import './style.css';
import {
  address, checkWindow, checkoutId, client, formatQor, getEvent, parsePrice, parseShare, read, requestWallet,
  selectWallet, short, splitAmounts, transact, validateLink, verifyReceipt,
} from './chain.js';

const content = document.querySelector('#content');
const status = document.querySelector('#status');
const walletButton = document.querySelector('#wallet');
let provider;
let account;
let rendering = 0;
let busy = false;
let operationStatus;
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
  return code === 4001 ? 'Request cancelled in your wallet.' : (
    error?.shortMessage ?? error?.message ?? 'Something went wrong.'
  );
};
const explorerTx = (hash) => 'https://explore.qore.network/tx/' + hash;
const linkURL = (fragment) => new URL('#' + fragment, location.href).href;
const contractRoute = (route, value) => route + '/' + address + '/' + value;
const validHash = (hash) => /^0x[\da-f]{64}$/i.test(hash ?? '');
const shareLabel = (bps) => String(Number(bps) / 100) + '%';
const icon = (text) => '<span class="step-icon" aria-hidden="true">' + text + '</span>';

function refreshWalletLabel() {
  walletButton.textContent = account ? short(account) : 'Connect wallet';
  walletButton.title = account ?? 'Connect MetaMask or a compatible EVM wallet';
}

function attachWalletEvents(selected) {
  selected.on?.('accountsChanged', (accounts) => {
    account = accounts[0];
    refreshWalletLabel();
    if (location.hash === '#withdraw' && !busy) void render();
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
    const suffix = operationStatus
      ? ' Check transaction ' + operationStatus + ' before retrying.'
      : '';
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

function splitCard(link, heading = 'Payment breakdown', exactCredits) {
  const { price, shares, recipients } = link;
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
  return address ? '' : '<div class="notice"><strong>Preview mode</strong><p>Connect a Diana deployment to publish links, accept payments, and verify live receipts.</p></div>';
}

function createPage() {
  content.innerHTML = `
    <div class="intro"><h1>One payment.<br><em>Everyone gets their share.</em></h1>
    <p>Create a payment link for collaborators. Each recipient can withdraw their share directly, and each checkout includes a receipt anyone can verify.</p></div>
    ${setupNotice()}
    <div class="layout">
      <section class="card editor">
        <div class="card-head"><h2>Create a payment link</h2></div>
        <form id="create-form">
          <div class="field"><label for="title">Payment title</label><input id="title" name="title" maxlength="96" placeholder="Community design workshop" required></div>
          <div class="field"><label for="price">Price per payment</label><div class="with-unit"><input id="price" name="price" inputmode="decimal" placeholder="12.00" required><span>QOR</span></div></div>
          <div class="recipients-head"><h3>Recipients</h3><span id="shares-total">100% allocated</span></div>
          <div id="recipients"></div>
          <button type="button" id="add" class="text-button">+ Add recipient</button>
          <div class="form-foot"><p>The recipient addresses and shares lock when you publish.</p><button class="primary" type="submit" ${address ? '' : 'disabled'}>Publish payment link</button></div>
        </form>
      </section>
      <aside><div id="split-preview"></div>
        <section class="card process"><h2>After checkout</h2><ul>
          <li>${icon('✓')}<span><strong>Shares become claimable</strong><small>Each recipient can withdraw when ready.</small></span></li>
          <li>${icon('≡')}<span><strong>A receipt goes on chain</strong><small>Verify the payment against its Native receipt.</small></span></li>
        </ul></section>
      </aside>
    </div>`;

  const form = document.querySelector('#create-form');
  const list = document.querySelector('#recipients');
  const add = document.querySelector('#add');
  const preview = document.querySelector('#split-preview');
  const totalLabel = document.querySelector('#shares-total');
  let rowCount = 0;

  function addRecipient(share = '') {
    const key = ++rowCount;
    const row = document.createElement('div');
    row.className = 'recipient';
    row.innerHTML = `<div class="field"><label for="recipient-${key}">Wallet address</label><input id="recipient-${key}" name="recipient" placeholder="0x…" spellcheck="false" required></div>
      <div class="field"><label for="share-${key}">Share</label><div class="with-unit"><input id="share-${key}" name="share" inputmode="decimal" value="${share}" placeholder="0" required><span>%</span></div></div>
      <button class="remove" type="button" aria-label="Remove recipient">×</button>`;
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
    add.disabled = shares.length >= 3;
    for (const button of list.querySelectorAll('.remove')) button.disabled = shares.length <= 2;

    let price = 0n;
    try { price = parsePrice(data.get('price').trim()); } catch { /* Await complete input. */ }
    if (!price || total !== 10_000 || shares.includes(0)) {
      preview.innerHTML = splitCard(sample, 'Example split');
      return;
    }
    const recipients = data.getAll('recipient').map((value, i) => value.trim() || 'Recipient ' + (i + 1));
    preview.innerHTML = splitCard({ price, shares, recipients });
  }

  addRecipient('60');
  addRecipient('40');
  add.onclick = () => addRecipient();
  form.oninput = onInput;
  form.onsubmit = (event) => {
    event.preventDefault();
    void run(async (route) => {
      const data = new FormData(form);
      const trim = (value) => value.trim();
      const args = validateLink(trim(data.get('title')), trim(data.get('price')),
        data.getAll('recipient').map(trim), data.getAll('share').map(trim));
      const receipt = await write('createLink', args);
      const { linkId } = getEvent(receipt, 'LinkCreated');
      if (location.href === route) location.hash = contractRoute('pay', linkId);
    });
  };
}

async function payPage(id, revision) {
  if (!/^[1-9]\d{0,77}$/.test(id) || BigInt(id) >= 2n ** 256n) throw new Error('Invalid payment link.');
  const [link, credits] = await Promise.all([read('getLink', [BigInt(id)]), read('quote', [BigInt(id)])]);
  if (revision !== rendering) return;
  content.innerHTML = `<div class="intro"><h1>${escape(link.title)}</h1><p>Payment link #${id} · Created by <span title="${escape(link.organizer)}">${short(link.organizer)}</span></p></div>
    <div class="layout"><section class="card action"><h2>Pay ${formatQor(link.price)}</h2>
    <p>Review the recipients before approving the testnet payment. Each share is credited at checkout and can be withdrawn separately.</p>
    <button class="primary" id="pay" type="button">Pay ${formatQor(link.price)}</button>
    <label class="share-link">Share this checkout<input id="share-url" readonly value="${escape(linkURL(contractRoute('pay', id)))}"></label>
    <button class="secondary" id="copy" type="button">Copy payment link</button></section>
    ${splitCard(link, 'Recipients', credits)}</div>`;
  document.querySelector('#copy').onclick = (event) => copy(linkURL(contractRoute('pay', id)), event.currentTarget);
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
    const payment = receipt.status === 'success'
      ? getEvent(receipt, 'Checkout', { optional: true })
      : undefined;
    savePending(undefined);
    reference = undefined;
    if (payment?.linkId === BigInt(id) && payment.paymentId === expectedPaymentId) {
      if (location.href === route) location.hash = contractRoute('receipt', receipt.transactionHash);
      return;
    }
    pay.textContent = 'Pay ' + formatQor(link.price);
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
      const receipt = await transact(provider, signer, 'checkout', [BigInt(id), reference], link.price, (hash) => {
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

async function withdrawPage(revision) {
  content.innerHTML = `<div class="intro"><h1>Withdraw your shares</h1><p>Your available balance includes credits from every payment link that lists this wallet.</p></div>
    ${setupNotice()}<section class="card action narrow"><h2>Available to withdraw</h2><p id="balance" class="amount">—</p>
    <p id="window-state" class="muted" hidden></p><button class="primary" id="claim" type="button">${account ? 'Withdraw all' : 'Connect wallet'}</button></section>`;
  const claim = document.querySelector('#claim');
  const balance = document.querySelector('#balance');
  const windowState = document.querySelector('#window-state');
  if (!address) { claim.disabled = true; return; }
  if (!account) {
    claim.onclick = () => void run(async (route) => {
      await connect();
      if (route === location.href) await render();
    });
    return;
  }
  const signer = account;
  const amount = await read('claimable', [signer]);
  if (revision !== rendering) return;
  balance.textContent = formatQor(amount);
  claim.disabled = amount === 0n;
  claim.onclick = () => void run(async (route) => {
    const receipt = await write('withdraw');
    const event = getEvent(receipt, 'Withdrawn');
    if (location.href === route) {
      await render();
      alert('Withdrew ' + formatQor(event.amount) + ' · ' + receipt.transactionHash, 'success');
    }
  });
  void checkWindow(signer).then(({ active, qorAddress }) => {
    if (revision !== rendering || active === undefined) return;
    windowState.hidden = false;
    windowState.textContent = active
      ? 'EVM window active · ' + qorAddress
      : 'Open an EVM window for ' + qorAddress + ' before withdrawing.';
  }).catch(() => {});
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
  const { receipt, payment, link, native, nativeError } = await verifyReceipt(hash);
  if (revision !== rendering) return;
  content.innerHTML = `<div class="intro"><h1>Payment receipt</h1><p>${escape(link.title)} · Payment link #${payment.linkId}</p></div>
    <div class="layout"><section class="card action"><div class="tag ${native ? 'ok' : 'warn'}">${native ? 'Verified on EVM and Native' : 'EVM confirmed · Native unverified'}</div>
    <h2>${formatQor(payment.total)} credited</h2>
    <dl><dt>Payer</dt><dd>${escape(payment.payer)}</dd><dt>EVM block</dt><dd>${receipt.blockNumber}</dd><dt>Native receipt ID</dt><dd>${native ? escape(native.id) : 'Unverified'}</dd>
    <dt>Receipt commitment</dt><dd>${escape(payment.commitment)}</dd></dl>
    ${nativeError ? '<p class="muted">' + escape(nativeError) + '</p>' : ''}
    <div class="actions"><a class="secondary" href="${explorerTx(hash)}" target="_blank" rel="noreferrer">View transaction</a>
    <button class="secondary" id="copy" type="button">Copy receipt link</button></div></section>
    ${splitCard(link, 'Shares credited', payment.credits)}</div>`;
  document.querySelector('#copy').onclick = (event) => copy(linkURL(contractRoute('receipt', hash)), event.currentTarget);
}

async function render() {
  const revision = ++rendering;
  const [route, deployment, parameter, extra] = (location.hash.slice(1) || 'create').split('/');
  alert('');
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  try {
    if (route === 'create') createPage();
    else if (route === 'verify') verifyPage();
    else if (route === 'withdraw') await withdrawPage(revision);
    else if (route === 'pay' || route === 'receipt') {
      if (extra !== undefined || !address || deployment?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('This link requires its original QoreSplit Diana deployment.');
      }
      content.innerHTML = '<div class="intro"><h1>Reading QoreChain</h1><p>Waiting for Diana testnet data…</p></div>';
      if (route === 'pay') await payPage(parameter ?? '', revision);
      else await receiptPage(parameter ?? '', revision);
    } else throw new Error('This page does not exist.');
  } catch (error) {
    if (revision !== rendering) return;
    content.innerHTML = '<div class="intro"><h1>Unable to load this page</h1><p>' +
      escape(errorMessage(error)) + '</p><a class="secondary" href="#create">Back to QoreSplit</a></div>';
  }
}

walletButton.onclick = () => void run(async (route) => {
  const signer = await connect();
  if (location.href !== route) return;
  if (location.hash === '#withdraw') await render();
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
