import './style.css';
import { formatEther } from 'viem';
import {
  address, chainTime, checkWindow, checkoutId, client, explainError, formatQor, getAgreement, getDeliveries, getEvent,
  getRefundable, getStatement, getUnitPayments, getWithdrawals, parsePrice, parseRequest, parseShare, pqcKeyStatus,
  requestWallet, selectWallet, short, splitAmounts, transact, validateLink, validateService, verifyAgreement, verifyReceipt,
} from './chain.js';
import { MAX_PARTIES } from './protocol.js';

const content = document.querySelector('#content');
const status = document.querySelector('#status');
const walletButton = document.querySelector('#wallet');
let provider;
let account;
let rendering = 0;
let busy = false;
let operationStatus;
let flash;
const QOR = 10n ** 18n;
const samples = {
  revenue: { price: 12n * QOR, shares: [5000, 3000, 2000], recipients: ['Facilitator', 'Venue', 'Community fund'] },
  service: { price: 2n * QOR, shares: [8000, 2000], recipients: ['Data agent', 'Cleaning agent'] },
};
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const alert = (message, kind = 'info') => {
  status.textContent = message;
  status.hidden = !message;
  status.dataset.kind = kind;
};
const errorMessage = (error) => {
  const code = error?.walk?.((cause) => cause.code === 4001)?.code ?? error?.code;
  return code === 4001 ? 'Request cancelled in your wallet.' : explainError(error);
};
const explorerTx = (hash) => 'https://explore.qore.network/tx/' + hash;
const linkURL = (fragment) => new URL('#' + fragment, location.href).href;
const contractRoute = (route, value) => route + '/' + address + '/' + value;
const validHash = (hash) => /^0x[\da-f]{64}$/i.test(hash ?? '');
const validId = (id) => /^[1-9]\d{0,30}$/.test(id ?? '');
const validAddress = (value) => /^0x[\da-f]{40}$/i.test(value ?? '');
const shareLabel = (bps) => String(Number(bps) / 100) + '%';
const icon = (text) => '<span class="step-icon" aria-hidden="true">' + text + '</span>';
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
const plural = (count, word) => count + ' ' + word + (BigInt(count) === 1n ? '' : 's');
const when = (seconds) => new Date(Number(seconds) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const duration = (seconds) => {
  const value = Number(seconds);
  if (value % 86400 === 0) return plural(value / 86400, 'day');
  if (value % 3600 === 0) return plural(value / 3600, 'hour');
  return plural(Math.round(value / 60), 'minute');
};
const stateLabel = {
  Pending: ['Waiting for signatures', 'warn'], Active: ['Live · every party signed', 'ok'],
  Superseded: ['Replaced by a newer version', 'muted'], Cancelled: ['Cancelled', 'muted'],
};
const deliveryLabel = { Pending: 'Waiting for review', Accepted: 'Accepted · paid', Rejected: 'Rejected', Released: 'Released · paid' };

function refreshWalletLabel() {
  walletButton.textContent = account ? short(account) : 'Connect wallet';
  walletButton.title = account ?? 'Connect MetaMask or a compatible EVM wallet';
}

function attachWalletEvents(selected) {
  selected.on?.('accountsChanged', (accounts) => {
    account = accounts[0];
    refreshWalletLabel();
    if (location.hash === '#earnings' && !busy) void render();
  });
}

async function connect() {
  if (!provider) {
    provider = selectWallet();
    if (!provider) throw new Error('Open QorePact in a browser with MetaMask or a compatible EVM wallet.');
    attachWalletEvents(provider);
  }
  account = await requestWallet(provider);
  refreshWalletLabel();
  return account;
}

async function run(action) {
  if (busy) return;
  busy = true;
  operationStatus = undefined;
  document.body.setAttribute('aria-busy', 'true');
  const startingLocation = location.href;
  alert('Waiting for wallet approval…');
  try {
    await action(startingLocation);
  } catch (error) {
    const message = errorMessage(error);
    const suffix = operationStatus ? ' Check transaction ' + operationStatus + ' before retrying.' : '';
    if (location.href === startingLocation) alert(message + suffix, 'error');
  } finally {
    busy = false;
    operationStatus = undefined;
    document.body.removeAttribute('aria-busy');
  }
}

async function write(name, args, value) {
  const signer = await connect();
  return transact(provider, signer, name, args, value, (hash) => {
    operationStatus = hash;
    alert('Submitted ' + hash + '. Waiting for confirmation…');
  });
}

async function copy(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const label = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = label; }, 1200);
  } catch {
    alert('Clipboard access was denied. Select and copy the displayed value.', 'error');
  }
}

function bindCopy(root = content) {
  for (const button of root.querySelectorAll('[data-copy]')) {
    button.onclick = () => copy(button.dataset.copy, button);
  }
}

function splitCard(terms, heading = 'Payment breakdown', exactCredits, note = '') {
  const { price, shares, recipients } = terms;
  const credits = exactCredits ?? splitAmounts(price, shares);
  const rows = recipients.map((recipient, i) =>
    '<li><span class="swatch c' + i + '"></span><span title="' + escape(recipient) + '">' +
    escape(recipient) + '<small>' + shareLabel(shares[i]) +
    '</small></span><strong>' + formatQor(credits[i]) + '</strong></li>'
  ).join('');
  return '<section class="card breakdown"><div class="card-head"><h2>' + heading +
    '</h2><strong>' + formatQor(price) + '</strong></div>' + note + '<div class="bar" aria-hidden="true">' +
    shares.map((share, i) => '<span class="c' + i + '" style="--share:' + Number(share) + '"></span>').join('') +
    '</div><ul>' + rows + '</ul></section>';
}

function setupNotice() {
  return address ? '' : '<div class="notice"><strong>Preview mode</strong><p>Connect a Diana deployment to propose pacts, move money, and verify live receipts.</p></div>';
}

function command(text) {
  return '<div class="command"><code>' + escape(text) + '</code><button class="secondary" type="button" data-copy="' +
    escape(text) + '">Copy</button></div>';
}

/** Go to `fragment` and show a success message once that page has rendered. */
async function show(fragment, message) {
  flash = message;
  if (location.hash === '#' + fragment) await render();
  else location.hash = fragment;
}

/** A form that relays a signed request from the signing tool or an agent. Any connected wallet can send it. */
function relayForm(hint) {
  return `<section class="card action relay"><h2>Submit a signature</h2>
    <p>${hint} The signature is checked on chain against the signer’s registered ML-DSA-87 key, so the wallet that sends it does not matter.</p>
    <form class="relay-form"><div class="field"><label for="signed-request">Signed request from <code>--out</code> or an agent</label>
    <textarea id="signed-request" name="request" rows="5" spellcheck="false" placeholder='{"kind":"qorepact-signed-request", …}' required></textarea></div>
    <button class="secondary" type="submit" ${address ? '' : 'disabled'}>Send with my wallet</button></form></section>`;
}

function bindRelay() {
  for (const form of content.querySelectorAll('.relay-form')) {
    form.onsubmit = (event) => {
      event.preventDefault();
      void run(async (route) => {
        const request = parseRequest(new FormData(form).get('request').trim());
        const receipt = await write(request.action, request.args);
        if (location.href !== route) return;
        const [first] = request.args;
        if (request.action === 'sign') {
          const activated = getEvent(receipt, 'Activated', { optional: true });
          await show(contractRoute('agreement', first),
            activated ? 'Final signature recorded. The pact is live.' : 'Signature recorded for ' + short(request.args[1]) + '.');
        } else if (request.action === 'deliver') {
          const { unit } = getEvent(receipt, 'Delivered');
          await show(contractRoute('agreement', first), 'Delivery ' + unit + ' recorded. The client can review it now.');
        } else if (request.action === 'accept' || request.action === 'reject') {
          await show(contractRoute('agreement', first), request.action === 'accept'
            ? 'Delivery ' + request.args[1] + ' accepted and paid.' : 'Delivery ' + request.args[1] + ' rejected.');
        } else if (request.action === 'withdraw') {
          const withdrawn = getEvent(receipt, 'Withdrawn');
          await show(contractRoute('statement', first),
            'Withdrew ' + formatQor(withdrawn.amount) + ' to ' + short(withdrawn.to) + ' · ' + receipt.transactionHash);
        } else {
          await show(contractRoute('statement', first),
            request.action === 'setMandate' ? 'The agent’s limits are set.' : 'The agent is switched off.');
        }
      });
    };
  }
}

/** Rows of address + share inputs, with a live total and preview. */
function partyRows(form, { list, add, totalLabel, preview, minimum, sample, heading, onPreview }) {
  let rowCount = 0;
  function addRow(share = '', value = '') {
    const key = ++rowCount;
    const row = document.createElement('div');
    row.className = 'recipient';
    row.innerHTML = `<div class="field"><label for="party-${key}">Wallet address</label><input id="party-${key}" name="recipient" placeholder="0x…" spellcheck="false" value="${escape(value)}" required></div>
      <div class="field"><label for="share-${key}">Share</label><div class="with-unit"><input id="share-${key}" name="share" inputmode="decimal" value="${escape(share)}" placeholder="0" required><span>%</span></div></div>
      <button class="remove" type="button" aria-label="Remove">×</button>`;
    row.querySelector('button').onclick = () => {
      row.remove();
      update();
    };
    list.append(row);
    update();
  }
  function update() {
    const data = new FormData(form);
    const shares = data.getAll('share').map((value) => {
      try { return parseShare(value.trim()); } catch { return 0; }
    });
    const total = shares.reduce((sum, share) => sum + share, 0);
    totalLabel.textContent = shareLabel(total) + ' allocated';
    totalLabel.classList.toggle('valid', total === 10_000);
    add.disabled = shares.length >= MAX_PARTIES;
    for (const button of list.querySelectorAll('.remove')) button.disabled = shares.length <= minimum;
    let price = 0n;
    try { price = parsePrice(data.get('price').trim()); } catch { /* Await complete input. */ }
    if (!price || total !== 10_000 || shares.includes(0)) {
      preview.innerHTML = splitCard(sample, 'Example: ' + heading);
      return;
    }
    const recipients = data.getAll('recipient').map((value, i) => value.trim() || 'Party ' + (i + 1));
    preview.innerHTML = onPreview({ price, shares, recipients }, data);
  }
  add.onclick = () => addRow();
  form.oninput = update;
  return { addRow, update };
}

function modeTabs(current) {
  return `<nav class="tabs" aria-label="Kind of pact">
    <a href="#create" ${current === 'revenue' ? 'aria-current="page"' : ''}>Revenue share</a>
    <a href="#service" ${current === 'service' ? 'aria-current="page"' : ''}>Service pact</a></nav>`;
}

const howItWorks = `<section class="card process"><h2>Why it holds</h2><ul>
  <li>${icon('1')}<span><strong>Every party signs the terms</strong><small>People and agents alike, with ML-DSA-87 keys checked on chain.</small></span></li>
  <li>${icon('2')}<span><strong>The contract holds the money</strong><small>It pays out only as agreed, with a receipt on EVM and QoreChain Native.</small></span></li>
  <li>${icon('3')}<span><strong>A stolen wallet key gets nothing</strong><small>Every signed action needs the post-quantum key.</small></span></li>
  <li>${icon('4')}<span><strong>Owners keep agents on a leash</strong><small>Spending limits the contract enforces, and an off switch.</small></span></li>
</ul></section>`;

const intro = `<h1>Pacts between people and AI agents.<br><em>Nobody holds the money.</em></h1>
  <p>Every party signs the terms with a post-quantum key. The contract holds the money and pays out only as agreed, so a stolen wallet key gets nothing, and an agent cannot spend past the limits its owner set.</p>`;

async function createPage(previousId, revision) {
  let previous;
  if (previousId !== undefined) {
    if (!validId(previousId)) throw new Error('Invalid pact number.');
    previous = await getAgreement(BigInt(previousId));
    if (revision !== rendering) return;
    if (previous.state !== 'Active' || previous.service) throw new Error('Only a live revenue share can be changed.');
  }
  content.innerHTML = `
    <div class="intro">${previous
      ? `<h1>Change pact #${previousId}</h1><p>The new version goes live only when everyone on it <em>and</em> everyone on #${previousId} signs. Until then, #${previousId} keeps taking payments.</p>`
      : intro}</div>
    ${setupNotice()}${previous ? '' : modeTabs('revenue')}
    <div class="layout">
      <section class="card editor">
        <div class="card-head"><h2>${previous ? 'New terms' : 'Share revenue'}</h2></div>
        <p class="lede">${previous ? '' : 'Anyone pays a fixed price, and every payment is split between the parties.'}</p>
        <form id="create-form">
          <div class="field"><label for="title">What is paid for</label><input id="title" name="title" maxlength="96" placeholder="Community design workshop" required></div>
          <div class="field"><label for="price">Price per payment</label><div class="with-unit"><input id="price" name="price" inputmode="decimal" placeholder="12.00" required><span>QOR</span></div></div>
          <div class="recipients-head"><h3>Parties</h3><span id="shares-total">100% allocated</span></div>
          <div id="recipients"></div>
          <button type="button" id="add" class="text-button">+ Add party</button>
          <div class="form-foot"><p>Each party, person or agent, needs a QoreChain account with a registered ML-DSA-87 key. Nobody can be paid, or added, without signing.</p>
          <button class="primary" type="submit" ${address ? '' : 'disabled'}>${previous ? 'Propose this change' : 'Propose pact'}</button></div>
        </form>
      </section>
      <aside><div id="split-preview"></div>${howItWorks}</aside>
    </div>`;

  const form = document.querySelector('#create-form');
  const rows = partyRows(form, {
    list: document.querySelector('#recipients'), add: document.querySelector('#add'),
    totalLabel: document.querySelector('#shares-total'), preview: document.querySelector('#split-preview'),
    minimum: 2, sample: samples.revenue, heading: 'each payment', onPreview: (terms) => splitCard(terms, 'Each payment'),
  });
  if (previous) {
    form.querySelector('#title').value = previous.title;
    form.querySelector('#price').value = formatEther(previous.price);
    previous.recipients.forEach((recipient, i) => rows.addRow(String(Number(previous.shares[i]) / 100), recipient));
  } else {
    rows.addRow('60');
    rows.addRow('40');
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(async (route) => {
      const data = new FormData(form);
      const trim = (value) => value.trim();
      const args = validateLink(trim(data.get('title')), trim(data.get('price')),
        data.getAll('recipient').map(trim), data.getAll('share').map(trim));
      const receipt = await write('propose', [...args, previous ? BigInt(previousId) : 0n]);
      const { id } = getEvent(receipt, 'Proposed');
      if (location.href === route) location.hash = contractRoute('agreement', id);
    });
  };
}

function servicePage() {
  const local = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const inAWeek = local(new Date(Date.now() + 7 * 86_400_000));
  content.innerHTML = `<div class="intro">${intro}</div>${setupNotice()}${modeTabs('service')}
    <div class="layout">
      <section class="card editor">
        <div class="card-head"><h2>Hire for work</h2></div>
        <p class="lede">A client, often an agent, locks a budget. Providers deliver units of work; each accepted unit is paid. Work the client ignores pays itself after the review period, and unused budget returns after the deadline.</p>
        <form id="create-form">
          <div class="field"><label for="title">The work</label><input id="title" name="title" maxlength="96" placeholder="Clean five survey datasets" required></div>
          <div class="field"><label for="client">Client (who pays)</label><div class="with-action"><input id="client" name="client" placeholder="0x…" spellcheck="false" value="${escape(account ?? '')}" required>
            <button type="button" class="text-button" id="use-wallet">Use my wallet</button></div></div>
          <div class="grid-2">
            <div class="field"><label for="price">Price per unit</label><div class="with-unit"><input id="price" name="price" inputmode="decimal" placeholder="2" required><span>QOR</span></div></div>
            <div class="field"><label for="units">Units at most</label><input id="units" name="units" inputmode="numeric" placeholder="5" required></div>
            <div class="field"><label for="deadline">Deadline</label><input id="deadline" name="deadline" type="datetime-local" value="${inAWeek}" required></div>
            <div class="field"><label for="review">Review period</label><div class="with-unit"><input id="review" name="review" inputmode="numeric" value="1440" required><span>min</span></div></div>
          </div>
          <div class="recipients-head"><h3>Providers</h3><span id="shares-total">100% allocated</span></div>
          <div id="recipients"></div>
          <button type="button" id="add" class="text-button">+ Add provider</button>
          <div class="form-foot"><p>The client and every provider sign these terms with their ML-DSA-87 keys. If the client is an agent with an owner, its owner’s limits apply.</p>
          <button class="primary" type="submit" ${address ? '' : 'disabled'}>Propose pact</button></div>
        </form>
      </section>
      <aside><div id="split-preview"></div>${howItWorks}</aside>
    </div>`;
  const form = document.querySelector('#create-form');
  const rows = partyRows(form, {
    list: document.querySelector('#recipients'), add: document.querySelector('#add'),
    totalLabel: document.querySelector('#shares-total'), preview: document.querySelector('#split-preview'),
    minimum: 1, sample: samples.service, heading: 'each unit',
    onPreview: (terms, data) => {
      const units = /^\d{1,4}$/.test(data.get('units').trim()) ? BigInt(data.get('units').trim()) : 0n;
      const note = units ? '<p class="muted budget">Budget locked by the client: ' + units + ' × ' + formatQor(terms.price) + ' = <strong>' + formatQor(terms.price * units) + '</strong></p>' : '';
      return splitCard(terms, 'Each accepted unit', undefined, note);
    },
  });
  rows.addRow('100');
  document.querySelector('#use-wallet').onclick = () => void run(async () => {
    form.querySelector('#client').value = await connect();
    alert('');
  });
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(async (route) => {
      const data = new FormData(form);
      const trim = (value) => value.trim();
      const args = validateService({
        title: trim(data.get('title')), priceText: trim(data.get('price')), unitsText: trim(data.get('units')),
        deadline: data.get('deadline'), reviewMinutesText: trim(data.get('review')), clientText: trim(data.get('client')),
        providerTexts: data.getAll('recipient').map(trim), shareTexts: data.getAll('share').map(trim),
      });
      const receipt = await write('proposeService', args);
      const { id } = getEvent(receipt, 'Proposed');
      if (location.href === route) location.hash = contractRoute('agreement', id);
    });
  };
}

function roleOf(agreement, signer) {
  if (agreement.service) return same(signer, agreement.client) ? 'Client' : 'Provider';
  return agreement.recipients.some((recipient) => same(recipient, signer)) ? 'Party' : 'Party on the version being replaced';
}

async function serviceSection(id, agreement, revision) {
  const [deliveries, refundable, now] = await Promise.all([
    getDeliveries(BigInt(id), agreement.deliveries), agreement.funded ? getRefundable(BigInt(id)) : 0n, chainTime(),
  ]);
  if (revision !== rendering) return {};
  const pastDeadline = now > agreement.deadline;
  const rows = deliveries.slice().reverse().map((delivery) => {
    const reviewEnds = delivery.deliveredAt + BigInt(agreement.reviewPeriod);
    const overdue = delivery.state === 'Pending' && now > reviewEnds;
    return `<tr><td>${delivery.unit}</td><td title="${escape(delivery.provider)}">${short(delivery.provider)}</td>
      <td><code title="${escape(delivery.deliverable)}">${short(delivery.deliverable)}</code></td>
      <td>${deliveryLabel[delivery.state]}${delivery.state === 'Pending' ? '<small>' + (overdue ? 'Review period over' : 'Review until ' + when(reviewEnds)) + '</small>' : ''}</td>
      <td>${overdue ? `<button class="secondary small" type="button" data-release="${delivery.unit}">Release payment</button>` : ''}</td></tr>`;
  }).join('');
  let main;
  if (agreement.state === 'Active' && !agreement.funded) {
    main = `<section class="card action"><div class="tag warn">Live · waiting for the budget</div>
      <h2>${pastDeadline ? 'The deadline passed before the budget was locked' : 'The client locks ' + formatQor(agreement.budget)}</h2>
      <p>${pastDeadline ? 'Nothing was locked, so there is nothing to return.' : 'Every party signed. Work starts once the budget is in the contract, where the providers can see it. Anyone can lock it; the client’s owner limits apply.'}</p>
      ${pastDeadline ? '' : `<button class="primary" id="fund" type="button" ${address ? '' : 'disabled'}>Lock ${formatQor(agreement.budget)}</button>`}
      ${command('npm run pq -- fund ' + id)}</section>`;
  } else if (agreement.state === 'Active') {
    main = `<section class="card action"><div class="tag ok">Live · budget locked</div>
      <h2>${plural(agreement.sales, 'unit')} paid of ${agreement.maxUnits}</h2>
      <dl class="totals"><dt>Budget</dt><dd>${formatQor(agreement.budget)}</dd><dt>Waiting for review</dt><dd>${agreement.pendingUnits}</dd>
      <dt>Deadline</dt><dd>${when(agreement.deadline)}${pastDeadline ? ' · passed' : ''}</dd><dt>Review period</dt><dd>${duration(agreement.reviewPeriod)}</dd>
      ${agreement.refunded ? `<dt>Returned</dt><dd>${formatQor(agreement.refunded)}</dd>` : ''}</dl>
      ${pastDeadline
        ? (refundable ? `<p>The deadline passed. ${formatQor(refundable)} of unused budget can go back now.</p><button class="primary" id="refund" type="button">Return ${formatQor(refundable)}</button>` : '<p>The deadline passed and the budget is settled.</p>')
        : `<p>A provider delivers one unit; only the hash of the work goes on chain. The client accepts or rejects it within ${duration(agreement.reviewPeriod)}, or it pays itself.</p>
          ${command('npm run pq -- deliver ' + id + ' --file work.zip')}
          ${command('npm run pq -- accept ' + id + ' <delivery>')}`}</section>`;
  }
  const deliveriesCard = agreement.funded ? `<section class="card ledger"><h2>Deliveries</h2>${rows
    ? '<div class="table"><table><thead><tr><th>#</th><th>Provider</th><th>Work hash</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<p class="muted">Nothing delivered yet.</p>'}<div id="payments"></div></section>` : '';
  return { main, deliveriesCard };
}

async function agreementPage(id, revision) {
  if (!validId(id)) throw new Error('Invalid pact number.');
  const agreementId = BigInt(id);
  const agreement = await getAgreement(agreementId);
  const [keys, verification, service] = await Promise.all([
    Promise.all(agreement.signers.map((signer) => pqcKeyStatus(signer).catch(() => undefined))),
    verifyAgreement(agreementId, agreement),
    agreement.service && agreement.state === 'Active' ? serviceSection(id, agreement, revision) : {},
  ]);
  if (revision !== rendering) return;
  const [label, kind] = stateLabel[agreement.state];
  const signedCount = agreement.signers.filter((_, i) => (agreement.signedMask >> i) & 1).length;
  const signerRows = agreement.signers.map((signer, i) => {
    const signed = (agreement.signedMask >> i) & 1;
    const key = keys[i];
    const keyNote = key === undefined ? 'Key status unavailable'
      : !key.registered ? 'No ML-DSA-87 key registered yet' : !key.proven ? 'Key registered without proof of possession' : 'ML-DSA-87 key registered';
    return `<li class="${signed ? 'signed' : ''}"><span class="check" aria-hidden="true">${signed ? '✓' : ''}</span>
      <span title="${escape(signer)}">${escape(signer)}<small>${roleOf(agreement, signer)} · ${signed ? 'Signed' : 'Not signed yet'} · ${keyNote}</small></span>
      <a class="small-link" href="#${contractRoute('statement', signer)}">Statement</a></li>`;
  }).join('');
  const isParty = account && (same(account, agreement.proposer) || agreement.signers.some((signer) => same(signer, account)));
  const nativeLine = verification.native
    ? `<dl><dt>Terms receipt on Native</dt><dd>#${escape(verification.native.id)} · ${escape(verification.commitment)}</dd></dl>`
    : (verification.nativeError ? '<p class="muted">' + escape(verification.nativeError) + '</p>' : '');

  let main;
  if (agreement.state === 'Pending') {
    main = `<section class="card action"><div class="tag warn">${label} · ${signedCount} of ${agreement.signers.length}</div>
      <h2>Every party signs these terms</h2>
      <p>Send this page to every party. People sign with the QorePact signing tool on their own computer; agents sign with the QorePact SDK. Browser wallets cannot make ML-DSA-87 signatures yet.</p>
      ${command('npm run pq -- sign ' + id)}
      <p>To send a signature from another wallet, add <code>--out signature.json</code> and paste the file below.</p>
      <div class="actions"><button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('agreement', id)))}">Copy this page’s link</button>
      ${isParty ? '<button class="secondary" id="cancel" type="button">Cancel proposal</button>' : ''}</div></section>`;
  } else if (agreement.service && agreement.state === 'Active') {
    main = service.main + (nativeLine ? '<section class="card compact">' + nativeLine + '</section>' : '');
  } else if (agreement.state === 'Active') {
    main = `<section class="card action"><div class="tag ${verification.native ? 'ok' : 'warn'}">${verification.native ? 'Live · terms recorded on EVM and Native' : 'Live · Native record unverified'}</div>
      <h2>Checkout is open at ${formatQor(agreement.price)}</h2>
      <p>Every party signed on block ${agreement.activatedAt}. ${plural(agreement.sales, 'payment')} so far.</p>
      <div class="actions"><a class="primary" href="#${contractRoute('pay', id)}">Open checkout</a>
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('pay', id)))}">Copy payment link</button>
      <a class="secondary" href="#${contractRoute('create', id)}">Propose a change</a></div>${nativeLine}</section>`;
  } else if (agreement.state === 'Superseded') {
    main = `<section class="card action"><div class="tag muted">${label}</div><h2>This version takes no more payments</h2>
      <p>All parties signed pact #${agreement.successor}, which replaced this one. Its ${plural(agreement.sales, 'past payment')} stay credited.</p>
      <a class="primary" href="#${contractRoute('agreement', agreement.successor)}">Open pact #${agreement.successor}</a></section>`;
  } else {
    main = `<section class="card action"><div class="tag muted">${label}</div><h2>This proposal was cancelled</h2><p>It never went live and moved no money.</p>
      <a class="secondary" href="#create">Propose a new pact</a></section>`;
  }

  const termsCard = agreement.service
    ? splitCard(agreement, 'Each accepted unit', undefined,
      `<p class="muted budget">Client <a href="#${contractRoute('statement', agreement.client)}" title="${escape(agreement.client)}">${short(agreement.client)}</a> · up to ${agreement.maxUnits} units · budget <strong>${formatQor(agreement.budget)}</strong> · until ${when(agreement.deadline)} · review ${duration(agreement.reviewPeriod)}</p>`)
    : splitCard(agreement, 'Terms');
  const relay = agreement.state === 'Pending'
    ? relayForm('Paste a signed request a party saved with the signing tool, or an agent produced.')
    : (agreement.service && agreement.state === 'Active' && agreement.funded ? relayForm('Paste a delivery, acceptance or rejection signed by a provider or the client.') : '');
  content.innerHTML = `<div class="intro"><p class="eyebrow">${agreement.service ? 'Service pact' : 'Revenue share'} #${id}</p><h1>${escape(agreement.title)}</h1>
    <p>Proposed by <span title="${escape(agreement.proposer)}">${short(agreement.proposer)}</span>${
      agreement.previous ? ` · Replaces <a href="#${contractRoute('agreement', agreement.previous)}">#${agreement.previous}</a>` : ''}</p></div>
    <div class="layout"><div class="stack">${main}${service.deliveriesCard ?? ''}
      <section class="card signers"><div class="card-head"><h2>Signatures</h2><strong>${signedCount} / ${agreement.signers.length}</strong></div><ul>${signerRows}</ul></section>
      ${relay}</div>
    ${termsCard}</div>`;
  bindCopy();
  bindRelay();
  const cancel = document.querySelector('#cancel');
  if (cancel) cancel.onclick = () => void run(async (route) => {
    await write('cancel', [agreementId]);
    if (location.href === route) await show(contractRoute('agreement', id), 'Proposal cancelled.');
  });
  const fund = document.querySelector('#fund');
  if (fund) fund.onclick = () => void run(async (route) => {
    await write('fund', [agreementId], agreement.budget);
    if (location.href === route) await show(contractRoute('agreement', id), formatQor(agreement.budget) + ' is locked. Providers can deliver now.');
  });
  const refund = document.querySelector('#refund');
  if (refund) refund.onclick = () => void run(async (route) => {
    const receipt = await write('refund', [agreementId]);
    const { to, amount } = getEvent(receipt, 'Refunded');
    if (location.href === route) await show(contractRoute('agreement', id), formatQor(amount) + ' returned to ' + short(to) + '.');
  });
  for (const button of content.querySelectorAll('[data-release]')) {
    button.onclick = () => void run(async (route) => {
      await write('release', [agreementId, BigInt(button.dataset.release)]);
      if (location.href === route) await show(contractRoute('agreement', id), 'Delivery ' + button.dataset.release + ' released and paid.');
    });
  }
  if (agreement.service && agreement.funded) {
    void getUnitPayments(agreementId, agreement).then((payments) => {
      if (revision !== rendering || !payments.length) return;
      document.querySelector('#payments').innerHTML = '<h3>Payments</h3><ul class="history">' + payments.map((payment) =>
        `<li><span>Delivery ${payment.unit} · ${payment.how === 'Accepted' ? 'accepted' : 'released'}
        <small>${payment.native ? 'Verified on EVM and Native · receipt #' + escape(payment.native.id) : 'EVM confirmed · ' + escape(payment.nativeError)}</small></span>
        <a href="${explorerTx(payment.hash)}" target="_blank" rel="noreferrer">View</a></li>`).join('') + '</ul>';
    }).catch(() => {});
  }
}

async function payPage(id, revision) {
  if (!validId(id)) throw new Error('Invalid payment link.');
  const agreement = await getAgreement(BigInt(id));
  if (revision !== rendering) return;
  if (agreement.service) {
    location.hash = contractRoute('agreement', id);
    return;
  }
  if (agreement.state !== 'Active') {
    const target = agreement.state === 'Superseded' ? agreement.successor : BigInt(id);
    content.innerHTML = `<div class="intro"><h1>${escape(agreement.title)}</h1><p>${agreement.state === 'Superseded'
      ? 'The parties replaced this payment link with a new version.'
      : agreement.state === 'Pending' ? 'This checkout opens when every party has signed the terms.' : 'This proposal was cancelled.'}</p>
      ${agreement.state === 'Cancelled' ? '' : `<a class="primary" href="#${contractRoute(agreement.state === 'Superseded' ? 'pay' : 'agreement', target)}">${
        agreement.state === 'Superseded' ? 'Go to the current checkout' : 'See who still has to sign'}</a>`}</div>`;
    return;
  }
  const credits = splitAmounts(agreement.price, agreement.shares);
  content.innerHTML = `<div class="intro"><p class="eyebrow">Revenue share #${id}</p><h1>${escape(agreement.title)}</h1><p>Terms signed by every party with a post-quantum key</p></div>
    <div class="layout"><section class="card action"><h2>Pay ${formatQor(agreement.price)}</h2>
    <p>Each share is credited in the same transaction, and a receipt is written on QoreChain Native. Each party withdraws separately.</p>
    <button class="primary" id="pay" type="button">Pay ${formatQor(agreement.price)}</button>
    <label class="share-link">Share this checkout<input id="share-url" readonly value="${escape(linkURL(contractRoute('pay', id)))}"></label>
    <div class="actions"><button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('pay', id)))}">Copy payment link</button>
    <a class="secondary" href="#${contractRoute('agreement', id)}">View signed terms</a></div></section>
    ${splitCard(agreement, 'Parties', credits)}</div>`;
  bindCopy();
  let reference;
  const pendingKey = 'qorepact:pending:' + address + ':' + id;
  let pending;
  try {
    const stored = JSON.parse(localStorage.getItem(pendingKey));
    if (validHash(stored?.hash) && validHash(stored?.paymentId)) pending = stored;
  } catch { /* In-memory retry remains available if storage is disabled. */ }

  function savePending(value) {
    pending = value;
    try {
      if (value) localStorage.setItem(pendingKey, JSON.stringify(value));
      else localStorage.removeItem(pendingKey);
    } catch { /* In-memory retry remains available if storage is disabled. */ }
  }

  const pay = document.querySelector('#pay');
  if (pending) pay.textContent = 'Check submitted payment';

  function complete(receipt, expectedPaymentId, route) {
    const payment = receipt.status === 'success' ? getEvent(receipt, 'Checkout', { optional: true }) : undefined;
    savePending(undefined);
    reference = undefined;
    if (payment?.id === BigInt(id) && payment.paymentId === expectedPaymentId) {
      if (location.href === route) location.hash = contractRoute('receipt', receipt.transactionHash);
      return;
    }
    pay.textContent = 'Pay ' + formatQor(agreement.price);
    if (location.href === route) alert('The confirmed transaction did not complete this checkout. Review it before paying again.', 'error');
  }
  pay.onclick = () => void run(async (route) => {
    if (pending) {
      const { hash, paymentId } = pending;
      operationStatus = hash;
      alert('Checking checkout transaction ' + hash + '…');
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
      complete(receipt, paymentId, route);
      return;
    }
    if (!reference) {
      const random = crypto.getRandomValues(new Uint8Array(32));
      reference = '0x' + Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('');
    }
    try {
      const signer = await connect();
      const paymentId = checkoutId(BigInt(id), signer, reference);
      const receipt = await transact(provider, signer, 'checkout', [BigInt(id), reference], agreement.price, (hash) => {
        operationStatus = hash;
        savePending({ hash, paymentId });
        alert('Submitted ' + hash + '. Waiting for confirmation…');
      });
      complete(receipt, paymentId, route);
    } catch (error) {
      if (pending) pay.textContent = 'Check submitted payment';
      throw error;
    }
  });
}

function earningsPage() {
  content.innerHTML = `<div class="intro"><h1>Earnings</h1><p>See what any person or agent has earned, withdrawn and can still withdraw, and the limits its owner set. Statements are public and need no wallet.</p></div>
    ${setupNotice()}<section class="card action narrow"><form id="statement-form"><div class="field">
    <label for="who">Address of a person or agent</label><input id="who" name="who" placeholder="0x…" spellcheck="false" value="${escape(account ?? '')}" required>
    </div><div class="actions"><button class="primary" type="submit" ${address ? '' : 'disabled'}>Open statement</button>
    ${account ? '' : '<button class="secondary" id="use-wallet" type="button">Use my wallet</button>'}</div></form></section>`;
  const form = document.querySelector('#statement-form');
  form.onsubmit = (event) => {
    event.preventDefault();
    const who = new FormData(form).get('who').trim();
    if (!validAddress(who)) { alert('Enter a 0x address with 40 hexadecimal digits.', 'error'); return; }
    location.hash = contractRoute('statement', who);
  };
  const useWallet = document.querySelector('#use-wallet');
  if (useWallet) {
    useWallet.onclick = () => void run(async (route) => {
      const signer = await connect();
      if (location.href === route) location.hash = contractRoute('statement', signer);
    });
  }
}

function mandateCard(who, mandate, off) {
  return `<section class="card action"><div class="tag ${off ? 'muted' : 'ok'}">${off ? (mandate.revoked ? 'Agent switched off by its owner' : 'Agent’s mandate expired') : 'Agent with an owner'}</div>
    <h2>Owner’s limits</h2>
    <dl class="totals"><dt>Owner</dt><dd><a href="#${contractRoute('statement', mandate.owner)}" title="${escape(mandate.owner)}">${short(mandate.owner)}</a></dd>
    <dt>Per pact</dt><dd>${formatQor(mandate.maxPerPact)}</dd><dt>Committed</dt><dd>${formatQor(mandate.committed)} of ${formatQor(mandate.maxTotal)}</dd>
    <dt>Until</dt><dd>${when(mandate.expiry)}</dd></dl>
    <p>${off ? 'This agent can no longer sign anything here. Only its owner can move its earnings, and unused budgets go back to the owner:'
      : 'The contract refuses any pact that would take this agent past these limits. The owner can switch it off at any time:'}</p>
    ${command(off ? 'npm run pq -- withdraw all --for ' + who : 'npm run pq -- revoke ' + who)}</section>`;
}

async function statementPage(who, revision) {
  if (!validAddress(who)) throw new Error('Invalid address.');
  const statement = await getStatement(who);
  if (revision !== rendering) return;
  const rows = statement.agreements.map(({ id, agreement, share, credit, total }) => `<tr>
      <td><a href="#${contractRoute('agreement', id)}">#${id}</a> ${escape(agreement.title)}<small>${agreement.service ? 'Service · ' : ''}${stateLabel[agreement.state][0]}</small></td>
      <td>${shareLabel(share)}</td><td>${agreement.sales} × ${formatQor(credit)}</td><td>${formatQor(total)}</td></tr>`).join('');
  const switchedOff = !same(statement.signer, who);
  content.innerHTML = `<div class="intro"><h1>Statement</h1><p title="${escape(who)}">${escape(who)}</p></div>
    <div class="layout"><div class="stack"><section class="card action"><div class="tag ${statement.consistent ? 'ok' : 'warn'}">${statement.consistent
      ? 'Balances match the signed pacts' : 'Balances do not reconcile'}</div>
      <h2>Available to withdraw</h2><p class="amount">${formatQor(statement.available)}</p>
      <dl class="totals"><dt>Earned</dt><dd>${formatQor(statement.earned)}</dd><dt>Withdrawn</dt><dd>${formatQor(statement.withdrawn)}</dd><dt>Withdrawals</dt><dd>${statement.nonce}</dd></dl>
      <p>${switchedOff ? 'This agent was switched off, so only its owner’s ML-DSA-87 signature can move these earnings.' : 'Earnings leave only with this account’s ML-DSA-87 signature. On their own computer they run:'}</p>
      ${command(switchedOff ? 'npm run pq -- withdraw all --for ' + who : 'npm run pq -- withdraw all')}
      <p>Add <code>--to 0x…</code> to send elsewhere, or <code>--out withdrawal.json</code> to submit from any wallet below.</p>
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('statement', who)))}">Copy statement link</button></section>
      ${statement.mandate ? mandateCard(who, statement.mandate, switchedOff) : ''}
      ${relayForm('Paste a withdrawal, or an owner’s limits or off switch, signed with the signing tool or an agent.')}</div>
    <div class="stack"><section class="card ledger"><h2>Earning from</h2>${rows
      ? '<div class="table"><table><thead><tr><th>Pact</th><th>Share</th><th>Paid</th><th>Earned</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="muted">No live pact has credited this address yet.</p>'}</section>
    ${statement.clientOf.length ? `<section class="card ledger"><h2>Paying for</h2><ul class="history">${statement.clientOf.map((id) =>
      `<li><span>Service pact #${id}</span><a href="#${contractRoute('agreement', id)}">Open</a></li>`).join('')}</ul></section>` : ''}
    <section class="card ledger"><h2>Withdrawals</h2><div id="withdrawals"><p class="muted">Reading history…</p></div></section></div></div>`;
  bindCopy();
  bindRelay();
  void getWithdrawals(who).then((withdrawals) => {
    if (revision !== rendering) return;
    document.querySelector('#withdrawals').innerHTML = withdrawals.length
      ? '<ul class="history">' + withdrawals.reverse().map((item) => `<li><span>${formatQor(item.amount)} to <span title="${escape(item.to)}">${short(item.to)}</span>
        <small>Withdrawal #${item.nonce} · block ${item.block}</small></span><a href="${explorerTx(item.hash)}" target="_blank" rel="noreferrer">View</a></li>`).join('') + '</ul>'
      : '<p class="muted">No withdrawals yet.</p>';
  }).catch(() => {
    if (revision !== rendering) return;
    document.querySelector('#withdrawals').innerHTML = '<p class="muted">The RPC did not return the withdrawal history. The totals above come from contract state.</p>';
  });
}

function submitPage() {
  content.innerHTML = `<div class="intro"><h1>Submit a signature</h1><p>Send any post-quantum-signed action that a person made with the QorePact signing tool, or an agent made with the SDK: accepting terms, delivering work, reviewing it, withdrawing, or an owner setting limits or switching an agent off.</p></div>
    ${setupNotice()}<div class="narrow">${relayForm('Paste the JSON request.')}</div>`;
  bindRelay();
}

function verifyPage() {
  content.innerHTML = `<div class="intro"><h1>Verify a receipt</h1><p>Check a revenue-share payment against the record it wrote on QoreChain Native. Service payments are verified on their pact’s page.</p></div>
    ${setupNotice()}<section class="card action narrow"><form id="verify-form"><div class="field">
    <label for="hash">Payment transaction hash</label><input id="hash" name="hash" placeholder="0x…" spellcheck="false" required>
    </div><button class="primary" type="submit" ${address ? '' : 'disabled'}>Verify receipt</button></form></section>`;
  document.querySelector('#verify-form').onsubmit = (event) => {
    event.preventDefault();
    const hash = new FormData(event.currentTarget).get('hash').trim();
    if (!validHash(hash)) { alert('Enter a 0x transaction hash with 64 hexadecimal digits.', 'error'); return; }
    location.hash = contractRoute('receipt', hash.toLowerCase());
  };
}

async function receiptPage(hash, revision) {
  if (!validHash(hash)) throw new Error('Invalid payment transaction hash.');
  const { receipt, payment, agreement, native, nativeError } = await verifyReceipt(hash);
  if (revision !== rendering) return;
  content.innerHTML = `<div class="intro"><h1>Payment receipt</h1><p>${escape(agreement.title)} · <a href="#${contractRoute('agreement', payment.id)}">Pact #${payment.id}</a></p></div>
    <div class="layout"><section class="card action"><div class="tag ${native ? 'ok' : 'warn'}">${native ? 'Verified on EVM and Native' : 'EVM confirmed · Native unverified'}</div>
    <h2>${formatQor(payment.total)} credited</h2>
    <dl><dt>Payer</dt><dd>${escape(payment.payer)}</dd><dt>EVM block</dt><dd>${receipt.blockNumber}</dd><dt>Native receipt ID</dt><dd>${native ? escape(native.id) : 'Unverified'}</dd>
    <dt>Receipt commitment</dt><dd>${escape(payment.commitment)}</dd></dl>
    ${nativeError ? '<p class="muted">' + escape(nativeError) + '</p>' : ''}
    <div class="actions"><a class="secondary" href="${explorerTx(hash)}" target="_blank" rel="noreferrer">View transaction</a>
    <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('receipt', hash)))}">Copy receipt link</button></div></section>
    ${splitCard(agreement, 'Shares credited', payment.credits)}</div>`;
  bindCopy();
}

async function render() {
  const revision = ++rendering;
  const [route, deployment, parameter, extra] = (location.hash.slice(1) || 'create').split('/');
  alert('');
  const section = { agreement: 'create', pay: 'create', service: 'create', statement: 'earnings', receipt: 'verify' }[route] ?? route;
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  try {
    if (route === 'create' && deployment === undefined) await createPage(undefined, revision);
    else if (route === 'service') servicePage();
    else if (route === 'verify') verifyPage();
    else if (route === 'earnings') earningsPage();
    else if (route === 'submit') submitPage();
    else if (['create', 'agreement', 'pay', 'receipt', 'statement'].includes(route)) {
      if (extra !== undefined || !address || deployment?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('This link requires its original QorePact Diana deployment.');
      }
      content.innerHTML = '<div class="intro"><h1>Reading QoreChain</h1><p>Waiting for Diana testnet data…</p></div>';
      if (route === 'create') await createPage(parameter, revision);
      else if (route === 'agreement') await agreementPage(parameter, revision);
      else if (route === 'pay') await payPage(parameter, revision);
      else if (route === 'statement') await statementPage(parameter, revision);
      else await receiptPage(parameter ?? '', revision);
    } else throw new Error('This page does not exist.');
    if (flash && revision === rendering) {
      alert(flash, 'success');
      flash = undefined;
    }
  } catch (error) {
    if (revision !== rendering) return;
    flash = undefined;
    content.innerHTML = '<div class="intro"><h1>Unable to load this page</h1><p>' +
      escape(errorMessage(error)) + '</p><a class="secondary" href="#create">Back to QorePact</a></div>';
  }
}

walletButton.onclick = () => void run(async (route) => {
  const signer = await connect();
  if (location.href !== route) return;
  if (location.hash === '#earnings') await render();
  else {
    const state = await checkWindow(signer).catch(() => undefined);
    if (location.href !== route) return;
    alert(state?.problem
      ? 'Wallet connected, but ' + state.qorAddress + ' ' + state.problem + '. Open one before sending.'
      : 'Wallet connected · ' + signer, state?.problem ? 'info' : 'success');
  }
});
window.addEventListener('hashchange', render);
void render();
