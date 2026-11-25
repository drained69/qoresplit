// Pure QorePact protocol helpers shared by the app, the signing tool, the agent SDK and the tests.
// Each function mirrors the contract byte for byte; the tests check that they agree.
import { concatHex, encodeAbiParameters, encodePacked, keccak256, stringToHex, toHex } from 'viem';

export const WEI_PER_UQOR = 10n ** 12n;
export const BPS = 10_000n;
export const MAX_PARTIES = 5;
export const MAX_UNITS = 1000;
export const MIN_REVIEW = 60;
export const MAX_REVIEW = 30 * 24 * 60 * 60;
export const Kind = Object.freeze(['RevenueShare', 'Service']);
export const Status = Object.freeze(['None', 'Pending', 'Active', 'Superseded', 'Cancelled']);
export const DeliveryStatus = Object.freeze(['None', 'Pending', 'Accepted', 'Rejected', 'Released']);

const domain = (name) => keccak256(stringToHex(name));
export const TERMS_DOMAIN = domain('qorepact.terms.v3');
export const SERVICE_DOMAIN = domain('qorepact.service.v3');
export const AGREEMENT_DOMAIN = domain('qorepact.agreement.v3');
export const RECEIPT_DOMAIN = domain('qorepact.checkout.v3');
export const PAYMENT_DOMAIN = domain('qorepact.delivery.v3');
const params = (...types) => types.map((type) => ({ type }));
const packed = (label, types, values) => concatHex([toHex(label), encodePacked(types, values)]);

/** Whole uqor for every share but the last, which receives the remainder. */
export function splitAmounts(price, shares) {
  let remainder = BigInt(price);
  return shares.map((share, i) => {
    if (i === shares.length - 1) return remainder;
    const credit = (BigInt(price) / WEI_PER_UQOR * BigInt(share) / BPS) * WEI_PER_UQOR;
    remainder -= credit;
    return credit;
  });
}

export const budgetOf = ({ price, maxUnits }) => BigInt(price) * BigInt(maxUnits);
export const isService = (agreement) => Kind[agreement.kind] === 'Service';

/** The hash every signer's acceptance covers, for either kind of pact. */
export function termsHash(agreement) {
  const { title, price, recipients, shares } = agreement;
  if (isService(agreement)) {
    const { client, maxUnits, deadline, reviewPeriod } = agreement;
    return keccak256(encodeAbiParameters(
      params('bytes32', 'string', 'uint128', 'address[]', 'uint16[]', 'address', 'uint32', 'uint64', 'uint32'),
      [SERVICE_DOMAIN, title, BigInt(price), recipients, shares.map(Number), client, Number(maxUnits), BigInt(deadline), Number(reviewPeriod)],
    ));
  }
  return keccak256(encodeAbiParameters(
    params('bytes32', 'string', 'uint128', 'address[]', 'uint16[]', 'uint256'),
    [TERMS_DOMAIN, title, BigInt(price), recipients, shares.map(Number), BigInt(agreement.previous ?? 0n)],
  ));
}

/** The bytes a signer signs with ML-DSA-87 to accept agreement `id`. */
export const termsMessage = ({ chainId, contract, id, signer, hash }) => packed('QorePact:terms:v3',
  ['uint256', 'address', 'uint256', 'address', 'bytes32'], [BigInt(chainId), contract, BigInt(id), signer, hash]);

/** The bytes a provider signs to deliver `deliverable` as unit `unit`. */
export const deliveryMessage = ({ chainId, contract, id, unit, provider, deliverable }) => packed('QorePact:deliver:v3',
  ['uint256', 'address', 'uint256', 'uint256', 'address', 'bytes32'],
  [BigInt(chainId), contract, BigInt(id), BigInt(unit), provider, deliverable]);

/** The bytes a client signs to accept or reject a delivery. */
export const reviewMessage = ({ chainId, contract, id, unit, deliverable, accepted }) => packed(
  accepted ? 'QorePact:accept:v3' : 'QorePact:reject:v3',
  ['uint256', 'address', 'uint256', 'uint256', 'bytes32'], [BigInt(chainId), contract, BigInt(id), BigInt(unit), deliverable]);

/** The bytes an agent and its owner both sign to set the agent's limits. */
export const mandateMessage = ({ chainId, contract, agent, owner, maxPerPact, maxTotal, expiry, nonce }) => packed(
  'QorePact:mandate:v3', ['uint256', 'address', 'address', 'address', 'uint128', 'uint128', 'uint64', 'uint256'],
  [BigInt(chainId), contract, agent, owner, BigInt(maxPerPact), BigInt(maxTotal), BigInt(expiry), BigInt(nonce)]);

/** The bytes an owner signs to switch its agent off. */
export const revokeMessage = ({ chainId, contract, agent, nonce }) => packed('QorePact:revoke:v3',
  ['uint256', 'address', 'address', 'uint256'], [BigInt(chainId), contract, agent, BigInt(nonce)]);

/** The bytes signed to send `amount` wei of `recipient`'s earnings to `to`. */
export const withdrawalMessage = ({ chainId, contract, recipient, to, amount, nonce }) => packed('QorePact:withdraw:v3',
  ['uint256', 'address', 'address', 'address', 'uint256', 'uint256'],
  [BigInt(chainId), contract, recipient, to, BigInt(amount), BigInt(nonce)]);

/** The hash of a deliverable: what a provider commits to, and a client can check later. */
export const deliverableHash = (content) => keccak256(typeof content === 'string' ? stringToHex(content) : content);

export function agreementCommitment({ chainId, contract, id, hash, signers }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'uint256', 'address', 'uint256', 'bytes32', 'address[]'),
    [AGREEMENT_DOMAIN, BigInt(chainId), contract, BigInt(id), hash, signers],
  ));
}

export function paymentId(id, payer, reference) {
  return keccak256(encodeAbiParameters(params('uint256', 'address', 'bytes32'), [BigInt(id), payer, reference]));
}

export function paymentCommitment({ chainId, contract, id, payer, paymentId: payment, total, recipients, credits }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'uint256', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'address[]', 'uint256[]'),
    [RECEIPT_DOMAIN, BigInt(chainId), contract, BigInt(id), payer, payment, BigInt(total), recipients, credits],
  ));
}

export function deliveryCommitment({ chainId, contract, id, unit, deliverable, recipients, credits }) {
  return keccak256(encodeAbiParameters(
    params('bytes32', 'uint256', 'address', 'uint256', 'uint256', 'bytes32', 'address[]', 'uint256[]'),
    [PAYMENT_DOMAIN, BigInt(chainId), contract, BigInt(id), BigInt(unit), deliverable, recipients, credits],
  ));
}

/** The Native receipt notes the contract writes. */
export const termsNote = (commitment) => 'qorepact-terms:' + commitment.slice(2);
export const paymentNote = (commitment) => 'qorepact:' + commitment.slice(2);
export const deliveryNote = (commitment) => 'qorepact-pay:' + commitment.slice(2);

/** Everyone who must sign a revenue share: the recipients, then anyone on the replaced version not already listed. */
export function requiredSigners(recipients, previousRecipients = []) {
  const lower = new Set(recipients.map((value) => value.toLowerCase()));
  return [...recipients, ...previousRecipients.filter((value) => !lower.has(value.toLowerCase()))];
}

/**
 * Why a Diana EVM window (as /qorechain/pqc/v1/evm_window returns it) would refuse a
 * transaction to `contract` carrying `valueWei`, or undefined when it allows it.
 * Windows can limit targets, transaction count and value (in uqor).
 */
export function windowProblem(state, { contract, valueWei = 0n }) {
  if (!state || state.found === false || state.live !== true) return 'has no live EVM window';
  if (state.native_only) return 'has a window for Native transactions only';
  const targets = (state.allowed_targets ?? []).map((target) => String(target).toLowerCase());
  if (targets.length && !targets.includes(contract.toLowerCase())) return 'has an EVM window that does not allow QorePact at ' + contract;
  if (state.remaining_txs !== undefined && BigInt(state.remaining_txs) < 1n) return 'has used every transaction its EVM window allows';
  const needed = (BigInt(valueWei) + WEI_PER_UQOR - 1n) / WEI_PER_UQOR;
  if (needed && state.remaining_value !== undefined && BigInt(state.remaining_value) < needed) {
    return 'has an EVM window with less value left than this payment';
  }
}

/*
 * A signed request carries one post-quantum-signed call between whoever signed it and
 * whichever wallet relays it. It authorises nothing by itself: the contract checks the
 * ML-DSA-87 signature against the signer's registered key.
 */
export const REQUEST_KIND = 'qorepact-signed-request';
const address = { test: (value) => /^0x[\da-fA-F]{40}$/.test(value ?? '') };
const uint = { test: (value) => /^\d{1,78}$/.test(String(value ?? '')) };
const bytes32 = { test: (value) => /^0x[\da-fA-F]{64}$/.test(value ?? '') };
const bytes = { test: (value) => /^0x(?:[\da-fA-F]{2})+$/.test(value ?? '') };
/** The relayable calls, their argument names and checks, and a label for people. */
export const RELAYABLE = Object.freeze({
  sign: { args: [['id', uint], ['signer', address], ['signature', bytes]], label: 'Accept terms' },
  deliver: { args: [['id', uint], ['provider', address], ['deliverable', bytes32], ['signature', bytes]], label: 'Deliver work' },
  accept: { args: [['id', uint], ['unit', uint], ['signature', bytes]], label: 'Accept a delivery' },
  reject: { args: [['id', uint], ['unit', uint], ['signature', bytes]], label: 'Reject a delivery' },
  withdraw: { args: [['recipient', address], ['to', address], ['amount', uint], ['signature', bytes]], label: 'Withdraw earnings' },
  setMandate: {
    args: [['agent', address], ['owner', address], ['maxPerPact', uint], ['maxTotal', uint], ['expiry', uint],
      ['agentSignature', bytes], ['ownerSignature', bytes]],
    label: 'Set an agent’s limits',
  },
  revokeMandate: { args: [['agent', address], ['ownerSignature', bytes]], label: 'Switch an agent off' },
});

export function signedRequest(action, fields, { chainId, contract }) {
  if (!RELAYABLE[action]) throw new Error('Unknown action ' + action);
  const body = { kind: REQUEST_KIND, version: 3, chainId, contract, action };
  for (const [name] of RELAYABLE[action].args) body[name] = typeof fields[name] === 'bigint' ? fields[name].toString() : fields[name];
  return JSON.stringify(body, null, 2);
}

/** Check a pasted signed request and return `{ action, args }` ready for the contract call. */
export function parseSignedRequest(text, { chainId, contract }) {
  let request;
  try { request = JSON.parse(text); } catch { throw new Error('Paste the JSON the signing tool or agent saved.'); }
  if (request?.kind !== REQUEST_KIND || request.version !== 3) throw new Error('This is not a QorePact signed request.');
  if (request.chainId !== chainId) throw new Error('This request was signed for a different chain.');
  if (!address.test(request.contract) || request.contract.toLowerCase() !== contract?.toLowerCase()) {
    throw new Error('This request was signed for a different QorePact deployment.');
  }
  const spec = RELAYABLE[request.action];
  if (!spec) throw new Error('Unknown signed request action.');
  const args = spec.args.map(([name, check]) => {
    if (!check.test(request[name])) throw new Error('The request has no valid ' + name + '.');
    return check === uint ? BigInt(request[name]) : request[name];
  });
  return { action: request.action, label: spec.label, args, fields: request };
}
