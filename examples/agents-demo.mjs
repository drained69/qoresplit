// QorePact demo: AI agents make a deal, deliver work, get paid, and a stolen key gets nothing.
//
//   npm run demo               the story in the terminal (about 30 seconds)
//   npm run demo -- --serve    then keep the chain running and open the web app on it
//
// Everything runs locally on the Diana stand-in (scripts/local-diana.mjs): a chain with ID
// 9800 whose ML-DSA-87 checks are backed by real ML-DSA-87 verification. Every party below
// has its own fresh keys and acts only through the QorePact SDK, as separate agents would.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generateMnemonic, generatePqcKeypair, pqcSign } from '@qorechain/sdk';
import { hexToBytes, parseEther, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deliverableHash } from '../src/protocol.js';
import { QorePact, abi, explain, qor } from '../sdk/qorepact.mjs';
import { loadSigner } from '../sdk/pqc.mjs';
import { startDiana } from '../scripts/local-diana.mjs';

const serve = process.argv.includes('--serve');
const root = fileURLToPath(new URL('..', import.meta.url));
const artifact = JSON.parse(await readFile(new URL('../artifacts/QorePact.json', import.meta.url)));
const step = (text) => console.log('\n' + text);
const say = (text) => console.log('   ' + text);
const short = (address) => address.slice(0, 6) + '…' + address.slice(-4);

/** An AI agent: its own keys, its own QorePact connection, and a little judgement. */
class Agent {
  constructor(name, pact) {
    this.name = name;
    this.pact = pact;
    this.address = pact.address;
  }

  toString() { return this.name + ' (' + short(this.address) + ')'; }
}

const diana = await startDiana({ abi });
let vite;
async function shutdown() {
  vite?.kill();
  await diana.stop();
}
process.on('SIGINT', () => { void shutdown().then(() => process.exit(0)); });

try {
  // The deployment and the parties.
  const deployer = diana.accounts[0];
  const hash = await diana.wallet.deployContract({ account: deployer, abi, bytecode: artifact.bytecode });
  const contract = (await diana.client.waitForTransactionReceipt({ hash })).contractAddress;
  diana.useContract(contract);

  async function party(name) {
    const mnemonic = generateMnemonic();
    const signer = await loadSigner({ QORE_MNEMONIC: mnemonic });
    await diana.fund(signer.address, parseEther('50'));
    await diana.registerKey(signer.address, signer.publicKey);
    const pact = await QorePact.connect({ contract, rpc: diana.url, rest: diana.url, mnemonic });
    return new Agent(name, pact);
  }
  const olivia = await party('Olivia, a human');
  const researcher = await party('Research agent');
  const databot = await party('Data agent');
  const cleaner = await party('Cleaning agent');

  console.log('QorePact demo on a local QoreChain Diana stand-in. Every party has its own ML-DSA-87 key.');
  say(olivia + ' owns the research agent.');
  say(researcher + ' needs survey data cleaned.');
  say(databot + ' and ' + cleaner + ' sell data cleaning as a team, 80/20.');

  step('1. Olivia puts her agent on a budget');
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400);
  const limits = { owner: olivia.address, maxPerPact: parseEther('10'), maxTotal: parseEther('15'), expiry };
  const agentSignature = await researcher.pact.approveOwner(limits);
  await olivia.pact.setMandate({ agent: researcher.address, ...limits, agentSignature });
  say('Both signed with ML-DSA-87: at most 10 QOR per pact, 15 QOR in total, for 7 days. The contract enforces it.');

  step('2. The research agent proposes a deal');
  const deadline = (await diana.client.getBlock()).timestamp + 3600n;
  const id = await researcher.pact.proposeService({
    title: 'Clean five survey datasets', unitPrice: '2', maxUnits: 5, deadline, reviewPeriod: 120,
    client: researcher.address, providers: [databot.address, cleaner.address], shares: [8000, 2000],
  });
  say('Pact #' + id + ': 2 QOR per cleaned dataset, up to 5, within an hour. The client has 2 minutes to review each delivery.');

  step('3. Every party reads the terms and signs them');
  for (const agent of [databot, cleaner, researcher]) {
    const terms = await agent.pact.agreement(id);
    await agent.pact.sign(id);
    say(agent + ' checked "' + terms.title + '" and signed.');
  }
  say('All signed: the pact is live, and its terms are recorded on QoreChain Native.');

  step('4. The research agent locks the budget');
  await researcher.pact.fund(id);
  say('10 QOR is locked in the contract. The data team can see it is there before they start.');
  const greedy = await researcher.pact.proposeService({
    title: 'Label 5,000 images', unitPrice: '1', maxUnits: 10, deadline, reviewPeriod: 120,
    client: researcher.address, providers: [databot.address], shares: [10000],
  });
  await databot.pact.sign(greedy);
  try {
    await researcher.pact.sign(greedy);
    say('Unexpected: a second 10 QOR pact was accepted.');
  } catch (error) {
    say('It tries to commit another 10 QOR elsewhere: refused (' + explain(error) + '). Olivia’s limit holds.');
  }

  step('5. Work is delivered, checked and paid');
  const datasets = [
    JSON.stringify({ survey: 'north', rows: 1200, nulls: 0 }),
    JSON.stringify({ survey: 'south', rows: 40, nulls: 312 }),
    JSON.stringify({ survey: 'south', rows: 1100, nulls: 0 }),
  ];
  /** The research agent's judgement: the delivery must match its hash and be a usable dataset. */
  const judge = (content, onChain) => {
    if (deliverableHash(content) !== onChain) return 'it does not match what was delivered on chain';
    const data = JSON.parse(content);
    if (data.rows < 1000 || data.nulls > 0) return 'only ' + data.rows + ' rows with ' + data.nulls + ' empty values';
  };
  for (const [i, content] of datasets.slice(0, 2).entries()) {
    const { unit } = await databot.pact.deliver(id, content);
    const delivery = await researcher.pact.read('getDelivery', [id, unit]);
    const problem = judge(content, delivery.deliverable);
    if (problem) {
      await researcher.pact.reject(id, unit);
      say('Dataset ' + (i + 1) + ' delivered. The research agent rejects it: ' + problem + '. Nothing is paid.');
    } else {
      await researcher.pact.accept(id, unit);
      say('Dataset ' + (i + 1) + ' delivered. The research agent checks it and accepts: 1.6 QOR to the data agent, 0.4 to the cleaner.');
    }
  }
  const { unit: late } = await databot.pact.deliver(id, datasets[2]);
  say('Dataset 2 is delivered again, fixed. This time the research agent is busy and does not answer.');
  await diana.advance(121);
  await cleaner.pact.release(id, late);
  say('Two minutes later anyone may release it, and the cleaning agent does: the team is paid without waiting.');

  step('6. An attacker steals the data agent’s wallet key');
  const thief = '0x000000000000000000000000000000000000dEaD';
  const stolen = privateKeyToAccount(databot.pact.signer.privateKey);
  const forge = (message) => toHex(pqcSign(generatePqcKeypair().secretKey, hexToBytes(message)));
  const earnings = await databot.pact.read('claimable', [databot.address]);
  const nonce = await databot.pact.read('nonces', [databot.address]);
  const attempts = [
    ['withdraw its ' + qor(earnings), 'withdraw', [databot.address, thief, earnings,
      forge(await databot.pact.read('withdrawalMessage', [databot.address, thief, earnings, nonce]))]],
    ['deliver junk to get paid', 'deliver', [id, databot.address, deliverableHash('junk'),
      forge(await databot.pact.read('deliveryMessage', [id, 3n, databot.address, deliverableHash('junk')]))]],
  ];
  for (const [what, functionName, args] of attempts) {
    try {
      await databot.pact.client.simulateContract({ account: stolen, address: contract, abi, functionName, args });
      say('Unexpected: the attacker managed to ' + what + '.');
    } catch (error) {
      say('With the classical key alone it tries to ' + what + ': BLOCKED (' + explain(error) + ').');
    }
  }

  step('7. Olivia switches her agent off');
  await olivia.pact.revoke(researcher.address);
  const { unit: after } = await databot.pact.deliver(id, JSON.stringify({ survey: 'east', rows: 1500, nulls: 0 }));
  try {
    await researcher.pact.accept(id, after);
  } catch (error) {
    say('The research agent can no longer sign anything: ' + explain(error) + '.');
  }

  step('8. The deadline passes');
  await diana.advance(3600);
  await cleaner.pact.release(id, after);
  say('The last delivery was never reviewed, so it is released and paid.');
  const before = await diana.client.getBalance({ address: olivia.address });
  await databot.pact.refund(id);
  const returned = (await diana.client.getBalance({ address: olivia.address })) - before;
  say('The unused budget, ' + qor(returned) + ', goes back to Olivia, not to the switched-off agent.');

  step('9. The team withdraws with their post-quantum keys');
  for (const agent of [databot, cleaner]) {
    const amount = await agent.pact.read('claimable', [agent.address]);
    await agent.pact.withdraw('all');
    say(agent + ' withdrew ' + qor(amount) + '.');
  }

  const pact = await researcher.pact.agreement(id);
  step('Done');
  say('Pact #' + id + ': ' + pact.sales + ' datasets paid, 1 rejected, budget settled.');
  say(diana.stats.verified + ' ML-DSA-87 signatures checked and accepted; ' + diana.stats.refused + ' forged ones refused.');

  if (serve) {
    const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
    vite = spawn(process.execPath, [viteBin, '--port', '5173'], {
      cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, VITE_QOREPACT_ADDRESS: contract, VITE_QOREPACT_RPC: diana.url, QORE_NATIVE_REST: diana.url },
    });
    let log = '';
    const url = await new Promise((resolve, reject) => {
      vite.on('exit', (code) => reject(new Error('The app server exited (' + code + ').')));
      vite.stdout.on('data', (chunk) => {
        log += chunk;
        const match = log.replace(/\x1b\[[\d;]*m/g, '').match(/Local:\s+(http:\/\/\S+?)\/?\s/);
        if (match) resolve(match[1]);
      });
    });
    step('The web app is running on this chain:');
    say('Pact      ' + url + '/#agreement/' + contract + '/' + id);
    say('Agent     ' + url + '/#statement/' + contract + '/' + researcher.address);
    say('Provider  ' + url + '/#statement/' + contract + '/' + databot.address);
    say('Press Ctrl+C to stop.');
    await once(vite, 'exit');
  }
} catch (error) {
  console.error('\nThe demo stopped: ' + explain(error));
  process.exitCode = 1;
} finally {
  if (!serve || process.exitCode) await shutdown();
}
