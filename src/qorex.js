// Signing Treaty messages with the QoreX wallet in the browser.
//
// QoreX signs arbitrary messages in the QoreSign message-signing-v1 format: its ML-DSA-87 key
// signs "qorechain-msg-v1|" + chainId + "|" + data, and the person sees `data` before approving.
// Treaty's messages are exactly that, with readable text as `data`, so the contract can check the
// ML-DSA-87 part with pqcVerify. The secp256k1 part of QoreX's signature is not needed on chain.
//
// QoreX is found with the official @qorechain/qorex-types helpers. Today's QoreX refuses
// signArbitrary ("not yet supported"), so Treaty offers QoreX signing only to a build that
// announces the capability, and otherwise points people to the signing tool.
import { getQorexNative, hasCapability, isQorexInstalled, QOREX_DOWNLOAD_URLS } from '@qorechain/qorex-types';
import { bech32, base64 } from '@scure/base';
import { bytesToHex, getAddress } from 'viem';
import { messageText } from './protocol.js';

/** The capability a QoreX build announces when it can sign arbitrary messages. */
export const SIGN_MESSAGES = 'signArbitrary';

/** Whether a QoreX wallet that can sign messages is installed. */
export function qorexAvailable() {
  const native = getQorexNative();
  return Boolean(native) && typeof native.signArbitrary === 'function' && hasCapability(native, SIGN_MESSAGES);
}

/** What to tell someone who cannot sign with QoreX here: install it, or wait for message signing. */
export function qorexStatus() {
  if (qorexAvailable()) return 'ready';
  return isQorexInstalled() ? 'cannot-sign-messages' : 'not-installed';
}

/** Where to get QoreX, from the official list. */
export const qorexDownload = QOREX_DOWNLOAD_URLS.website;

/** The 0x form of QoreX's current account: the same 20 bytes as its qor1 address. */
export async function qorexAccount(chainId) {
  const native = getQorexNative();
  if (!qorexAvailable()) {
    throw new Error(qorexStatus() === 'cannot-sign-messages'
      ? 'This QoreX version cannot sign messages yet. Use the signing tool for now.'
      : 'Install the QoreX wallet to sign here.');
  }
  await native.enable(chainId);
  const { bech32Address } = await native.getKey(chainId);
  const { prefix, words } = bech32.decode(bech32Address);
  if (prefix !== 'qor') throw new Error('QoreX returned an account that is not a qor1 address.');
  return { qorAddress: bech32Address, address: getAddress(bytesToHex(bech32.fromWords(words))) };
}

/** The ML-DSA-87 signature, as hex, from what signArbitrary returns. */
export function pqSignatureOf(result) {
  let value = result;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { throw new Error('QoreX returned a signature Treaty cannot read.'); }
  }
  const signature = value?.pq?.signature ?? value?.signature?.pq?.signature;
  if (!signature) throw new Error('QoreX did not add an ML-DSA-87 signature. Register the account’s post-quantum key first.');
  return bytesToHex(base64.decode(signature));
}

/**
 * Ask QoreX to sign a Treaty message as `expected` (0x). Refuses if QoreX is on another account,
 * since the contract checks the signature against that party's registered key.
 */
export async function signWithQorex(message, { chainId, signingChain, expected }) {
  const account = await qorexAccount(chainId);
  if (expected && account.address.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('QoreX is on ' + account.qorAddress + '. Switch QoreX to the account of ' + expected + ' and try again.');
  }
  const result = await getQorexNative().signArbitrary(chainId, account.qorAddress, messageText(message, signingChain));
  return { signature: pqSignatureOf(result), signer: account.address };
}
