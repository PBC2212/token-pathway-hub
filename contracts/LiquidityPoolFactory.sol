// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LiquidityPool.sol";

/**
 * @title LiquidityPoolFactory
 * @dev Factory contract for creating and managing liquidity pools
 */
contract LiquidityPoolFactory is AccessControl, Pausable, ReentrancyGuard {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Events
    event PoolCreated(
        address indexed tokenA,
        address indexed tokenB,
        address indexed pool,
        uint256 feeRate,
        uint256 poolCount
    );
    
    event PoolStatusChanged(address indexed pool, bool isActive);
    event DefaultFeeRateChanged(uint256 oldFeeRate, uint256 newFeeRate);
    
    // State variables
    mapping(address => mapping(address => mapping(uint256 => address))) public getPool;
    mapping(address => bool) public isValidPool;
    mapping(address => bool) public poolStatus; // true = active, false = inactive
    
    address[] public allPools;
    uint256 public defaultFeeRate = 30; // 0.3% default fee
    uint256 public constant MAX_FEE_RATE = 1000; // 10% maximum fee
    
    // Pool creation parameters
    struct PoolParams {
        address tokenA;
        address tokenB;
        uint256 feeRate;
        uint256 initialLiquidityA;
        uint256 initialLiquidityB;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new liquidity pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint256 feeRate
    ) external nonReentrant whenNotPaused returns (address pool) {
        require(tokenA != address(0) && tokenB != address(0), "LiquidityPoolFactory: zero address");
        require(tokenA != tokenB, "LiquidityPoolFactory: identical tokens");
        require(feeRate <= MAX_FEE_RATE, "LiquidityPoolFactory: fee rate too high");
        
        // Ensure consistent token ordering
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        
        require(getPool[tokenA][tokenB][feeRate] == address(0), "LiquidityPoolFactory: pool exists");
        
        // Deploy new pool
        LiquidityPool newPool = new LiquidityPool();
        pool = address(newPool);
        
        // Initialize the pool
        newPool.initialize(tokenA, tokenB, feeRate);
        
        // Grant admin role to factory for pool management
        newPool.grantRole(newPool.ADMIN_ROLE(), address(this));
        
        // Store pool mapping
        getPool[tokenA][tokenB][feeRate] = pool;
        getPool[tokenB][tokenA][feeRate] = pool; // Reverse mapping
        
        allPools.push(pool);
        isValidPool[pool] = true;
        poolStatus[pool] = true; // Active by default
        
        emit PoolCreated(tokenA, tokenB, pool, feeRate, allPools.length);
    }
    
    /**
     * @dev Create pool with initial liquidity
     */
    function createPoolWithLiquidity(
        PoolParams calldata params,
        address liquidityProvider,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (address pool, uint256 liquidity) {
        require(liquidityProvider != address(0), "LiquidityPoolFactory: invalid provider");
        require(params.initialLiquidityA > 0 && params.initialLiquidityB > 0, 
            "LiquidityPoolFactory: insufficient initial liquidity");
        
        // Create the pool
        pool = createPool(params.tokenA, params.tokenB, params.feeRate);
        
        // Transfer tokens to this contract first
        IERC20(params.tokenA).transferFrom(msg.sender, address(this), params.initialLiquidityA);
        IERC20(params.tokenB).transferFrom(msg.sender, address(this), params.initialLiquidityB);
        
        // Approve pool to spend tokens
        IERC20(params.tokenA).approve(pool, params.initialLiquidityA);
        IERC20(params.tokenB).approve(pool, params.initialLiquidityB);
        
        // Add initial liquidity
        (, , liquidity) = LiquidityPool(pool).addLiquidity(
            params.initialLiquidityA,
            params.initialLiquidityB,
            0, // No minimum amounts for initial liquidity
            0,
            liquidityProvider,
            deadline
        );
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
        uint256[] memory tempFeeRates = new uint256[](10); // Assume max 10 different fee rates
        address[] memory tempPools = new address[](10);
        
        // Check common fee rates
        uint256[] memory commonFeeRates = new uint256[](5);
        commonFeeRates[0] = 5;   // 0.05%
        commonFeeRates[1] = 30;  // 0.30%
        commonFeeRates[2] = 100; // 1.00%
        commonFeeRates[3] = 300; // 3.00%
        commonFeeRates[4] = 500; // 5.00%
        
        for (uint256 i = 0; i < commonFeeRates.length; i++) {
            address pool = getPool[tokenA][tokenB][commonFeeRates[i]];
            if (pool != address(0) && poolStatus[pool]) {
                tempPools[count] = pool;
                tempFeeRates[count] = commonFeeRates[i];
                count++;
            }
        }
        
        // Resize arrays to actual count
        pools = new address[](count);
        feeRates = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            pools[i] = tempPools[i];
            feeRates[i] = tempFeeRates[i];
        }
    }
    
    /**
     * @dev Get pool statistics
     */
    function getPoolStats(address pool) 
        external 
        view 
        returns (
            bool isActive,
            uint256 totalSupply,
            uint256 reserveA,
            uint256 reserveB,
            address tokenA,
            address tokenB,
            uint256 feeRate
        ) 
    {
        require(isValidPool[pool], "LiquidityPoolFactory: invalid pool");
        
        LiquidityPool liquidityPool = LiquidityPool(pool);
        ILiquidityPool.PoolInfo memory info = liquidityPool.getPoolInfo();
        
        isActive = poolStatus[pool] && info.isActive;
        totalSupply = info.totalSupply;
        reserveA = info.reserveA;
        reserveB = info.reserveB;
        tokenA = info.tokenA;
        tokenB = info.tokenB;
        feeRate = info.feeRate;
    }
    
    /**
     * @dev Set default fee rate for new pools
     */
    function setDefaultFeeRate(uint256 _feeRate) external onlyRole(ADMIN_ROLE) {
        require(_feeRate <= MAX_FEE_RATE, "LiquidityPoolFactory: fee rate too high");
        uint256 oldFeeRate = defaultFeeRate;
        defaultFeeRate = _feeRate;
        emit DefaultFeeRateChanged(oldFeeRate, _feeRate);
    }
    
    /**
     * @dev Pause/unpause a specific pool
     */
    function setPoolStatus(address pool, bool isActive) external onlyRole(ADMIN_ROLE) {
        require(isValidPool[pool], "LiquidityPoolFactory: invalid pool");
        
        poolStatus[pool] = isActive;
        
        // Pause/unpause the pool contract itself
        LiquidityPool liquidityPool = LiquidityPool(pool);
        if (isActive) {
            liquidityPool.unpause();
        } else {
            liquidityPool.pause();
        }
        
        emit PoolStatusChanged(pool, isActive);
    }
    
    /**
     * @dev Emergency functions
     */
    function emergencyPausePool(address pool) external onlyRole(OPERATOR_ROLE) {
        require(isValidPool[pool], "LiquidityPoolFactory: invalid pool");
        LiquidityPool(pool).pause();
        poolStatus[pool] = false;
        emit PoolStatusChanged(pool, false);
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
}