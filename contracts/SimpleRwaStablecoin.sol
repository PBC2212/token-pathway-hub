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
 * @title SimpleRwaBackedStablecoin
 * @dev Simplified RWA-backed stablecoin system - tokens deployed separately
 */
contract SimpleRwaBackedStablecoin is AccessControl, Pausable, ReentrancyGuard {
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
    uint256 public collateralizationRatio = 12000;            // 120% min collateralization (basis points)

    address public treasury;
    uint256 public reserveRatio = 500;                       // 5% reserves (basis points)
    uint256 public totalRwaValue;

    // State tracking
    mapping(uint256 => Pledge) public pledges;
    mapping(address => uint256[]) public userPledges;
    mapping(string => bool) public rwaExists;
    mapping(string => uint256) public rwaToPledgeId;
    mapping(RwaCategory => uint256) public categoryLimits;
    mapping(RwaCategory => uint256) public categoryValues;
    mapping(RwaCategory => TokenInfo) public categoryTokens;

    uint256 public nextPledgeId;
    uint256 public totalPledges;

    // Events
    event PledgeSubmitted(uint256 indexed pledgeId, address indexed pledger, string rwaIdentifier, uint256 rwaValueUSD, RwaCategory category);
    event PledgeVerified(uint256 indexed pledgeId, address indexed verifier, uint256 rwaValueUSD);
    event StablecoinMinted(address indexed user, uint256 indexed pledgeId, uint256 amount, RwaCategory category, address tokenAddress);
    event TokenDeployed(RwaCategory indexed category, address indexed tokenAddress, string symbol);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CategoryLimitUpdated(RwaCategory indexed category, uint256 oldLimit, uint256 newLimit);

    // Custom errors
    error PledgeNotFound();
    error InvalidRwaValue();
    error ZeroAddress();

    modifier validAddress(address addr) {
        require(addr != address(0), "Address is zero");
        _;
    }

    modifier pledgeExists(uint256 pledgeId) {
        if (pledges[pledgeId].pledger == address(0)) revert PledgeNotFound();
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

        // Set category limits
        categoryLimits[RwaCategory.RealEstate] = 50_000_000e18;
        categoryLimits[RwaCategory.Commodities] = 20_000_000e18;
        categoryLimits[RwaCategory.Bonds] = 30_000_000e18;
        categoryLimits[RwaCategory.Equipment] = 10_000_000e18;
        categoryLimits[RwaCategory.Inventory] = 15_000_000e18;
        categoryLimits[RwaCategory.Other] = 5_000_000e18;
    }


    /**
     * @dev Internal function to deploy a token for a specific category
     */
    function _deployTokenForCategory(
        RwaCategory category, 
        string memory name, 
        string memory symbol
    ) internal {
        require(!categoryTokens[category].active, "Token already deployed");
        
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

    /**
     * @dev Deploy all standard tokens
     */
    function deployAllTokens() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _deployTokenForCategory(RwaCategory.RealEstate, "Real Estate USD", "RUSD");
        _deployTokenForCategory(RwaCategory.Commodities, "Commodities USD", "CUSD");
        _deployTokenForCategory(RwaCategory.Bonds, "Bonds USD", "BUSD");
        _deployTokenForCategory(RwaCategory.Equipment, "Equipment USD", "EUSD");
        _deployTokenForCategory(RwaCategory.Inventory, "Inventory USD", "IUSD");
        _deployTokenForCategory(RwaCategory.Other, "Other Assets USD", "OUSD");
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

    // Utility functions
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function updateTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) validAddress(newTreasury) {
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    // Emergency functions
    function rescueERC20(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0) && to != address(0), "Zero address");
        IERC20(token).transfer(to, amount);
    }

    function rescueETH(address payable to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Zero address");
        require(amount <= address(this).balance, "Insufficient balance");
        to.transfer(amount);
    }

    receive() external payable {}
}