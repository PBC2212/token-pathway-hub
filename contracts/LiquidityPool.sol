// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/ILiquidityPool.sol";
import "./LPToken.sol";

/**
 * @title LiquidityPool
 * @dev Enhanced Automated Market Maker (AMM) liquidity pool with advanced features
 * @notice This contract implements a constant product formula (x * y = k) with additional security and optimization features
 */
contract LiquidityPool is ILiquidityPool, ReentrancyGuard, AccessControl, Pausable, Initializable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Constants
    uint256 private constant MINIMUM_LIQUIDITY = 1000;
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_FEE_RATE = 1000; // 10% maximum fee
    uint256 private constant PRECISION = 1e18;
    
    // Pool state
    address public tokenA;
    address public tokenB;
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public feeRate; // Fee in basis points
    uint32 public blockTimestampLast;
    bool private _initialized;
    
    LPToken public lpToken;
    
    // Price oracle data
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    
    // Advanced features
    uint256 public protocolFeeRate = 0; // Protocol fee in basis points
    address public protocolFeeRecipient;
    uint256 public maxSlippage = 500; // 5% max slippage protection
    bool public slippageProtectionEnabled = true;
    
    // Trading limits
    uint256 public maxTransactionAmount;
    uint256 public dailyVolumeLimit;
    mapping(uint256 => uint256) public dailyVolume; // day => volume
    mapping(address => uint256) public userDailyVolume; // user => daily volume
    mapping(address => uint256) public lastActivityDay; // user => last activity day
    uint256 public maxUserDailyVolume;
    
    // Pool statistics
    uint256 public totalVolumeTraded;
    uint256 public totalFeesCollected;
    uint256 public totalTransactions;
    uint256 public largestTrade;
    
    // Liquidity provider tracking
    mapping(address => uint256) public liquidityProviderCount;
    mapping(address => uint256) public firstLiquidityTime;
    mapping(address => uint256) public totalLiquidityProvided;
    address[] public liquidityProviders;
    
    // Emergency controls
    bool public emergencyMode = false;
    uint256 public emergencyExitFee = 100; // 1% emergency exit fee
    
    // Price impact controls
    uint256 public maxPriceImpact = 1000; // 10% max price impact
    bool public priceImpactProtectionEnabled = true;
    
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

    // Custom errors
    error PoolAlreadyInitialized();
    error PoolNotInitialized();
    error InvalidToken(address token);
    error IdenticalTokens();
    error FeeRateTooHigh(uint256 rate);
    error InsufficientLiquidity();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error ExcessiveSlippage(uint256 actual, uint256 maximum);
    error TransactionExpired();
    error InvalidRecipient();
    error ArrayLengthMismatch();
    error ExceedsTransactionLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 amount, uint256 limit);
    error ExcessivePriceImpact(uint256 impact, uint256 maximum);
    error EmergencyModeActive();
    error ZeroAmount();
    error ZeroAddress();

    modifier onlyInitialized() {
        if (!_initialized) revert PoolNotInitialized();
        _;
    }
    
    modifier deadline(uint256 _deadline) {
        if (block.timestamp > _deadline) revert TransactionExpired();
        _;
    }
    
    modifier notInEmergency() {
        if (emergencyMode) revert EmergencyModeActive();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the pool with token pair and fee
     * @param _tokenA Address of token A
     * @param _tokenB Address of token B
     * @param _feeRate Fee rate in basis points
     */
    function initialize(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) external initializer {
        if (_initialized) revert PoolAlreadyInitialized();
        if (_tokenA == address(0) || _tokenB == address(0)) revert InvalidToken(address(0));
        if (_tokenA == _tokenB) revert IdenticalTokens();
        if (_feeRate > MAX_FEE_RATE) revert FeeRateTooHigh(_feeRate);
        
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
        
        _initialized = true;
        blockTimestampLast = uint32(block.timestamp);
        
        // Initialize roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Set default limits
        maxTransactionAmount = type(uint256).max;
        dailyVolumeLimit = type(uint256).max;
        maxUserDailyVolume = type(uint256).max;
        
        emit PoolInitialized(_tokenA, _tokenB, _feeRate, address(lpToken));
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
        notInEmergency
        returns (uint256 amountA, uint256 amountB, uint256 liquidity) 
    {
        if (to == address(0)) revert InvalidRecipient();
        
        (amountA, amountB) = _calculateLiquidityAmounts(
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        
        // Check transaction limits
        uint256 totalValue = amountA.add(amountB);
        if (totalValue > maxTransactionAmount) {
            revert ExceedsTransactionLimit(totalValue, maxTransactionAmount);
        }
        
        // Transfer tokens
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        
        // Calculate liquidity tokens to mint
        uint256 totalSupply = lpToken.totalSupply();
        if (totalSupply == 0) {
            liquidity = _sqrt(amountA.mul(amountB)).sub(MINIMUM_LIQUIDITY);
            lpToken.mint(address(0), MINIMUM_LIQUIDITY); // Lock minimum liquidity
        } else {
            liquidity = _min(
                amountA.mul(totalSupply).div(reserveA),
                amountB.mul(totalSupply).div(reserveB)
            );
        }
        
        if (liquidity == 0) revert InsufficientLiquidity();
        lpToken.mint(to, liquidity);
        
        // Track liquidity provider
        _trackLiquidityProvider(to, liquidity);
        
        _update(reserveA.add(amountA), reserveB.add(amountB));
        
        // Calculate current prices
        uint256 priceA = reserveB > 0 ? reserveA.mul(PRECISION).div(reserveB) : 0;
        uint256 priceB = reserveA > 0 ? reserveB.mul(PRECISION).div(reserveA) : 0;
        
        emit LiquidityAdded(msg.sender, amountA, amountB, liquidity, priceA, priceB);
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
        if (to == address(0)) revert InvalidRecipient();
        if (liquidity == 0) revert ZeroAmount();
        
        uint256 totalSupply = lpToken.totalSupply();
        amountA = liquidity.mul(reserveA).div(totalSupply);
        amountB = liquidity.mul(reserveB).div(totalSupply);
        
        if (amountA < amountAMin) revert InsufficientOutputAmount();
        if (amountB < amountBMin) revert InsufficientOutputAmount();
        
        // Calculate exit fee if in emergency mode
        uint256 fee = 0;
        if (emergencyMode) {
            fee = liquidity.mul(emergencyExitFee).div(BASIS_POINTS);
            liquidity = liquidity.sub(fee);
        }
        
        lpToken.burn(msg.sender, liquidity.add(fee));
        
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);
        
        _update(reserveA.sub(amountA), reserveB.sub(amountB));
        
        emit LiquidityRemoved(msg.sender, amountA, amountB, liquidity, fee);
    }
    
    /**
     * @dev Swap tokens with advanced features
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
        notInEmergency
        returns (uint256 amountOut) 
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (tokenIn != tokenA && tokenIn != tokenB) revert InvalidToken(tokenIn);
        if (to == address(0)) revert InvalidRecipient();
        
        // Check transaction limits
        if (amountIn > maxTransactionAmount) {
            revert ExceedsTransactionLimit(amountIn, maxTransactionAmount);
        }
        
        // Check daily volume limits
        _checkDailyLimits(msg.sender, amountIn);
        
        bool isTokenA = tokenIn == tokenA;
        address tokenOut = isTokenA ? tokenB : tokenA;
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        
        amountOut = getAmountOut(amountIn, tokenIn);
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();
        if (amountOut >= reserveOut) revert InsufficientLiquidity();
        
        // Check price impact
        if (priceImpactProtectionEnabled) {
            uint256 priceImpact = _calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);
            if (priceImpact > maxPriceImpact) {
                revert ExcessivePriceImpact(priceImpact, maxPriceImpact);
            }
        }
        
        // Check slippage
        if (slippageProtectionEnabled) {
            uint256 expectedOut = amountIn.mul(reserveOut).div(reserveIn.add(amountIn));
            uint256 slippage = expectedOut > amountOut ? 
                expectedOut.sub(amountOut).mul(BASIS_POINTS).div(expectedOut) : 0;
            if (slippage > maxSlippage) {
                revert ExcessiveSlippage(slippage, maxSlippage);
            }
        }
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Calculate fees
        uint256 totalFee = amountIn.mul(feeRate).div(BASIS_POINTS);
        uint256 protocolFee = totalFee.mul(protocolFeeRate).div(BASIS_POINTS);
        uint256 lpFee = totalFee.sub(protocolFee);
        
        // Transfer protocol fee if applicable
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            IERC20(tokenIn).safeTransfer(protocolFeeRecipient, protocolFee);
        }
        
        IERC20(tokenOut).safeTransfer(to, amountOut);
        
        uint256 newReserveIn = reserveIn.add(amountIn).sub(protocolFee);
        uint256 newReserveOut = reserveOut.sub(amountOut);
        
        if (isTokenA) {
            _update(newReserveIn, newReserveOut);
        } else {
            _update(newReserveOut, newReserveIn);
        }
        
        // Update statistics
        totalVolumeTraded = totalVolumeTraded.add(amountIn);
        totalFeesCollected = totalFeesCollected.add(totalFee);
        totalTransactions = totalTransactions.add(1);
        if (amountIn > largestTrade) {
            largestTrade = amountIn;
        }
        
        // Update daily volumes
        _updateDailyVolume(msg.sender, amountIn);
        
        uint256 priceImpact = _calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, totalFee, priceImpact);
        emit FeesCollected(totalFee, protocolFee, lpFee);
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
                if (amountBOptimal < amountBMin) revert InsufficientOutputAmount();
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                if (amountAOptimal > amountADesired || amountAOptimal < amountAMin) {
                    revert InsufficientOutputAmount();
                }
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
            // Use Q112.112 fixed point math
            price0CumulativeLast = price0CumulativeLast.add(
                uint256(_reserveB.mul(2**112).div(_reserveA)).mul(timeElapsed)
            );
            price1CumulativeLast = price1CumulativeLast.add(
                uint256(_reserveA.mul(2**112).div(_reserveB)).mul(timeElapsed)
            );
        }
        
        reserveA = _reserveA;
        reserveB = _reserveB;
        blockTimestampLast = blockTimestamp;
    }
    
    /**
     * @dev Track liquidity providers
     */
    function _trackLiquidityProvider(address provider, uint256 liquidity) private {
        if (liquidityProviderCount[provider] == 0) {
            liquidityProviders.push(provider);
            firstLiquidityTime[provider] = block.timestamp;
        }
        liquidityProviderCount[provider] = liquidityProviderCount[provider].add(1);
        totalLiquidityProvided[provider] = totalLiquidityProvided[provider].add(liquidity);
    }
    
    /**
     * @dev Check daily trading limits
     */
    function _checkDailyLimits(address user, uint256 amount) private view {
        uint256 currentDay = block.timestamp.div(86400);
        
        // Check global daily limit
        if (dailyVolume[currentDay].add(amount) > dailyVolumeLimit) {
            revert ExceedsDailyLimit(amount, dailyVolumeLimit);
        }
        
        // Check user daily limit
        uint256 userCurrentDayVolume = lastActivityDay[user] == currentDay ? 
            userDailyVolume[user] : 0;
        if (userCurrentDayVolume.add(amount) > maxUserDailyVolume) {
            revert ExceedsDailyLimit(amount, maxUserDailyVolume);
        }
    }
    
    /**
     * @dev Update daily volume tracking
     */
    function _updateDailyVolume(address user, uint256 amount) private {
        uint256 currentDay = block.timestamp.div(86400);
        
        dailyVolume[currentDay] = dailyVolume[currentDay].add(amount);
        
        if (lastActivityDay[user] != currentDay) {
            userDailyVolume[user] = 0;
            lastActivityDay[user] = currentDay;
        }
        userDailyVolume[user] = userDailyVolume[user].add(amount);
    }
    
    /**
     * @dev Calculate price impact
     */
    function _calculatePriceImpact(
        uint256 amountIn,
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) private pure returns (uint256) {
        uint256 priceBeforeNumerator = reserveOut.mul(PRECISION);
        uint256 priceBeforeDenominator = reserveIn;
        
        uint256 priceAfterNumerator = reserveOut.sub(amountOut).mul(PRECISION);
        uint256 priceAfterDenominator = reserveIn.add(amountIn);
        
        uint256 priceBefore = priceBeforeNumerator.div(priceBeforeDenominator);
        uint256 priceAfter = priceAfterNumerator.div(priceAfterDenominator);
        
        if (priceBefore <= priceAfter) return 0;
        
        return priceBefore.sub(priceAfter).mul(BASIS_POINTS).div(priceBefore);
    }
    
    // View functions
    function getReserves() external view returns (uint256, uint256, uint32) {
        return (reserveA, reserveB, blockTimestampLast);
    }
    
    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (tokenIn != tokenA && tokenIn != tokenB) revert InvalidToken(tokenIn);
        
        bool isTokenA = tokenIn == tokenA;
        uint256 reserveIn = isTokenA ? reserveA : reserveB;
        uint256 reserveOut = isTokenA ? reserveB : reserveA;
        
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        
        uint256 amountInWithFee = amountIn.mul(BASIS_POINTS.sub(feeRate));
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(BASIS_POINTS).add(amountInWithFee);
        amountOut = numerator.div(denominator);
    }
    
    function quote(uint256 amountA, uint256 _reserveA, uint256 _reserveB) public pure returns (uint256 amountB) {
        if (amountA == 0) revert InsufficientInputAmount();
        if (_reserveA == 0 || _reserveB == 0) revert InsufficientLiquidity();
        amountB = amountA.mul(_reserveB).div(_reserveA);
    }
    
    function getPoolInfo() external view returns (PoolInfo memory) {
        return PoolInfo({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: reserveA,
            reserveB: reserveB,
            totalSupply: lpToken.totalSupply(),
            feeRate: feeRate,
            isActive: !paused() && !emergencyMode
        });
    }
    
    function getPoolStatistics() external view returns (
        uint256 volume,
        uint256 fees,
        uint256 transactions,
        uint256 providers,
        uint256 largest
    ) {
        return (
            totalVolumeTraded,
            totalFeesCollected,
            totalTransactions,
            liquidityProviders.length,
            largestTrade
        );
    }
    
    // Admin functions
    function setFeeRate(uint256 _feeRate) external onlyRole(FEE_MANAGER_ROLE) {
        if (_feeRate > MAX_FEE_RATE) revert FeeRateTooHigh(_feeRate);
        feeRate = _feeRate;
    }
    
    function setProtocolFee(uint256 _protocolFeeRate, address _recipient) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_protocolFeeRate > BASIS_POINTS) revert FeeRateTooHigh(_protocolFeeRate);
        if (_recipient == address(0)) revert ZeroAddress();
        
        uint256 oldRate = protocolFeeRate;
        protocolFeeRate = _protocolFeeRate;
        protocolFeeRecipient = _recipient;
        
        emit ProtocolFeeUpdated(oldRate, _protocolFeeRate);
    }
    
    function setTradingLimits(
        uint256 _maxTransactionAmount,
        uint256 _dailyVolumeLimit,
        uint256 _maxUserDailyVolume
    ) external onlyRole(ADMIN_ROLE) {
        maxTransactionAmount = _maxTransactionAmount;
        dailyVolumeLimit = _dailyVolumeLimit;
        maxUserDailyVolume = _maxUserDailyVolume;
        
        emit TradingLimitsUpdated(_maxTransactionAmount, _dailyVolumeLimit, _maxUserDailyVolume);
    }
    
    function setProtectionSettings(
        bool _slippageProtectionEnabled,
        uint256 _maxSlippage,
        bool _priceImpactProtectionEnabled,
        uint256 _maxPriceImpact
    ) external onlyRole(ADMIN_ROLE) {
        slippageProtectionEnabled = _slippageProtectionEnabled;
        maxSlippage = _maxSlippage;
        priceImpactProtectionEnabled = _priceImpactProtectionEnabled;
        maxPriceImpact = _maxPriceImpact;
    }
    
    function toggleEmergencyMode() external onlyRole(EMERGENCY_ROLE) {
        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    // Utility functions
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y.div(2).add(1);
            while (x < z) {
                z = x;
                x = y.div(x).add(x).div(2);
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    function _min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }
    
    function isInitialized() external view returns (bool) {
        return _initialized;
    }
}