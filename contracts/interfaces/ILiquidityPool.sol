// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILiquidityPool {
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
    event LiquidityAdded(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event LiquidityRemoved(
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    
    event Swap(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // Core functions
    function initialize(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) external;

    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swap(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);

    // View functions
    function getReserves() external view returns (uint256 reserveA, uint256 reserveB, uint32 blockTimestampLast);
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256 amountOut);
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) external pure returns (uint256 amountB);
    function getPoolInfo() external view returns (PoolInfo memory);
}