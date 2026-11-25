// Read-only checks that QoreChain Diana still behaves the way QoreSplit relies on.
// Needs no keys and no funds: every check is an eth_call or a public REST read.
//
//   npm run check:diana
//
// 1. pqcVerify accepts a real ML-DSA-87 signature over QoreSplit's exact terms and
//    withdrawal bytes, and refuses a tampered message.
// 2. QoreSplit's bytecode deploys on Diana's EVM (inside a call), and its sign path
//    reaches the real key registry and verifier with the expected errors.
// 3. The Cross-VM bridge writes to the pinned receipt book and replies in the format
//    the contract and app parse, and Native REST returns receipts and windows as expected.
import { readFile } from 'node:fs/promises';
import { generatePqcKeypair, pqcSign } from '@qorechain/sdk';
import solc from 'solc';
import {
  createPublicClient, decodeAbiParameters, decodeErrorResult, defineChain, encodeFunctionData, hexToBytes, hexToString,
  http, toHex,
} from 'viem';
import { NATIVE_REST, RECEIPTS } from '../server/native.mjs';
import { termsMessage, withdrawalMessage } from '../src/protocol.js';

const RPC = process.env.QORE_EVM_RPC?.trim() || 'https://evm-testnet.qore.host';
const chain = defineChain({
  id: 9800, name: 'QoreChain Diana', nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const client = createPublicClient({ chain, transport: http(RPC, { timeout: 60_000 }) });
const { abi } = JSON.parse(await readFile(new URL('../artifacts/QoreSplit.json', import.meta.url)));
const verifyAbi = [{
  type: 'function', name: 'pqcVerify', stateMutability: 'view',
  inputs: [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }], outputs: [{ type: 'bool' }],
}];
let failures = 0;
function check(label, ok, detail = '') {
  console.log((ok ? '  ok    ' : '  FAIL  ') + label + (detail ? ' · ' + detail : ''));
  if (!ok) failures += 1;
}
async function rest(path) {
  const response = await fetch(NATIVE_REST + path, { signal: AbortSignal.timeout(20_000) });
  return { status: response.status, body: response.ok ? await response.json() : undefined };
}

console.log('Diana EVM ' + RPC + ' · Native ' + NATIVE_REST);
check('chain ID is 9800', await client.getChainId() === 9800);

console.log('ML-DSA-87 verification (pqcVerify at 0x0a01)');
const keypair = generatePqcKeypair();
const pubkey = toHex(keypair.publicKey);
const someone = '0x2222222222222222222222222222222222222222';
const contract = '0x1111111111111111111111111111111111111111';
const verify = (signature, message) => client.readContract({
  address: '0x0000000000000000000000000000000000000a01', abi: verifyAbi, functionName: 'pqcVerify', args: [pubkey, signature, message],
});
const terms = termsMessage({ chainId: 9800, contract, id: 1n, signer: someone, hash: '0x' + 'ab'.repeat(32) });
const termsSignature = toHex(pqcSign(keypair.secretKey, hexToBytes(terms)));
check('accepts a signature over QoreSplit terms bytes', await verify(termsSignature, terms) === true);
check('refuses the same signature over changed bytes', await verify(termsSignature, terms.slice(0, -2) + '00') === false);
const withdrawal = withdrawalMessage({ chainId: 9800, contract, recipient: someone, to: someone, amount: 10n ** 18n, nonce: 0n });
check('accepts a signature over QoreSplit withdrawal bytes',
  await verify(toHex(pqcSign(keypair.secretKey, hexToBytes(withdrawal), { hedged: true })), withdrawal) === true);
const gas = await client.estimateGas({
  to: '0x0000000000000000000000000000000000000a01',
  data: encodeFunctionData({ abi: verifyAbi, functionName: 'pqcVerify', args: [pubkey, termsSignature, terms] }),
});
console.log('        one verification costs about ' + gas + ' gas, calldata included');

console.log('QoreSplit inside a call on Diana');
const recent = await (async () => {
  const latest = await client.getBlockNumber();
  for (let block = latest; block > latest - 2000n; block -= 1n) {
    const { transactions } = await client.getBlock({ blockNumber: block, includeTransactions: true });
    if (transactions.length) return transactions[0].from;
  }
})();
check('found a recent EVM sender (it has a registered key)', Boolean(recent), recent);
const harness = `
pragma solidity ^0.8.26;
import "QoreSplit.sol";
interface IBridge { function executeCrossVMCall(uint8, string calldata, bytes calldata) external returns (bytes memory); }
contract Harness {
    constructor(address registered) {
        QoreSplit split = new QoreSplit();
        address[] memory recipients = new address[](2);
        recipients[0] = registered;
        recipients[1] = address(0xBEEF);
        uint16[] memory shares = new uint16[](2);
        shares[0] = 5000;
        shares[1] = 5000;
        uint256 id = split.propose("Diana check", 1 ether, recipients, shares, 0);
        bytes memory registeredError;
        bytes memory unregisteredError;
        try split.sign(id, registered, new bytes(4627)) {} catch (bytes memory reason) { registeredError = reason; }
        try split.sign(id, address(0xBEEF), new bytes(4627)) {} catch (bytes memory reason) { unregisteredError = reason; }
        (bool bridged, bytes memory reply) = address(0x0901).call(abi.encodeCall(
            IBridge.executeCrossVMCall, (1, split.RECEIPTS(), bytes('{"record":{"note":"qoresplit:diana-check"}}'))));
        bytes memory out = abi.encode(address(split).code.length, registeredError, unregisteredError, bridged, reply);
        assembly { return(add(out, 32), mload(out)) }
    }
}`;
const compiled = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: {
    'Harness.sol': { content: harness },
    'QoreSplit.sol': { content: await readFile(new URL('../contracts/QoreSplit.sol', import.meta.url), 'utf8') },
  },
  settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'cancun', outputSelection: { '*': { '*': ['evm.bytecode.object'] } } },
})));
const compileErrors = (compiled.errors ?? []).filter(({ severity }) => severity === 'error');
if (compileErrors.length) throw new Error(compileErrors.map(({ formattedMessage }) => formattedMessage).join('\n'));
const { data } = await client.call({
  account: recent, gas: 30_000_000n,
  data: '0x' + compiled.contracts['Harness.sol'].Harness.evm.bytecode.object + recent.slice(2).toLowerCase().padStart(64, '0'),
});
const [size, registeredError, unregisteredError, bridged, reply] = decodeAbiParameters(
  [{ type: 'uint256' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'bool' }, { type: 'bytes' }], data,
);
const errorName = (bytes) => { try { return decodeErrorResult({ abi, data: bytes }).errorName; } catch { return bytes; } };
check('QoreSplit deploys', size > 0n, size + ' bytes of runtime code');
check('a junk signature for a registered account is refused by pqcVerify', errorName(registeredError) === 'BadPqcSignature', errorName(registeredError));
check('an account without a key is refused by the registry', errorName(unregisteredError) === 'PqcKeyNotRegistered', errorName(unregisteredError));
check('the bridge accepts a QoreSplit receipt note', bridged === true);
let receipt;
try { receipt = JSON.parse(hexToString(decodeAbiParameters([{ type: 'bytes' }], reply)[0])); } catch { /* checked below */ }
check('the bridge replies with an ABI-wrapped receipt longer than 64 bytes',
  (reply.length - 2) / 2 > 64 && Number.isSafeInteger(receipt?.id) && receipt?.note === 'qoresplit:diana-check', JSON.stringify(receipt));

console.log('Native REST');
const params = await rest('/qorechain/crossvm/v1/params');
const pinned = (params.body?.params ?? params.body)?.bridge_target_pins?.some(({ target, code_id }) =>
  target === 'cosmwasm:' + RECEIPTS && String(code_id) === '865');
check('the receipt book is pinned on the bridge allowlist (code 865)', Boolean(pinned));
if (receipt?.id > 1) {
  const query = encodeURIComponent(btoa(JSON.stringify({ receipt: { id: receipt.id - 1 } })));
  const stored = await rest('/cosmwasm/wasm/v1/contract/' + RECEIPTS + '/smart/' + query);
  const shape = stored.body?.data;
  check('receipts read back with id, sender, note and height',
    shape && Number.isSafeInteger(shape.id) && /^qor1/.test(shape.sender) && typeof shape.note === 'string' && Number(shape.height) > 0);
}
const { bech32 } = await import('@scure/base');
const window = await rest('/qorechain/pqc/v1/evm_window/' + bech32.encode('qor', bech32.toWords(hexToBytes(recent))));
check('EVM windows report live, targets and remaining value',
  window.status === 404 || (typeof window.body?.live === 'boolean' && Array.isArray(window.body?.allowed_targets)));

console.log(failures ? failures + ' check(s) failed.' : 'Diana matches what QoreSplit expects.');
process.exitCode = failures ? 1 : 0;
