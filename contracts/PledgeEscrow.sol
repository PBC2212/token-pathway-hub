// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IPledgeEscrow.sol";
import "./interfaces/IAssetMetadata.sol";
import "./PledgeNFT.sol";
import "./BaseAssetToken.sol";

/**
 * @title PledgeEscrow
 * @dev Main escrow contract for managing asset pledges and token minting
 * @notice This contract manages the entire lifecycle of asset pledges from creation to redemption
 */
contract PledgeEscrow is IPledgeEscrow, AccessControl, Pausable, ReentrancyGuard, IERC721Receiver, Initializable {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // State variables
    uint256 private _pledgeIdCounter;
    PledgeNFT public pledgeNFT;
    bool private _initialized;
    
    // Mappings
    mapping(uint256 => PledgeInfo) public pledges;
    mapping(address => uint256[]) public userPledges;
    mapping(AssetType => address) public assetTokenContracts;
    mapping(uint256 => uint256) public pledgeToNFT; // pledgeId => nftTokenId
    mapping(uint256 => uint256) public nftToPledge; // nftTokenId => pledgeId
    
    // Arrays for enumeration
    uint256[] public allPledges;
    uint256[] public pendingPledges;
    
    // Configuration
    uint256 public minAppraisalValue = 1000e18; // $1,000 minimum
    uint256 public maxLTV = 7000; // 70% max loan-to-value (basis points)
    uint256 public defaultThreshold = 90 days; // Time before default
    uint256 public platformFee = 100; // 1% platform fee in basis points
    address public feeRecipient;
    
    // Events for better tracking
    event ConfigurationUpdated(
        uint256 minAppraisalValue,
        uint256 maxLTV,
        uint256 defaultThreshold,
        uint256 platformFee
    );
    
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    event AssetTokenContractUpdated(AssetType indexed assetType, address indexed tokenContract);

    modifier onlyPledgeOwner(uint256 pledgeId) {
        require(pledges[pledgeId].borrower == msg.sender, "PledgeEscrow: not pledge owner");
        _;
    }
    
    modifier validPledge(uint256 pledgeId) {
        require(pledges[pledgeId].pledgeId != 0, "PledgeEscrow: invalid pledge");
        _;
    }

    modifier onlyInitialized() {
        require(_initialized, "PledgeEscrow: not initialized");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract (for proxy pattern)
     * @param _pledgeNFT Address of the PledgeNFT contract
     */
    function initialize(address _pledgeNFT) external initializer {
        require(_pledgeNFT != address(0), "PledgeEscrow: invalid NFT address");
        
        pledgeNFT = PledgeNFT(_pledgeNFT);
        _pledgeIdCounter = 1; // Start at 1
        feeRecipient = msg.sender; // Default fee recipient
        _initialized = true;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(APPROVER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Create a new asset pledge
     * @param assetType Type of asset being pledged
     * @param appraisedValue USD value of the asset (in wei)
     * @param metadata Asset metadata including description and documents
     * @return pledgeId The ID of the created pledge
     */
    function createPledge(
        AssetType assetType,
        uint256 appraisedValue,
        AssetMetadata calldata metadata
    ) external nonReentrant whenNotPaused onlyInitialized returns (uint256 pledgeId) {
        require(appraisedValue >= minAppraisalValue, "PledgeEscrow: value too low");
        require(bytes(metadata.description).length > 0, "PledgeEscrow: invalid metadata");
        require(metadata.documentHash != bytes32(0), "PledgeEscrow: invalid document hash");

        pledgeId = _pledgeIdCounter++;
        
        // Create NFT representing the pledged asset
        uint256 nftTokenId = pledgeNFT.mintPledgeNFT(
            msg.sender,
            pledgeId,
            _assetTypeToString(assetType),
            appraisedValue,
            metadata.description,
            metadata.documentHash
        );

        // Store pledge information
        pledges[pledgeId] = PledgeInfo({
            pledgeId: pledgeId,
            borrower: msg.sender,
            assetType: assetType,
            appraisedValue: appraisedValue,
            tokenAmount: 0, // Set during approval
            nftTokenId: nftTokenId,
            status: PledgeStatus.Pending,
            createdAt: block.timestamp,
            approvedAt: 0,
            approvedBy: address(0),
            metadataURI: metadata.description,
            documentHash: metadata.documentHash
        });

        // Update mappings
        pledgeToNFT[pledgeId] = nftTokenId;
        nftToPledge[nftTokenId] = pledgeId;
        userPledges[msg.sender].push(pledgeId);
        allPledges.push(pledgeId);
        pendingPledges.push(pledgeId);

        emit PledgeCreated(pledgeId, msg.sender, assetType, appraisedValue, nftTokenId);
    }

    /**
     * @dev Approve a pledge and set token amount
     * @param pledgeId ID of the pledge to approve
     * @param tokenAmount Amount of tokens to be minted (in wei)
     */
    function approvePledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external onlyRole(APPROVER_ROLE) validPledge(pledgeId) nonReentrant onlyInitialized {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Pending, "PledgeEscrow: not pending");
        require(tokenAmount > 0, "PledgeEscrow: invalid token amount");
        
        // Check LTV ratio
        uint256 ltv = (tokenAmount * 10000) / pledge.appraisedValue;
        require(ltv <= maxLTV, "PledgeEscrow: LTV too high");

        // Update pledge status
        pledge.status = PledgeStatus.Approved;
        pledge.tokenAmount = tokenAmount;
        pledge.approvedAt = block.timestamp;
        pledge.approvedBy = msg.sender;

        // Remove from pending pledges
        _removePendingPledge(pledgeId);

        // Transfer NFT to escrow
        pledgeNFT.transferToEscrow(pledge.nftTokenId, address(this));

        emit PledgeApproved(pledgeId, msg.sender, tokenAmount);
    }

    /**
     * @dev Reject a pledge
     * @param pledgeId ID of the pledge to reject
     * @param reason Reason for rejection
     */
    function rejectPledge(
        uint256 pledgeId,
        string calldata reason
    ) external onlyRole(APPROVER_ROLE) validPledge(pledgeId) nonReentrant onlyInitialized {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Pending, "PledgeEscrow: not pending");

        pledge.status = PledgeStatus.Rejected;
        
        // Remove from pending pledges
        _removePendingPledge(pledgeId);

        emit PledgeRejected(pledgeId, msg.sender, reason);
    }

    /**
     * @dev Mint tokens for approved pledge
     * @param pledgeId ID of the approved pledge
     * @return tokenContract Address of the asset token contract
     * @return amount Amount of tokens minted
     */
    function mintTokens(
        uint256 pledgeId
    ) external onlyRole(MINTER_ROLE) validPledge(pledgeId) nonReentrant onlyInitialized returns (address tokenContract, uint256 amount) {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");

        tokenContract = assetTokenContracts[pledge.assetType];
        require(tokenContract != address(0), "PledgeEscrow: token contract not set");

        amount = pledge.tokenAmount;
        
        // Calculate platform fee
        uint256 fee = (amount * platformFee) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Mint tokens to borrower (minus fee)
        BaseAssetToken(tokenContract).mint(pledge.borrower, amountAfterFee);
        
        // Mint fee tokens to fee recipient if fee > 0
        if (fee > 0 && feeRecipient != address(0)) {
            BaseAssetToken(tokenContract).mint(feeRecipient, fee);
        }

        emit TokensMinted(pledgeId, pledge.borrower, tokenContract, amountAfterFee);
    }

    /**
     * @dev Redeem pledge by burning tokens
     * @param pledgeId ID of the pledge to redeem
     * @param tokenAmount Amount of tokens to burn
     */
    function redeemPledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external onlyPledgeOwner(pledgeId) validPledge(pledgeId) nonReentrant onlyInitialized {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");
        
        // Calculate required amount including fees
        uint256 fee = (pledge.tokenAmount * platformFee) / 10000;
        uint256 requiredAmount = pledge.tokenAmount - fee;
        require(tokenAmount >= requiredAmount, "PledgeEscrow: insufficient amount");

        address tokenContract = assetTokenContracts[pledge.assetType];
        require(tokenContract != address(0), "PledgeEscrow: token contract not set");

        // Burn tokens from user
        BaseAssetToken(tokenContract).burnFrom(msg.sender, tokenAmount);

        // Update pledge status
        pledge.status = PledgeStatus.Redeemed;

        // Transfer NFT back to owner
        pledgeNFT.transferFrom(address(this), msg.sender, pledge.nftTokenId);

        emit PledgeRedeemed(pledgeId, msg.sender, tokenAmount);
    }

    /**
     * @dev Default a pledge (admin function)
     * @param pledgeId ID of the pledge to default
     */
    function defaultPledge(
        uint256 pledgeId
    ) external onlyRole(ADMIN_ROLE) validPledge(pledgeId) nonReentrant onlyInitialized {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");
        require(
            block.timestamp >= pledge.approvedAt + defaultThreshold,
            "PledgeEscrow: not in default"
        );

        pledge.status = PledgeStatus.Defaulted;

        emit PledgeDefaulted(pledgeId, pledge.borrower, pledge.tokenAmount);
    }

    /**
     * @dev Set asset token contract addresses
     * @param assetType Type of asset
     * @param tokenContract Address of the token contract
     */
    function setAssetTokenContract(
        AssetType assetType,
        address tokenContract
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(tokenContract != address(0), "PledgeEscrow: invalid contract");
        assetTokenContracts[assetType] = tokenContract;
        emit AssetTokenContractUpdated(assetType, tokenContract);
    }

    /**
     * @dev Set asset token contract addresses (for external interface compatibility)
     * @param assetType Type of asset (uint8)
     * @param tokenContract Address of the token contract
     */
    function setAssetTokenContract(
        uint8 assetType,
        address tokenContract
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(assetType <= 5, "PledgeEscrow: invalid asset type");
        require(tokenContract != address(0), "PledgeEscrow: invalid contract");
        AssetType assetTypeEnum = AssetType(assetType);
        assetTokenContracts[assetTypeEnum] = tokenContract;
        emit AssetTokenContractUpdated(assetTypeEnum, tokenContract);
    }

    /**
     * @dev Update configuration parameters
     * @param _minAppraisalValue Minimum appraisal value required
     * @param _maxLTV Maximum loan-to-value ratio (basis points)
     * @param _defaultThreshold Time before a pledge can be defaulted
     * @param _platformFee Platform fee in basis points
     */
    function updateConfiguration(
        uint256 _minAppraisalValue,
        uint256 _maxLTV,
        uint256 _defaultThreshold,
        uint256 _platformFee
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_maxLTV <= 10000, "PledgeEscrow: invalid LTV");
        require(_platformFee <= 1000, "PledgeEscrow: fee too high"); // Max 10%
        
        minAppraisalValue = _minAppraisalValue;
        maxLTV = _maxLTV;
        defaultThreshold = _defaultThreshold;
        platformFee = _platformFee;
        
        emit ConfigurationUpdated(_minAppraisalValue, _maxLTV, _defaultThreshold, _platformFee);
    }

    /**
     * @dev Update fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_feeRecipient != address(0), "PledgeEscrow: invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(oldRecipient, _feeRecipient);
    }

    // View functions
    function getPledgeInfo(uint256 pledgeId) external view returns (PledgeInfo memory) {
        return pledges[pledgeId];
    }

    function getUserPledges(address user) external view returns (uint256[] memory) {
        return userPledges[user];
    }

    function getPendingPledges() external view returns (uint256[] memory) {
        return pendingPledges;
    }

    function getTotalPledges() external view returns (uint256) {
        return allPledges.length;
    }

    function getAssetTokenContract(AssetType assetType) external view returns (address) {
        return assetTokenContracts[assetType];
    }

    /**
     * @dev Get pledge statistics
     * @return total Total number of pledges
     * @return pending Number of pending pledges
     * @return approved Number of approved pledges
     * @return redeemed Number of redeemed pledges
     * @return defaulted Number of defaulted pledges
     */
    function getPledgeStatistics() external view returns (
        uint256 total,
        uint256 pending,
        uint256 approved,
        uint256 redeemed,
        uint256 defaulted
    ) {
        total = allPledges.length;
        pending = pendingPledges.length;
        
        for (uint256 i = 0; i < allPledges.length; i++) {
            PledgeStatus status = pledges[allPledges[i]].status;
            if (status == PledgeStatus.Approved) approved++;
            else if (status == PledgeStatus.Redeemed) redeemed++;
            else if (status == PledgeStatus.Defaulted) defaulted++;
        }
    }

    // Internal functions
    function _removePendingPledge(uint256 pledgeId) internal {
        for (uint256 i = 0; i < pendingPledges.length; i++) {
            if (pendingPledges[i] == pledgeId) {
                pendingPledges[i] = pendingPledges[pendingPledges.length - 1];
                pendingPledges.pop();
                break;
            }
        }
    }

    function _assetTypeToString(AssetType assetType) internal pure returns (string memory) {
        if (assetType == AssetType.RealEstate) return "Real Estate";
        if (assetType == AssetType.Gold) return "Gold";
        if (assetType == AssetType.Vehicle) return "Vehicle";
        if (assetType == AssetType.Art) return "Art";
        if (assetType == AssetType.Equipment) return "Equipment";
        if (assetType == AssetType.Commodity) return "Commodity";
        return "Unknown";
    }

    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal of NFTs (only for defaulted pledges)
     * @param nftTokenId ID of the NFT to withdraw
     * @param to Address to send the NFT to
     */
    function emergencyWithdrawNFT(
        uint256 nftTokenId,
        address to
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(to != address(0), "PledgeEscrow: invalid recipient");
        
        uint256 pledgeId = nftToPledge[nftTokenId];
        require(pledgeId != 0, "PledgeEscrow: NFT not found");
        require(
            pledges[pledgeId].status == PledgeStatus.Defaulted,
            "PledgeEscrow: pledge not defaulted"
        );
        
        pledgeNFT.transferFrom(address(this), to, nftTokenId);
    }

    // Required for receiving NFTs
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Check if contract is initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }
}