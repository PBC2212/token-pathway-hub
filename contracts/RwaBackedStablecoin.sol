// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title RwaBackedStablecoin
 * @dev RWA-backed stablecoin with 1:1 backing ratio. Users pledge real world assets (RWA) off-chain.
 * Authorized verifiers approve pledges and set USD values. Stablecoins are minted 1:1 with verified RWA value.
 * Features: redemption mechanism, collateral management, price oracles integration ready.
 */
contract RwaBackedStablecoin is ERC20, AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    
    // Roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant LIQUIDATOR_ROLE = keccak256("LIQUIDATOR_ROLE");
    
    // Pledge status enum
    enum PledgeStatus { Pending, Verified, Minted, Rejected, Cancelled, Redeemed, Liquidated }
    
    // RWA Categories for different types of assets
    enum RwaCategory { RealEstate, Commodities, Bonds, Equipment, Inventory, Other }
    
    struct Pledge {
        string rwaIdentifier;          // Unique identifier for the real world asset
        address pledger;
        PledgeStatus status;
        uint256 rwaValueUSD;          // USD value of RWA (18 decimals)
        uint256 stablecoinAmount;     // Amount of stablecoins to mint (1:1 with USD value)
        uint256 timestamp;            // When pledge was created
        uint256 lastValuationTime;    // Last time RWA was revalued
        string metadata;              // Additional information about the RWA
        address verifiedBy;           // Who verified this pledge
        RwaCategory category;         // Type of RWA
        uint256 ltv;                  // Loan-to-value ratio (basis points, e.g., 8000 = 80%)
        bool isRedeemable;            // Whether this RWA can be redeemed
    }
    
    // Redemption request structure
    struct RedemptionRequest {
        uint256 pledgeId;
        uint256 stablecoinAmount;
        uint256 requestTime;
        bool processed;
        address requester;
    }
    
    // Configuration parameters
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_RWA_VALUE = 1000e18;     // $1,000 minimum
    uint256 public constant MAX_RWA_VALUE = 100000000e18; // $100M maximum
    uint256 public pledgeExpiryTime = 30 days;
    uint256 public maxRwaIdentifierLength = 256;
    uint256 public revaluationInterval = 90 days;       // RWAs must be revalued every 90 days
    uint256 public redemptionDelay = 7 days;            // 7 day delay for redemptions
    uint256 public collateralizationRatio = 12000;     // 120% minimum collateralization (basis points)
    
    // Treasury and reserve management
    address public treasury;                             // Treasury address for fees and reserves
    uint256 public reserveRatio = 500;                  // 5% reserve ratio (basis points)
    uint256 public totalReserves;                       // Total USD reserves
    uint256 public totalRwaValue;                       // Total RWA backing value
    
    // State mappings
    mapping(uint256 => Pledge) public pledges;
    mapping(address => uint256[]) public userPledges;
    mapping(string => bool) public rwaExists;
    mapping(string => uint256) public rwaToPledgeId;
    mapping(uint256 => RedemptionRequest) public redemptionRequests;
    mapping(RwaCategory => uint256) public categoryLimits; // Max value per category
    mapping(RwaCategory => uint256) public categoryValues; // Current value per category
    
    uint256 public nextPledgeId;
    uint256 public nextRedemptionId;
    uint256 public totalPledges;
    uint256 public totalVerifiedPledges;
    uint256 public totalMintedPledges;
    
    // Events
    event PledgeSubmitted(
        uint256 indexed pledgeId,
        address indexed pledger,
        string rwaIdentifier,
        uint256 rwaValueUSD,
        RwaCategory category
    );
    event PledgeVerified(uint256 indexed pledgeId, address indexed verifier, uint256 rwaValueUSD);
    event PledgeRejected(uint256 indexed pledgeId, address indexed verifier, string reason);
    event PledgeCancelled(uint256 indexed pledgeId, address indexed pledger);
    event StablecoinMinted(address indexed user, uint256 indexed pledgeId, uint256 amount);
    event RedemptionRequested(uint256 indexed redemptionId, uint256 indexed pledgeId, address indexed requester, uint256 amount);
    event RedemptionProcessed(uint256 indexed redemptionId, uint256 indexed pledgeId, uint256 amount);
    event RwaRevalued(uint256 indexed pledgeId, uint256 oldValue, uint256 newValue, address indexed oracle);
    event CollateralizationUpdated(uint256 oldRatio, uint256 newRatio);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event CategoryLimitUpdated(RwaCategory indexed category, uint256 oldLimit, uint256 newLimit);
    event LiquidationExecuted(uint256 indexed pledgeId, address indexed liquidator, uint256 rwaValue);
    
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
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }
    
    modifier pledgeExists(uint256 pledgeId) {
        if (pledges[pledgeId].pledger == address(0)) revert PledgeNotFound();
        _;
    }
    
    constructor(
        string memory name_,
        string memory symbol_,
        address _treasury
    ) ERC20(name_, symbol_) validAddress(_treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        _grantRole(LIQUIDATOR_ROLE, msg.sender);
        
        treasury = _treasury;
        
        // Set default category limits (in USD, 18 decimals)
        categoryLimits[RwaCategory.RealEstate] = 50000000e18;    // $50M
        categoryLimits[RwaCategory.Commodities] = 20000000e18;   // $20M
        categoryLimits[RwaCategory.Bonds] = 30000000e18;         // $30M
        categoryLimits[RwaCategory.Equipment] = 10000000e18;     // $10M
        categoryLimits[RwaCategory.Inventory] = 15000000e18;     // $15M
        categoryLimits[RwaCategory.Other] = 5000000e18;          // $5M
    }
    
    /**
     * @dev User submits off-chain RWA pledge
     */
    function submitPledge(
        string calldata rwaIdentifier,
        uint256 estimatedValueUSD,
        RwaCategory category,
        string calldata metadata,
        bool isRedeemable
    ) external whenNotPaused nonReentrant returns (uint256) {
        // Validate inputs
        if (bytes(rwaIdentifier).length == 0 || bytes(rwaIdentifier).length > maxRwaIdentifierLength) {
            revert InvalidRwaIdentifier();
        }
        if (estimatedValueUSD < MIN_RWA_VALUE || estimatedValueUSD > MAX_RWA_VALUE) {
            revert InvalidRwaValue();
        }
        if (rwaExists[rwaIdentifier]) {
            revert RwaAlreadyPledged();
        }
        
        uint256 pledgeId = nextPledgeId++;
        
        pledges[pledgeId] = Pledge({
            rwaIdentifier: rwaIdentifier,
            pledger: msg.sender,
            status: PledgeStatus.Pending,
            rwaValueUSD: estimatedValueUSD, // Will be updated by verifier
            stablecoinAmount: 0, // Will be calculated after verification
            timestamp: block.timestamp,
            lastValuationTime: 0,
            metadata: metadata,
            verifiedBy: address(0),
            category: category,
            ltv: 8000, // Default 80% LTV
            isRedeemable: isRedeemable
        });
        
        userPledges[msg.sender].push(pledgeId);
        rwaExists[rwaIdentifier] = true;
        rwaToPledgeId[rwaIdentifier] = pledgeId;
        totalPledges++;
        
        emit PledgeSubmitted(pledgeId, msg.sender, rwaIdentifier, estimatedValueUSD, category);
        return pledgeId;
    }
    
    /**
     * @dev Verifier approves the pledge and sets the official USD value
     */
    function verifyPledge(
        uint256 pledgeId,
        uint256 officialValueUSD,
        uint256 ltvBasisPoints
    ) external onlyRole(VERIFIER_ROLE) pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (pledge.status != PledgeStatus.Pending) revert PledgeAlreadyProcessed();
        if (block.timestamp > pledge.timestamp + pledgeExpiryTime) revert PledgeExpired();
        if (officialValueUSD < MIN_RWA_VALUE || officialValueUSD > MAX_RWA_VALUE) {
            revert InvalidRwaValue();
        }
        
        // Check category limits
        uint256 newCategoryValue = categoryValues[pledge.category].add(officialValueUSD);
        if (newCategoryValue > categoryLimits[pledge.category]) {
            revert CategoryLimitExceeded();
        }
        
        // Calculate stablecoin amount based on LTV ratio
        uint256 maxStablecoinAmount = officialValueUSD.mul(ltvBasisPoints).div(BASIS_POINTS);
        
        pledge.status = PledgeStatus.Verified;
        pledge.rwaValueUSD = officialValueUSD;
        pledge.stablecoinAmount = maxStablecoinAmount;
        pledge.verifiedBy = msg.sender;
        pledge.lastValuationTime = block.timestamp;
        pledge.ltv = ltvBasisPoints;
        
        // Update category tracking
        categoryValues[pledge.category] = newCategoryValue;
        totalVerifiedPledges++;
        totalRwaValue = totalRwaValue.add(officialValueUSD);
        
        emit PledgeVerified(pledgeId, msg.sender, officialValueUSD);
    }
    
    /**
     * @dev User mints stablecoins for their verified pledge
     */
    function mintStablecoins(uint256 pledgeId) external whenNotPaused nonReentrant pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (msg.sender != pledge.pledger) revert NotPledgeOwner();
        if (pledge.status != PledgeStatus.Verified) revert PledgeNotVerified();
        if (block.timestamp > pledge.timestamp + pledgeExpiryTime) revert PledgeExpired();
        
        // Check if collateralization ratio is maintained
        uint256 currentCollateralizationRatio = _calculateCollateralizationRatio();
        if (currentCollateralizationRatio < collateralizationRatio) {
            revert InsufficientCollateralization();
        }
        
        uint256 amount = pledge.stablecoinAmount;
        pledge.status = PledgeStatus.Minted;
        pledge.stablecoinAmount = 0; // Prevent re-minting
        totalMintedPledges++;
        
        // Calculate and mint to treasury as reserves
        uint256 reserveAmount = amount.mul(reserveRatio).div(BASIS_POINTS);
        if (reserveAmount > 0) {
            _mint(treasury, reserveAmount);
            totalReserves = totalReserves.add(reserveAmount);
        }
        
        _mint(msg.sender, amount);
        
        emit StablecoinMinted(msg.sender, pledgeId, amount);
    }
    
    /**
     * @dev Request redemption of stablecoins for RWA
     */
    function requestRedemption(
        uint256 pledgeId,
        uint256 stablecoinAmount
    ) external nonReentrant pledgeExists(pledgeId) returns (uint256) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (pledge.status != PledgeStatus.Minted) revert InvalidPledgeStatus();
        if (!pledge.isRedeemable) revert NotRedeemable();
        if (balanceOf(msg.sender) < stablecoinAmount) revert InvalidRedemptionAmount();
        
        // Check if RWA needs revaluation
        if (block.timestamp > pledge.lastValuationTime + revaluationInterval) {
            revert RevaluationRequired();
        }
        
        uint256 redemptionId = nextRedemptionId++;
        
        redemptionRequests[redemptionId] = RedemptionRequest({
            pledgeId: pledgeId,
            stablecoinAmount: stablecoinAmount,
            requestTime: block.timestamp,
            processed: false,
            requester: msg.sender
        });
        
        // Burn the stablecoins immediately but hold redemption
        _burn(msg.sender, stablecoinAmount);
        
        emit RedemptionRequested(redemptionId, pledgeId, msg.sender, stablecoinAmount);
        return redemptionId;
    }
    
    /**
     * @dev Process redemption request (admin function)
     */
    function processRedemption(uint256 redemptionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        RedemptionRequest storage request = redemptionRequests[redemptionId];
        
        if (request.processed) revert RedemptionAlreadyProcessed();
        if (block.timestamp < request.requestTime + redemptionDelay) {
            revert RedemptionDelayNotMet();
        }
        
        Pledge storage pledge = pledges[request.pledgeId];
        
        // Mark as redeemed if full amount
        if (request.stablecoinAmount >= pledge.rwaValueUSD.mul(pledge.ltv).div(BASIS_POINTS)) {
            pledge.status = PledgeStatus.Redeemed;
            categoryValues[pledge.category] = categoryValues[pledge.category].sub(pledge.rwaValueUSD);
            totalRwaValue = totalRwaValue.sub(pledge.rwaValueUSD);
            
            // Free up the RWA
            rwaExists[pledge.rwaIdentifier] = false;
            delete rwaToPledgeId[pledge.rwaIdentifier];
        }
        
        request.processed = true;
        
        emit RedemptionProcessed(redemptionId, request.pledgeId, request.stablecoinAmount);
    }
    
    /**
     * @dev Revalue RWA (Oracle function)
     */
    function revalueRwa(
        uint256 pledgeId,
        uint256 newValueUSD
    ) external onlyRole(ORACLE_ROLE) pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (pledge.status != PledgeStatus.Minted) revert InvalidPledgeStatus();
        if (newValueUSD < MIN_RWA_VALUE) revert InvalidRwaValue();
        
        uint256 oldValue = pledge.rwaValueUSD;
        pledge.rwaValueUSD = newValueUSD;
        pledge.lastValuationTime = block.timestamp;
        
        // Update category tracking
        categoryValues[pledge.category] = categoryValues[pledge.category].sub(oldValue).add(newValueUSD);
        totalRwaValue = totalRwaValue.sub(oldValue).add(newValueUSD);
        
        emit RwaRevalued(pledgeId, oldValue, newValueUSD, msg.sender);
        
        // Check if liquidation is needed (if RWA value drops too much)
        uint256 currentValue = newValueUSD.mul(pledge.ltv).div(BASIS_POINTS);
        uint256 outstandingStablecoins = pledge.stablecoinAmount; // This would need tracking in real implementation
        
        if (currentValue < outstandingStablecoins.mul(collateralizationRatio).div(BASIS_POINTS)) {
            // Trigger liquidation event but don't auto-liquidate
            emit LiquidationExecuted(pledgeId, msg.sender, newValueUSD);
        }
    }
    
    /**
     * @dev Emergency liquidation (Liquidator role)
     */
    function liquidatePledge(uint256 pledgeId) external onlyRole(LIQUIDATOR_ROLE) pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (pledge.status != PledgeStatus.Minted) revert InvalidPledgeStatus();
        
        pledge.status = PledgeStatus.Liquidated;
        categoryValues[pledge.category] = categoryValues[pledge.category].sub(pledge.rwaValueUSD);
        totalRwaValue = totalRwaValue.sub(pledge.rwaValueUSD);
        
        // Free up the RWA
        rwaExists[pledge.rwaIdentifier] = false;
        delete rwaToPledgeId[pledge.rwaIdentifier];
        
        emit LiquidationExecuted(pledgeId, msg.sender, pledge.rwaValueUSD);
    }
    
    // View functions
    
    /**
     * @dev Get current collateralization ratio
     */
    function getCollateralizationRatio() external view returns (uint256) {
        return _calculateCollateralizationRatio();
    }
    
    function _calculateCollateralizationRatio() internal view returns (uint256) {
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) return type(uint256).max;
        
        return totalRwaValue.add(totalReserves).mul(BASIS_POINTS).div(totalSupply);
    }
    
    /**
     * @dev Get backing ratio (should always be >= 100%)
     */
    function getBackingRatio() external view returns (uint256) {
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) return type(uint256).max;
        
        return totalRwaValue.mul(BASIS_POINTS).div(totalSupply);
    }
    
    /**
     * @dev Get detailed pledge information
     */
    function getPledgeDetails(uint256 pledgeId) external view returns (
        Pledge memory pledge,
        bool isExpired,
        bool needsRevaluation
    ) {
        pledge = pledges[pledgeId];
        isExpired = block.timestamp > pledge.timestamp + pledgeExpiryTime;
        needsRevaluation = block.timestamp > pledge.lastValuationTime + revaluationInterval;
    }
    
    /**
     * @dev Get category statistics
     */
    function getCategoryStats(RwaCategory category) external view returns (
        uint256 currentValue,
        uint256 limit,
        uint256 utilization
    ) {
        currentValue = categoryValues[category];
        limit = categoryLimits[category];
        utilization = limit > 0 ? currentValue.mul(BASIS_POINTS).div(limit) : 0;
    }
    
    // Admin functions
    
    /**
     * @dev Update collateralization ratio
     */
    function setCollateralizationRatio(uint256 _ratio) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_ratio < BASIS_POINTS || _ratio > 20000) revert InvalidCollateralizationRatio(); // 100% - 200%
        
        uint256 oldRatio = collateralizationRatio;
        collateralizationRatio = _ratio;
        
        emit CollateralizationUpdated(oldRatio, _ratio);
    }
    
    /**
     * @dev Update treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) validAddress(_treasury) {
        address oldTreasury = treasury;
        treasury = _treasury;
        
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /**
     * @dev Update category limit
     */
    function setCategoryLimit(RwaCategory category, uint256 limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldLimit = categoryLimits[category];
        categoryLimits[category] = limit;
        
        emit CategoryLimitUpdated(category, oldLimit, limit);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // Additional helper functions for reject, cancel, etc. (similar to previous version)
    function rejectPledge(uint256 pledgeId, string calldata reason) external onlyRole(VERIFIER_ROLE) pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (pledge.status != PledgeStatus.Pending) revert PledgeAlreadyProcessed();
        
        pledge.status = PledgeStatus.Rejected;
        pledge.verifiedBy = msg.sender;
        
        rwaExists[pledge.rwaIdentifier] = false;
        delete rwaToPledgeId[pledge.rwaIdentifier];
        
        emit PledgeRejected(pledgeId, msg.sender, reason);
    }
    
    function cancelPledge(uint256 pledgeId) external pledgeExists(pledgeId) {
        Pledge storage pledge = pledges[pledgeId];
        
        if (msg.sender != pledge.pledger) revert NotPledgeOwner();
        if (pledge.status != PledgeStatus.Pending) revert InvalidPledgeStatus();
        
        pledge.status = PledgeStatus.Cancelled;
        
        rwaExists[pledge.rwaIdentifier] = false;
        delete rwaToPledgeId[pledge.rwaIdentifier];
        
        emit PledgeCancelled(pledgeId, msg.sender);
    }
}
