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

/// @title QoreSplit
/// @notice Revenue-share agreements that no single person controls.
/// - Every collaborator accepts the exact terms with their ML-DSA-87 key before a
///   checkout link goes live. The chain's own key registry supplies the key.
/// - Terms change only through a new version that every old and new collaborator
///   signs. The old version then stops taking payments; its history stays.
/// - Each checkout credits every share and writes a receipt on QoreChain Native in
///   the same transaction.
/// - Earnings leave only with the recipient's ML-DSA-87 signature. A stolen or
///   broken secp256k1 key alone cannot sign terms or move earnings.
contract QoreSplit {
    address constant BRIDGE = address(0x0901);
    IQorePQC constant PQC_VERIFY = IQorePQC(address(0x0a01));
    IQorePQC constant PQC_KEYS = IQorePQC(address(0x0a02));
    string public constant RECEIPTS = "qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8";
    uint256 public constant WEI_PER_UQOR = 1e12;
    uint256 public constant MAX_RECIPIENTS = 5;
    uint256 private constant BPS = 10_000;
    bytes32 public constant TERMS_DOMAIN = keccak256("qoresplit.terms.v2");
    bytes32 public constant AGREEMENT_DOMAIN = keccak256("qoresplit.agreement.v2");
    bytes32 public constant RECEIPT_DOMAIN = keccak256("qoresplit.checkout.v2");

    enum Status { None, Pending, Active, Superseded, Cancelled }

    struct Agreement {
        address proposer;
        Status status;
        uint16 signedMask;
        uint64 activatedAt;
        uint64 sales;
        uint128 price;
        uint256 previous;
        uint256 successor;
        bytes32 termsHash;
        string title;
        address[] recipients;
        uint16[] shares;
        address[] signers;
        bytes nativeReply;
    }

    error InvalidTerms();
    error AgreementNotFound();
    error NotPending();
    error NotActive();
    error PreviousNotActive();
    error NotASigner();
    error AlreadySigned();
    error NotAuthorized();
    error PqcKeyNotRegistered();
    error PqcKeyNotProven();
    error BadPqcSignature();
    error IncorrectPayment();
    error AlreadyPaid();
    error BridgeUnavailable();
    error NativeReceiptRejected(bytes reason);
    error InvalidWithdrawal();
    error InsufficientBalance();
    error WithdrawalFailed();

    event Proposed(uint256 indexed id, address indexed proposer, uint256 indexed previous, bytes32 termsHash);
    event Signed(uint256 indexed id, address indexed signer);
    event Activated(uint256 indexed id, bytes32 commitment, bytes nativeReply);
    event Superseded(uint256 indexed previous, uint256 indexed successor);
    event Cancelled(uint256 indexed id, address indexed by);
    event Checkout(
        uint256 indexed id, address indexed payer, bytes32 indexed paymentId,
        uint256 total, bytes32 commitment, uint256[] credits, bytes nativeReply
    );
    event Withdrawn(address indexed recipient, address indexed to, uint256 amount, uint256 nonce);

    /// The block this contract was deployed in, so readers know where its history starts.
    uint256 public deployBlock;
    uint256 public agreementCount;
    mapping(uint256 => Agreement) private agreements;
    mapping(bytes32 => bool) public paid;
    mapping(address => uint256) public earned;
    mapping(address => uint256) public withdrawn;
    /// Increases with every withdrawal of that recipient, so a signature works once.
    mapping(address => uint256) public nonces;
    mapping(address => uint256[]) private memberships;

    constructor() {
        deployBlock = block.number;
    }

    // ---------------------------------------------------------------- terms

    /// Propose terms. Nothing can be paid until every signer accepts them.
    /// `previous` is zero for a new agreement, or the active agreement this version replaces.
    function propose(
        string calldata title, uint128 price, address[] calldata recipients, uint16[] calldata shares, uint256 previous
    ) external returns (uint256 id) {
        uint256 size = recipients.length;
        if (bytes(title).length == 0 || bytes(title).length > 96 || size < 2 || size > MAX_RECIPIENTS ||
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

        id = ++agreementCount;
        Agreement storage agreement = agreements[id];
        agreement.proposer = msg.sender;
        agreement.status = Status.Pending;
        agreement.price = price;
        agreement.previous = previous;
        agreement.title = title;
        agreement.recipients = recipients;
        agreement.shares = shares;
        agreement.signers = recipients;
        if (previous != 0) {
            // Everyone on the version being replaced must consent too, so nobody can be
            // removed or diluted without their own post-quantum signature.
            Agreement storage old = agreements[previous];
            if (old.status != Status.Active) revert PreviousNotActive();
            for (uint256 i; i < old.recipients.length; ++i) {
                if (!_containsCalldata(recipients, old.recipients[i])) agreement.signers.push(old.recipients[i]);
            }
        }
        bytes32 hash = keccak256(abi.encode(TERMS_DOMAIN, title, price, recipients, shares, previous));
        agreement.termsHash = hash;
        emit Proposed(id, msg.sender, previous, hash);
    }

    /// The exact bytes `signer` signs with ML-DSA-87 to accept agreement `id`.
    function termsMessage(uint256 id, address signer) public view returns (bytes memory) {
        return abi.encodePacked("QoreSplit:terms:v2", block.chainid, address(this), id, signer, _get(id).termsHash);
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
        _requirePqcSignature(signer, mldsaSignature, termsMessage(id, signer));

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

        bytes32 commitment = agreementCommitment(id);
        bytes memory reply = _record("qoresplit-terms:", commitment);
        agreement.nativeReply = reply;
        emit Activated(id, commitment, reply);
    }

    /// What the Native receipt of an active agreement commits to.
    function agreementCommitment(uint256 id) public view returns (bytes32) {
        Agreement storage agreement = _get(id);
        return keccak256(abi.encode(
            AGREEMENT_DOMAIN, block.chainid, address(this), id, agreement.termsHash, agreement.signers
        ));
    }

    // ------------------------------------------------------------- payments

    function checkout(uint256 id, bytes32 paymentReference) external payable {
        Agreement storage agreement = _get(id);
        if (agreement.status != Status.Active) revert NotActive();
        if (msg.value != agreement.price || paymentReference == bytes32(0)) revert IncorrectPayment();
        bytes32 paymentId = keccak256(abi.encode(id, msg.sender, paymentReference));
        if (paid[paymentId]) revert AlreadyPaid();
        paid[paymentId] = true;
        agreement.sales += 1;

        address[] memory recipients = agreement.recipients;
        uint256[] memory credits = _split(agreement.price, agreement.shares);
        for (uint256 i; i < credits.length; ++i) earned[recipients[i]] += credits[i];

        bytes32 commitment = keccak256(abi.encode(
            RECEIPT_DOMAIN, block.chainid, address(this), id, msg.sender, paymentId, msg.value, recipients, credits
        ));
        bytes memory reply = _record("qoresplit:", commitment);
        emit Checkout(id, msg.sender, paymentId, msg.value, commitment, credits, reply);
    }

    // ---------------------------------------------------------- withdrawals

    function claimable(address recipient) public view returns (uint256) {
        return earned[recipient] - withdrawn[recipient];
    }

    /// The exact bytes `recipient` signs with ML-DSA-87 to send `amount` to `to`.
    function withdrawalMessage(address recipient, address to, uint256 amount, uint256 nonce)
        public view returns (bytes memory)
    {
        return abi.encodePacked("QoreSplit:withdraw:v2", block.chainid, address(this), recipient, to, amount, nonce);
    }

    /// Pay out earnings. Anyone may submit; only the recipient's ML-DSA-87 signature
    /// over the destination, amount and current nonce authorises it.
    function withdraw(address recipient, address payable to, uint256 amount, bytes calldata mldsaSignature) external {
        if (to == address(0) || to == address(this) || amount == 0) revert InvalidWithdrawal();
        if (amount > claimable(recipient)) revert InsufficientBalance();
        uint256 nonce = nonces[recipient];
        _requirePqcSignature(recipient, mldsaSignature, withdrawalMessage(recipient, to, amount, nonce));

        nonces[recipient] = nonce + 1;
        withdrawn[recipient] += amount;
        emit Withdrawn(recipient, to, amount, nonce);
        (bool success,) = to.call{value: amount}("");
        if (!success) revert WithdrawalFailed();
    }

    // ---------------------------------------------------------------- views

    function getAgreement(uint256 id) external view returns (Agreement memory) {
        return _get(id);
    }

    function quote(uint256 id) external view returns (uint256[] memory) {
        Agreement storage agreement = _get(id);
        return _split(agreement.price, agreement.shares);
    }

    /// Agreements that have credited `account`: every version it was a recipient of once active.
    function agreementsOf(address account) external view returns (uint256[] memory) {
        return memberships[account];
    }

    // -------------------------------------------------------------- private

    function _get(uint256 id) private view returns (Agreement storage agreement) {
        agreement = agreements[id];
        if (agreement.status == Status.None) revert AgreementNotFound();
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
