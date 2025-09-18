// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AssetBackedToken
 * @dev ERC20 token for each asset category, mint/burn controlled by parent contract (holds MINTER_ROLE)
 */
contract AssetBackedToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string public assetCategory;

    constructor(
        string memory name,
        string memory symbol,
        string memory _assetCategory,
        address minter
    ) ERC20(name, symbol) {
        require(minter != address(0), "Invalid minter address");
        _grantRole(DEFAULT_ADMIN_ROLE, minter);
        _grantRole(MINTER_ROLE, minter);
        assetCategory = _assetCategory;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(from != address(0), "Invalid burn address");
        require(amount > 0, "Amount must be positive");
        _burn(from, amount);
    }
}

/**
 * @title MultiTokenRwaBackedStablecoin
 * @dev Asset-backed stablecoin system with scalable categories and tokens
 */
contract MultiTokenRwaBackedStablecoin is AccessControl, Pausable, ReentrancyGuard {
    // Role definitions
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");

    // Asset Categories
    enum RwaCategory { RealEstate, Commodities, Bonds, Equipment, Inventory, Other }

    // Pledge lifecycle
    enum PledgeStatus { Pending, Verified, Minted, Rejected, Cancelled, Redeemed, Liquidated }

    // Pledge record
    struct Pledge {
        string rwaIdentifier;
        address pledger;
        PledgeStatus status;
        uint256 rwaValueUSD;
        uint256 stablecoinAmount;
        uint256 timestamp;
        uint256 lastValuationTime;
        string metadata;
        address verifiedBy;
        RwaCategory category;
        uint256 ltv;
        bool isRedeemable;
    }

    struct RedemptionRequest {
        uint256 pledgeId;
        uint256 stablecoinAmount;
        uint256 requestTime;
        bool processed;
        address requester;
        RwaCategory category;
    }

    struct TokenInfo {
        AssetBackedToken token;
        string name;
        string symbol;
        uint256 totalMinted;
        uint256 totalReserves;
        bool active;
    }

    // Configurable parameters
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_RWA_VALUE = 1_000e18;        // $1,000 min
    uint256 public constant MAX_RWA_VALUE = 100_000_000e18;  // $100M max
    uint256 public pledgeExpiryTime = 30 days;
    uint256 public maxRwaIdentifierLength = 256;
    uint256 public revaluationInterval = 90 days;
    uint256 public redemptionDelay = 7 days;
    uint256 public collateralizationRatio = 12000;            // 120% min collateralization (basis points)

    address public treasury;
    uint256 public reserveRatio = 500;                       // 5% reserves (basis points)
    uint256 public totalRwaValue;

    // State tracking
    mapping(uint256 => Pledge) public pledges;
    mapping(address => uint256[]) public userPledges;
    mapping(string => bool) public rwaExists;
    mapping(string => uint256) public rwaToPledgeId;
    mapping(uint256 => RedemptionRequest) public redemptionRequests;
    mapping(RwaCategory => uint256) public categoryLimits;
    mapping(RwaCategory => uint256) public categoryValues;
    mapping(RwaCategory => TokenInfo) public categoryTokens;

    uint256 public nextPledgeId;
    uint256 public nextRedemptionId;
    uint256 public totalPledges;
    uint256 public totalVerifiedPledges;
    uint256 public totalMintedPledges;

    // Events
    event PledgeSubmitted(uint256 indexed pledgeId, address indexed pledger, string rwaIdentifier, uint256 rwaValueUSD, RwaCategory category);
    event PledgeVerified(uint256 indexed pledgeId, address indexed verifier, uint256 rwaValueUSD);
    event PledgeRejected(uint256 indexed pledgeId, address indexed verifier, string reason);
    event PledgeCancelled(uint256 indexed pledgeId, address indexed pledger);
    event StablecoinMinted(address indexed user, uint256 indexed pledgeId, uint256 amount, RwaCategory category, address tokenAddress);
    event RedemptionRequested(uint256 indexed redemptionId, uint256 indexed pledgeId, address indexed requester, uint256 amount, RwaCategory category);
    event RedemptionProcessed(uint256 indexed redemptionId, uint256 indexed pledgeId, uint256 amount);
    event RwaRevalued(uint256 indexed pledgeId, uint256 oldValue, uint256 newValue, address indexed oracle);
    event CollateralizationUpdated(uint256 oldRatio, uint256 newRatio);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CategoryLimitUpdated(RwaCategory indexed category, uint256 oldLimit, uint256 newLimit);
    event LiquidationExecuted(uint256 indexed pledgeId, address indexed liquidator, uint256 rwaValue);
    event TokenDeployed(RwaCategory indexed category, address indexed tokenAddress, string symbol);
    event CategoryActivationChanged(RwaCategory indexed category, bool active);
    event RescueERC20(address indexed token, address indexed to, uint256 amount);
    event RescueETH(address indexed to, uint256 amount);

    // Custom errors
    error PledgeNotFound();
    error PledgeAlreadyProcessed();
    error NotPledgeOwner();
    error PledgeNotVerified();
    error PledgeExpired();
    error RwaAlreadyPledged();
    error InvalidRwaValue();
    error InvalidRwaIdentifier();
    error InvalidPledgeStatus();
    error ZeroAddress();
    error InvalidCollateralizationRatio();
    error CategoryLimitExceeded();
    error RevaluationRequired();
    error InsufficientCollateralization();
    error RedemptionDelayNotMet();
    error RedemptionAlreadyProcessed();
    error NotRedeemable();
    error InvalidRedemptionAmount();
    error ReservesInsufficient();
    error TokenNotDeployed();
    error CategoryNotActive();

    modifier validAddress(address addr) {
        require(addr != address(0), "Address is zero");
        _;
    }

    modifier pledgeExists(uint256 pledgeId) {
        if (pledges[pledgeId].pledger == address(0)) revert PledgeNotFound();
        _;
    }

    modifier categoryActive(RwaCategory category) {
        require(categoryTokens[category].active, "Category not active");
        _;
    }

    constructor(address _treasury) validAddress(_treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(LIQUIDATOR_ROLE, msg.sender);

        treasury = _treasury;
        nextPledgeId = 1;
        nextRedemptionId = 1;

        categoryLimits[RwaCategory.RealEstate] = 50_000_000e18;
        categoryLimits[RwaCategory.Commodities] = 20_000_000e18;
        categoryLimits[RwaCategory.Bonds] = 30_000_000e18;
        categoryLimits[RwaCategory.Equipment] = 10_000_000e18;
        categoryLimits[RwaCategory.Inventory] = 15_000_000e18;
        categoryLimits[RwaCategory.Other] = 5_000_000e18;

        _deployAllTokens();
    }

    function _deployAllTokens() internal {
        _deployTokenForCategory(RwaCategory.RealEstate, "Real Estate USD", "RUSD");
        _deployTokenForCategory(RwaCategory.Commodities, "Commodities USD", "CUSD");
        _deployTokenForCategory(RwaCategory.Bonds, "Bonds USD", "BUSD");
        _deployTokenForCategory(RwaCategory.Equipment, "Equipment USD", "EUSD");
        _deployTokenForCategory(RwaCategory.Inventory, "Inventory USD", "IUSD");
        _deployTokenForCategory(RwaCategory.Other, "Other Assets USD", "OUSD");
    }

    function _deployTokenForCategory(RwaCategory category, string memory name, string memory symbol) internal {
        AssetBackedToken token = new AssetBackedToken(name, symbol, _getCategoryName(category), address(this));
        categoryTokens[category] = TokenInfo({
            token: token,
            name: name,
            symbol: symbol,
            totalMinted: 0,
            totalReserves: 0,
            active: true
        });
        emit TokenDeployed(category, address(token), symbol);
    }

    function _getCategoryName(RwaCategory category) internal pure returns (string memory) {
        if (category == RwaCategory.RealEstate) return "Real Estate";
        if (category == RwaCategory.Commodities) return "Commodities";
        if (category == RwaCategory.Bonds) return "Bonds";
        if (category == RwaCategory.Equipment) return "Equipment";
        if (category == RwaCategory.Inventory) return "Inventory";
        if (category == RwaCategory.Other) return "Other";
        return "Unknown";
    }

    // Core functionality methods would go here...
    // For deployment purposes, this provides the basic structure

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Emergency functions
    function rescueERC20(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0) && to != address(0), "Zero address");
        IERC20(token).transfer(to, amount);
        emit RescueERC20(token, to, amount);
    }

    function rescueETH(address payable to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Zero address");
        require(amount <= address(this).balance, "Insufficient balance");
        to.transfer(amount);
        emit RescueETH(to, amount);
    }

    receive() external payable {}
}