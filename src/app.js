import './style.css';
import {
  address, checkWindow, checkoutId, client, explainError, formatQor, getAgreement, getEvent, getStatement,
  getWithdrawals, parsePrice, parseRequest, parseShare, pqcKeyStatus, requestWallet, selectWallet, short,
  splitAmounts, transact, validateLink, verifyAgreement, verifyReceipt,
} from './chain.js';
import { MAX_RECIPIENTS } from './protocol.js';
import { formatEther } from 'viem';

const content = document.querySelector('#content');
const status = document.querySelector('#status');
const walletButton = document.querySelector('#wallet');
let provider;
let account;
let rendering = 0;
let busy = false;
let operationStatus;
let flash;
const sample = {
  title: 'Community design workshop', price: 12n * 10n ** 18n,
  shares: [5000, 3000, 2000], recipients: ['Facilitator', 'Venue', 'Community fund'],
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
const shareLabel = (bps) => String(Number(bps) / 100) + '%';
const icon = (text) => '<span class="step-icon" aria-hidden="true">' + text + '</span>';
const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();
const stateLabel = {
  Pending: ['Waiting for signatures', 'warn'], Active: ['Live · every collaborator signed', 'ok'],
  Superseded: ['Replaced by a newer version', 'muted'], Cancelled: ['Cancelled', 'muted'],
};

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
    if (!provider) throw new Error('Open QoreSplit in a browser with MetaMask or a compatible EVM wallet.');
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

function splitCard(terms, heading = 'Payment breakdown', exactCredits) {
  const { price, shares, recipients } = terms;
  const credits = exactCredits ?? splitAmounts(price, shares);
  const rows = recipients.map((recipient, i) =>
    '<li><span class="swatch c' + i + '"></span><span title="' + escape(recipient) + '">' +
    escape(recipient) + '<small>' + shareLabel(shares[i]) +
    '</small></span><strong>' + formatQor(credits[i]) + '</strong></li>'
  ).join('');
  return '<section class="card breakdown"><div class="card-head"><h2>' + heading +
    '</h2><strong>' + formatQor(price) + '</strong></div><div class="bar" aria-hidden="true">' +
    shares.map((share, i) => '<span class="c' + i + '" style="--share:' + Number(share) + '"></span>').join('') +
    '</div><ul>' + rows + '</ul></section>';
}

function setupNotice() {
  return address ? '' : '<div class="notice"><strong>Preview mode</strong><p>Connect a Diana deployment to propose agreements, accept payments, and verify live receipts.</p></div>';
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

/** A form that relays a signed request from the signing tool. Any connected wallet can send it. */
function relayForm(hint) {
  return `<section class="card action relay"><h2>Submit a signature</h2>
    <p>${hint} The signature is checked on chain against the signer’s registered ML-DSA-87 key, so the wallet that sends it does not matter.</p>
    <form class="relay-form"><div class="field"><label for="signed-request">Signed request from <code>--out</code></label>
    <textarea id="signed-request" name="request" rows="5" spellcheck="false" placeholder='{"kind":"qoresplit-signed-request", …}' required></textarea></div>
    <button class="secondary" type="submit" ${address ? '' : 'disabled'}>Send with my wallet</button></form></section>`;
}

function bindRelay() {
  for (const form of content.querySelectorAll('.relay-form')) {
    form.onsubmit = (event) => {
      event.preventDefault();
      void run(async (route) => {
        const request = parseRequest(new FormData(form).get('request').trim());
        if (request.action === 'sign') {
          const receipt = await write('sign', [request.id, request.signer, request.signature]);
          const activated = getEvent(receipt, 'Activated', { optional: true });
          if (location.href !== route) return;
          await show(contractRoute('agreement', request.id),
            activated ? 'Final signature recorded. The agreement is live.' : 'Signature recorded for ' + short(request.signer) + '.');
        } else {
          const receipt = await write('withdraw', [request.recipient, request.to, request.amount, request.signature]);
          const event = getEvent(receipt, 'Withdrawn');
          if (location.href !== route) return;
          await show(contractRoute('statement', request.recipient),
            'Withdrew ' + formatQor(event.amount) + ' to ' + short(event.to) + ' · ' + receipt.transactionHash);
        }
      });
    };
  }
}

async function createPage(previousId, revision) {
  let previous;
  if (previousId !== undefined) {
    if (!validId(previousId)) throw new Error('Invalid agreement number.');
    previous = await getAgreement(BigInt(previousId));
    if (revision !== rendering) return;
    if (previous.state !== 'Active') throw new Error('Only a live agreement can be changed.');
  }
  content.innerHTML = `
    <div class="intro">${previous
      ? `<h1>Change agreement #${previousId}</h1><p>The new version goes live only when everyone on it <em>and</em> everyone on #${previousId} signs. Until then, #${previousId} keeps taking payments.</p>`
      : `<h1>Sell together.<br><em>Nobody holds the money.</em></h1>
    <p>Propose how a sale is split. Every collaborator accepts the terms with their post-quantum key before the checkout goes live, and earnings only leave with that key. A stolen wallet key gets nothing.</p>`}</div>
    ${setupNotice()}
    <div class="layout">
      <section class="card editor">
        <div class="card-head"><h2>${previous ? 'New terms' : 'Propose an agreement'}</h2></div>
        <form id="create-form">
          <div class="field"><label for="title">What you sell</label><input id="title" name="title" maxlength="96" placeholder="Community design workshop" required></div>
          <div class="field"><label for="price">Price per payment</label><div class="with-unit"><input id="price" name="price" inputmode="decimal" placeholder="12.00" required><span>QOR</span></div></div>
          <div class="recipients-head"><h3>Collaborators</h3><span id="shares-total">100% allocated</span></div>
          <div id="recipients"></div>
          <button type="button" id="add" class="text-button">+ Add collaborator</button>
          <div class="form-foot"><p>Each collaborator needs a QoreChain account with a registered ML-DSA-87 key. Nobody can be paid, or added, without signing.</p>
          <button class="primary" type="submit" ${address ? '' : 'disabled'}>${previous ? 'Propose this change' : 'Propose agreement'}</button></div>
        </form>
      </section>
      <aside><div id="split-preview"></div>
        <section class="card process"><h2>How it works</h2><ul>
          <li>${icon('1')}<span><strong>Everyone signs the terms</strong><small>With their ML-DSA-87 key, checked on chain.</small></span></li>
          <li>${icon('2')}<span><strong>Each sale pays every share</strong><small>With a receipt on EVM and QoreChain Native.</small></span></li>
          <li>${icon('3')}<span><strong>Earnings leave with a PQ signature</strong><small>Your classical key alone cannot move them.</small></span></li>
          <li>${icon('4')}<span><strong>Changes need everyone</strong><small>A new version, signed by all; history stays.</small></span></li>
        </ul></section>
      </aside>
    </div>`;

  const form = document.querySelector('#create-form');
  const list = document.querySelector('#recipients');
  const add = document.querySelector('#add');
  const preview = document.querySelector('#split-preview');
  const totalLabel = document.querySelector('#shares-total');
  let rowCount = 0;

  function addRecipient(share = '', recipient = '') {
    const key = ++rowCount;
    const row = document.createElement('div');
    row.className = 'recipient';
    row.innerHTML = `<div class="field"><label for="recipient-${key}">Wallet address</label><input id="recipient-${key}" name="recipient" placeholder="0x…" spellcheck="false" value="${escape(recipient)}" required></div>
      <div class="field"><label for="share-${key}">Share</label><div class="with-unit"><input id="share-${key}" name="share" inputmode="decimal" value="${escape(share)}" placeholder="0" required><span>%</span></div></div>
      <button class="remove" type="button" aria-label="Remove collaborator">×</button>`;
    row.querySelector('button').onclick = () => {
      row.remove();
      onInput();
    };
    list.append(row);
    onInput();
  }

  function onInput() {
    const data = new FormData(form);
    const shares = data.getAll('share').map((value) => {
      try { return parseShare(value.trim()); } catch { return 0; }
    });
    const total = shares.reduce((sum, share) => sum + share, 0);
    totalLabel.textContent = shareLabel(total) + ' allocated';
    totalLabel.classList.toggle('valid', total === 10_000);
    add.disabled = shares.length >= MAX_RECIPIENTS;
    for (const button of list.querySelectorAll('.remove')) button.disabled = shares.length <= 2;

    let price = 0n;
    try { price = parsePrice(data.get('price').trim()); } catch { /* Await complete input. */ }
    if (!price || total !== 10_000 || shares.includes(0)) {
      preview.innerHTML = splitCard(sample, 'Example split');
      return;
    }
    const recipients = data.getAll('recipient').map((value, i) => value.trim() || 'Collaborator ' + (i + 1));
    preview.innerHTML = splitCard({ price, shares, recipients });
  }

  if (previous) {
    form.querySelector('#title').value = previous.title;
    form.querySelector('#price').value = formatEther(previous.price);
    previous.recipients.forEach((recipient, i) => addRecipient(String(Number(previous.shares[i]) / 100), recipient));
  } else {
    addRecipient('60');
    addRecipient('40');
  }
  add.onclick = () => addRecipient();
  form.oninput = onInput;
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

async function agreementPage(id, revision) {
  if (!validId(id)) throw new Error('Invalid agreement number.');
  const agreementId = BigInt(id);
  const agreement = await getAgreement(agreementId);
  const [keys, verification] = await Promise.all([
    Promise.all(agreement.signers.map((signer) => pqcKeyStatus(signer).catch(() => undefined))),
    verifyAgreement(agreementId, agreement),
  ]);
  if (revision !== rendering) return;
  const [label, kind] = stateLabel[agreement.state];
  const signedCount = agreement.signers.filter((_, i) => (agreement.signedMask >> i) & 1).length;
  const signerRows = agreement.signers.map((signer, i) => {
    const signed = (agreement.signedMask >> i) & 1;
    const key = keys[i];
    const keyNote = key === undefined ? 'Key status unavailable'
      : !key.registered ? 'No ML-DSA-87 key registered yet' : !key.proven ? 'Key registered without proof of possession' : 'ML-DSA-87 key registered';
    const role = agreement.recipients.some((recipient) => same(recipient, signer)) ? '' : ' · on the version being replaced';
    return `<li class="${signed ? 'signed' : ''}"><span class="check" aria-hidden="true">${signed ? '✓' : ''}</span>
      <span title="${escape(signer)}">${escape(signer)}<small>${signed ? 'Signed' : 'Not signed yet'} · ${keyNote}${role}</small></span></li>`;
  }).join('');
  const isParty = account && (same(account, agreement.proposer) || agreement.signers.some((signer) => same(signer, account)));

  let main;
  if (agreement.state === 'Pending') {
    main = `<section class="card action"><div class="tag warn">${label} · ${signedCount} of ${agreement.signers.length}</div>
      <h2>Each collaborator signs these terms</h2>
      <p>Send this page to every collaborator. Each one accepts with their ML-DSA-87 key, using the QoreSplit signing tool on their own computer. Browser wallets cannot make these signatures yet.</p>
      ${command('npm run pq -- sign ' + id)}
      <p>The tool shows the terms, checks them against the contract, and sends the signature from the same account. To send it from another wallet instead, add <code>--out signature.json</code> and paste the file below.</p>
      <div class="actions"><button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('agreement', id)))}">Copy this page’s link</button>
      ${isParty ? '<button class="secondary" id="cancel" type="button">Cancel proposal</button>' : ''}</div></section>`;
  } else if (agreement.state === 'Active') {
    main = `<section class="card action"><div class="tag ${verification.native ? 'ok' : 'warn'}">${verification.native ? 'Live · terms recorded on EVM and Native' : 'Live · Native record unverified'}</div>
      <h2>Checkout is open at ${formatQor(agreement.price)}</h2>
      <p>Every collaborator signed on block ${agreement.activatedAt}. ${agreement.sales} payment${agreement.sales === 1n ? '' : 's'} so far.</p>
      <div class="actions"><a class="primary" href="#${contractRoute('pay', id)}">Open checkout</a>
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('pay', id)))}">Copy payment link</button>
      <a class="secondary" href="#${contractRoute('create', id)}">Propose a change</a></div>
      ${verification.nativeError ? '<p class="muted">' + escape(verification.nativeError) + '</p>' : ''}
      ${verification.native ? `<dl><dt>Native receipt ID</dt><dd>${escape(verification.native.id)}</dd><dt>Terms commitment</dt><dd>${escape(verification.commitment)}</dd></dl>` : ''}</section>`;
  } else if (agreement.state === 'Superseded') {
    main = `<section class="card action"><div class="tag muted">${label}</div><h2>This version takes no more payments</h2>
      <p>All collaborators signed agreement #${agreement.successor}, which replaced this one. Its ${agreement.sales} past payment${agreement.sales === 1n ? '' : 's'} stay credited.</p>
      <a class="primary" href="#${contractRoute('agreement', agreement.successor)}">Open agreement #${agreement.successor}</a></section>`;
  } else {
    main = `<section class="card action"><div class="tag muted">${label}</div><h2>This proposal was cancelled</h2><p>It never went live and took no payments.</p>
      <a class="secondary" href="#create">Propose a new agreement</a></section>`;
  }

  content.innerHTML = `<div class="intro"><h1>${escape(agreement.title)}</h1>
    <p>Agreement #${id} · Proposed by <span title="${escape(agreement.proposer)}">${short(agreement.proposer)}</span>${
      agreement.previous ? ` · Replaces <a href="#${contractRoute('agreement', agreement.previous)}">#${agreement.previous}</a>` : ''}</p></div>
    <div class="layout"><div class="stack">${main}
      <section class="card signers"><div class="card-head"><h2>Signatures</h2><strong>${signedCount} / ${agreement.signers.length}</strong></div><ul>${signerRows}</ul></section>
      ${agreement.state === 'Pending' ? relayForm('Paste a signed request a collaborator saved with the signing tool.') : ''}</div>
    ${splitCard(agreement, 'Terms')}</div>`;
  bindCopy();
  bindRelay();
  const cancel = document.querySelector('#cancel');
  if (cancel) {
    cancel.onclick = () => void run(async (route) => {
      await write('cancel', [agreementId]);
      if (location.href === route) await render();
    });
  }
}

async function payPage(id, revision) {
  if (!validId(id)) throw new Error('Invalid payment link.');
  const agreement = await getAgreement(BigInt(id));
  if (revision !== rendering) return;
  if (agreement.state !== 'Active') {
    const target = agreement.state === 'Superseded' ? agreement.successor : BigInt(id);
    content.innerHTML = `<div class="intro"><h1>${escape(agreement.title)}</h1><p>${agreement.state === 'Superseded'
      ? 'The collaborators replaced this payment link with a new version.'
      : agreement.state === 'Pending' ? 'This checkout opens when every collaborator has signed the terms.' : 'This proposal was cancelled.'}</p>
      ${agreement.state === 'Cancelled' ? '' : `<a class="primary" href="#${contractRoute(agreement.state === 'Superseded' ? 'pay' : 'agreement', target)}">${
        agreement.state === 'Superseded' ? 'Go to the current checkout' : 'See who still has to sign'}</a>`}</div>`;
    return;
  }
  const credits = splitAmounts(agreement.price, agreement.shares);
  content.innerHTML = `<div class="intro"><h1>${escape(agreement.title)}</h1><p>Agreement #${id} · Terms signed by every collaborator with a post-quantum key</p></div>
    <div class="layout"><section class="card action"><h2>Pay ${formatQor(agreement.price)}</h2>
    <p>Each share is credited in the same transaction, and a receipt is written on QoreChain Native. Collaborators withdraw separately.</p>
    <button class="primary" id="pay" type="button">Pay ${formatQor(agreement.price)}</button>
    <label class="share-link">Share this checkout<input id="share-url" readonly value="${escape(linkURL(contractRoute('pay', id)))}"></label>
    <div class="actions"><button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('pay', id)))}">Copy payment link</button>
    <a class="secondary" href="#${contractRoute('agreement', id)}">View signed terms</a></div></section>
    ${splitCard(agreement, 'Collaborators', credits)}</div>`;
  bindCopy();
  let reference;
  const pendingKey = 'qoresplit:pending:' + address + ':' + id;
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
  content.innerHTML = `<div class="intro"><h1>Earnings</h1><p>See what any collaborator has earned, withdrawn and can still withdraw. Statements are public and need no wallet.</p></div>
    ${setupNotice()}<section class="card action narrow"><form id="statement-form"><div class="field">
    <label for="who">Collaborator address</label><input id="who" name="who" placeholder="0x…" spellcheck="false" value="${escape(account ?? '')}" required>
    </div><div class="actions"><button class="primary" type="submit" ${address ? '' : 'disabled'}>Open statement</button>
    ${account ? '' : '<button class="secondary" id="use-wallet" type="button">Use my wallet</button>'}</div></form></section>`;
  const form = document.querySelector('#statement-form');
  form.onsubmit = (event) => {
    event.preventDefault();
    const who = new FormData(form).get('who').trim();
    if (!/^0x[\da-f]{40}$/i.test(who)) { alert('Enter a 0x address with 40 hexadecimal digits.', 'error'); return; }
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

async function statementPage(who, revision) {
  if (!/^0x[\da-f]{40}$/i.test(who ?? '')) throw new Error('Invalid collaborator address.');
  const statement = await getStatement(who);
  if (revision !== rendering) return;
  const rows = statement.agreements.map(({ id, agreement, share, credit, total }) => `<tr>
      <td><a href="#${contractRoute('agreement', id)}">#${id}</a> ${escape(agreement.title)}<small>${stateLabel[agreement.state][0]}</small></td>
      <td>${shareLabel(share)}</td><td>${agreement.sales} × ${formatQor(credit)}</td><td>${formatQor(total)}</td></tr>`).join('');
  content.innerHTML = `<div class="intro"><h1>Statement</h1><p title="${escape(who)}">${escape(who)}</p></div>
    <div class="layout"><div class="stack"><section class="card action"><div class="tag ${statement.consistent ? 'ok' : 'warn'}">${statement.consistent
      ? 'Balances match the signed agreements' : 'Balances do not reconcile'}</div>
      <h2>Available to withdraw</h2><p class="amount">${formatQor(statement.available)}</p>
      <dl class="totals"><dt>Earned</dt><dd>${formatQor(statement.earned)}</dd><dt>Withdrawn</dt><dd>${formatQor(statement.withdrawn)}</dd><dt>Withdrawals</dt><dd>${statement.nonce}</dd></dl>
      <p>Earnings leave only with this collaborator’s ML-DSA-87 signature. On their own computer they run:</p>
      ${command('npm run pq -- withdraw all')}
      <p>Add <code>--to 0x…</code> to send to another address, or <code>--out withdrawal.json</code> to submit from any wallet below.</p>
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('statement', who)))}">Copy statement link</button></section>
      ${relayForm('Paste a withdrawal the collaborator signed with the signing tool.')}</div>
    <div class="stack"><section class="card ledger"><h2>Agreements</h2>${rows
      ? '<div class="table"><table><thead><tr><th>Agreement</th><th>Share</th><th>Sales</th><th>Earned</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="muted">No live agreement has credited this address yet.</p>'}</section>
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
  content.innerHTML = `<div class="intro"><h1>Submit a signature</h1><p>Send a post-quantum signature that a collaborator made with the QoreSplit signing tool: an acceptance of terms or a withdrawal.</p></div>
    ${setupNotice()}<div class="narrow">${relayForm('Paste the JSON file the tool saved with --out.')}</div>`;
  bindRelay();
}

function verifyPage() {
  content.innerHTML = `<div class="intro"><h1>Verify a receipt</h1><p>Check an EVM checkout against the record it wrote on QoreChain Native.</p></div>
    ${setupNotice()}<section class="card action narrow"><form id="verify-form"><div class="field">
    <label for="hash">Checkout transaction hash</label><input id="hash" name="hash" placeholder="0x…" spellcheck="false" required>
    </div><button class="primary" type="submit" ${address ? '' : 'disabled'}>Verify receipt</button></form></section>`;
  document.querySelector('#verify-form').onsubmit = (event) => {
    event.preventDefault();
    const hash = new FormData(event.currentTarget).get('hash').trim();
    if (!validHash(hash)) { alert('Enter a 0x transaction hash with 64 hexadecimal digits.', 'error'); return; }
    location.hash = contractRoute('receipt', hash.toLowerCase());
  };
}

async function receiptPage(hash, revision) {
  if (!validHash(hash)) throw new Error('Invalid checkout transaction hash.');
  const { receipt, payment, agreement, native, nativeError } = await verifyReceipt(hash);
  if (revision !== rendering) return;
  content.innerHTML = `<div class="intro"><h1>Payment receipt</h1><p>${escape(agreement.title)} · <a href="#${contractRoute('agreement', payment.id)}">Agreement #${payment.id}</a></p></div>
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
  const section = { agreement: 'create', pay: 'create', statement: 'earnings', receipt: 'verify' }[route] ?? route;
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  try {
    if (route === 'create' && deployment === undefined) await createPage(undefined, revision);
    else if (route === 'verify') verifyPage();
    else if (route === 'earnings') earningsPage();
    else if (route === 'submit') submitPage();
    else if (['create', 'agreement', 'pay', 'receipt', 'statement'].includes(route)) {
      if (extra !== undefined || !address || deployment?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('This link requires its original QoreSplit Diana deployment.');
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
      escape(errorMessage(error)) + '</p><a class="secondary" href="#create">Back to QoreSplit</a></div>';
  }
}

walletButton.onclick = () => void run(async (route) => {
  const signer = await connect();
  if (location.href !== route) return;
  if (location.hash === '#earnings') await render();
  else {
    const state = await checkWindow(signer).catch(() => undefined);
    if (location.href !== route) return;
    alert(state?.active === false
      ? 'Wallet connected. Open a Diana EVM window for ' + state.qorAddress + ' before sending.'
      : 'Wallet connected · ' + signer, 'success');
  }
});
window.addEventListener('hashchange', render);
void render();
