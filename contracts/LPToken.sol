// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title LPToken
 * @dev Enhanced ERC20 token representing liquidity pool shares with advanced features
 * @notice This contract represents ownership shares in a liquidity pool with comprehensive tracking and governance features
 */
contract LPToken is ERC20, ERC20Permit, ERC20Burnable, AccessControl, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Pool information
    address public pool;
    address public tokenA;
    address public tokenB;
    uint256 public feeRate;
    
    // Liquidity provider tracking
    struct ProviderInfo {
        uint256 liquidityProvided;
        uint256 feesEarned;
        uint256 firstProvisionTime;
        uint256 lastProvisionTime;
        uint256 totalTransactions;
        bool isActive;
    }
    
    mapping(address => ProviderInfo) public providerInfo;
    mapping(address => uint256) public providerIndex;
    address[] public liquidityProviders;
    
    // Token statistics
    uint256 public totalFeesDistributed;
    uint256 public totalLiquidityProvided;
    uint256 public averageHoldingTime;
    uint256 public totalProviders;
    uint256 public activeProviders;
    
    // Fee distribution
    mapping(address => uint256) public unclaimedFees;
    mapping(address => uint256) public lastFeeUpdateTime;
    uint256 public cumulativeFeePerToken;
    uint256 public lastFeeDistributionTime;
    
    // Transfer restrictions
    bool public transfersEnabled = true;
    mapping(address => bool) public transferAllowlist;
    mapping(address => bool) public transferBlocklist;
    bool public requireAllowlist = false;
    
    // Staking and rewards
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakingRewards;
    mapping(address => uint256) public lastStakeTime;
    uint256 public totalStaked;
    uint256 public stakingRewardRate = 0; // Rewards per second per token
    
    // Governance features
    mapping(address => uint256) public votingPower;
    mapping(bytes32 => uint256) public proposalVotes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    uint256 public totalVotingPower;
    
    // Events
    event LiquidityProviderAdded(
        address indexed provider,
        uint256 amount,
        uint256 totalProviders
    );
    
    event LiquidityProviderRemoved(
        address indexed provider,
        uint256 amount,
        uint256 totalProviders
    );
    
    event FeesDistributed(
        uint256 totalFees,
        uint256 perTokenAmount,
        uint256 timestamp
    );
    
    event FeeClaimed(
        address indexed provider,
        uint256 amount,
        uint256 timestamp
    );
    
    event TransferSettingsUpdated(
        bool transfersEnabled,
        bool requireAllowlist
    );
    
    event ProviderStatusUpdated(
        address indexed provider,
        bool isActive,
        uint256 liquidityAmount
    );
    
    event TokensStaked(
        address indexed staker,
        uint256 amount,
        uint256 totalStaked
    );
    
    event TokensUnstaked(
        address indexed staker,
        uint256 amount,
        uint256 rewards,
        uint256 totalStaked
    );
    
    event VoteCast(
        address indexed voter,
        bytes32 indexed proposalId,
        uint256 votingPower,
        uint256 totalVotes
    );

    // Custom errors
    error UnauthorizedMinter(address caller);
    error UnauthorizedBurner(address caller);
    error InvalidPool(address pool);
    error TransfersDisabled();
    error TransferNotAllowed(address from, address to);
    error InsufficientBalance(uint256 requested, uint256 available);
    error NoFeesToClaim();
    error InvalidStakeAmount(uint256 amount);
    error InsufficientStakedBalance(uint256 requested, uint256 available);
    error AlreadyVoted(bytes32 proposalId);
    error ZeroAddress();
    error InvalidAmount(uint256 amount);

    modifier onlyPool() {
        if (msg.sender != pool) revert UnauthorizedMinter(msg.sender);
        _;
    }
    
    modifier whenTransfersEnabled() {
        if (!transfersEnabled) revert TransfersDisabled();
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _pool
    ) ERC20(name, symbol) ERC20Permit(name) validAddress(_pool) {
        pool = _pool;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, _pool);
        _grantRole(BURNER_ROLE, _pool);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Allow pool to transfer freely
        transferAllowlist[_pool] = true;
        transferAllowlist[msg.sender] = true;
        
        lastFeeDistributionTime = block.timestamp;
    }

    /**
     * @dev Initialize pool information (called by pool contract)
     * @param _tokenA Address of token A in the pool
     * @param _tokenB Address of token B in the pool
     * @param _feeRate Fee rate of the pool
     */
    function initializePoolInfo(
        address _tokenA,
        address _tokenB,
        uint256 _feeRate
    ) external onlyPool {
        tokenA = _tokenA;
        tokenB = _tokenB;
        feeRate = _feeRate;
    }

    /**
     * @dev Mint LP tokens to account (only callable by pool)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyPool nonReentrant whenNotPaused validAddress(to) {
        if (amount == 0) revert InvalidAmount(amount);
        
        // Update provider information
        _updateProviderInfo(to, amount, true);
        
        // Update fee tracking before minting
        _updateFeeTracking(to);
        
        _mint(to, amount);
        
        // Update voting power
        _updateVotingPower(to, balanceOf(to));
        
        emit LiquidityProviderAdded(to, amount, totalProviders);
    }

    /**
     * @dev Burn LP tokens from account (only callable by pool)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyPool nonReentrant whenNotPaused validAddress(from) {
        if (amount == 0) revert InvalidAmount(amount);
        if (balanceOf(from) < amount) revert InsufficientBalance(amount, balanceOf(from));
        
        // Update fee tracking before burning
        _updateFeeTracking(from);
        
        // Update provider information
        _updateProviderInfo(from, amount, false);
        
        _burn(from, amount);
        
        // Update voting power
        _updateVotingPower(from, balanceOf(from));
        
        emit LiquidityProviderRemoved(from, amount, totalProviders);
    }

    /**
     * @dev Distribute fees to LP token holders
     * @param totalFees Total fees to distribute
     */
    function distributeFees(uint256 totalFees) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (totalFees == 0) return;
        if (totalSupply() == 0) return;
        
        uint256 feePerToken = totalFees.mul(1e18).div(totalSupply());
        cumulativeFeePerToken = cumulativeFeePerToken.add(feePerToken);
        totalFeesDistributed = totalFeesDistributed.add(totalFees);
        lastFeeDistributionTime = block.timestamp;
        
        emit FeesDistributed(totalFees, feePerToken, block.timestamp);
    }

    /**
     * @dev Claim accumulated fees
     */
    function claimFees() external nonReentrant whenNotPaused {
        _updateFeeTracking(msg.sender);
        
        uint256 fees = unclaimedFees[msg.sender];
        if (fees == 0) revert NoFeesToClaim();
        
        unclaimedFees[msg.sender] = 0;
        
        // Update provider info
        providerInfo[msg.sender].feesEarned = providerInfo[msg.sender].feesEarned.add(fees);
        
        // Transfer fees (assuming they're held in this contract or pool)
        // In a real implementation, you'd need to handle the actual fee token transfers
        
        emit FeeClaimed(msg.sender, fees, block.timestamp);
    }

    /**
     * @dev Stake LP tokens for additional rewards
     * @param amount Amount of LP tokens to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidStakeAmount(amount);
        if (balanceOf(msg.sender) < amount) revert InsufficientBalance(amount, balanceOf(msg.sender));
        
        // Update staking rewards before changing stake
        _updateStakingRewards(msg.sender);
        
        _transfer(msg.sender, address(this), amount);
        
        stakedBalance[msg.sender] = stakedBalance[msg.sender].add(amount);
        totalStaked = totalStaked.add(amount);
        lastStakeTime[msg.sender] = block.timestamp;
        
        emit TokensStaked(msg.sender, amount, totalStaked);
    }

    /**
     * @dev Unstake LP tokens and claim rewards
     * @param amount Amount of LP tokens to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidStakeAmount(amount);
        if (stakedBalance[msg.sender] < amount) revert InsufficientStakedBalance(amount, stakedBalance[msg.sender]);
        
        // Update staking rewards before changing stake
        _updateStakingRewards(msg.sender);
        
        uint256 rewards = stakingRewards[msg.sender];
        stakingRewards[msg.sender] = 0;
        
        stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(amount);
        totalStaked = totalStaked.sub(amount);
        
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnstaked(msg.sender, amount, rewards, totalStaked);
    }

    /**
     * @dev Cast vote on a proposal (governance feature)
     * @param proposalId ID of the proposal
     */
    function vote(bytes32 proposalId) external nonReentrant whenNotPaused {
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted(proposalId);
        
        uint256 power = votingPower[msg.sender];
        if (power == 0) return;
        
        hasVoted[proposalId][msg.sender] = true;
        proposalVotes[proposalId] = proposalVotes[proposalId].add(power);
        
        emit VoteCast(msg.sender, proposalId, power, proposalVotes[proposalId]);
    }

    /**
     * @dev Update provider information
     */
    function _updateProviderInfo(address provider, uint256 amount, bool isAddition) internal {
        ProviderInfo storage info = providerInfo[provider];
        
        if (isAddition) {
            if (!info.isActive) {
                // New provider
                liquidityProviders.push(provider);
                providerIndex[provider] = liquidityProviders.length - 1;
                info.firstProvisionTime = block.timestamp;
                info.isActive = true;
                totalProviders = totalProviders.add(1);
                activeProviders = activeProviders.add(1);
            }
            
            info.liquidityProvided = info.liquidityProvided.add(amount);
            info.lastProvisionTime = block.timestamp;
            info.totalTransactions = info.totalTransactions.add(1);
            totalLiquidityProvided = totalLiquidityProvided.add(amount);
        } else {
            info.liquidityProvided = info.liquidityProvided.sub(amount);
            info.totalTransactions = info.totalTransactions.add(1);
            totalLiquidityProvided = totalLiquidityProvided.sub(amount);
            
            // Check if provider should be marked inactive
            if (balanceOf(provider).sub(amount) == 0) {
                info.isActive = false;
                activeProviders = activeProviders.sub(1);
                
                // Remove from array (swap with last element)
                uint256 index = providerIndex[provider];
                uint256 lastIndex = liquidityProviders.length - 1;
                
                if (index != lastIndex) {
                    address lastProvider = liquidityProviders[lastIndex];
                    liquidityProviders[index] = lastProvider;
                    providerIndex[lastProvider] = index;
                }
                
                liquidityProviders.pop();
                delete providerIndex[provider];
            }
        }
        
        emit ProviderStatusUpdated(provider, info.isActive, info.liquidityProvided);
    }

    /**
     * @dev Update fee tracking for a provider
     */
    function _updateFeeTracking(address provider) internal {
        uint256 balance = balanceOf(provider);
        if (balance == 0) return;
        
        uint256 lastUpdate = lastFeeUpdateTime[provider];
        uint256 feesSinceLastUpdate = cumulativeFeePerToken.sub(lastUpdate);
        uint256 newFees = balance.mul(feesSinceLastUpdate).div(1e18);
        
        unclaimedFees[provider] = unclaimedFees[provider].add(newFees);
        lastFeeUpdateTime[provider] = cumulativeFeePerToken;
    }

    /**
     * @dev Update staking rewards for a user
     */
    function _updateStakingRewards(address user) internal {
        if (stakingRewardRate == 0 || stakedBalance[user] == 0) return;
        
        uint256 timeElapsed = block.timestamp.sub(lastStakeTime[user]);
        uint256 rewards = stakedBalance[user].mul(stakingRewardRate).mul(timeElapsed).div(1e18);
        
        stakingRewards[user] = stakingRewards[user].add(rewards);
        lastStakeTime[user] = block.timestamp;
    }

    /**
     * @dev Update voting power for a user
     */
    function _updateVotingPower(address user, uint256 newBalance) internal {
        uint256 oldPower = votingPower[user];
        uint256 newPower = newBalance.add(stakedBalance[user]); // Staked tokens get voting power too
        
        totalVotingPower = totalVotingPower.sub(oldPower).add(newPower);
        votingPower[user] = newPower;
    }

    /**
     * @dev Override transfer to include restrictions and tracking
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        // Skip checks for minting and burning
        if (from == address(0) || to == address(0)) return;
        
        // Check transfer restrictions
        if (!transfersEnabled && !transferAllowlist[from] && !transferAllowlist[to]) {
            revert TransfersDisabled();
        }
        
        if (requireAllowlist && !transferAllowlist[from] && !transferAllowlist[to]) {
            revert TransferNotAllowed(from, to);
        }
        
        if (transferBlocklist[from] || transferBlocklist[to]) {
            revert TransferNotAllowed(from, to);
        }
    }

    /**
     * @dev Override transfer to update fee tracking
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._afterTokenTransfer(from, to, amount);
        
        // Update fee tracking for both parties
        if (from != address(0)) {
            _updateFeeTracking(from);
            _updateVotingPower(from, balanceOf(from));
        }
        
        if (to != address(0)) {
            _updateFeeTracking(to);
            _updateVotingPower(to, balanceOf(to));
        }
    }

    /**
     * @dev Admin functions
     */
    function setPool(address _pool) external onlyRole(ADMIN_ROLE) validAddress(_pool) {
        address oldPool = pool;
        pool = _pool;
        
        // Update roles
        if (oldPool != address(0)) {
            _revokeRole(MINTER_ROLE, oldPool);
            _revokeRole(BURNER_ROLE, oldPool);
        }
        
        _grantRole(MINTER_ROLE, _pool);
        _grantRole(BURNER_ROLE, _pool);
    }

    function setTransferSettings(
        bool _transfersEnabled,
        bool _requireAllowlist
    ) external onlyRole(ADMIN_ROLE) {
        transfersEnabled = _transfersEnabled;
        requireAllowlist = _requireAllowlist;
        
        emit TransferSettingsUpdated(_transfersEnabled, _requireAllowlist);
    }

    function updateTransferAllowlist(
        address[] calldata addresses,
        bool[] calldata allowed
    ) external onlyRole(ADMIN_ROLE) {
        require(addresses.length == allowed.length, "Array length mismatch");
        
        for (uint256 i = 0; i < addresses.length; i++) {
            transferAllowlist[addresses[i]] = allowed[i];
        }
    }

    function updateTransferBlocklist(
        address[] calldata addresses,
        bool[] calldata blocked
    ) external onlyRole(ADMIN_ROLE) {
        require(addresses.length == blocked.length, "Array length mismatch");
        
        for (uint256 i = 0; i < addresses.length; i++) {
            transferBlocklist[addresses[i]] = blocked[i];
        }
    }

    function setStakingRewardRate(uint256 _rewardRate) external onlyRole(ADMIN_ROLE) {
        stakingRewardRate = _rewardRate;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // View functions
    function getProviderInfo(address provider) external view returns (ProviderInfo memory) {
        return providerInfo[provider];
    }

    function getUnclaimedFees(address provider) external view returns (uint256) {
        uint256 balance = balanceOf(provider);
        if (balance == 0) return unclaimedFees[provider];
        
        uint256 lastUpdate = lastFeeUpdateTime[provider];
        uint256 feesSinceLastUpdate = cumulativeFeePerToken.sub(lastUpdate);
        uint256 newFees = balance.mul(feesSinceLastUpdate).div(1e18);
        
        return unclaimedFees[provider].add(newFees);
    }

    function getStakingRewards(address user) external view returns (uint256) {
        if (stakingRewardRate == 0 || stakedBalance[user] == 0) {
            return stakingRewards[user];
        }
        
        uint256 timeElapsed = block.timestamp.sub(lastStakeTime[user]);
        uint256 newRewards = stakedBalance[user].mul(stakingRewardRate).mul(timeElapsed).div(1e18);
        
        return stakingRewards[user].add(newRewards);
    }

    function getLiquidityProviders() external view returns (address[] memory) {
        return liquidityProviders;
    }

    function getTokenStatistics() external view returns (
        uint256 totalSupplyValue,
        uint256 totalFeesDistributedValue,
        uint256 totalLiquidityProvidedValue,
        uint256 totalProvidersValue,
        uint256 activeProvidersValue,
        uint256 totalStakedValue,
        uint256 totalVotingPowerValue
    ) {
        return (
            totalSupply(),
            totalFeesDistributed,
            totalLiquidityProvided,
            totalProviders,
            activeProviders,
            totalStaked,
            totalVotingPower
        );
    }

    function getProposalVotes(bytes32 proposalId) external view returns (uint256) {
        return proposalVotes[proposalId];
    }
}