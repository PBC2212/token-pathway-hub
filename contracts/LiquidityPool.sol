// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/ILiquidityPool.sol";
import "./LPToken.sol";

/**
 * @title LiquidityPool
 * @dev Automated Market Maker (AMM) liquidity pool with constant product formula
 */
contract LiquidityPool is ILiquidityPool, ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Constants
    uint256 private constant MINIMUM_LIQUIDITY = 1000;
    uint256 private constant BASIS_POINTS = 10000;
    
    // Pool state
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public feeRate; // Fee in basis points
    uint32 public blockTimestampLast;
    
    LPToken public lpToken;
    bool public initialized;
    
    // Price cumulative for oracle
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    
    modifier onlyInitialized() {
        require(initialized, "LiquidityPool: not initialized");
        _;
    }
    
    modifier deadline(uint256 _deadline) {
        require(block.timestamp <= _deadline, "LiquidityPool: expired");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Initialize the pool with token pair and fee
     */
    function initialize(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) external onlyRole(ADMIN_ROLE) {
        require(!initialized, "LiquidityPool: already initialized");
        require(_tokenA != address(0) && _tokenB != address(0), "LiquidityPool: invalid token");
        require(_tokenA != _tokenB, "LiquidityPool: identical tokens");
        require(_feeRate <= 1000, "LiquidityPool: fee too high"); // Max 10%
        
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeRate = _feeRate;
        
        // Create LP token
        string memory nameA = IERC20Metadata(_tokenA).name();
        string memory nameB = IERC20Metadata(_tokenB).name();
        string memory symbolA = IERC20Metadata(_tokenA).symbol();
        string memory symbolB = IERC20Metadata(_tokenB).symbol();
        
        lpToken = new LPToken(
            string(abi.encodePacked(nameA, "-", nameB, " LP")),
            string(abi.encodePacked(symbolA, "-", symbolB, "-LP")),
            address(this)
        );
        
        initialized = true;
        blockTimestampLast = uint32(block.timestamp);
    }
    
    /**
     * @dev Add liquidity to the pool
     */
    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 _deadline
    ) external 
        nonReentrant 
        onlyInitialized 
        whenNotPaused 
        deadline(_deadline)
        returns (uint256 amountA, uint256 amountB, uint256 liquidity) 
    {
        require(to != address(0), "LiquidityPool: invalid recipient");
        
        (amountA, amountB) = _calculateLiquidityAmounts(
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        
        // Transfer tokens
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity tokens to mint
        uint256 totalSupply = lpToken.totalSupply();
        if (totalSupply == 0) {
            liquidity = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            lpToken.mint(address(0), MINIMUM_LIQUIDITY); // Lock minimum liquidity
        } else {
            liquidity = min(
                (amountA * totalSupply) / reserveA,
                (amountB * totalSupply) / reserveB
            );
        }
        
        require(liquidity > 0, "LiquidityPool: insufficient liquidity minted");
        lpToken.mint(to, liquidity);
        
        _update(reserveA + amountA, reserveB + amountB);
        
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity);
    }
    
    /**
     * @dev Remove liquidity from the pool
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 _deadline
    ) external 
        nonReentrant 
        onlyInitialized 
        whenNotPaused 
        deadline(_deadline)
        returns (uint256 amountA, uint256 amountB) 
    {
        require(to != address(0), "LiquidityPool: invalid recipient");
        require(liquidity > 0, "LiquidityPool: insufficient liquidity");
        
        uint256 totalSupply = lpToken.totalSupply();
        amountA = (liquidity * reserveA) / totalSupply;
        amountB = (liquidity * reserveB) / totalSupply;
        
        require(amountA >= amountAMin, "LiquidityPool: insufficient A amount");
        require(amountB >= amountBMin, "LiquidityPool: insufficient B amount");
        
        lpToken.burn(msg.sender, liquidity);
        
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);
        
        _update(reserveA - amountA, reserveB - amountB);
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity);
    }
    
    /**
     * @dev Swap tokens
     */
    function swap(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address to,
        uint256 _deadline
    ) external 
        nonReentrant 
        onlyInitialized 
        whenNotPaused 
        deadline(_deadline)
        returns (uint256 amountOut) 
    {
        require(amountIn > 0, "LiquidityPool: insufficient input amount");
        require(tokenIn == tokenA || tokenIn == tokenB, "LiquidityPool: invalid token");
        require(to != address(0), "LiquidityPool: invalid recipient");
        
        bool isTokenA = tokenIn == tokenA;
        address tokenOut = isTokenA ? tokenB : tokenA;
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        
        amountOut = getAmountOut(amountIn, tokenIn);
        require(amountOut >= amountOutMin, "LiquidityPool: insufficient output amount");
        require(amountOut < reserveOut, "LiquidityPool: insufficient liquidity");
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(to, amountOut);
        
        uint256 newReserveIn = reserveIn + amountIn;
        uint256 newReserveOut = reserveOut - amountOut;
        
        if (isTokenA) {
            _update(newReserveIn, newReserveOut);
        } else {
            _update(newReserveOut, newReserveIn);
        }
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
    
    /**
     * @dev Calculate optimal liquidity amounts
     */
    function _calculateLiquidityAmounts(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private view returns (uint256 amountA, uint256 amountB) {
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "LiquidityPool: insufficient B amount");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, 
                    "LiquidityPool: insufficient A amount");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    
    /**
     * @dev Update reserves and price accumulators
     */
    function _update(uint256 _reserveA, uint256 _reserveB) private {
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        
        if (timeElapsed > 0 && reserveA != 0 && reserveB != 0) {
            price0CumulativeLast += uint256((reserveB * 2**112) / reserveA) * timeElapsed;
            price1CumulativeLast += uint256((reserveA * 2**112) / reserveB) * timeElapsed;
        }
        
        reserveA = _reserveA;
        reserveB = _reserveB;
        blockTimestampLast = blockTimestamp;
    }
    
    // View functions
    function getReserves() external view returns (uint256, uint256, uint32) {
        return (reserveA, reserveB, blockTimestampLast);
    }
    
    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256 amountOut) {
        require(amountIn > 0, "LiquidityPool: insufficient input amount");
        require(tokenIn == tokenA || tokenIn == tokenB, "LiquidityPool: invalid token");
        
        bool isTokenA = tokenIn == tokenA;
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        
        require(reserveIn > 0 && reserveOut > 0, "LiquidityPool: insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * (BASIS_POINTS - feeRate);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * BASIS_POINTS + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    function quote(uint256 amountA, uint256 _reserveA, uint256 _reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0, "LiquidityPool: insufficient amount");
        require(_reserveA > 0 && _reserveB > 0, "LiquidityPool: insufficient liquidity");
        amountB = (amountA * _reserveB) / _reserveA;
    }
    
    function getPoolInfo() external view returns (PoolInfo memory) {
        return PoolInfo({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: reserveA,
            reserveB: reserveB,
            totalSupply: lpToken.totalSupply(),
            feeRate: feeRate,
            isActive: !paused()
        });
    }
    
    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    function setFeeRate(uint256 _feeRate) external onlyRole(ADMIN_ROLE) {
        require(_feeRate <= 1000, "LiquidityPool: fee too high");
        feeRate = _feeRate;
    }
    
    // Utility functions
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }
}