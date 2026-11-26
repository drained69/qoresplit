// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface INativeBridge {
    function executeCrossVMCall(uint8 targetVM, string calldata target, bytes calldata payload)
        external returns (bytes memory);
}

/// QoreChain post-quantum precompiles (active on the qorechain-diana testnet).
interface IQorePQC {
    /// ML-DSA-87 (FIPS 204) verification: 2592-byte key, 4627-byte signature.
    function pqcVerify(bytes calldata pubkey, bytes calldata signature, bytes calldata message)
        external view returns (bool valid);

    /// The ML-DSA-87 key an account registered on chain.
    function pqcKeyStatus(address account)
        external view returns (bool registered, uint8 algorithmId, bytes memory pubkey, bool possessionProven);
}

/// @title QorePact
/// @notice Post-quantum agreements between people and AI agents. The contract holds
/// the money and moves it only as every party agreed.
///
/// Two kinds of pact share one consent and payout system:
/// - Revenue share: anyone pays a fixed price; every payment is split between the parties.
/// - Service: a client locks a budget; a provider (or a team) delivers units of work;
///   each accepted delivery pays one unit, a delivery the client ignores pays itself after
///   the review period, and unused budget returns after the deadline.
///
/// Every party accepts the exact terms with its ML-DSA-87 key, which the contract checks
/// on chain against the chain's own key registry. Deliveries, acceptances, rejections and
/// withdrawals are ML-DSA-87 signed too, so anyone can relay them and a stolen or
/// quantum-broken secp256k1 key alone moves nothing.
///
/// An agent can have a human owner with limits the contract enforces: the largest budget
/// per pact, the total it may commit, and an expiry. The owner can switch the agent off;
/// from then on only the owner can move the agent's money, and refunds go to the owner.
contract QorePact {
    address constant BRIDGE = address(0x0901);
    IQorePQC constant PQC_VERIFY = IQorePQC(address(0x0a01));
    IQorePQC constant PQC_KEYS = IQorePQC(address(0x0a02));
    string public constant RECEIPTS = "qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8";
    uint256 public constant WEI_PER_UQOR = 1e12;
    uint256 public constant MAX_PARTIES = 5;
    uint256 public constant MAX_UNITS = 1000;
    uint256 public constant MIN_REVIEW = 60;
    uint256 public constant MAX_REVIEW = 30 days;
    uint256 private constant BPS = 10_000;
    bytes32 public constant TERMS_DOMAIN = keccak256("qorepact.terms.v3");
    bytes32 public constant SERVICE_DOMAIN = keccak256("qorepact.service.v3");
    bytes32 public constant AGREEMENT_DOMAIN = keccak256("qorepact.agreement.v3");
    bytes32 public constant RECEIPT_DOMAIN = keccak256("qorepact.checkout.v3");
    bytes32 public constant PAYMENT_DOMAIN = keccak256("qorepact.delivery.v3");

    enum Kind { RevenueShare, Service }
    enum Status { None, Pending, Active, Superseded, Cancelled }
    enum DeliveryStatus { None, Pending, Accepted, Rejected, Released }

    struct Agreement {
        Kind kind;
        address proposer;
        Status status;
        uint16 signedMask;
        uint64 activatedAt;
        /// Revenue share: payments made. Service: units paid.
        uint64 sales;
        /// Revenue share: price per payment. Service: price per unit.
        uint128 price;
        uint256 previous;
        uint256 successor;
        bytes32 termsHash;
        string title;
        address[] recipients;
        uint16[] shares;
        address[] signers;
        bytes nativeReply;
        // Service pacts only.
        address client;
        uint32 maxUnits;
        uint32 reviewPeriod;
        uint64 deadline;
        bool funded;
        uint32 deliveries;
        uint32 pendingUnits;
        uint128 refunded;
    }

    struct Delivery {
        bytes32 deliverable;
        address provider;
        uint64 deliveredAt;
        DeliveryStatus status;
    }

    struct Mandate {
        address owner;
        uint64 expiry;
        bool revoked;
        uint128 maxPerPact;
        uint128 maxTotal;
        uint128 committed;
    }

    error InvalidTerms();
    error AgreementNotFound();
    error WrongKind();
    error NotPending();
    error NotActive();
    error PreviousNotActive();
    error NotASigner();
    error AlreadySigned();
    error NotAuthorized();
    error NotClient();
    error PqcKeyNotRegistered();
    error PqcKeyNotProven();
    error BadPqcSignature();
    error IncorrectPayment();
    error AlreadyPaid();
    error AlreadyFunded();
    error NotFunded();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NoUnitsLeft();
    error NotAProvider();
    error DeliveryNotPending();
    error ReviewPeriodOver();
    error ReviewPeriodNotOver();
    error NothingToRefund();
    error AgentNotAuthorized();
    error MandateLimitExceeded();
    error InvalidMandate();
    error BridgeUnavailable();
    error NativeReceiptRejected(bytes reason);
    error InvalidWithdrawal();
    error InsufficientBalance();
    error TransferFailed();

    event Proposed(uint256 indexed id, address indexed proposer, uint256 indexed previous, bytes32 termsHash);
    event Signed(uint256 indexed id, address indexed signer);
    event Activated(uint256 indexed id, bytes32 commitment, bytes nativeReply);
    event Superseded(uint256 indexed previous, uint256 indexed successor);
    event Cancelled(uint256 indexed id, address indexed by);
    event Checkout(
        uint256 indexed id, address indexed payer, bytes32 indexed paymentId,
        uint256 total, bytes32 commitment, uint256[] credits, bytes nativeReply
    );
    event Funded(uint256 indexed id, address indexed from, uint256 amount);
    event Delivered(uint256 indexed id, uint256 indexed unit, address indexed provider, bytes32 deliverable);
    event Rejected(uint256 indexed id, uint256 indexed unit);
    event Paid(
        uint256 indexed id, uint256 indexed unit, DeliveryStatus how,
        bytes32 commitment, uint256[] credits, bytes nativeReply
    );
    event Refunded(uint256 indexed id, address indexed to, uint256 amount);
    event MandateSet(address indexed agent, address indexed owner, uint128 maxPerPact, uint128 maxTotal, uint64 expiry);
    event MandateRevoked(address indexed agent, address indexed owner);
    event Withdrawn(address indexed recipient, address indexed to, uint256 amount, uint256 nonce);

    /// The block this contract was deployed in, so readers know where its history starts.
    uint256 public deployBlock;
    uint256 public agreementCount;
    mapping(uint256 => Agreement) private agreements;
    mapping(uint256 => mapping(uint256 => Delivery)) private deliveryLog;
    mapping(bytes32 => bool) public paid;
    mapping(address => uint256) public earned;
    mapping(address => uint256) public withdrawn;
    /// Increases with every withdrawal of that recipient, so a signature works once.
    mapping(address => uint256) public nonces;
    mapping(address => Mandate) private mandates;
    /// Increases with every mandate change of that agent, so a signature works once.
    mapping(address => uint256) public mandateNonces;
    mapping(address => uint256[]) private memberships;
    mapping(address => uint256[]) private clientPacts;

    constructor() {
        deployBlock = block.number;
    }

    // ---------------------------------------------------------------- terms

    /// Propose a revenue share. Nothing can be paid until every signer accepts it.
    /// `previous` is zero for a new pact, or the active revenue share this version replaces.
    function propose(
        string calldata title, uint128 price, address[] calldata recipients, uint16[] calldata shares, uint256 previous
    ) external returns (uint256 id) {
        _checkSplit(title, price, recipients, shares, 2);
        id = _create(Kind.RevenueShare, title, price, recipients, shares);
        Agreement storage agreement = agreements[id];
        agreement.previous = previous;
        if (previous != 0) {
            // Everyone on the version being replaced must consent too, so nobody can be
            // removed or diluted without their own post-quantum signature.
            Agreement storage old = agreements[previous];
            if (old.status != Status.Active || old.kind != Kind.RevenueShare) revert PreviousNotActive();
            for (uint256 i; i < old.recipients.length; ++i) {
                if (!_containsCalldata(recipients, old.recipients[i])) agreement.signers.push(old.recipients[i]);
            }
        }
        _finishProposal(id, keccak256(abi.encode(TERMS_DOMAIN, title, price, recipients, shares, previous)));
    }

    /// Propose a service pact: `client` locks `unitPrice * maxUnits`, and each delivered and
    /// accepted unit pays `unitPrice`, split between `providers` by `shares`.
    function proposeService(
        string calldata title, uint128 unitPrice, uint32 maxUnits, uint64 deadline, uint32 reviewPeriod,
        address client, address[] calldata providers, uint16[] calldata shares
    ) external returns (uint256 id) {
        _checkSplit(title, unitPrice, providers, shares, 1);
        if (client == address(0) || client == address(this) || _containsCalldata(providers, client) ||
            maxUnits == 0 || maxUnits > MAX_UNITS || deadline <= block.timestamp ||
            reviewPeriod < MIN_REVIEW || reviewPeriod > MAX_REVIEW ||
            uint256(unitPrice) * maxUnits > type(uint128).max) revert InvalidTerms();
        id = _create(Kind.Service, title, unitPrice, providers, shares);
        Agreement storage agreement = agreements[id];
        agreement.client = client;
        agreement.maxUnits = maxUnits;
        agreement.deadline = deadline;
        agreement.reviewPeriod = reviewPeriod;
        agreement.signers.push(client);
        _finishProposal(id, keccak256(abi.encode(
            SERVICE_DOMAIN, title, unitPrice, providers, shares, client, maxUnits, deadline, reviewPeriod
        )));
    }

    /// The exact bytes `signer` signs with ML-DSA-87 to accept agreement `id`.
    function termsMessage(uint256 id, address signer) public view returns (bytes memory) {
        return abi.encodePacked("QorePact:terms:v3", block.chainid, address(this), id, signer, _get(id).termsHash);
    }

    /// Record `signer`'s acceptance. Anyone may submit it: the ML-DSA-87 signature,
    /// checked against the key `signer` registered on chain, is what counts.
    /// The last signature activates the agreement and writes its Native receipt.
    function sign(uint256 id, address signer, bytes calldata mldsaSignature) external {
        Agreement storage agreement = _get(id);
        if (agreement.status != Status.Pending) revert NotPending();
        uint256 index = _indexOf(agreement.signers, signer);
        uint16 bit = uint16(1 << index);
        if (agreement.signedMask & bit != 0) revert AlreadySigned();
        _requireActing(signer, mldsaSignature, termsMessage(id, signer));
        if (agreement.kind == Kind.Service && signer == agreement.client) _checkMandate(signer, _budget(agreement));

        agreement.signedMask |= bit;
        emit Signed(id, signer);
        if (agreement.signedMask == (1 << agreement.signers.length) - 1) _activate(id, agreement);
    }

    /// The proposer or any signer can withdraw a proposal that is not yet active.
    function cancel(uint256 id) external {
        Agreement storage agreement = _get(id);
        if (agreement.status != Status.Pending) revert NotPending();
        if (msg.sender != agreement.proposer && !_contains(agreement.signers, msg.sender)) revert NotAuthorized();
        agreement.status = Status.Cancelled;
        emit Cancelled(id, msg.sender);
    }

    /// What the Native receipt of an active agreement commits to.
    function agreementCommitment(uint256 id) public view returns (bytes32) {
        Agreement storage agreement = _get(id);
        return keccak256(abi.encode(
            AGREEMENT_DOMAIN, block.chainid, address(this), id, agreement.termsHash, agreement.signers
        ));
    }

    // -------------------------------------------------------- revenue share

    function checkout(uint256 id, bytes32 paymentReference) external payable {
        Agreement storage agreement = _get(id);
        if (agreement.kind != Kind.RevenueShare) revert WrongKind();
        if (agreement.status != Status.Active) revert NotActive();
        if (msg.value != agreement.price || paymentReference == bytes32(0)) revert IncorrectPayment();
        bytes32 paymentId = keccak256(abi.encode(id, msg.sender, paymentReference));
        if (paid[paymentId]) revert AlreadyPaid();
        paid[paymentId] = true;
        agreement.sales += 1;

        address[] memory recipients = agreement.recipients;
        uint256[] memory credits = _credit(agreement);
        bytes32 commitment = keccak256(abi.encode(
            RECEIPT_DOMAIN, block.chainid, address(this), id, msg.sender, paymentId, msg.value, recipients, credits
        ));
        bytes memory reply = _record("qorepact:", commitment);
        emit Checkout(id, msg.sender, paymentId, msg.value, commitment, credits, reply);
    }

    // -------------------------------------------------------------- service

    /// Lock the whole budget of an agreed service pact, before the deadline. Only the client, or
    /// the client's owner when it is an agent, may fund it: unused budget is refunded to them.
    function fund(uint256 id) external payable {
        Agreement storage agreement = _service(id);
        if (msg.sender != agreement.client && msg.sender != mandates[agreement.client].owner) revert NotClient();
        if (agreement.status != Status.Active) revert NotActive();
        if (agreement.funded) revert AlreadyFunded();
        if (block.timestamp > agreement.deadline) revert DeadlinePassed();
        uint256 budget = _budget(agreement);
        if (msg.value != budget) revert IncorrectPayment();
        _checkMandate(agreement.client, budget);
        Mandate storage mandate = mandates[agreement.client];
        if (mandate.owner != address(0)) mandate.committed += uint128(budget);
        agreement.funded = true;
        emit Funded(id, msg.sender, budget);
    }

    /// The bytes a provider signs to deliver `deliverable` as unit `unit` of pact `id`.
    function deliveryMessage(uint256 id, uint256 unit, address provider, bytes32 deliverable)
        public view returns (bytes memory)
    {
        return abi.encodePacked("QorePact:deliver:v3", block.chainid, address(this), id, unit, provider, deliverable);
    }

    /// Submit one unit of work, identified by the hash of what was delivered.
    function deliver(uint256 id, address provider, bytes32 deliverable, bytes calldata mldsaSignature) external {
        Agreement storage agreement = _service(id);
        if (agreement.status != Status.Active) revert NotActive();
        if (!agreement.funded) revert NotFunded();
        if (block.timestamp > agreement.deadline) revert DeadlinePassed();
        if (!_contains(agreement.recipients, provider)) revert NotAProvider();
        if (deliverable == bytes32(0)) revert InvalidTerms();
        if (agreement.sales + agreement.pendingUnits >= agreement.maxUnits) revert NoUnitsLeft();
        uint256 unit = agreement.deliveries;
        _requireActing(provider, mldsaSignature, deliveryMessage(id, unit, provider, deliverable));

        agreement.deliveries += 1;
        agreement.pendingUnits += 1;
        deliveryLog[id][unit] = Delivery(deliverable, provider, uint64(block.timestamp), DeliveryStatus.Pending);
        emit Delivered(id, unit, provider, deliverable);
    }

    /// The bytes the client signs to accept (`accepted` true) or reject a delivery.
    function reviewMessage(uint256 id, uint256 unit, bool accepted) public view returns (bytes memory) {
        bytes memory label = accepted ? bytes("QorePact:accept:v3") : bytes("QorePact:reject:v3");
        return abi.encodePacked(
            label, block.chainid, address(this), id, unit, deliveryLog[id][unit].deliverable
        );
    }

    /// The client accepts a delivery, which pays one unit.
    function accept(uint256 id, uint256 unit, bytes calldata mldsaSignature) external {
        Agreement storage agreement = _service(id);
        Delivery storage delivery = _pending(id, unit);
        _requireActing(agreement.client, mldsaSignature, reviewMessage(id, unit, true));
        _payUnit(id, unit, agreement, delivery, DeliveryStatus.Accepted);
    }

    /// The client rejects a delivery within the review period. The unit becomes available again.
    function reject(uint256 id, uint256 unit, bytes calldata mldsaSignature) external {
        Agreement storage agreement = _service(id);
        Delivery storage delivery = _pending(id, unit);
        if (block.timestamp > uint256(delivery.deliveredAt) + agreement.reviewPeriod) revert ReviewPeriodOver();
        _requireActing(agreement.client, mldsaSignature, reviewMessage(id, unit, false));
        delivery.status = DeliveryStatus.Rejected;
        agreement.pendingUnits -= 1;
        emit Rejected(id, unit);
    }

    /// After the review period, anyone can release a delivery the client neither accepted nor rejected.
    function release(uint256 id, uint256 unit) external {
        Agreement storage agreement = _service(id);
        Delivery storage delivery = _pending(id, unit);
        if (block.timestamp <= uint256(delivery.deliveredAt) + agreement.reviewPeriod) revert ReviewPeriodNotOver();
        _payUnit(id, unit, agreement, delivery, DeliveryStatus.Released);
    }

    /// After the deadline, anyone can return the unused budget: to the client's owner when the
    /// client is an agent with a mandate, otherwise to the client. Pending deliveries stay reserved.
    function refund(uint256 id) external {
        Agreement storage agreement = _service(id);
        if (!agreement.funded) revert NotFunded();
        if (block.timestamp <= agreement.deadline) revert DeadlineNotPassed();
        uint256 amount = refundable(id);
        if (amount == 0) revert NothingToRefund();
        agreement.refunded += uint128(amount);
        Mandate storage mandate = mandates[agreement.client];
        address to = agreement.client;
        if (mandate.owner != address(0)) {
            to = mandate.owner;
            mandate.committed -= uint128(amount < mandate.committed ? amount : mandate.committed);
        }
        emit Refunded(id, to, amount);
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function refundable(uint256 id) public view returns (uint256) {
        Agreement storage agreement = _service(id);
        if (!agreement.funded) return 0;
        uint256 reserved = (uint256(agreement.sales) + agreement.pendingUnits) * agreement.price;
        return _budget(agreement) - reserved - agreement.refunded;
    }

    function getDelivery(uint256 id, uint256 unit) external view returns (Delivery memory) {
        return deliveryLog[id][unit];
    }

    // --------------------------------------------------------------- agents

    function getMandate(address agent) external view returns (Mandate memory) {
        return mandates[agent];
    }

    /// The bytes both the agent and its owner sign to set the agent's limits.
    function mandateMessage(address agent, address owner, uint128 maxPerPact, uint128 maxTotal, uint64 expiry)
        public view returns (bytes memory)
    {
        return abi.encodePacked(
            "QorePact:mandate:v3", block.chainid, address(this), agent, owner, maxPerPact, maxTotal, expiry,
            mandateNonces[agent]
        );
    }

    /// Put an agent under an owner's limits. The agent and the owner both sign, so nobody can
    /// claim an agent, and no agent can pick an owner who did not agree. Only the current owner
    /// can set new limits later.
    function setMandate(
        address agent, address owner, uint128 maxPerPact, uint128 maxTotal, uint64 expiry,
        bytes calldata agentSignature, bytes calldata ownerSignature
    ) external {
        Mandate storage mandate = mandates[agent];
        if (agent == address(0) || owner == address(0) || agent == owner || expiry <= block.timestamp ||
            maxTotal == 0 || maxPerPact > maxTotal || (mandate.owner != address(0) && mandate.owner != owner)) {
            revert InvalidMandate();
        }
        bytes memory message = mandateMessage(agent, owner, maxPerPact, maxTotal, expiry);
        _requirePqcSignature(agent, agentSignature, message);
        _requirePqcSignature(owner, ownerSignature, message);
        mandateNonces[agent] += 1;
        mandate.owner = owner;
        mandate.maxPerPact = maxPerPact;
        mandate.maxTotal = maxTotal;
        mandate.expiry = expiry;
        mandate.revoked = false;
        emit MandateSet(agent, owner, maxPerPact, maxTotal, expiry);
    }

    function revokeMessage(address agent) public view returns (bytes memory) {
        return abi.encodePacked("QorePact:revoke:v3", block.chainid, address(this), agent, mandateNonces[agent]);
    }

    /// The owner switches the agent off. From then on the agent cannot sign anything here,
    /// and only the owner can withdraw the agent's earnings.
    function revokeMandate(address agent, bytes calldata ownerSignature) external {
        Mandate storage mandate = mandates[agent];
        if (mandate.owner == address(0) || mandate.revoked) revert InvalidMandate();
        _requirePqcSignature(mandate.owner, ownerSignature, revokeMessage(agent));
        mandateNonces[agent] += 1;
        mandate.revoked = true;
        emit MandateRevoked(agent, mandate.owner);
    }

    /// Whether `account` may sign here itself: false once its owner revoked it or its mandate expired.
    function canAct(address account) public view returns (bool) {
        Mandate storage mandate = mandates[account];
        return mandate.owner == address(0) || (!mandate.revoked && block.timestamp <= mandate.expiry);
    }

    // ---------------------------------------------------------- withdrawals

    function claimable(address recipient) public view returns (uint256) {
        return earned[recipient] - withdrawn[recipient];
    }

    /// Who must sign withdrawals of `recipient`'s earnings: the recipient, or its owner once it was switched off.
    function withdrawalSigner(address recipient) public view returns (address) {
        return canAct(recipient) ? recipient : mandates[recipient].owner;
    }

    /// The exact bytes signed with ML-DSA-87 to send `amount` of `recipient`'s earnings to `to`.
    function withdrawalMessage(address recipient, address to, uint256 amount, uint256 nonce)
        public view returns (bytes memory)
    {
        return abi.encodePacked("QorePact:withdraw:v3", block.chainid, address(this), recipient, to, amount, nonce);
    }

    /// Pay out earnings. Anyone may submit; only an ML-DSA-87 signature from
    /// `withdrawalSigner(recipient)` over the destination, amount and nonce authorises it.
    function withdraw(address recipient, address payable to, uint256 amount, bytes calldata mldsaSignature) external {
        if (to == address(0) || to == address(this) || amount == 0) revert InvalidWithdrawal();
        if (amount > claimable(recipient)) revert InsufficientBalance();
        uint256 nonce = nonces[recipient];
        _requirePqcSignature(withdrawalSigner(recipient), mldsaSignature, withdrawalMessage(recipient, to, amount, nonce));

        nonces[recipient] = nonce + 1;
        withdrawn[recipient] += amount;
        emit Withdrawn(recipient, to, amount, nonce);
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ---------------------------------------------------------------- views

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _get(id);
    }

    function quote(uint256 id) external view returns (uint256[] memory) {
        Agreement storage agreement = _get(id);
        return _split(agreement.price, agreement.shares);
    }

    /// Agreements that have credited `account`: every active version it was a recipient or provider of.
    function agreementsOf(address account) external view returns (uint256[] memory) {
        return memberships[account];
    }

    /// Service pacts `account` agreed to pay for.
    function pactsAsClient(address account) external view returns (uint256[] memory) {
        return clientPacts[account];
    }

    // -------------------------------------------------------------- private

    function _checkSplit(
        string calldata title, uint128 price, address[] calldata recipients, uint16[] calldata shares, uint256 minimum
    ) private view {
        uint256 size = recipients.length;
        if (bytes(title).length == 0 || bytes(title).length > 96 || size < minimum || size > MAX_PARTIES ||
            size != shares.length || price == 0 || price % WEI_PER_UQOR != 0) revert InvalidTerms();
        uint256 sum;
        for (uint256 i; i < size; ++i) {
            if (recipients[i] == address(0) || recipients[i] == address(this) ||
                (uint256(price) / WEI_PER_UQOR) * shares[i] < BPS) revert InvalidTerms();
            for (uint256 j; j < i; ++j) {
                if (recipients[j] == recipients[i]) revert InvalidTerms();
            }
            sum += shares[i];
        }
        if (sum != BPS) revert InvalidTerms();
    }

    function _create(
        Kind kind, string calldata title, uint128 price, address[] calldata recipients, uint16[] calldata shares
    ) private returns (uint256 id) {
        id = ++agreementCount;
        Agreement storage agreement = agreements[id];
        agreement.kind = kind;
        agreement.proposer = msg.sender;
        agreement.status = Status.Pending;
        agreement.price = price;
        agreement.title = title;
        agreement.recipients = recipients;
        agreement.shares = shares;
        agreement.signers = recipients;
    }

    function _finishProposal(uint256 id, bytes32 hash) private {
        agreements[id].termsHash = hash;
        emit Proposed(id, msg.sender, agreements[id].previous, hash);
    }

    function _activate(uint256 id, Agreement storage agreement) private {
        uint256 previous = agreement.previous;
        if (previous != 0) {
            Agreement storage old = agreements[previous];
            if (old.status != Status.Active) revert PreviousNotActive();
            old.status = Status.Superseded;
            old.successor = id;
            emit Superseded(previous, id);
        }
        agreement.status = Status.Active;
        agreement.activatedAt = uint64(block.number);
        for (uint256 i; i < agreement.recipients.length; ++i) memberships[agreement.recipients[i]].push(id);
        if (agreement.kind == Kind.Service) clientPacts[agreement.client].push(id);

        bytes32 commitment = agreementCommitment(id);
        bytes memory reply = _record("qorepact-terms:", commitment);
        agreement.nativeReply = reply;
        emit Activated(id, commitment, reply);
    }

    function _payUnit(
        uint256 id, uint256 unit, Agreement storage agreement, Delivery storage delivery, DeliveryStatus how
    ) private {
        delivery.status = how;
        agreement.pendingUnits -= 1;
        agreement.sales += 1;
        uint256[] memory credits = _credit(agreement);
        bytes32 commitment = keccak256(abi.encode(
            PAYMENT_DOMAIN, block.chainid, address(this), id, unit, delivery.deliverable, agreement.recipients, credits
        ));
        bytes memory reply = _record("qorepact-pay:", commitment);
        emit Paid(id, unit, how, commitment, credits, reply);
    }

    /// Credit one payment of `agreement.price` to its recipients by their shares.
    function _credit(Agreement storage agreement) private returns (uint256[] memory credits) {
        credits = _split(agreement.price, agreement.shares);
        for (uint256 i; i < credits.length; ++i) earned[agreement.recipients[i]] += credits[i];
    }

    function _get(uint256 id) private view returns (Agreement storage agreement) {
        agreement = agreements[id];
        if (agreement.status == Status.None) revert AgreementNotFound();
    }

    function _service(uint256 id) private view returns (Agreement storage agreement) {
        agreement = _get(id);
        if (agreement.kind != Kind.Service) revert WrongKind();
    }

    function _pending(uint256 id, uint256 unit) private view returns (Delivery storage delivery) {
        delivery = deliveryLog[id][unit];
        if (delivery.status != DeliveryStatus.Pending) revert DeliveryNotPending();
    }

    function _budget(Agreement storage agreement) private view returns (uint256) {
        return uint256(agreement.price) * agreement.maxUnits;
    }

    function _checkMandate(address agent, uint256 budget) private view {
        Mandate storage mandate = mandates[agent];
        if (mandate.owner == address(0)) return;
        if (mandate.revoked || block.timestamp > mandate.expiry) revert AgentNotAuthorized();
        if (budget > mandate.maxPerPact || mandate.committed + budget > mandate.maxTotal) revert MandateLimitExceeded();
    }

    /// A signature from `account` acting for itself: refused once its owner switched it off.
    function _requireActing(address account, bytes calldata signature, bytes memory message) private view {
        if (!canAct(account)) revert AgentNotAuthorized();
        _requirePqcSignature(account, signature, message);
    }

    function _requirePqcSignature(address account, bytes calldata signature, bytes memory message) private view {
        (bool registered,, bytes memory pubkey, bool proven) = PQC_KEYS.pqcKeyStatus(account);
        if (!registered || pubkey.length == 0) revert PqcKeyNotRegistered();
        if (!proven) revert PqcKeyNotProven();
        if (!PQC_VERIFY.pqcVerify(pubkey, signature, message)) revert BadPqcSignature();
    }

    /// Write a receipt into the governance-pinned Native receipt book in this transaction.
    /// A Native failure reverts everything, so both VMs change together or neither does.
    function _record(bytes memory prefix, bytes32 commitment) private returns (bytes memory reply) {
        bytes memory payload = abi.encodePacked('{"record":{"note":"', prefix, _hex(commitment), '"}}');
        bool success;
        (success, reply) = BRIDGE.call(abi.encodeCall(INativeBridge.executeCrossVMCall, (1, RECEIPTS, payload)));
        if (!success) revert NativeReceiptRejected(reply);
        // The pinned receipt book returns JSON with a sender, note, ID and height.
        // Both an absent precompile and ABI-encoded empty bytes fail this check.
        if (reply.length <= 64) revert BridgeUnavailable();
    }

    /// Whole uqor for every share but the last, which receives the remainder.
    function _split(uint256 price, uint16[] storage shares) private view returns (uint256[] memory credits) {
        credits = new uint256[](shares.length);
        uint256 remaining = price;
        for (uint256 i; i + 1 < credits.length; ++i) {
            credits[i] = ((price / WEI_PER_UQOR) * shares[i] / BPS) * WEI_PER_UQOR;
            remaining -= credits[i];
        }
        credits[credits.length - 1] = remaining;
    }

    function _indexOf(address[] storage list, address account) private view returns (uint256) {
        for (uint256 i; i < list.length; ++i) if (list[i] == account) return i;
        revert NotASigner();
    }

    function _contains(address[] storage list, address account) private view returns (bool) {
        for (uint256 i; i < list.length; ++i) if (list[i] == account) return true;
        return false;
    }

    function _containsCalldata(address[] calldata list, address account) private pure returns (bool) {
        for (uint256 i; i < list.length; ++i) if (list[i] == account) return true;
        return false;
    }

    function _hex(bytes32 value) private pure returns (bytes memory result) {
        bytes16 alphabet = "0123456789abcdef";
        result = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            result[2 * i] = alphabet[uint8(value[i]) >> 4];
            result[2 * i + 1] = alphabet[uint8(value[i]) & 15];
        }
    }
}
