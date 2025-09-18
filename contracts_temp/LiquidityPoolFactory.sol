// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./LiquidityPool.sol";

/**
 * @title LiquidityPoolFactory
 * @dev Enhanced factory contract for creating and managing liquidity pools with advanced features
 * @notice This factory creates and manages AMM liquidity pools with comprehensive tracking and controls
 */
contract LiquidityPoolFactory is AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using Clones for address;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant POOL_MANAGER_ROLE = keccak256("POOL_MANAGER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // Implementation contract for cloning
    address public liquidityPoolImplementation;

    // Pool registry
    struct PoolInfo {
        address poolAddress;
        address tokenA;
        address tokenB;
        uint256 feeRate;
        uint256 createdAt;
        address creator;
        bool isActive;
        uint256 totalVolume;
        uint256 totalLiquidity;
        uint256 totalFees;
        uint256 liquidityProviders;
    }

    // State variables
    mapping(address => mapping(address => mapping(uint256 => address))) public getPool;
    mapping(address => PoolInfo) public poolInfo;
    mapping(address => bool) public isValidPool;
    mapping(address => bool) public poolStatus; // true = active, false = inactive
    mapping(address => address[]) public creatorPools;
    mapping(bytes32 => address) public pairPools; // keccak256(tokenA, tokenB) => pool

    address[] public allPools;
    uint256 public totalPoolsCreated;
    uint256 public activePoolsCount;

    // Fee configurations
    uint256[] public standardFeeRates = [5, 30, 100, 300, 500]; // 0.05%, 0.3%, 1%, 3%, 5%
    uint256 public defaultFeeRate = 30; // 0.3% default fee
    uint256 public constant MAX_FEE_RATE = 1000; // 10% maximum fee
    uint256 public protocolFeeRate = 0; // Protocol fee rate
    address public protocolFeeRecipient;

    // Pool creation parameters
    struct PoolCreationParams {
        address tokenA;
        address tokenB;
        uint256 feeRate;
        uint256 initialLiquidityA;
        uint256 initialLiquidityB;
        uint256 minLiquidityA;
        uint256 minLiquidityB;
        address liquidityProvider;
        uint256 deadline;
    }

    // Factory statistics
    uint256 public totalVolumeAllPools;
    uint256 public totalFeesAllPools;
    uint256 public totalTransactionsAllPools;

    // Supported tokens
    mapping(address => bool) public supportedTokens;
    mapping(address => string) public tokenCategories; // "asset", "stable", "utility", etc.
    address[] public whitelistedTokens;

    // Pool limits and configurations
    uint256 public maxPoolsPerPair = 5; // Maximum pools per token pair (different fees)
    uint256 public minInitialLiquidity = 1000 * 10**18; // Minimum initial liquidity
    bool public permissionlessPoolCreation = true;
    bool public requireTokenWhitelist = false;

    // Events
    event PoolCreated(
        address indexed tokenA,
        address indexed tokenB,
        address indexed pool,
        uint256 feeRate,
        uint256 poolCount,
        address creator
    );

    event PoolStatusChanged(
        address indexed pool,
        bool isActive
    );

    event InitialLiquidityAdded(
        address indexed pool,
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event DefaultFeeRateChanged(
        uint256 oldFeeRate,
        uint256 newFeeRate
    );

    event ProtocolFeeUpdated(
        uint256 oldRate,
        uint256 newRate,
        address recipient
    );

    event TokenWhitelisted(
        address indexed token,
        string category,
        bool whitelisted
    );

    event PoolStatsUpdated(
        address indexed pool,
        uint256 totalVolume,
        uint256 totalLiquidity,
        uint256 totalFees,
        uint256 liquidityProviders
    );

    event FactoryConfigUpdated(
        uint256 maxPoolsPerPair,
        uint256 minInitialLiquidity,
        bool permissionlessCreation,
        bool requireWhitelist
    );

    // Custom errors
    error InvalidToken(address token);
    error IdenticalTokens();
    error PoolExists();
    error FeeRateTooHigh(uint256 rate);
    error MaxPoolsExceeded(uint256 current, uint256 maximum);
    error TokenNotWhitelisted(address token);
    error InsufficientInitialLiquidity(uint256 provided, uint256 required);
    error PermissionlessCreationDisabled();
    error InvalidPoolAddress(address pool);
    error ZeroAddress();
    error InvalidImplementation();
    error DeploymentFailed();

    modifier validTokenPair(address tokenA, address tokenB) {
        if (tokenA == address(0) || tokenB == address(0)) revert InvalidToken(address(0));
        if (tokenA == tokenB) revert IdenticalTokens();
        if (requireTokenWhitelist) {
            if (!supportedTokens[tokenA]) revert TokenNotWhitelisted(tokenA);
            if (!supportedTokens[tokenB]) revert TokenNotWhitelisted(tokenB);
        }
        _;
    }

    modifier validFeeRate(uint256 feeRate) {
        if (feeRate > MAX_FEE_RATE) revert FeeRateTooHigh(feeRate);
        _;
    }

    modifier onlyValidPool(address pool) {
        if (!isValidPool[pool]) revert InvalidPoolAddress(pool);
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(POOL_MANAGER_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);

        // Deploy implementation contract
        liquidityPoolImplementation = address(new LiquidityPool());
        if (liquidityPoolImplementation == address(0)) revert InvalidImplementation();
    }

    /**
     * @dev Create a new liquidity pool
     * @param tokenA Address of token A
     * @param tokenB Address of token B
     * @param feeRate Fee rate in basis points
     * @return pool Address of the created pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint256 feeRate
    ) external nonReentrant whenNotPaused validTokenPair(tokenA, tokenB) validFeeRate(feeRate) returns (address pool) {
        
        if (!permissionlessPoolCreation && !hasRole(POOL_MANAGER_ROLE, msg.sender)) {
            revert PermissionlessCreationDisabled();
        }

        // Ensure consistent token ordering
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        if (getPool[tokenA][tokenB][feeRate] != address(0)) revert PoolExists();

        // Check maximum pools per pair
        uint256 existingPools = _countPoolsForPair(tokenA, tokenB);
        if (existingPools >= maxPoolsPerPair) {
            revert MaxPoolsExceeded(existingPools, maxPoolsPerPair);
        }

        // Deploy pool using minimal proxy
        pool = liquidityPoolImplementation.clone();
        
        // Initialize the pool
        LiquidityPool(pool).initialize(tokenA, tokenB, feeRate);

        // Grant necessary roles to this factory for pool management
        LiquidityPool(pool).grantRole(keccak256("ADMIN_ROLE"), address(this));
        LiquidityPool(pool).grantRole(keccak256("FEE_MANAGER_ROLE"), address(this));

        // Register the pool
        _registerPool(pool, tokenA, tokenB, feeRate, msg.sender);

        emit PoolCreated(tokenA, tokenB, pool, feeRate, allPools.length, msg.sender);
    }

    /**
     * @dev Create pool with initial liquidity
     * @param params Pool creation parameters
     * @return pool Address of the created pool
     * @return liquidity Amount of LP tokens minted
     */
    function createPoolWithLiquidity(
        PoolCreationParams calldata params
    ) external nonReentrant whenNotPaused validTokenPair(params.tokenA, params.tokenB) validFeeRate(params.feeRate) returns (address pool, uint256 liquidity) {
        
        if (params.liquidityProvider == address(0)) revert ZeroAddress();
        if (params.initialLiquidityA.add(params.initialLiquidityB) < minInitialLiquidity) {
            revert InsufficientInitialLiquidity(
                params.initialLiquidityA.add(params.initialLiquidityB),
                minInitialLiquidity
            );
        }

        // Create the pool first
        pool = this.createPool(params.tokenA, params.tokenB, params.feeRate);

        // Transfer tokens to this contract first
        IERC20(params.tokenA).transferFrom(msg.sender, address(this), params.initialLiquidityA);
        IERC20(params.tokenB).transferFrom(msg.sender, address(this), params.initialLiquidityB);

        // Approve pool to spend tokens
        IERC20(params.tokenA).approve(pool, params.initialLiquidityA);
        IERC20(params.tokenB).approve(pool, params.initialLiquidityB);

        // Add initial liquidity
        uint256 amountA;
        uint256 amountB;
        (amountA, amountB, liquidity) = LiquidityPool(pool).addLiquidity(
            params.initialLiquidityA,
            params.initialLiquidityB,
            params.minLiquidityA,
            params.minLiquidityB,
            params.liquidityProvider,
            params.deadline
        );

        // Update pool statistics
        _updatePoolStats(pool);

        emit InitialLiquidityAdded(pool, params.liquidityProvider, amountA, amountB, liquidity);
    }

    /**
     * @dev Register a pool in the factory
     */
    function _registerPool(
        address pool,
        address tokenA,
        address tokenB,
        uint256 feeRate,
        address creator
    ) internal {
        // Store pool mapping
        getPool[tokenA][tokenB][feeRate] = pool;
        getPool[tokenB][tokenA][feeRate] = pool; // Reverse mapping

        // Create pool info
        poolInfo[pool] = PoolInfo({
            poolAddress: pool,
            tokenA: tokenA,
            tokenB: tokenB,
            feeRate: feeRate,
            createdAt: block.timestamp,
            creator: creator,
            isActive: true,
            totalVolume: 0,
            totalLiquidity: 0,
            totalFees: 0,
            liquidityProviders: 0
        });

        // Update registries
        allPools.push(pool);
        isValidPool[pool] = true;
        poolStatus[pool] = true;
        creatorPools[creator].push(pool);
        
        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        pairPools[pairKey] = pool;

        // Update counters
        totalPoolsCreated = totalPoolsCreated.add(1);
        activePoolsCount = activePoolsCount.add(1);
    }

    /**
     * @dev Count existing pools for a token pair
     */
    function _countPoolsForPair(address tokenA, address tokenB) internal view returns (uint256 count) {
        for (uint256 i = 0; i < standardFeeRates.length; i++) {
            if (getPool[tokenA][tokenB][standardFeeRates[i]] != address(0)) {
                count++;
            }
        }
    }

    /**
     * @dev Update pool statistics
     */
    function _updatePoolStats(address pool) internal {
        try LiquidityPool(pool).getPoolStatistics() returns (
            uint256 volume,
            uint256 fees,
            uint256 transactions,
            uint256 providers,
            uint256
        ) {
            PoolInfo storage info = poolInfo[pool];
            info.totalVolume = volume;
            info.totalFees = fees;
            info.liquidityProviders = providers;

            // Update factory totals
            totalVolumeAllPools = totalVolumeAllPools.add(volume);
            totalFeesAllPools = totalFeesAllPools.add(fees);
            totalTransactionsAllPools = totalTransactionsAllPools.add(transactions);

            emit PoolStatsUpdated(pool, volume, info.totalLiquidity, fees, providers);
        } catch {
            // Ignore errors for older pool implementations
        }
    }

    /**
     * @dev Get all pools for a token pair
     */
    function getPoolsForPair(address tokenA, address tokenB) 
        external 
        view 
        returns (address[] memory pools, uint256[] memory feeRates) 
    {
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        
        // Count valid pools for this pair
        uint256 count = 0;
        for (uint256 i = 0; i < standardFeeRates.length; i++) {
            if (getPool[tokenA][tokenB][standardFeeRates[i]] != address(0) && 
                poolStatus[getPool[tokenA][tokenB][standardFeeRates[i]]]) {
                count++;
            }
        }
        
        // Populate arrays
        pools = new address[](count);
        feeRates = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < standardFeeRates.length; i++) {
            address pool = getPool[tokenA][tokenB][standardFeeRates[i]];
            if (pool != address(0) && poolStatus[pool]) {
                pools[index] = pool;
                feeRates[index] = standardFeeRates[i];
                index++;
            }
        }
    }

    /**
     * @dev Get pool statistics
     */
    function getPoolStats(address pool) 
        external 
        view 
        onlyValidPool(pool)
        returns (
            bool isActive,
            uint256 totalSupply,
            uint256 reserveA,
            uint256 reserveB,
            address tokenA,
            address tokenB,
            uint256 feeRate,
            uint256 volume,
            uint256 fees
        ) 
    {
        PoolInfo memory info = poolInfo[pool];
        isActive = poolStatus[pool];
        
        try LiquidityPool(pool).getPoolInfo() returns (ILiquidityPool.PoolInfo memory poolData) {
            totalSupply = poolData.totalSupply;
            reserveA = poolData.reserveA;
            reserveB = poolData.reserveB;
            tokenA = poolData.tokenA;
            tokenB = poolData.tokenB;
            feeRate = poolData.feeRate;
        } catch {
            // Return stored data if pool call fails
            tokenA = info.tokenA;
            tokenB = info.tokenB;
            feeRate = info.feeRate;
        }
        
        volume = info.totalVolume;
        fees = info.totalFees;
    }

    /**
     * @dev Batch update statistics for all pools
     */
    function batchUpdateAllPoolStats() external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < allPools.length; i++) {
            if (poolStatus[allPools[i]]) {
                _updatePoolStats(allPools[i]);
            }
        }
    }

    /**
     * @dev Token management functions
     */
    function addSupportedToken(
        address token,
        string memory category
    ) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) revert InvalidToken(token);
        
        if (!supportedTokens[token]) {
            supportedTokens[token] = true;
            tokenCategories[token] = category;
            whitelistedTokens.push(token);
            
            emit TokenWhitelisted(token, category, true);
        }
    }

    function removeSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        if (supportedTokens[token]) {
            supportedTokens[token] = false;
            delete tokenCategories[token];
            
            // Remove from whitelist array
            for (uint256 i = 0; i < whitelistedTokens.length; i++) {
                if (whitelistedTokens[i] == token) {
                    whitelistedTokens[i] = whitelistedTokens[whitelistedTokens.length - 1];
                    whitelistedTokens.pop();
                    break;
                }
            }
            
            emit TokenWhitelisted(token, "", false);
        }
    }

    /**
     * @dev Pool management functions
     */
    function setPoolStatus(address pool, bool isActive) external onlyRole(POOL_MANAGER_ROLE) onlyValidPool(pool) {
        bool wasActive = poolStatus[pool];
        poolStatus[pool] = isActive;
        poolInfo[pool].isActive = isActive;

        // Update active count
        if (wasActive && !isActive) {
            activePoolsCount = activePoolsCount.sub(1);
        } else if (!wasActive && isActive) {
            activePoolsCount = activePoolsCount.add(1);
        }

        // Pause/unpause the pool contract itself
        try LiquidityPool(pool).pause() {
            if (!isActive) {
                // Successfully paused
            }
        } catch {}

        try LiquidityPool(pool).unpause() {
            if (isActive) {
                // Successfully unpaused
            }
        } catch {}

        emit PoolStatusChanged(pool, isActive);
    }

    /**
     * @dev Configuration functions
     */
    function setDefaultFeeRate(uint256 _feeRate) external onlyRole(FEE_MANAGER_ROLE) validFeeRate(_feeRate) {
        uint256 oldFeeRate = defaultFeeRate;
        defaultFeeRate = _feeRate;
        emit DefaultFeeRateChanged(oldFeeRate, _feeRate);
    }

    function setProtocolFee(uint256 _protocolFeeRate, address _recipient) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_protocolFeeRate > MAX_FEE_RATE) revert FeeRateTooHigh(_protocolFeeRate);
        if (_recipient == address(0)) revert ZeroAddress();
        
        uint256 oldRate = protocolFeeRate;
        protocolFeeRate = _protocolFeeRate;
        protocolFeeRecipient = _recipient;
        
        emit ProtocolFeeUpdated(oldRate, _protocolFeeRate, _recipient);
    }

    function setFactoryConfig(
        uint256 _maxPoolsPerPair,
        uint256 _minInitialLiquidity,
        bool _permissionlessCreation,
        bool _requireWhitelist
    ) external onlyRole(ADMIN_ROLE) {
        maxPoolsPerPair = _maxPoolsPerPair;
        minInitialLiquidity = _minInitialLiquidity;
        permissionlessPoolCreation = _permissionlessCreation;
        requireTokenWhitelist = _requireWhitelist;
        
        emit FactoryConfigUpdated(
            _maxPoolsPerPair,
            _minInitialLiquidity,
            _permissionlessCreation,
            _requireWhitelist
        );
    }

    function updateStandardFeeRates(uint256[] calldata _feeRates) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < _feeRates.length; i++) {
            if (_feeRates[i] > MAX_FEE_RATE) revert FeeRateTooHigh(_feeRates[i]);
        }
        standardFeeRates = _feeRates;
    }

    /**
     * @dev Emergency functions
     */
    function emergencyPausePool(address pool) external onlyRole(ADMIN_ROLE) onlyValidPool(pool) {
        try LiquidityPool(pool).pause() {
            poolStatus[pool] = false;
            poolInfo[pool].isActive = false;
            if (activePoolsCount > 0) {
                activePoolsCount = activePoolsCount.sub(1);
            }
            emit PoolStatusChanged(pool, false);
        } catch {
            // Pool doesn't support pausing
        }
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // View functions
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    function getActivePools() external view returns (address[] memory activePools) {
        uint256 activeCount = 0;
        
        // Count active pools
        for (uint256 i = 0; i < allPools.length; i++) {
            if (poolStatus[allPools[i]]) {
                activeCount++;
            }
        }
        
        // Create array of active pools
        activePools = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPools.length; i++) {
            if (poolStatus[allPools[i]]) {
                activePools[index] = allPools[i];
                index++;
            }
        }
    }

    function getPoolsByCreator(address creator) external view returns (address[] memory) {
        return creatorPools[creator];
    }

    function getWhitelistedTokens() external view returns (address[] memory) {
        return whitelistedTokens;
    }

    function getFactoryStatistics() external view returns (
        uint256 totalPools,
        uint256 activePools,
        uint256 totalVolume,
        uint256 totalFees,
        uint256 totalTransactions,
        uint256 supportedTokenCount
    ) {
        return (
            totalPoolsCreated,
            activePoolsCount,
            totalVolumeAllPools,
            totalFeesAllPools,
            totalTransactionsAllPools,
            whitelistedTokens.length
        );
    }

    function getStandardFeeRates() external view returns (uint256[] memory) {
        return standardFeeRates;
    }
}