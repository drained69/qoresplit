// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface INativeBridge {
    function executeCrossVMCall(uint8 targetVM, string calldata target, bytes calldata payload)
        external returns (bytes memory);
}

contract QoreSplit {
    address constant BRIDGE = address(0x0901);
    string public constant RECEIPTS = "qor1xjayq5ev55tkzpml9klxwyshr7gdrha0nurha9jhm0f0gdckksgs3gltw8";
    uint256 public constant WEI_PER_UQOR = 1e12;
    uint256 private constant BPS = 10_000;
    bytes32 public constant RECEIPT_DOMAIN = keccak256("qoresplit.checkout.v1");

    struct Link {
        address organizer;
        string title;
        uint128 price;
        address[] recipients;
        uint16[] shares;
    }

    error InvalidLink();
    error LinkNotFound();
    error IncorrectPayment();
    error AlreadyPaid();
    error BridgeUnavailable();
    error NativeReceiptRejected(bytes reason);
    error NothingToWithdraw();
    error WithdrawalFailed();

    event LinkCreated(uint256 indexed linkId, address indexed organizer);
    event Checkout(
        uint256 indexed linkId, address indexed payer, bytes32 indexed paymentId,
        uint256 total, bytes32 commitment, uint256[] credits, bytes nativeReply
    );
    event Withdrawn(address indexed recipient, uint256 amount);

    uint256 public linkCount;
    mapping(uint256 => Link) private links;
    mapping(bytes32 => bool) public paid;
    mapping(address => uint256) public claimable;

    function createLink(string calldata title, uint128 price, address[] calldata recipients, uint16[] calldata shares)
        external returns (uint256 id)
    {
        uint256 size = recipients.length;
        if (bytes(title).length == 0 || bytes(title).length > 96 || size < 2 || size > 3 ||
            size != shares.length || price == 0 || price % WEI_PER_UQOR != 0) revert InvalidLink();

        uint256 sum;
        for (uint256 i; i < size; ++i) {
            if (recipients[i] == address(0) || recipients[i] == address(this) ||
                (uint256(price) / WEI_PER_UQOR) * shares[i] < BPS) revert InvalidLink();
            for (uint256 j; j < i; ++j) {
                if (recipients[j] == recipients[i]) revert InvalidLink();
            }
            sum += shares[i];
        }
        if (sum != BPS) revert InvalidLink();

        id = ++linkCount;
        links[id] = Link(msg.sender, title, price, recipients, shares);
        emit LinkCreated(id, msg.sender);
    }

    function getLink(uint256 id) public view returns (Link memory link) {
        link = links[id];
        if (link.organizer == address(0)) revert LinkNotFound();
    }

    function quote(uint256 id) external view returns (uint256[] memory) {
        return splitAmounts(getLink(id));
    }

    function checkout(uint256 id, bytes32 paymentReference) external payable {
        Link memory link = getLink(id);
        if (msg.value != link.price || paymentReference == bytes32(0)) revert IncorrectPayment();
        bytes32 paymentId = keccak256(abi.encode(id, msg.sender, paymentReference));
        if (paid[paymentId]) revert AlreadyPaid();
        paid[paymentId] = true;

        uint256[] memory credits = splitAmounts(link);
        for (uint256 i; i < credits.length; ++i) {
            claimable[link.recipients[i]] += credits[i];
        }

        bytes32 commitment = keccak256(abi.encode(
            RECEIPT_DOMAIN, block.chainid, address(this), id, msg.sender, paymentId,
            msg.value, link.recipients, credits
        ));
        bytes memory payload = abi.encodePacked('{"record":{"note":"qoresplit:', hexDigest(commitment), '"}}');
        (bool success, bytes memory reply) = BRIDGE.call(
            abi.encodeCall(INativeBridge.executeCrossVMCall, (1, RECEIPTS, payload))
        );
        if (!success) revert NativeReceiptRejected(reply);
        // The pinned receipt book returns JSON with a sender, note, ID and height.
        // Both an absent precompile and ABI-encoded empty bytes fail this check.
        if (reply.length <= 64) revert BridgeUnavailable();

        emit Checkout(id, msg.sender, paymentId, msg.value, commitment, credits, reply);
    }

    function withdraw() external {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        claimable[msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function splitAmounts(Link memory link) private pure returns (uint256[] memory credits) {
        credits = new uint256[](link.recipients.length);
        uint256 price = link.price;
        uint256 remaining = price;
        for (uint256 i; i + 1 < credits.length; ++i) {
            credits[i] = ((price / WEI_PER_UQOR) * link.shares[i] / BPS) * WEI_PER_UQOR;
            remaining -= credits[i];
        }
        credits[credits.length - 1] = remaining;
    }

    function hexDigest(bytes32 value) private pure returns (bytes memory result) {
        bytes16 alphabet = "0123456789abcdef";
        result = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            result[2 * i] = alphabet[uint8(value[i]) >> 4];
            result[2 * i + 1] = alphabet[uint8(value[i]) & 15];
        }
    }
}
