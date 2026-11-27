import './style.css';
import { formatEther, getAddress, isAddress } from 'viem';
import {
  address, chainTime, checkWindow, cosmosHashOf, describeTransaction, getSigningChain, read, checkoutId, client, explainError, formatQor, getAgreement, getDeliveries, getEvent,
  getRefundable, getStatement, getUnitPayments, getWithdrawals, parsePrice, parseRequest, parseShare, pqcKeyStatus,
  requestWallet, switchToDiana, listWallets, getSmartAccount, walletChainId, authorizedAccount, balanceOf, DIANA_CHAIN_ID, qorAddressOf, short, splitAmounts, transact, validateLink, validateService, verifyAgreement, verifyReceipt,
} from './chain.js';
import { MAX_PARTIES, deliverableHash } from './protocol.js';
import { qorexAccount, qorexAvailable, qorexDownload, qorexStatus, signWithQorex } from './qorex.js';
import { homeHtml, liveFacts, liveHtml, liveParties, liveStateHtml } from './story.js';

const content = document.querySelector('#content');
const status = document.querySelector('#status');
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
/** Every transaction link opens Treaty's own transaction page, read straight from Diana. */
const explorerTx = (hash) => '#' + contractRoute('tx', hash);
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

// ----------------------------------------------------------------- wallet
// A standard connect flow: a wallet picker (EIP-6963), an account menu, the network, and a session
// that is remembered. The EVM wallet sends transactions; QoreX adds the post-quantum signatures.
const WALLET_KEY = 'treaty.wallet';
const walletWrap = document.querySelector('#wallet-wrap');
let walletId;
let chainOk = true;
let menuOpen = false;
let balance;
const shortBalance = (wei) => Number(formatEther(wei)).toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' QOR';
const remember = (id) => { try { id ? localStorage.setItem(WALLET_KEY, id) : localStorage.removeItem(WALLET_KEY); } catch {} };
const remembered = () => { try { return localStorage.getItem(WALLET_KEY) ?? undefined; } catch { return undefined; } };

/** A small deterministic avatar for an address, in the site's colours. */
function avatar(value, size = '') {
  const bytes = value.slice(2).match(/../g).map((byte) => parseInt(byte, 16));
  const hue = (i) => (bytes[i] * 360) / 256;
  const cells = Array.from({ length: 16 }, (_, i) => bytes[4 + i] > 120
    ? `<rect x="${(i % 4) * 8}" y="${Math.floor(i / 4) * 8}" width="8" height="8" fill="#ffffff" opacity="${(0.08 + (bytes[4 + i] % 5) / 20).toFixed(2)}"/>` : '').join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue(0)},90%,62%)"/><stop offset="1" stop-color="hsl(${hue(1)},80%,58%)"/></linearGradient></defs><rect width="32" height="32" fill="url(#a)"/>${cells}</svg>`;
  return `<img class="avatar ${size}" alt="" src="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

function renderWallet() {
  if (!account) {
    walletWrap.innerHTML = '<button id="wallet" type="button" class="wallet-btn connect" aria-haspopup="dialog">Connect wallet</button>';
  } else if (!chainOk) {
    walletWrap.innerHTML = `<button id="wallet" type="button" class="wallet-btn wrong" aria-haspopup="menu" aria-expanded="${menuOpen}">Wrong network <span class="chev">▾</span></button>` + walletMenu();
  } else {
    walletWrap.innerHTML = `<button id="wallet" type="button" class="wallet-btn" aria-haspopup="menu" aria-expanded="${menuOpen}" title="${escape(account)}">${avatar(account)}<span>${short(account)}</span><span class="net-badge">Diana</span><span class="chev">▾</span></button>` + walletMenu();
  }
  walletWrap.querySelector('#wallet').onclick = (event) => {
    event.stopPropagation();
    if (!account) void run(async () => { await connect({ choose: true }); alert('Wallet connected · ' + account, 'success'); });
    else { menuOpen = !menuOpen; renderWallet(); if (menuOpen) void refreshBalance(); }
  };
  walletWrap.querySelector('.wallet-menu')?.addEventListener('click', onMenu);
}

function walletMenu() {
  const name = listWallets().find((wallet) => wallet.id === walletId)?.name ?? 'Wallet';
  const qor = qorAddressOf(account);
  const pq = qorexAvailable()
    ? '<div class="wm-pq ok"><b>QoreX detected.</b> Post-quantum (ML-DSA-87) signing is ready in this browser.</div>'
    : '<div class="wm-pq"><b>QoreX not found.</b> Add the QoreX wallet to sign with your ML-DSA-87 key here, or use the signing tool.</div>';
  return `<div class="wallet-menu" role="menu" ${menuOpen ? '' : 'hidden'}>
    <div class="wm-head">${avatar(account, 'lg')}<span><strong>${short(account)}</strong><small title="${escape(qor)}">${escape(qor.slice(0, 12) + '…' + qor.slice(-6))}</small></span>
      <span class="net-badge ${chainOk ? '' : 'bad'}">${chainOk ? 'Diana' : 'Wrong chain'}</span></div>
    <div class="wm-balance"><span>Balance on Diana<small>via ${escape(name)}</small></span><b id="wm-balance">${balance === undefined ? '…' : shortBalance(balance)}</b></div>
    ${chainOk ? '' : '<button class="wm-item attention" data-act="switch" role="menuitem"><i>⇄</i>Switch to QoreChain Diana</button>'}
    <button class="wm-item" data-act="copy" role="menuitem"><i>⧉</i>Copy 0x address</button>
    <button class="wm-item" data-act="copy-qor" role="menuitem"><i>⧉</i>Copy qor1 address</button>
    ${address ? `<a class="wm-item" href="#${contractRoute('statement', account)}" data-act="close" role="menuitem"><i>◎</i>My earnings and limits</a>` : ''}
    ${pq}
    <div class="wm-sep"></div>
    <button class="wm-item" data-act="change" role="menuitem"><i>↺</i>Change wallet</button>
    <button class="wm-item danger" data-act="disconnect" role="menuitem"><i>⏻</i>Disconnect</button></div>`;
}

async function refreshBalance() {
  if (!account) return;
  const owner = account;
  const value = await balanceOf(owner).catch(() => undefined);
  if (owner !== account) return;
  balance = value;
  const target = document.querySelector('#wm-balance');
  if (target) target.textContent = value === undefined ? 'unavailable' : shortBalance(value);
}

async function onMenu(event) {
  const act = event.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  event.stopPropagation();
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); alert(what + ' copied.', 'success'); } catch { alert(text); }
  };
  if (act === 'copy') await copy(account, 'Address');
  else if (act === 'copy-qor') await copy(qorAddressOf(account), 'qor1 address');
  else if (act === 'switch') {
    await run(async () => { await switchToDiana(provider); await refreshChain(); alert('Switched to QoreChain Diana.', 'success'); });
    return;
  } else if (act === 'change') {
    menuOpen = false;
    await run(async () => { await connect({ choose: true, fresh: true }); alert('Wallet connected · ' + account, 'success'); });
    return;
  } else if (act === 'disconnect') disconnect();
  menuOpen = false;
  renderWallet();
}

function disconnect() {
  provider?.removeListener?.('accountsChanged', onAccounts);
  provider?.removeListener?.('chainChanged', onChain);
  provider = account = walletId = balance = undefined;
  chainOk = true;
  menuOpen = false;
  remember();
  renderWallet();
  alert('Wallet disconnected from Treaty.', 'info');
  if (location.hash.startsWith('#earnings') && !busy) void render();
void restoreWallet();
}

function onAccounts(accounts) {
  const next = accounts?.[0];
  if (!next) { disconnect(); return; }
  account = getAddressSafe(next);
  balance = undefined;
  renderWallet();
  if (location.hash === '#earnings' && !busy) void render();
void restoreWallet();
}
const getAddressSafe = (value) => (isAddress(value ?? '') ? getAddress(value) : account);
function onChain(id) { chainOk = Number(id) === DIANA_CHAIN_ID; renderWallet(); }
async function refreshChain() {
  const id = await walletChainId(provider);
  chainOk = id === undefined || id === DIANA_CHAIN_ID;
  renderWallet();
}

function use(wallet) {
  if (provider && provider !== wallet.provider) {
    provider.removeListener?.('accountsChanged', onAccounts);
    provider.removeListener?.('chainChanged', onChain);
  }
  provider = wallet.provider;
  walletId = wallet.id;
  provider.on?.('accountsChanged', onAccounts);
  provider.on?.('chainChanged', onChain);
}

/** The wallet picker. Resolves with the chosen wallet; rejects if closed. */
function chooseWallet() {
  return new Promise((resolve, reject) => {
    const wallets = listWallets();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const option = (wallet, i) => `<button class="wallet-option" data-i="${i}" type="button">${wallet.icon && /^data:image\//.test(wallet.icon)
      ? `<img src="${escape(wallet.icon)}" alt="">` : `<span class="wicon">${escape(wallet.name.slice(0, 1))}</span>`}<span>${escape(wallet.name)}<small>${wallet.id === walletId ? 'Connected' : 'Detected in this browser'}</small></span>
      ${remembered() === wallet.id ? '<span class="tag-right">Last used</span>' : ''}</button>`;
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
      <div class="modal-head"><h2 id="wallet-title">Connect a wallet</h2><button class="modal-close" type="button" aria-label="Close">✕</button></div>
      <p>Your EVM wallet sends Treaty transactions on QoreChain Diana (chain ID 9800). Treaty never sees your keys.</p>
      <div class="modal-group">${wallets.length ? 'Detected wallets' : 'No EVM wallet found'}</div>
      <div class="wallet-list">${wallets.length ? wallets.map(option).join('') : `
        <a class="wallet-option" href="https://metamask.io/download/" target="_blank" rel="noreferrer"><span class="wicon">M</span><span>Install MetaMask<small>Or any EVM wallet, then reload this page</small></span><span class="tag-right dim">Get ↗</span></a>`}</div>
      <div class="modal-group">Post-quantum signing</div>
      <div class="wallet-list"><div class="wallet-option" style="cursor:default"><span class="wicon">Q</span><span>QoreX<small>${qorexAvailable() ? 'Detected: signs your ML-DSA-87 approvals' : 'Signs ML-DSA-87 approvals in the browser'}</small></span>
        <span class="tag-right ${qorexAvailable() ? '' : 'dim'}">${qorexAvailable() ? 'Ready' : 'Optional'}</span></div></div>
      <div class="modal-foot">Agents and people sign the terms, deliveries and withdrawals with ML-DSA-87; the EVM wallet only pays gas and sends. New to Diana? <a href="https://dashboard.qorechain.io/faucet" target="_blank" rel="noreferrer">Get test QOR ↗</a></div></div>`;
    const close = (error) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      if (error) reject(error);
    };
    const onKey = (event) => { if (event.key === 'Escape') close(new Error('Wallet connection cancelled.')); };
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('.modal-close')) { close(new Error('Wallet connection cancelled.')); return; }
      const pick = event.target.closest('[data-i]');
      if (pick) { close(); resolve(wallets[Number(pick.dataset.i)]); }
    });
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    backdrop.querySelector('.wallet-option, .modal-close')?.focus();
  });
}

/**
 * The connected account. Opens the wallet picker when asked to, or when the choice is not obvious:
 * a remembered wallet or the only wallet in the browser is used directly.
 */
async function connect({ choose = false, fresh = false } = {}) {
  if (!provider || fresh) {
    const wallets = listWallets();
    const known = wallets.find((wallet) => wallet.id === remembered());
    const wallet = !choose && !fresh && (known ?? (wallets.length === 1 ? wallets[0] : undefined)) || await chooseWallet();
    use(wallet);
  }
  account = await requestWallet(provider);
  remember(walletId);
  balance = undefined;
  await refreshChain();
  return account;
}

/** Restore a remembered session quietly, without a wallet prompt. */
async function restoreWallet() {
  const id = remembered();
  if (!id) { renderWallet(); return; }
  await new Promise((resolve) => setTimeout(resolve, 250)); // let wallets announce themselves
  const wallet = listWallets().find((candidate) => candidate.id === id);
  const found = wallet && await authorizedAccount(wallet.provider);
  if (!found) { renderWallet(); return; }
  use(wallet);
  account = found;
  await refreshChain();
}
document.addEventListener('click', (event) => {
  if (menuOpen && !walletWrap.contains(event.target)) { menuOpen = false; renderWallet(); }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuOpen) { menuOpen = false; renderWallet(); }
});

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
    escape(/^0x[\da-fA-F]{40}$/.test(recipient) ? short(recipient) : recipient) + '<small>' + shareLabel(shares[i]) +
    '</small></span><strong>' + formatQor(credits[i]) + '</strong></li>'
  ).join('');
  return '<section class="card breakdown"><div class="card-head"><h2>' + heading +
    '</h2><strong>' + formatQor(price) + '</strong></div>' + note + '<div class="bar" aria-hidden="true">' +
    shares.map((share, i) => '<span class="c' + i + '" style="--share:' + Number(share) + '"></span>').join('') +
    '</div><ul>' + rows + '</ul></section>';
}

function setupNotice() {
  return address ? '' : '<div class="notice"><strong>Preview mode</strong><p>Connect a Diana deployment to propose treaties, move money, and verify live receipts.</p></div>';
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

/** Why there is no QoreX button here, and what to do instead. */
const qorexHint = () => qorexStatus() === 'cannot-sign-messages'
  ? '<p class="muted qorex-hint">Your QoreX wallet cannot sign messages yet. Until it can, sign with the signing tool or an agent, and send the signed request below.</p>'
  : '<p class="muted qorex-hint">Install the <a href="' + qorexDownload + '" target="_blank" rel="noreferrer">QoreX wallet</a> to sign here with your post-quantum key, or use the signing tool.</p>';

/**
 * Sign a Treaty message with QoreX as `expected`, then send the call from the connected EVM wallet.
 * `messageCall` names the contract view that returns the exact bytes; `args(signature)` builds the call.
 */
function qorexAction({ expected, messageCall, action, args, done }) {
  return () => void run(async (route) => {
    const signingChain = await getSigningChain();
    const message = await read(...messageCall);
    alert('Approve the message in QoreX…');
    const { signature } = await signWithQorex(message, { chainId: signingChain, signingChain, expected });
    const receipt = await write(action, args(signature));
    if (location.href === route) await done(receipt);
  });
}

/** A form that relays a signed request from the signing tool or an agent. Any connected wallet can send it. */
function relayForm(hint) {
  return `<section class="card action relay"><h2>Submit a signature</h2>
    <p>${hint} The signature is checked on chain against the signer’s registered ML-DSA-87 key, so the wallet that sends it does not matter.</p>
    <form class="relay-form"><div class="field"><label for="signed-request">Signed request from <code>--out</code> or an agent</label>
    <textarea id="signed-request" name="request" rows="5" spellcheck="false" placeholder='{"kind":"treaty-signed-request", …}' required></textarea></div>
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
            activated ? 'Final signature recorded. The treaty is live.' : 'Signature recorded for ' + short(request.args[1]) + '.');
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
  return `<nav class="tabs" aria-label="Kind of treaty">
    <a href="#create" ${current === 'revenue' ? 'aria-current="page"' : ''}>Revenue share</a>
    <a href="#service" ${current === 'service' ? 'aria-current="page"' : ''}>Service treaty</a></nav>`;
}

const howItWorks = `<section class="card process"><h2>Why it holds</h2><ul>
  <li>${icon('1')}<span><strong>Every party signs the terms</strong><small>People and agents alike, with ML-DSA-87 keys checked on chain.</small></span></li>
  <li>${icon('2')}<span><strong>The contract holds the money</strong><small>It pays out only as agreed, with a receipt on EVM and QoreChain Native.</small></span></li>
  <li>${icon('3')}<span><strong>A stolen wallet key gets nothing</strong><small>Every signed action needs the post-quantum key.</small></span></li>
  <li>${icon('4')}<span><strong>Owners keep agents on a leash</strong><small>Spending limits the contract enforces, and an off switch.</small></span></li>
</ul></section>`;

const intro = `<p class="eyebrow">Make a treaty</p><h1>Set the terms. Everyone signs.</h1>
  <p>Choose a service treaty to hire an agent, or a team of agents, for units of work, or a revenue share to split every payment. Nothing is binding until every party signs the exact terms with its post-quantum key, and the contract holds the money from then on.</p>`;

async function createPage(previousId, revision) {
  let previous;
  if (previousId !== undefined) {
    if (!validId(previousId)) throw new Error('Invalid treaty number.');
    previous = await getAgreement(BigInt(previousId));
    if (revision !== rendering) return;
    if (previous.state !== 'Active' || previous.service) throw new Error('Only a live revenue share can be changed.');
  }
  content.innerHTML = `
    <div class="intro">${previous
      ? `<h1>Change treaty #${previousId}</h1><p>The new version goes live only when everyone on it <em>and</em> everyone on #${previousId} signs. Until then, #${previousId} keeps taking payments.</p>`
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
          <button class="primary" type="submit" ${address ? '' : 'disabled'}>${previous ? 'Propose this change' : 'Propose treaty'}</button></div>
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
          <button class="primary" type="submit" ${address ? '' : 'disabled'}>Propose treaty</button></div>
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
      <td>${overdue ? `<button class="secondary small" type="button" data-release="${delivery.unit}">Release payment</button>` : ''}
      ${delivery.state === 'Pending' && qorexAvailable() ? `<button class="secondary small" type="button" data-qorex-review="accept" data-unit="${delivery.unit}">Accept with QoreX</button>
        ${overdue ? '' : `<button class="secondary small" type="button" data-qorex-review="reject" data-unit="${delivery.unit}">Reject with QoreX</button>`}` : ''}</td></tr>`;
  }).join('');
  let main;
  if (agreement.state === 'Active' && !agreement.funded) {
    main = `<section class="card action"><div class="tag warn">Live · waiting for the budget</div>
      <h2>${pastDeadline ? 'The deadline passed before the budget was locked' : 'The client locks ' + formatQor(agreement.budget)}</h2>
      <p>${pastDeadline ? 'Nothing was locked, so there is nothing to return.' : 'Every party signed. Work starts once the budget is in the contract, where the providers can see it. The client locks it, or its owner when the client is an agent; the owner’s limits apply.'}</p>
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
          ${qorexAvailable() ? `<form id="deliver-form" class="deliver-form"><div class="field"><label for="work">Deliver one unit as a provider</label>
            <input id="work" name="work" type="file" required></div><button class="primary" type="submit">Deliver with QoreX</button></form>` : qorexHint()}
          ${command('npm run pq -- deliver ' + id + ' --file work.zip')}
          ${command('npm run pq -- accept ' + id + ' <delivery>')}`}</section>`;
  }
  const deliveriesCard = agreement.funded ? `<section class="card ledger"><h2>Deliveries</h2>${rows
    ? '<div class="table"><table><thead><tr><th>#</th><th>Provider</th><th>Work hash</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    : '<p class="muted">Nothing delivered yet.</p>'}<div id="payments"></div></section>` : '';
  return { main, deliveriesCard };
}

async function agreementPage(id, revision) {
  if (!validId(id)) throw new Error('Invalid treaty number.');
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
      ${!signed && agreement.state === 'Pending' && qorexAvailable()
        ? `<button class="secondary small" type="button" data-qorex-sign="${escape(signer)}">Sign with QoreX</button>`
        : `<a class="small-link" href="#${contractRoute('statement', signer)}">Statement</a>`}</li>`;
  }).join('');
  const isParty = account && (same(account, agreement.proposer) || agreement.signers.some((signer) => same(signer, account)));
  const nativeLine = verification.native
    ? `<dl><dt>Terms receipt on Native</dt><dd>#${escape(verification.native.id)} · ${escape(verification.commitment)}</dd></dl>`
    : (verification.nativeError ? '<p class="muted">' + escape(verification.nativeError) + '</p>' : '');

  let main;
  if (agreement.state === 'Pending') {
    main = `<section class="card action"><div class="tag warn">${label} · ${signedCount} of ${agreement.signers.length}</div>
      <h2>Every party signs these terms</h2>
      <p>Send this page to every party. People sign with the Treaty signing tool (the command below), or right here with QoreX once their QoreX can sign messages; agents sign with the Treaty SDK. Every signature is ML-DSA-87, checked on chain.</p>
      ${qorexAvailable() ? '' : qorexHint()}
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
      <p>All parties signed treaty #${agreement.successor}, which replaced this one. Its ${plural(agreement.sales, 'past payment')} stay credited.</p>
      <a class="primary" href="#${contractRoute('agreement', agreement.successor)}">Open treaty #${agreement.successor}</a></section>`;
  } else {
    main = `<section class="card action"><div class="tag muted">${label}</div><h2>This proposal was cancelled</h2><p>It never went live and moved no money.</p>
      <a class="secondary" href="#create">Propose a new treaty</a></section>`;
  }

  const termsCard = agreement.service
    ? splitCard(agreement, 'Each accepted unit', undefined,
      `<p class="muted budget">Client <a href="#${contractRoute('statement', agreement.client)}" title="${escape(agreement.client)}">${short(agreement.client)}</a> · up to ${agreement.maxUnits} units · budget <strong>${formatQor(agreement.budget)}</strong> · until ${when(agreement.deadline)} · review ${duration(agreement.reviewPeriod)}</p>`)
    : splitCard(agreement, 'Terms');
  const relay = agreement.state === 'Pending'
    ? relayForm('Paste a signed request a party saved with the signing tool, or an agent produced.')
    : (agreement.service && agreement.state === 'Active' && agreement.funded ? relayForm('Paste a delivery, acceptance or rejection signed by a provider or the client.') : '');
  content.innerHTML = `<div class="intro"><p class="eyebrow">${agreement.service ? 'Service treaty' : 'Revenue share'} #${id}</p><h1>${escape(agreement.title)}</h1>
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
  for (const button of content.querySelectorAll('[data-qorex-sign]')) {
    const signer = button.dataset.qorexSign;
    button.onclick = qorexAction({
      expected: signer, messageCall: ['termsMessage', [agreementId, signer]], action: 'sign',
      args: (signature) => [agreementId, signer, signature],
      done: (receipt) => show(contractRoute('agreement', id), getEvent(receipt, 'Activated', { optional: true })
        ? 'Final signature recorded. The treaty is live.' : 'Your signature is recorded.'),
    });
  }
  for (const button of content.querySelectorAll('[data-qorex-review]')) {
    const unit = BigInt(button.dataset.unit);
    const accepted = button.dataset.qorexReview === 'accept';
    button.onclick = qorexAction({
      expected: agreement.client, messageCall: ['reviewMessage', [agreementId, unit, accepted]], action: accepted ? 'accept' : 'reject',
      args: (signature) => [agreementId, unit, signature],
      done: () => show(contractRoute('agreement', id), 'Delivery ' + unit + (accepted ? ' accepted and paid.' : ' rejected.')),
    });
  }
  const deliverForm = document.querySelector('#deliver-form');
  if (deliverForm) {
    deliverForm.onsubmit = (event) => {
      event.preventDefault();
      void run(async (route) => {
        const file = deliverForm.querySelector('#work').files[0];
        if (!file) throw new Error('Choose the file you deliver.');
        const work = deliverableHash(new Uint8Array(await file.arrayBuffer()));
        const signingChain = await getSigningChain();
        const { address: provider } = await qorexAccount(signingChain);
        if (!agreement.recipients.some((recipient) => same(recipient, provider))) {
          throw new Error('QoreX is on ' + provider + ', which is not a provider in this treaty.');
        }
        const { deliveries } = await read('getAgreement', [agreementId]);
        const message = await read('deliveryMessage', [agreementId, BigInt(deliveries), provider, work]);
        alert('Approve the delivery in QoreX…');
        const { signature } = await signWithQorex(message, { chainId: signingChain, signingChain, expected: provider });
        const receipt = await write('deliver', [agreementId, provider, work, signature]);
        if (location.href === route) await show(contractRoute('agreement', id), 'Delivery ' + getEvent(receipt, 'Delivered').unit + ' recorded. Work hash ' + work + '.');
      });
    };
  }
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
        <a href="${explorerTx(payment.hash)}">View</a></li>`).join('') + '</ul>';
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
  const pendingKey = 'treaty:pending:' + address + ':' + id;
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
    <dt>Per treaty</dt><dd>${formatQor(mandate.maxPerTreaty)}</dd><dt>Committed</dt><dd>${formatQor(mandate.committed)} of ${formatQor(mandate.maxTotal)}</dd>
    <dt>Until</dt><dd>${when(mandate.expiry)}</dd></dl>
    <p>${off ? 'This agent can no longer sign anything here. Only its owner can move its earnings, and unused budgets go back to the owner:'
      : 'The contract refuses any treaty that would take this agent past these limits. The owner can switch it off at any time:'}</p>
    ${!off && qorexAvailable() ? '<button class="secondary" id="qorex-revoke" type="button">Switch off with QoreX (owner)</button>' : ''}
    ${command(off ? 'npm run pq -- withdraw all --for ' + who : 'npm run pq -- revoke ' + who)}</section>`;
}

const uqorText = (value) => formatQor(BigInt(value) * 10n ** 12n);

/** QoreChain's own spending rules for this account, or for the owner whose account an agent spends from. */
function smartAccountCard(state, { whose, ownerOf }) {
  const now = Date.now() / 1000;
  const keys = state.authenticators.map((key) => {
    const expired = Number(key.expiryUnix) < now;
    const status = key.revoked ? ['Revoked', 'muted'] : expired ? ['Expired', 'muted'] : ['Active', 'ok'];
    return `<li><span>${escape(key.label || 'Linked key')}<small>${escape(key.scheme)} key ${escape(key.pubkeyHex.slice(0, 10))}… · may: ${escape(key.permissions.join(', '))} · until ${new Date(Number(key.expiryUnix) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</small></span>
      <span class="tag ${status[1]}">${status[0]}</span></li>`;
  }).join('');
  const rules = state.rules.map((rule) => `<div class="rule${rule.enabled ? '' : ' off'}">
      <dl class="totals"><dt>Per call</dt><dd>${Number(rule.perTxLimit) ? uqorText(rule.perTxLimit) : 'no limit'}</dd>
      <dt>Per day</dt><dd>${Number(rule.dailyLimit) ? uqorText(rule.dailyLimit) : 'no limit'}</dd>
      <dt>Coins</dt><dd>${rule.allowedDenoms.length ? escape(rule.allowedDenoms.join(', ').replace('uqor', 'QOR')) : 'any'}</dd></dl>
      <div class="calls">${rule.calls.length ? rule.calls.map((call) => `<span class="chip-call">${escape(call)}</span>`).join('') : '<span class="chip-call">value transfers only</span>'}</div></div>`).join('');
  return `<section class="card action smart-card"><div class="tag ok">Enforced by QoreChain</div>
    <h2>Chain-enforced spending rules</h2>
    <p>${ownerOf ? `This agent spends its owner’s money only through a key linked to the owner’s account, <span title="${escape(state.qorAddress)}">${escape(state.qorAddress.slice(0, 12))}…</span>. ` : ''}QoreChain’s smart-account module checks every call a linked key makes against these rules before it runs, then Treaty checks its own. Linking, changing and revoking need ${whose} hybrid ML-DSA-87 signature.</p>
    ${rules || '<p class="muted">No spending rule.</p>'}
    <h3>Linked keys</h3><ul class="history">${keys || '<li><span class="muted">None</span></li>'}</ul>
    ${command('npm run accounts -- session-status')}</section>`;
}

async function renderSmartAccount(who, mandate, revision) {
  const slot = document.querySelector('#smart-account');
  const owner = mandate?.owner;
  const [own, owners] = await Promise.all([
    getSmartAccount(who).catch(() => undefined),
    owner ? getSmartAccount(owner).catch(() => undefined) : undefined,
  ]);
  if (revision !== rendering || !slot) return;
  slot.innerHTML = [
    own?.smartAccount ? smartAccountCard(own, { whose: 'this account’s' }) : '',
    owners?.smartAccount ? smartAccountCard(owners, { whose: 'the owner’s', ownerOf: true }) : '',
  ].join('');
  bindCopy();
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
      ? 'Balances match the signed treaties' : 'Balances do not reconcile'}</div>
      <h2>Available to withdraw</h2><p class="amount">${formatQor(statement.available)}</p>
      <dl class="totals"><dt>Earned</dt><dd>${formatQor(statement.earned)}</dd><dt>Withdrawn</dt><dd>${formatQor(statement.withdrawn)}</dd><dt>Withdrawals</dt><dd>${statement.nonce}</dd></dl>
      <p>${switchedOff ? 'This agent was switched off, so only its owner’s ML-DSA-87 signature can move these earnings.' : 'Earnings leave only with this account’s ML-DSA-87 signature. On their own computer they run:'}</p>
      ${command(switchedOff ? 'npm run pq -- withdraw all --for ' + who : 'npm run pq -- withdraw all')}
      ${statement.available && qorexAvailable() ? `<button class="primary" id="qorex-withdraw" type="button">Withdraw ${formatQor(statement.available)} with QoreX</button>` : ''}
      <p>Add <code>--to 0x…</code> to send elsewhere, or <code>--out withdrawal.json</code> to submit from any wallet below.</p>
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('statement', who)))}">Copy statement link</button></section>
      ${statement.mandate ? mandateCard(who, statement.mandate, switchedOff) : ''}
      <div id="smart-account"></div>
      ${relayForm('Paste a withdrawal, or an owner’s limits or off switch, signed with the signing tool or an agent.')}</div>
    <div class="stack"><section class="card ledger"><h2>Earning from</h2>${rows
      ? '<div class="table"><table><thead><tr><th>Treaty</th><th>Share</th><th>Paid</th><th>Earned</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="muted">No live treaty has credited this address yet.</p>'}</section>
    ${statement.clientOf.length ? `<section class="card ledger"><h2>Paying for</h2><ul class="history">${statement.clientOf.map((id) =>
      `<li><span>Service treaty #${id}</span><a href="#${contractRoute('agreement', id)}">Open</a></li>`).join('')}</ul></section>` : ''}
    <section class="card ledger"><h2>Withdrawals</h2><div id="withdrawals"><p class="muted">Reading history…</p></div></section></div></div>`;
  bindCopy();
  bindRelay();
  const qorexWithdraw = document.querySelector('#qorex-withdraw');
  if (qorexWithdraw) {
    qorexWithdraw.onclick = qorexAction({
      expected: statement.signer,
      messageCall: ['withdrawalMessage', [who, statement.signer, statement.available, statement.nonce]],
      action: 'withdraw', args: (signature) => [who, statement.signer, statement.available, signature],
      done: (receipt) => show(contractRoute('statement', who),
        'Withdrew ' + formatQor(getEvent(receipt, 'Withdrawn').amount) + ' · ' + receipt.transactionHash),
    });
  }
  const qorexRevoke = document.querySelector('#qorex-revoke');
  if (qorexRevoke) {
    qorexRevoke.onclick = qorexAction({
      expected: statement.mandate.owner, messageCall: ['revokeMessage', [who]], action: 'revokeMandate',
      args: (signature) => [who, signature], done: () => show(contractRoute('statement', who), 'The agent is switched off.'),
    });
  }
  void renderSmartAccount(who, statement.mandate, revision);
  void getWithdrawals(who).then((withdrawals) => {
    if (revision !== rendering) return;
    document.querySelector('#withdrawals').innerHTML = withdrawals.length
      ? '<ul class="history">' + withdrawals.reverse().map((item) => `<li><span>${formatQor(item.amount)} to <span title="${escape(item.to)}">${short(item.to)}</span>
        <small>Withdrawal #${item.nonce} · block ${item.block}</small></span><a href="${explorerTx(item.hash)}">View</a></li>`).join('') + '</ul>'
      : '<p class="muted">No withdrawals yet.</p>';
  }).catch(() => {
    if (revision !== rendering) return;
    document.querySelector('#withdrawals').innerHTML = '<p class="muted">The RPC did not return the withdrawal history. The totals above come from contract state.</p>';
  });
}

function submitPage() {
  content.innerHTML = `<div class="intro"><h1>Submit a signature</h1><p>Send any post-quantum-signed action that a person made with the Treaty signing tool, or an agent made with the SDK: accepting terms, delivering work, reviewing it, withdrawing, or an owner setting limits or switching an agent off.</p></div>
    ${setupNotice()}<div class="narrow">${relayForm('Paste the JSON request.')}</div>`;
  bindRelay();
}

function verifyPage() {
  content.innerHTML = `<div class="intro"><h1>Verify a receipt</h1><p>Check a revenue-share payment against the record it wrote on QoreChain Native. Service payments are verified on their treaty’s page.</p></div>
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
  content.innerHTML = `<div class="intro"><h1>Payment receipt</h1><p>${escape(agreement.title)} · <a href="#${contractRoute('agreement', payment.id)}">Treaty #${payment.id}</a></p></div>
    <div class="layout"><section class="card action"><div class="tag ${native ? 'ok' : 'warn'}">${native ? 'Verified on EVM and Native' : 'EVM confirmed · Native unverified'}</div>
    <h2>${formatQor(payment.total)} credited</h2>
    <dl><dt>Payer</dt><dd>${escape(payment.payer)}</dd><dt>EVM block</dt><dd>${receipt.blockNumber}</dd><dt>Native receipt ID</dt><dd>${native ? escape(native.id) : 'Unverified'}</dd>
    <dt>Receipt commitment</dt><dd>${escape(payment.commitment)}</dd></dl>
    ${nativeError ? '<p class="muted">' + escape(nativeError) + '</p>' : ''}
    <div class="actions"><a class="secondary" href="${explorerTx(hash)}">Transaction details</a>
    <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('receipt', hash)))}">Copy receipt link</button></div></section>
    ${splitCard(agreement, 'Shares credited', payment.credits)}</div>`;
  bindCopy();
}

const eventText = {
  Proposed: (a) => ['Treaty #' + a.id + ' proposed', 'The terms are on chain; every party must now sign them.'],
  Signed: (a) => ['Treaty #' + a.id + ' signed by ' + short(a.signer), 'An ML-DSA-87 signature over the exact terms, checked with pqcVerify.'],
  Activated: (a) => ['Treaty #' + a.id + ' is live', 'Every party has signed; the terms are recorded on QoreChain Native.'],
  Superseded: (a) => ['Treaty #' + a.previous + ' replaced by #' + a.successor, 'Every old and new party signed the new version.'],
  Cancelled: (a) => ['Treaty #' + a.id + ' cancelled', 'The proposal was withdrawn before it went live.'],
  Checkout: (a) => [formatQor(a.total) + ' paid into treaty #' + a.id, 'Every share credited in this transaction, with a receipt on Native.'],
  Funded: (a) => [formatQor(a.amount) + ' locked in treaty #' + a.id, 'The budget is held by the contract until work is paid or refunded.'],
  Delivered: (a) => ['Delivery ' + a.unit + ' of treaty #' + a.id, 'By ' + short(a.provider) + ', signed with ML-DSA-87. Work hash ' + short(a.deliverable) + '.'],
  Rejected: (a) => ['Delivery ' + a.unit + ' of treaty #' + a.id + ' rejected', 'The client rejected it within the review period; nothing was paid.'],
  Paid: (a) => ['Delivery ' + a.unit + ' of treaty #' + a.id + ' paid', (a.how === 2 ? 'Accepted by the client. ' : 'Released after the review period. ') + 'Credited: ' + a.credits.map(formatQor).join(' + ') + '.'],
  Refunded: (a) => [formatQor(a.amount) + ' returned from treaty #' + a.id, 'Unused budget after the deadline, sent to ' + short(a.to) + '.'],
  MandateSet: (a) => ['Limits set for agent ' + short(a.agent), 'Owner ' + short(a.owner) + ': ' + formatQor(a.maxPerTreaty) + ' per treaty, ' + formatQor(a.maxTotal) + ' in total. Both signed with ML-DSA-87.'],
  MandateRevoked: (a) => ['Agent ' + short(a.agent) + ' switched off', 'By its owner ' + short(a.owner) + '. Only the owner can move its money now.'],
  Withdrawn: (a) => [formatQor(a.amount) + ' withdrawn', 'From the earnings of ' + short(a.recipient) + ' to ' + short(a.to) + ', signed with ML-DSA-87.'],
};

/** One transaction, read from Diana and explained. */
async function txPage(hash, revision) {
  if (!validHash(hash)) throw new Error('Invalid transaction hash.');
  const [details, cosmosTx] = await Promise.all([describeTransaction(hash), cosmosHashOf(hash)]);
  if (revision !== rendering) return;
  const { receipt, transaction, events, time, fee } = details;
  const ok = receipt.status === 'success';
  const rows = events.map(({ name, args, native, nativeError }) => {
    const [title, text] = eventText[name]?.(args) ?? [name, ''];
    const nativeLine = native ? '<span class="amount-tag">Native receipt #' + escape(native.id) + ' verified</span>'
      : nativeError ? '<span class="amount-tag warn-tag">Native: ' + escape(nativeError) + '</span>' : '';
    return `<article class="event"><span class="dot">✓</span><div><h3>${escape(title)}</h3><p>${escape(text)}</p>${nativeLine}</div><div class="meta">${escape(name)}</div></article>`;
  }).join('');
  const explorerLink = cosmosTx ? 'https://explore.qore.network/tx/' + cosmosTx : undefined;
  content.innerHTML = `<div class="intro"><p class="eyebrow">Transaction on QoreChain Diana</p><h1>${ok ? 'Confirmed' : 'Reverted'}${events.length ? ' · ' + escape(eventText[events.at(-1).name]?.(events.at(-1).args)[0] ?? events.at(-1).name) : ''}</h1>
    <p>Read just now from Diana's EVM, and checked against QoreChain Native where the transaction wrote a receipt.</p></div>
    <div class="layout"><div class="stack">
      <section class="card"><div class="card-head"><h2>What happened</h2><span class="tag ${ok ? 'ok' : 'warn'}">${ok ? 'Success' : 'Reverted'}</span></div>
        ${rows ? '<div class="timeline tx-events">' + rows + '</div>' : '<p class="muted">This transaction emitted no Treaty events.</p>'}</section>
    </div>
    <section class="card action"><h2>Details</h2>
      <dl><dt>EVM hash</dt><dd>${escape(hash)}</dd><dt>Explorer (Cosmos) hash</dt><dd>${escape(cosmosTx ?? 'not found')}</dd>
      <dt>Block</dt><dd>${receipt.blockNumber} · ${escape(time.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }))}</dd>
      <dt>From</dt><dd><a href="#${contractRoute('statement', transaction.from)}">${escape(transaction.from)}</a></dd>
      <dt>To</dt><dd>${escape(receipt.to ?? receipt.contractAddress ?? '—')}</dd>
      <dt>Gas used · fee</dt><dd>${receipt.gasUsed.toLocaleString('en-US')} · ${formatQor(fee)}</dd></dl>
      ${explorerLink ? `<a class="secondary arrow" href="${explorerLink}" target="_blank" rel="noreferrer">Open in QoreChain Explorer</a>
        <p class="muted small-note">The explorer opens on mainnet. Choose <strong>Testnet</strong> at the top of the explorer, then open this link again.</p>` : ''}
      <button class="secondary" type="button" data-copy="${escape(linkURL(contractRoute('tx', hash)))}">Copy link to this page</button>
    </section></div>`;
  bindCopy();
}

/** The home page: what Treaty is. `#home/<section>` scrolls to a section. */
function homePage(section) {
  content.className = '';
  content.innerHTML = homeHtml();
  const target = section && document.getElementById(section);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

/** The live deal: the real run on Diana, and Treaty #1's state read from the chain now. */
async function livePage(revision) {
  content.className = '';
  content.innerHTML = liveHtml();
  window.scrollTo(0, 0);
  if (!address || !same(address, liveFacts.contract)) return;
  try {
    const agreement = await getAgreement(1n);
    const [deliveries, mandate, data, cleaner] = await Promise.all([
      getDeliveries(1n, agreement.deliveries), read('getMandate', [liveParties['Research agent']]),
      read('earned', [liveParties['Data agent']]), read('earned', [liveParties['Cleaning agent']]),
    ]);
    if (revision !== rendering) return;
    const state = (verified) => liveStateHtml({
      agreement: { ...agreement, refundedQor: formatEther(agreement.refunded) }, deliveries, mandate, verified,
      earned: { data: formatEther(data), cleaner: formatEther(cleaner) },
    });
    document.querySelector('#live-state').innerHTML = state(false);
    const check = await verifyAgreement(1n, agreement);
    if (revision === rendering) document.querySelector('#live-state').innerHTML = state(Boolean(check.native));
  } catch { /* The recorded run above stands on its own. */ }
}

async function render() {
  const revision = ++rendering;
  const [route, deployment, parameter, extra] = (location.hash.slice(1) || 'home').split('/');
  alert('');
  const section = route === 'home' ? (deployment === 'how' ? 'how' : '') :
    ({ agreement: '', pay: '', tx: '', service: 'create', statement: 'earnings', receipt: 'verify' }[route] ?? route);
  content.className = 'shell page';
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  try {
    if (route === 'home') homePage(deployment);
    else if (route === 'live') await livePage(revision);
    else if (route === 'create' && deployment === undefined) await createPage(undefined, revision);
    else if (route === 'service') servicePage();
    else if (route === 'verify') verifyPage();
    else if (route === 'earnings') earningsPage();
    else if (route === 'submit') submitPage();
    else if (['create', 'agreement', 'pay', 'receipt', 'statement', 'tx'].includes(route)) {
      if (extra !== undefined || !address || deployment?.toLowerCase() !== address.toLowerCase()) {
        throw new Error('This link requires its original Treaty Diana deployment.');
      }
      content.innerHTML = '<div class="intro"><h1>Reading QoreChain</h1><p>Waiting for Diana testnet data…</p></div>';
      if (route === 'create') await createPage(parameter, revision);
      else if (route === 'agreement') await agreementPage(parameter, revision);
      else if (route === 'pay') await payPage(parameter, revision);
      else if (route === 'statement') await statementPage(parameter, revision);
      else if (route === 'tx') await txPage(parameter ?? '', revision);
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
      escape(errorMessage(error)) + '</p><a class="secondary" href="#home">Back to Treaty</a></div>';
  }
}

window.addEventListener('hashchange', render);
void render();
void restoreWallet();
