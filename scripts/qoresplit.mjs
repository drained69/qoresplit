// QoreSplit post-quantum signing tool. Run with: npm run pq -- <command>
//
//   whoami                         your addresses and whether your ML-DSA-87 key matches the chain
//   show <id>                      an agreement's terms and who has signed
//   sign <id>                      accept agreement <id> with your ML-DSA-87 key
//   withdraw <QOR|all> [--to 0x…]  pay out your earnings with your ML-DSA-87 key
//   statement [0x…]                earnings, withdrawals and agreements of an address
//   attack [QOR]                   demo: your classical key alone tries to withdraw (simulated)
//
// Options: --out <file> saves a signed request for any wallet to submit in the app
// instead of sending it from this account. --yes skips the confirmation.
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, defineChain, formatEther,
  getAddress, http, isAddress, parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  Status, signedRequest, splitAmounts, termsHash, termsMessage, windowProblem, withdrawalMessage,
} from '../src/protocol.js';
import { forgerFor, loadSigner, registeredKey } from './pqc.mjs';

const RPC = process.env.QORE_EVM_RPC?.trim() || 'https://evm-testnet.qore.host';
const REST = process.env.QORE_REST_URL?.trim() || 'https://api-testnet.qore.host';
const chain = defineChain({
  id: 9800, name: 'QoreChain Diana', nativeCurrency: { name: 'Test QOR', symbol: 'QOR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const artifact = JSON.parse(await readFile(new URL('../artifacts/QoreSplit.json', import.meta.url)));
const { abi } = artifact;
const client = createPublicClient({ chain, transport: http(RPC, { timeout: 20_000 }) });
const qor = (value) => formatEther(value) + ' QOR';

const argv = process.argv.slice(2);
const flags = { yes: false };
const positional = [];
for (let i = 0; i < argv.length; ++i) {
  if (argv[i] === '--yes' || argv[i] === '-y') flags.yes = true;
  else if (argv[i] === '--out' || argv[i] === '--to') flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [command = 'help', ...args] = positional;

function explain(error) {
  if (error instanceof BaseError) {
    const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.data?.errorName ?? revert.reason ?? revert.shortMessage;
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}

async function deployment() {
  const configured = (process.env.QORESPLIT_ADDRESS ?? process.env.VITE_QORESPLIT_ADDRESS ?? '').trim();
  if (!isAddress(configured)) throw new Error('Set VITE_QORESPLIT_ADDRESS (or QORESPLIT_ADDRESS) in .env to the deployed contract.');
  const address = getAddress(configured);
  const [chainId, code] = await Promise.all([client.getChainId(), client.getCode({ address })]);
  if (chainId !== chain.id) throw new Error('The RPC at ' + RPC + ' is not Diana (chain 9800).');
  if (code?.toLowerCase() !== artifact.runtime.toLowerCase()) {
    throw new Error('The contract at ' + address + ' is not this QoreSplit build. Run npm run compile, or check the address.');
  }
  return address;
}

const readAt = (address) => (functionName, args = []) => client.readContract({ address, abi, functionName, args });

async function confirm(question) {
  if (flags.yes) return;
  if (!process.stdin.isTTY) throw new Error('Pass --yes to confirm when not running interactively.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question + ' [y/N] ');
  prompt.close();
  if (!/^y(es)?$/i.test(answer.trim())) throw new Error('Cancelled. Nothing was signed.');
}

async function requireMatchingKey(signer) {
  const onChain = await registeredKey(client, signer.address);
  if (!onChain.registered) throw new Error(signer.qorAddress + ' has no ML-DSA-87 key on chain. Register it with the QoreChain workshop tool first.');
  if (!onChain.proven) throw new Error('The key registered for ' + signer.qorAddress + ' has no proof of possession. Rotate or re-register it.');
  if (onChain.pubkey.toLowerCase() !== '0x' + Buffer.from(signer.publicKey).toString('hex')) {
    throw new Error('Your local ML-DSA-87 key differs from the key registered on chain. Check QORE_MNEMONIC or QORE_PQC_RECOVERY_CODE.');
  }
}

/** Stop early, with the reason, when the account's EVM window would refuse the transaction. */
async function requireWindow(signer, contract) {
  let response;
  try {
    response = await fetch(REST + '/qorechain/pqc/v1/evm_window/' + signer.qorAddress, { signal: AbortSignal.timeout(10_000) });
  } catch {
    return; // The send itself reports a refused window.
  }
  if (!response.ok && response.status !== 404) return;
  const body = response.ok ? await response.json() : { found: false };
  const problem = windowProblem(body.window ?? body.evm_window ?? body, { contract });
  if (problem) {
    throw new Error(signer.qorAddress + ' ' + problem + '. Open one that allows ' + contract +
      ', or add --out request.json and submit it from any wallet in the app.');
  }
}

async function submit(contract, signer, functionName, functionArgs, request) {
  if (flags.out) {
    await writeFile(flags.out, signedRequest({ chainId: chain.id, contract, ...request }) + '\n', { mode: 0o600 });
    console.log('Saved the signed request to ' + flags.out + '. Paste it into "Submit a signature" in the app; any wallet can send it.');
    return;
  }
  await requireWindow(signer, contract);
  const account = privateKeyToAccount(signer.privateKey);
  const { request: prepared } = await client.simulateContract({ account, address: contract, abi, functionName, args: functionArgs });
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const hash = await wallet.writeContract(prepared);
  console.log('Submitted ' + hash);
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== 'success') throw new Error('The transaction reverted: https://explore.qore.network/tx/' + hash);
  console.log('Confirmed in block ' + receipt.blockNumber + ' · https://explore.qore.network/tx/' + hash);
  return receipt;
}

function printAgreement(id, agreement) {
  const credits = splitAmounts(agreement.price, agreement.shares);
  console.log('Agreement #' + id + ' · ' + Status[agreement.status]);
  console.log('  title   ' + JSON.stringify(agreement.title));
  console.log('  price   ' + qor(agreement.price) + ' per payment');
  agreement.recipients.forEach((recipient, i) => {
    console.log('  ' + recipient + '  ' + (Number(agreement.shares[i]) / 100) + '%  ' + qor(credits[i]));
  });
  if (agreement.previous) console.log('  replaces agreement #' + agreement.previous + ' (its collaborators must sign too)');
  if (agreement.successor) console.log('  replaced by agreement #' + agreement.successor);
  console.log('  signatures');
  agreement.signers.forEach((signer, i) => {
    console.log('    ' + ((agreement.signedMask >> i) & 1 ? '✓ ' : '· ') + signer);
  });
}

function parseId(value) {
  if (!/^[1-9]\d{0,30}$/.test(value ?? '')) throw new Error('Give the agreement number, for example: npm run pq -- sign 3');
  return BigInt(value);
}

const commands = {
  async help() {
    console.log(`Usage: npm run pq -- <command>

  whoami                         your addresses and whether your ML-DSA-87 key matches the chain
  show <id>                      an agreement's terms and who has signed
  sign <id>                      accept agreement <id> with your ML-DSA-87 key
  withdraw <QOR|all> [--to 0x…]  pay out your earnings with your ML-DSA-87 key
  statement [0x…]                earnings, withdrawals and agreements of an address
  attack [QOR]                   demo: your classical key alone tries to withdraw (simulated)

Options: --out <file> saves a signed request for any wallet to submit; --yes skips the confirmation.
Keys come from .env: QORE_MNEMONIC (and QORE_ACCOUNT_INDEX), or PRIVATE_KEY and QORE_PQC_RECOVERY_CODE.`);
  },

  async whoami() {
    const signer = await loadSigner();
    console.log('EVM address   ' + signer.address);
    console.log('QoreChain     ' + signer.qorAddress);
    try {
      await requireMatchingKey(signer);
      console.log('ML-DSA-87     registered, proven, and matches your local key');
    } catch (error) {
      console.log('ML-DSA-87     ' + explain(error));
      process.exitCode = 1;
    }
  },

  async show(id) {
    const contract = await deployment();
    const agreementId = parseId(id);
    printAgreement(agreementId, await readAt(contract)('getAgreement', [agreementId]));
  },

  async sign(id) {
    const contract = await deployment();
    const read = readAt(contract);
    const agreementId = parseId(id);
    const signer = await loadSigner();
    const agreement = await read('getAgreement', [agreementId]);
    printAgreement(agreementId, agreement);
    if (Status[agreement.status] !== 'Pending') throw new Error('Agreement #' + agreementId + ' is not waiting for signatures.');
    const index = agreement.signers.findIndex((value) => value.toLowerCase() === signer.address.toLowerCase());
    if (index < 0) throw new Error(signer.address + ' is not a signer of agreement #' + agreementId + '.');
    if ((agreement.signedMask >> index) & 1) throw new Error('You already signed agreement #' + agreementId + '.');

    // Sign only bytes rebuilt here from the terms shown above.
    const hash = termsHash({ ...agreement });
    if (hash !== agreement.termsHash) throw new Error('The contract returned terms that do not match their hash. Nothing was signed.');
    const message = termsMessage({ chainId: chain.id, contract, id: agreementId, signer: signer.address, hash });
    if (message !== await read('termsMessage', [agreementId, signer.address])) {
      throw new Error('The contract asks for different bytes than these terms. Nothing was signed.');
    }
    await requireMatchingKey(signer);
    await confirm('Sign these terms with your ML-DSA-87 key?');
    const signature = signer.sign(message);
    console.log('Signed: ML-DSA-87 signature of ' + (signature.length - 2) / 2 + ' bytes.');
    const receipt = await submit(contract, signer, 'sign', [agreementId, signer.address, signature],
      { action: 'sign', id: agreementId, signer: signer.address, signature });
    if (receipt) {
      const after = await read('getAgreement', [agreementId]);
      console.log(Status[after.status] === 'Active'
        ? 'Every collaborator has signed. Agreement #' + agreementId + ' is live and its Native receipt is written.'
        : 'Waiting for the other signatures.');
    }
  },

  async withdraw(amountText) {
    const contract = await deployment();
    const read = readAt(contract);
    const signer = await loadSigner();
    const available = await read('claimable', [signer.address]);
    if (available === 0n) throw new Error('Nothing to withdraw for ' + signer.address + '.');
    let amount;
    if (amountText === 'all') amount = available;
    else if (/^\d+(\.\d{1,18})?$/.test(amountText ?? '')) amount = parseEther(amountText);
    else throw new Error('Give an amount in QOR or "all", for example: npm run pq -- withdraw all');
    if (amount === 0n || amount > available) throw new Error('You can withdraw up to ' + qor(available) + '.');
    if (flags.to !== undefined && !isAddress(flags.to)) throw new Error('--to must be a 0x address.');
    const to = getAddress(flags.to ?? signer.address);
    const nonce = await read('nonces', [signer.address]);
    const message = withdrawalMessage({ chainId: chain.id, contract, recipient: signer.address, to, amount, nonce });
    if (message !== await read('withdrawalMessage', [signer.address, to, amount, nonce])) {
      throw new Error('The contract asks for different withdrawal bytes. Nothing was signed.');
    }
    await requireMatchingKey(signer);
    console.log('Withdraw ' + qor(amount) + ' of ' + qor(available) + ' to ' + to + ' (withdrawal #' + nonce + ')');
    await confirm('Sign this withdrawal with your ML-DSA-87 key?');
    const signature = signer.sign(message);
    await submit(contract, signer, 'withdraw', [signer.address, to, amount, signature],
      { action: 'withdraw', recipient: signer.address, to, amount, signature });
  },

  async statement(who) {
    const contract = await deployment();
    const read = readAt(contract);
    let address;
    if (who) {
      if (!isAddress(who)) throw new Error('Give a 0x address.');
      address = getAddress(who);
    } else address = (await loadSigner()).address;
    const [earned, withdrawn, available, ids] = await Promise.all([
      read('earned', [address]), read('withdrawn', [address]), read('claimable', [address]), read('agreementsOf', [address]),
    ]);
    console.log('Statement for ' + address);
    for (const id of ids) {
      const agreement = await read('getAgreement', [id]);
      const index = agreement.recipients.findIndex((value) => value === address);
      const credit = splitAmounts(agreement.price, agreement.shares)[index];
      console.log('  #' + id + ' ' + JSON.stringify(agreement.title) + ' · ' + Status[agreement.status] + ' · ' +
        (Number(agreement.shares[index]) / 100) + '% · ' + agreement.sales + (agreement.sales === 1n ? ' sale · ' : ' sales · ') +
        qor(credit * agreement.sales));
    }
    console.log('  earned     ' + qor(earned));
    console.log('  withdrawn  ' + qor(withdrawn));
    console.log('  available  ' + qor(available));
  },

  async attack(amountText) {
    const contract = await deployment();
    const read = readAt(contract);
    const signer = await loadSigner();
    const available = await read('claimable', [signer.address]);
    if (!amountText && available === 0n) {
      console.log('You have no earnings yet, so the contract would refuse for that reason first. Run this after a sale.');
      return;
    }
    const amount = amountText ? parseEther(amountText) : available;
    if (amount > available) throw new Error('Use an amount up to your balance of ' + qor(available) + ', so the signature check is what refuses it.');
    const thief = '0x000000000000000000000000000000000000dEaD';
    const nonce = await read('nonces', [signer.address]);
    const message = await read('withdrawalMessage', [signer.address, thief, amount, nonce]);
    const forged = forgerFor(signer.address).sign(message);
    console.log('An attacker who holds your classical key, but not your ML-DSA-87 key, tries to send');
    console.log(qor(amount) + ' of your earnings to ' + thief + ' with a forged post-quantum signature.');
    try {
      await client.simulateContract({
        account: privateKeyToAccount(signer.privateKey), address: contract, abi,
        functionName: 'withdraw', args: [signer.address, thief, amount, forged],
      });
      console.log('Unexpected: the simulation passed.');
      process.exitCode = 1;
    } catch (error) {
      console.log('BLOCKED by QoreSplit: ' + explain(error) + '. Nothing was sent.');
    }
  },
};

const run = commands[command];
if (!run) {
  console.error('Unknown command "' + command + '". Run: npm run pq -- help');
  process.exit(1);
}
run(...args).catch((error) => {
  console.error(explain(error));
  process.exitCode = 1;
});
