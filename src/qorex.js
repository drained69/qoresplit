// Signing Treaty messages with the QoreX wallet in the browser.
//
// QoreX signs arbitrary messages in the QoreSign message-signing-v1 format: its ML-DSA-87 key
// signs "qorechain-msg-v1|" + chainId + "|" + data, and the person sees `data` before approving.
// Treaty's messages are exactly that, with readable text as `data`, so the contract can check the
// ML-DSA-87 part with pqcVerify. The secp256k1 part of QoreX's signature is not needed on chain.
import { bech32, base64 } from '@scure/base';
import { bytesToHex, getAddress } from 'viem';
import { messageText } from './protocol.js';

const native = () => window.qorex?.native;

/** Whether a QoreX wallet that can sign messages is installed. */
export function qorexAvailable() {
  const wallet = native();
  return Boolean(wallet?.signArbitrary) && (!Array.isArray(wallet.capabilities) || wallet.capabilities.includes('signArbitrary'));
}

/** The 0x form of QoreX's current account: the same 20 bytes as its qor1 address. */
export async function qorexAccount(chainId) {
  const wallet = native();
  if (!qorexAvailable()) throw new Error('Install the QoreX wallet, or a version that can sign messages, to sign here.');
  await wallet.enable(chainId);
  const { bech32Address } = await wallet.getKey(chainId);
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
  const result = await native().signArbitrary(chainId, account.qorAddress, messageText(message, signingChain));
  return { signature: pqSignatureOf(result), signer: account.address };
}
