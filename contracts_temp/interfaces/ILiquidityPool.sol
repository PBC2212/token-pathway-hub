// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title ILiquidityPool
 * @dev Interface for enhanced liquidity pool with advanced AMM features
 * @notice This interface defines all functions for a production-ready AMM liquidity pool
 */
interface ILiquidityPool is IAccessControl {
    
    // Structs
    struct PoolInfo {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalSupply;
        uint256 feeRate; // Fee in basis points (e.g., 30 = 0.3%)
        bool isActive;
    }

    // Events
    event PoolInitialized(
        address indexed tokenA,
        address indexed tokenB,
        uint256 feeRate,
        address lpToken
    );

    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        uint256 priceA,
        uint256 priceB
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity,
        uint256 fee
    );
    
    event Swap(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee,
        uint256 priceImpact
    );

    event FeesCollected(
        uint256 totalFees,
        uint256 protocolFees,
        uint256 lpFees
    );

    event EmergencyModeToggled(bool enabled);

    event ProtocolFeeUpdated(uint256 oldRate, uint256 newRate);

    event TradingLimitsUpdated(
        uint256 maxTransactionAmount,
        uint256 dailyVolumeLimit,
        uint256 maxUserDailyVolume
    );

    // Core AMM functions
    
    /**
     * @dev Initialize the pool with token pair and fee (for proxy pattern)
     * @param _tokenA Address of token A
     * @param _tokenB Address of token B
     * @param _feeRate Fee rate in basis points
     */
    function initialize(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) external;

    /**
     * @dev Add liquidity to the pool
     * @param amountADesired Desired amount of token A to add
     * @param amountBDesired Desired amount of token B to add
     * @param amountAMin Minimum amount of token A to add
     * @param amountBMin Minimum amount of token B to add
     * @param to Address to receive LP tokens
     * @param deadline Transaction deadline
     * @return amountA Actual amount of token A added
     * @return amountB Actual amount of token B added
     * @return liquidity Amount of LP tokens minted
     */
    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    /**
     * @dev Remove liquidity from the pool
     * @param liquidity Amount of LP tokens to burn
     * @param amountAMin Minimum amount of token A to receive
     * @param amountBMin Minimum amount of token B to receive
     * @param to Address to receive tokens
     * @param deadline Transaction deadline
     * @return amountA Amount of token A received
     * @return amountB Amount of token B received
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    /**
     * @dev Swap tokens with slippage and price impact protection
     * @param amountIn Amount of input tokens
     * @param amountOutMin Minimum amount of output tokens
     * @param tokenIn Address of input token
     * @param to Address to receive output tokens
     * @param deadline Transaction deadline
     * @return amountOut Amount of output tokens received
     */
    function swap(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    // View functions
    
    /**
     * @dev Get current reserves and last update timestamp
     * @return reserveA Reserve of token A
     * @return reserveB Reserve of token B
     * @return blockTimestampLast Last update timestamp
     */
    function getReserves() external view returns (uint256 reserveA, uint256 reserveB, uint32 blockTimestampLast);
    
    /**
     * @dev Calculate output amount for a given input amount
     * @param amountIn Input amount
     * @param tokenIn Input token address
     * @return amountOut Expected output amount
     */
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256 amountOut);
    
    /**
     * @dev Quote amount B for given amount A using current reserves
     * @param amountA Amount of token A
     * @param reserveA Reserve of token A
     * @param reserveB Reserve of token B
     * @return amountB Equivalent amount of token B
     */
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256 amountB);
    
    /**
     * @dev Get comprehensive pool information
     * @return Pool information struct
     */
    function getPoolInfo() external view returns (PoolInfo memory);

    /**
     * @dev Get pool trading statistics
     * @return volume Total volume traded
     * @return fees Total fees collected
     * @return transactions Total number of transactions
     * @return providers Number of liquidity providers
     * @return largest Largest single trade amount
     */
    function getPoolStatistics() external view returns (
        uint256 volume,
        uint256 fees,
        uint256 transactions,
        uint256 providers,
        uint256 largest
    );

    // Configuration functions
    
    /**
     * @dev Set trading fee rate (admin only)
     * @param _feeRate New fee rate in basis points
     */
    function setFeeRate(uint256 _feeRate) external;

    /**
     * @dev Set protocol fee configuration (admin only)
     * @param _protocolFeeRate Protocol fee rate in basis points
     * @param _recipient Protocol fee recipient address
     */
    function setProtocolFee(uint256 _protocolFeeRate, address _recipient) external;

    /**
     * @dev Set trading limits (admin only)
     * @param _maxTransactionAmount Maximum transaction amount
     * @param _dailyVolumeLimit Daily volume limit
     * @param _maxUserDailyVolume Maximum daily volume per user
     */
    function setTradingLimits(
        uint256 _maxTransactionAmount,
        uint256 _dailyVolumeLimit,
        uint256 _maxUserDailyVolume
    ) external;

    /**
     * @dev Set protection settings (admin only)
     * @param _slippageProtectionEnabled Enable/disable slippage protection
     * @param _maxSlippage Maximum allowed slippage in basis points
     * @param _priceImpactProtectionEnabled Enable/disable price impact protection
     * @param _maxPriceImpact Maximum allowed price impact in basis points
     */
    function setProtectionSettings(
        bool _slippageProtectionEnabled,
        uint256 _maxSlippage,
        bool _priceImpactProtectionEnabled,
        uint256 _maxPriceImpact
    ) external;

    /**
     * @dev Toggle emergency mode (emergency role only)
     */
    function toggleEmergencyMode() external;

    // Admin functions
    
    /**
     * @dev Pause the pool
     */
    function pause() external;

    /**
     * @dev Unpause the pool
     */
    function unpause() external;

    // State variable getters
    
    /**
     * @dev Get token A address
     * @return Address of token A
     */
    function tokenA() external view returns (address);

    /**
     * @dev Get token B address
     * @return Address of token B
     */
    function tokenB() external view returns (address);

    /**
     * @dev Get current reserve A
     * @return Current reserve of token A
     */
    function reserveA() external view returns (uint256);

    /**
     * @dev Get current reserve B
     * @return Current reserve of token B
     */
    function reserveB() external view returns (uint256);

    /**
     * @dev Get current fee rate
     * @return Current fee rate in basis points
     */
    function feeRate() external view returns (uint256);

    /**
     * @dev Get LP token contract address
     * @return Address of LP token contract
     */
    function lpToken() external view returns (address);

    /**
     * @dev Get protocol fee rate
     * @return Protocol fee rate in basis points
     */
    function protocolFeeRate() external view returns (uint256);

    /**
     * @dev Get protocol fee recipient
     * @return Address of protocol fee recipient
     */
    function protocolFeeRecipient() external view returns (address);

    /**
     * @dev Get maximum transaction amount
     * @return Maximum transaction amount
     */
    function maxTransactionAmount() external view returns (uint256);

    /**
     * @dev Get daily volume limit
     * @return Daily volume limit
     */
    function dailyVolumeLimit() external view returns (uint256);

    /**
     * @dev Get maximum user daily volume
     * @return Maximum daily volume per user
     */
    function maxUserDailyVolume() external view returns (uint256);

    /**
     * @dev Get maximum slippage tolerance
     * @return Maximum slippage in basis points
     */
    function maxSlippage() external view returns (uint256);

    /**
     * @dev Check if slippage protection is enabled
     * @return Whether slippage protection is enabled
     */
    function slippageProtectionEnabled() external view returns (bool);

    /**
     * @dev Get maximum price impact tolerance
     * @return Maximum price impact in basis points
     */
    function maxPriceImpact() external view returns (uint256);

    /**
     * @dev Check if price impact protection is enabled
     * @return Whether price impact protection is enabled
     */
    function priceImpactProtectionEnabled() external view returns (bool);

    /**
     * @dev Check if emergency mode is active
     * @return Whether emergency mode is active
     */
    function emergencyMode() external view returns (bool);

    /**
     * @dev Get emergency exit fee
     * @return Emergency exit fee in basis points
     */
    function emergencyExitFee() external view returns (uint256);

    /**
     * @dev Get total volume traded
     * @return Total volume traded across all time
     */
    function totalVolumeTraded() external view returns (uint256);

    /**
     * @dev Get total fees collected
     * @return Total fees collected across all time
     */
    function totalFeesCollected() external view returns (uint256);

    /**
     * @dev Get total number of transactions
     * @return Total number of transactions
     */
    function totalTransactions() external view returns (uint256);

    /**
     * @dev Get largest single trade amount
     * @return Largest single trade amount
     */
    function largestTrade() external view returns (uint256);

    /**
     * @dev Get daily volume for a specific day
     * @param day Day timestamp (in days since epoch)
     * @return Volume for that day
     */
    function dailyVolume(uint256 day) external view returns (uint256);

    /**
     * @dev Get user daily volume
     * @param user User address
     * @return User's daily volume
     */
    function userDailyVolume(address user) external view returns (uint256);

    /**
     * @dev Get user's last activity day
     * @param user User address
     * @return Last activity day timestamp
     */
    function lastActivityDay(address user) external view returns (uint256);

    /**
     * @dev Get liquidity provider count for an address
     * @param provider Provider address
     * @return Number of times user provided liquidity
     */
    function liquidityProviderCount(address provider) external view returns (uint256);

    /**
     * @dev Get first liquidity provision time for a provider
     * @param provider Provider address
     * @return Timestamp of first liquidity provision
     */
    function firstLiquidityTime(address provider) external view returns (uint256);

    /**
     * @dev Get total liquidity provided by a provider
     * @param provider Provider address
     * @return Total liquidity provided
     */
    function totalLiquidityProvided(address provider) external view returns (uint256);

    /**
     * @dev Get liquidity provider at index
     * @param index Index in providers array
     * @return Address of liquidity provider
     */
    function liquidityProviders(uint256 index) external view returns (address);

    /**
     * @dev Get price oracle data - cumulative price 0
     * @return Cumulative price of token 0 (B/A)
     */
    function price0CumulativeLast() external view returns (uint256);

    /**
     * @dev Get price oracle data - cumulative price 1
     * @return Cumulative price of token 1 (A/B)
     */
    function price1CumulativeLast() external view returns (uint256);

    /**
     * @dev Get last block timestamp when reserves were updated
     * @return Last block timestamp
     */
    function blockTimestampLast() external view returns (uint32);

    /**
     * @dev Check if pool is initialized
     * @return Whether the pool is initialized
     */
    function isInitialized() external view returns (bool);

    /**
     * @dev Check if pool is paused
     * @return Whether the pool is paused
     */
    function paused() external view returns (bool);
}