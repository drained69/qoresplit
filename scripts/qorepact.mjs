// QorePact signing tool for people (agents use sdk/qorepact.mjs directly).
// Run with: npm run pq -- <command>. Keys come from .env (see .env.example).
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { generatePqcKeypair, pqcSign } from '@qorechain/sdk';
import { getAddress, hexToBytes, isAddress, parseEther, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deliverableHash } from '../src/protocol.js';
import { QorePact, abi, explain, qor } from '../sdk/qorepact.mjs';

const HELP = `Usage: npm run pq -- <command> [options]

Look
  whoami                              your addresses, and whether your ML-DSA-87 key matches the chain
  show <id>                           a pact's terms, signatures and (for services) deliveries
  statement [0x…]                     earnings, withdrawals and pacts of an address

Agree
  sign <id>                           accept pact <id> with your ML-DSA-87 key

Service pacts
  fund <id>                           lock the pact's budget (sends QOR)
  deliver <id> (--file f | --text t)  deliver one unit; only its hash goes on chain
  accept <id> <unit>                  as the client, accept a delivery (pays one unit)
  reject <id> <unit>                  as the client, reject a delivery within the review period
  release <id> <unit>                 pay a delivery the client ignored past its review period
  refund <id>                         after the deadline, return the unused budget

Money
  withdraw <QOR|all> [--to 0x…] [--for 0x…]   pay out earnings (--for: an agent you own that you switched off)
  attack [QOR]                        demo: your classical key alone tries to withdraw (simulated)

Agents
  approve-owner --owner 0x… --max-per-pact QOR --max-total QOR --days N   as the agent: agree to an owner's limits
  set-limits --agent 0x… --max-per-pact QOR --max-total QOR --expiry T --agent-signature file   as the owner
  revoke <agent>                      as the owner: switch the agent off

Options: --out <file> saves a signed request any wallet can submit in the app instead of sending it.
--yes skips the confirmation.`;

const flags = { yes: false };
const positional = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; ++i) {
  if (argv[i] === '--yes' || argv[i] === '-y') flags.yes = true;
  else if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [command = 'help', ...args] = positional;

async function confirm(question) {
  if (flags.yes) return;
  if (!process.stdin.isTTY) throw new Error('Pass --yes to confirm when not running interactively.');
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(question + ' [y/N] ');
  prompt.close();
  if (!/^y(es)?$/i.test(answer.trim())) throw new Error('Cancelled. Nothing was signed.');
}

const connect = (signer = true) => QorePact.connect({ signer });
const id = (value) => {
  if (!/^[1-9]\d{0,30}$/.test(value ?? '')) throw new Error('Give the pact number, for example: npm run pq -- sign 3');
  return BigInt(value);
};
const unitOf = (value) => {
  if (!/^\d{1,9}$/.test(value ?? '')) throw new Error('Give the delivery number, for example: npm run pq -- accept 3 0');
  return BigInt(value);
};
const addressFlag = (name) => {
  if (!isAddress(flags[name] ?? '')) throw new Error('--' + name + ' must be a 0x address.');
  return getAddress(flags[name]);
};
const amountFlag = (name) => {
  if (!/^\d+(\.\d{1,6})?$/.test(flags[name] ?? '')) throw new Error('--' + name + ' must be an amount in QOR.');
  return parseEther(flags[name]);
};

/** Send, or save a signed request with --out. */
async function finish(pact, label, run) {
  if (flags.out) {
    const request = await run({ relay: true });
    await writeFile(flags.out, request + '\n', { mode: 0o600 });
    console.log('Saved the signed request to ' + flags.out + '. Paste it into "Submit a signature" in the app; any wallet can send it.');
    return;
  }
  const result = await run({});
  const receipt = result?.receipt ?? result;
  console.log(label + ' · block ' + receipt.blockNumber + ' · https://explore.qore.network/tx/' + receipt.transactionHash);
  return result;
}

function printPact(pact) {
  const service = pact.kindName === 'Service';
  console.log((service ? 'Service pact #' : 'Revenue share #') + pact.id + ' · ' + pact.state + ' · ' + JSON.stringify(pact.title));
  if (service) {
    console.log('  client   ' + pact.client);
    console.log('  pays     ' + qor(pact.price) + ' per unit, up to ' + pact.maxUnits + ' units (budget ' + qor(pact.budget) + ')');
    console.log('  until    ' + new Date(Number(pact.deadline) * 1000).toISOString() + ' · review period ' + pact.reviewPeriod + ' s');
    console.log('  budget   ' + (pact.funded ? 'locked' : 'not funded yet') + ' · ' + pact.sales + ' paid, ' + pact.pendingUnits + ' pending');
  } else {
    console.log('  price    ' + qor(pact.price) + ' per payment · ' + pact.sales + ' payments');
  }
  pact.recipients.forEach((recipient, i) => {
    console.log('  ' + (service ? 'provider ' : 'share    ') + recipient + '  ' + (Number(pact.shares[i]) / 100) + '%  ' + qor(pact.credits[i]));
  });
  if (pact.previous) console.log('  replaces #' + pact.previous + ' (its collaborators must sign too)');
  if (pact.successor) console.log('  replaced by #' + pact.successor);
  console.log('  signatures');
  pact.signers.forEach((signer, i) => console.log('    ' + (pact.signed[i] ? '✓ ' : '· ') + signer));
}

const commands = {
  async help() { console.log(HELP); },

  async whoami() {
    const pact = await QorePact.connect({ verifyCode: false });
    console.log('EVM address   ' + pact.address);
    console.log('QoreChain     ' + pact.signer.qorAddress);
    const key = await pact.keyCheck();
    console.log('ML-DSA-87     ' + (key.ok ? 'registered, proven, and matches your local key' : key.reason));
    if (!key.ok) process.exitCode = 1;
  },

  async show(value) {
    const pact = await connect(false);
    const agreement = await pact.agreement(id(value));
    printPact(agreement);
    if (agreement.kindName === 'Service') {
      for (const delivery of await pact.deliveries(agreement.id)) {
        console.log('  delivery ' + delivery.unit + ' · ' + delivery.state + ' · ' + delivery.provider + ' · ' + delivery.deliverable);
      }
    }
  },

  async statement(who) {
    const pact = await connect(!who);
    const account = who ? (isAddress(who) ? getAddress(who) : (() => { throw new Error('Give a 0x address.'); })()) : pact.address;
    const statement = await pact.statement(account);
    console.log('Statement for ' + account);
    for (const row of statement.agreements) {
      const sales = row.agreement.sales;
      console.log('  #' + row.id + ' ' + JSON.stringify(row.agreement.title) + ' · ' + row.agreement.state + ' · ' +
        (Number(row.share) / 100) + '% · ' + sales + (row.agreement.kindName === 'Service' ? (sales === 1n ? ' unit · ' : ' units · ') : (sales === 1n ? ' sale · ' : ' sales · ')) +
        qor(row.total));
    }
    if (statement.clientOf.length) console.log('  client of pacts ' + statement.clientOf.map((value) => '#' + value).join(', '));
    const mandate = await pact.mandate(account);
    if (mandate) {
      console.log('  owner      ' + mandate.owner + (mandate.revoked ? ' · switched off' : ''));
      console.log('  limits     ' + qor(mandate.maxPerPact) + ' per pact, ' + qor(mandate.committed) + ' of ' + qor(mandate.maxTotal) + ' committed');
    }
    console.log('  earned     ' + qor(statement.earned));
    console.log('  withdrawn  ' + qor(statement.withdrawn));
    console.log('  available  ' + qor(statement.available));
  },

  async sign(value) {
    const pact = await connect();
    const agreement = await pact.agreement(id(value));
    printPact(agreement);
    await confirm('Sign these terms with your ML-DSA-87 key?');
    const receipt = await finish(pact, 'Signed', (options) => pact.sign(agreement.id, options));
    if (receipt) {
      const after = await pact.agreement(agreement.id);
      console.log(after.state === 'Active'
        ? 'Every party has signed. Pact #' + agreement.id + ' is live and its Native receipt is written.'
        : 'Waiting for the other signatures.');
    }
  },

  async fund(value) {
    const pact = await connect();
    const agreement = await pact.agreement(id(value));
    printPact(agreement);
    await confirm('Lock ' + qor(agreement.budget) + ' in pact #' + agreement.id + '?');
    await finish(pact, 'Funded', () => pact.fund(agreement.id));
  },

  async deliver(value) {
    const pact = await connect();
    const agreement = await pact.agreement(id(value));
    let content;
    if (flags.file) content = new Uint8Array(await readFile(flags.file));
    else if (flags.text !== undefined) content = flags.text;
    else throw new Error('Give the work with --file <path> or --text "…". Only its hash goes on chain.');
    console.log('Deliver to pact #' + agreement.id + ' (' + JSON.stringify(agreement.title) + '): ' + deliverableHash(content));
    await confirm('Sign this delivery with your ML-DSA-87 key?');
    const result = await finish(pact, 'Delivered', (options) => pact.deliver(agreement.id, content, options));
    if (result?.unit !== undefined) console.log('This is delivery ' + result.unit + '. The client has ' + agreement.reviewPeriod + ' s to review it.');
  },

  async accept(value, unit) { await review(value, unit, true); },
  async reject(value, unit) { await review(value, unit, false); },

  async release(value, unit) {
    const pact = await connect();
    await finish(pact, 'Released', () => pact.release(id(value), unitOf(unit)));
  },

  async refund(value) {
    const pact = await connect();
    const amount = await pact.read('refundable', [id(value)]);
    console.log('Unused budget: ' + qor(amount));
    await finish(pact, 'Refunded', () => pact.refund(id(value)));
  },

  async withdraw(amountText) {
    const pact = await connect();
    const recipient = flags.for ? addressFlag('for') : pact.address;
    const available = await pact.read('claimable', [recipient]);
    if (amountText !== 'all' && !/^\d+(\.\d{1,18})?$/.test(amountText ?? '')) {
      throw new Error('Give an amount in QOR or "all", for example: npm run pq -- withdraw all');
    }
    const to = flags.to ? addressFlag('to') : pact.address;
    console.log('Withdraw ' + (amountText === 'all' ? qor(available) : amountText + ' QOR') + ' of ' + qor(available) +
      ' earned by ' + recipient + ' to ' + to);
    await confirm('Sign this withdrawal with your ML-DSA-87 key?');
    await finish(pact, 'Withdrawn', (options) => pact.withdraw(amountText, { to, recipient, ...options }));
  },

  async attack(amountText) {
    const pact = await connect();
    const available = await pact.read('claimable', [pact.address]);
    if (!amountText && available === 0n) {
      console.log('You have no earnings yet, so the contract would refuse for that reason first. Run this after a payment.');
      return;
    }
    const amount = amountText ? parseEther(amountText) : available;
    if (amount > available) throw new Error('Use an amount up to your balance of ' + qor(available) + ', so the signature check is what refuses it.');
    const thief = '0x000000000000000000000000000000000000dEaD';
    const nonce = await pact.read('nonces', [pact.address]);
    const message = await pact.read('withdrawalMessage', [pact.address, thief, amount, nonce]);
    const forged = toHex(pqcSign(generatePqcKeypair().secretKey, hexToBytes(message)));
    console.log('An attacker who holds your classical key, but not your ML-DSA-87 key, tries to send');
    console.log(qor(amount) + ' of your earnings to ' + thief + ' with a forged post-quantum signature.');
    try {
      await pact.client.simulateContract({
        account: privateKeyToAccount(pact.signer.privateKey), address: pact.contract, abi,
        functionName: 'withdraw', args: [pact.address, thief, amount, forged],
      });
      console.log('Unexpected: the simulation passed.');
      process.exitCode = 1;
    } catch (error) {
      console.log('BLOCKED by QorePact: ' + explain(error) + '. Nothing was sent.');
    }
  },

  async 'approve-owner'() {
    const pact = await connect();
    const owner = addressFlag('owner');
    const days = Number(flags.days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('--days must be a whole number of days.');
    const expiry = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
    const limits = { owner, maxPerPact: amountFlag('max-per-pact'), maxTotal: amountFlag('max-total'), expiry };
    console.log('Agent ' + pact.address + ' agrees that ' + owner + ' may switch it off, and that it commits at most ' +
      qor(limits.maxPerPact) + ' per pact and ' + qor(limits.maxTotal) + ' in total until ' + new Date(Number(expiry) * 1000).toISOString() + '.');
    await confirm('Sign with the agent’s ML-DSA-87 key?');
    const signature = await pact.approveOwner(limits);
    const file = flags.out ?? 'agent-approval.json';
    await writeFile(file, JSON.stringify({ agent: pact.address, ...limits, maxPerPact: String(limits.maxPerPact), maxTotal: String(limits.maxTotal), expiry: String(expiry), agentSignature: signature }, null, 2) + '\n', { mode: 0o600 });
    console.log('Saved the agent’s approval to ' + file + '. The owner runs: npm run pq -- set-limits --approval ' + file);
  },

  async 'set-limits'() {
    const pact = await connect();
    if (!flags.approval) throw new Error('Give the agent’s approval file: --approval agent-approval.json');
    const approval = JSON.parse(await readFile(flags.approval, 'utf8'));
    if (getAddress(approval.owner) !== pact.address) throw new Error('This approval names ' + approval.owner + ' as owner, not you.');
    console.log('Set limits for agent ' + approval.agent + ': ' + qor(BigInt(approval.maxPerPact)) + ' per pact, ' +
      qor(BigInt(approval.maxTotal)) + ' in total, until ' + new Date(Number(approval.expiry) * 1000).toISOString() + '.');
    await confirm('Sign as the owner with your ML-DSA-87 key?');
    await finish(pact, 'Limits set', (options) => pact.setMandate({
      agent: getAddress(approval.agent), maxPerPact: BigInt(approval.maxPerPact), maxTotal: BigInt(approval.maxTotal),
      expiry: BigInt(approval.expiry), agentSignature: approval.agentSignature,
    }, options));
  },

  async revoke(agent) {
    const pact = await connect();
    if (!isAddress(agent ?? '')) throw new Error('Give the agent’s 0x address.');
    console.log('Switch off agent ' + getAddress(agent) + '. It will not be able to sign anything in QorePact, and only you can move its earnings.');
    await confirm('Sign as the owner with your ML-DSA-87 key?');
    await finish(pact, 'Agent switched off', (options) => pact.revoke(getAddress(agent), options));
  },
};

async function review(value, unit, accepted) {
  const pact = await connect();
  const pactId = id(value);
  const unitId = unitOf(unit);
  const delivery = await pact.read('getDelivery', [pactId, unitId]);
  console.log((accepted ? 'Accept' : 'Reject') + ' delivery ' + unitId + ' of pact #' + pactId + ' from ' + delivery.provider + ': ' + delivery.deliverable);
  await confirm('Sign with your ML-DSA-87 key?');
  await finish(pact, accepted ? 'Accepted and paid' : 'Rejected', (options) => (accepted ? pact.accept : pact.reject).call(pact, pactId, unitId, options));
}

const run = commands[command];
if (!run) {
  console.error('Unknown command "' + command + '". Run: npm run pq -- help');
  process.exit(1);
}
run(...args).catch((error) => {
  console.error(explain(error));
  process.exitCode = 1;
});
