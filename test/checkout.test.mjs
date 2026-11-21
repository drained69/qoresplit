import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import solc from 'solc';
import {
  createPublicClient, createWalletClient, decodeAbiParameters, decodeEventLog, encodeAbiParameters,
  getAddress, hexToString, http, keccak256, parseEther, stringToHex,
} from 'viem';
import { foundry } from 'viem/chains';

const bridge = '0x0000000000000000000000000000000000000901';
const receipts = 'qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8';
const artifact = JSON.parse(await readFile(new URL('../artifacts/QoreSplit.json', import.meta.url)));
const { abi, bytecode } = artifact;

const mockSource = `
pragma solidity ^0.8.26;
contract BridgeMock {
    bool public rejects;
    bool public emptyReply;
    uint256 public records;
    event NativeRecord(bytes payload);
    function setRejects(bool next) external { rejects = next; }
    function setEmptyReply(bool next) external { emptyReply = next; }
    function executeCrossVMCall(uint8 vm, string calldata target, bytes calldata payload)
        external returns (bytes memory)
    {
        require(vm == 1 && keccak256(bytes(target)) == keccak256(bytes("${receipts}")));
        ++records;
        emit NativeRecord(payload);
        require(!rejects, "Native receipt refused");
        if (emptyReply) return bytes("");
        return bytes('{"id":1}');
    }
}
contract RejectingRecipient {
    function withdrawFrom(address checkout) external {
        (bool success, ) = checkout.call(abi.encodeWithSignature("withdraw()"));
        require(success);
    }
    receive() external payable { revert("no"); }
}
`;
const mockArtifacts = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'Mock.sol': { content: mockSource } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } },
}))).contracts['Mock.sol'];

let anvil;
let publicClient;
let wallet;
let accounts;
let checkout;
let rpc;

function logsOf(receipt, eventAbi, eventAddress) {
  return receipt.logs.filter((log) => log.address.toLowerCase() === eventAddress.toLowerCase())
    .map((log) => decodeEventLog({ abi: eventAbi, ...log }));
}

function read(functionName, args = []) {
  return publicClient.readContract({ address: checkout, abi, functionName, args });
}

async function send(account, functionName, args, value) {
  const hash = await wallet.writeContract({ address: checkout, abi, account, functionName, args, value, gas: 1_600_000n });
  return publicClient.waitForTransactionReceipt({ hash });
}

async function createLink(recipients, shares, price = parseEther('12.000001')) {
  const receipt = await send(accounts[0], 'createLink', ['Workshop', price, recipients, shares]);
  assert.equal(receipt.status, 'success');
  return logsOf(receipt, abi, checkout)[0].args.linkId;
}

async function mockWrite(functionName, args) {
  const hash = await wallet.writeContract({
    account: accounts[0], address: bridge, abi: mockArtifacts.BridgeMock.abi, functionName, args,
  });
  return publicClient.waitForTransactionReceipt({ hash });
}

before(async () => {
  anvil = spawn('anvil', ['--port', '0', '--chain-id', '31337'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Anvil did not start: ' + output)), 7000);
    const stop = (action, value) => { clearTimeout(timer); action(value); };
    anvil.once('error', (error) => stop(reject, error));
    anvil.once('exit', (code) => stop(reject, new Error('Anvil exited: ' + code + '\n' + output)));
    for (const stream of [anvil.stdout, anvil.stderr]) stream.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/Listening on 127\.0\.0\.1:(\d+)/);
      if (match) stop(resolve, match[1]);
    });
  });
  const endpoint = 'http://127.0.0.1:' + port;
  rpc = http(endpoint);
  publicClient = createPublicClient({ chain: foundry, transport: rpc });
  wallet = createWalletClient({ chain: foundry, transport: rpc });
  accounts = (await wallet.getAddresses()).map((account) => getAddress(account));
  const deploy = await wallet.deployContract({ account: accounts[0], abi, bytecode });
  checkout = (await publicClient.waitForTransactionReceipt({ hash: deploy })).contractAddress;
  await publicClient.request({
    method: 'anvil_setCode', params: [bridge, '0x' + mockArtifacts.BridgeMock.evm.deployedBytecode.object],
  });
});

after(async () => {
  if (anvil && anvil.exitCode === null && anvil.pid) {
    anvil.kill();
    await once(anvil, 'exit');
  }
});

test('locks the split, commits exact credits and supports independent withdrawals', async () => {
  const [, alice, bob, carol, payer] = accounts;
  const price = parseEther('12.000001');
  const id = await createLink([alice, bob, carol], [5000, 3000, 2000], price);
  const link = await read('getLink', [id]);
  assert.equal(link.price, price);
  assert.deepEqual(link.recipients, [alice, bob, carol]);
  const quote = ['6', '3.6', '2.400001'].map((amount) => parseEther(amount));
  assert.deepEqual(await read('quote', [id]), quote);
  const ref = keccak256(stringToHex('checkout-1'));
  const receipt = await send(payer, 'checkout', [id, ref], price);
  assert.equal(receipt.status, 'success');
  const [{ args }] = logsOf(receipt, abi, checkout);
  assert.deepEqual(args.credits, quote);
  assert.equal(args.total, price);
  assert.deepEqual(JSON.parse(hexToString(decodeAbiParameters([{ type: 'bytes' }], args.nativeReply)[0])), { id: 1 });

  const commitmentTypes = ['bytes32', 'uint256', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'address[]', 'uint256[]'];
  const computed = keccak256(encodeAbiParameters(commitmentTypes.map((type) => ({ type })), [
    keccak256(stringToHex('qoresplit.checkout.v1')), 31337n, checkout, id, payer, args.paymentId,
    price, [alice, bob, carol], quote,
  ]));
  assert.equal(args.commitment, computed);
  const [{ args: record }] = logsOf(receipt, mockArtifacts.BridgeMock.abi, bridge);
  assert.deepEqual(JSON.parse(hexToString(record.payload)), { record: { note: 'qoresplit:' + computed.slice(2) } });
  assert.equal(await publicClient.getBalance({ address: checkout }), price);
  assert.equal((await send(alice, 'withdraw', [])).status, 'success');
  assert.equal(await read('claimable', [alice]), 0n);
  assert.equal(await read('claimable', [bob]), quote[1]);
  assert.equal((await send(alice, 'withdraw', [])).status, 'reverted');
  assert.equal((await send(bob, 'withdraw', [])).status, 'success');
  assert.equal((await send(carol, 'withdraw', [])).status, 'success');
  assert.equal(await publicClient.getBalance({ address: checkout }), 0n);
});

test('rejects wrong amounts and a repeated payment reference', async () => {
  const [, alice, bob, , payer] = accounts;
  const price = parseEther('2');
  const id = await createLink([alice, bob], [5000, 5000], price);
  const ref = keccak256(stringToHex('checkout-2'));
  const before = await read('claimable', [alice]);
  assert.equal((await send(payer, 'checkout', [id, ref], price - 1n)).status, 'reverted');
  assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'success');
  assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'reverted');
  assert.equal(await read('claimable', [alice]), before + parseEther('1'));
});

test('rolls back credits and permits retry if Native rejects or the bridge is absent', async () => {
  const [, alice, bob, , payer] = accounts;
  const price = parseEther('2');
  const id = await createLink([alice, bob], [5000, 5000], price);
  const ref = keccak256(stringToHex('atomicity'));
  const before = await read('claimable', [alice]);
  const contractBalance = await publicClient.getBalance({ address: checkout });
  const records = () => publicClient.readContract({
    address: bridge, abi: mockArtifacts.BridgeMock.abi, functionName: 'records',
  });
  const recordsBefore = await records();
  await mockWrite('setRejects', [true]);
  try {
    const rejected = await send(payer, 'checkout', [id, ref], price);
    assert.equal(rejected.status, 'reverted');
    assert.deepEqual(rejected.logs, []);
    assert.equal(await read('claimable', [alice]), before);
    assert.equal(await publicClient.getBalance({ address: checkout }), contractBalance);
    assert.equal(await records(), recordsBefore);
  } finally {
    await mockWrite('setRejects', [false]);
  }
  await mockWrite('setEmptyReply', [true]);
  try {
    assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'reverted');
    assert.equal(await read('claimable', [alice]), before);
    assert.equal(await records(), recordsBefore);
  } finally {
    await mockWrite('setEmptyReply', [false]);
  }
  await publicClient.request({ method: 'anvil_setCode', params: [bridge, '0x'] });
  try {
    assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'reverted');
    assert.equal(await read('claimable', [alice]), before);
  } finally {
    await publicClient.request({
      method: 'anvil_setCode', params: [bridge, '0x' + mockArtifacts.BridgeMock.evm.deployedBytecode.object],
    });
  }
  assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'success');
  assert.equal(await read('claimable', [alice]), before + parseEther('1'));
});

test('rejects invalid splits and isolates a recipient whose withdrawal fails', async () => {
  const [, alice, , , payer] = accounts;
  const price = parseEther('2');
  const linkArgs = ['Workshop', price, [alice, alice], [5000, 5000]];
  assert.equal((await send(accounts[0], 'createLink', linkArgs)).status, 'reverted');
  const mock = mockArtifacts.RejectingRecipient;
  const hash = await wallet.deployContract({
    account: accounts[0], abi: mock.abi, bytecode: '0x' + mock.evm.bytecode.object,
  });
  const { contractAddress: rejector } = await publicClient.waitForTransactionReceipt({ hash });
  const id = await createLink([alice, rejector], [5000, 5000], price);
  const ref = keccak256(stringToHex('independent-withdrawals'));
  assert.equal((await send(payer, 'checkout', [id, ref], price)).status, 'success');
  const failedHash = await wallet.writeContract({
    address: rejector, account: accounts[0], abi: mock.abi, functionName: 'withdrawFrom', args: [checkout], gas: 150_000n,
  });
  assert.equal((await publicClient.waitForTransactionReceipt({ hash: failedHash })).status, 'reverted');
  assert.equal(await read('claimable', [rejector]), parseEther('1'));
  assert.equal((await send(alice, 'withdraw', [])).status, 'success');
  assert.equal(await read('claimable', [alice]), 0n);
  assert.equal(await read('claimable', [rejector]), parseEther('1'));
});
