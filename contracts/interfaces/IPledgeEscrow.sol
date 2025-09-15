// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title IPledgeEscrow
 * @dev Enhanced interface for the PledgeEscrow contract managing asset pledges and token lifecycle
 * @notice This interface defines all functions for managing the complete lifecycle of asset pledges
 */
interface IPledgeEscrow is IAccessControl {
    
    // Enums
    enum AssetType { 
        RealEstate,     // 0
        Gold,           // 1
        Vehicle,        // 2
        Art,            // 3
        Equipment,      // 4
        Commodity       // 5
    }
    
    enum PledgeStatus { 
        Pending,        // 0
        Approved,       // 1
        Rejected,       // 2
        Redeemed,       // 3
        Defaulted       // 4
    }

    // Structs
    struct PledgeInfo {
        uint256 pledgeId;
        address borrower;
        AssetType assetType;
        uint256 appraisedValue;
        uint256 tokenAmount;
        uint256 nftTokenId;
        PledgeStatus status;
        uint256 createdAt;
        uint256 approvedAt;
        address approvedBy;
        string metadataURI;
        bytes32 documentHash;
    }

    struct AssetMetadata {
        string description;
        bytes32 documentHash;
        string appraisalDate;
        string appraiserLicense;
    }

    // Events
    event PledgeCreated(
        uint256 indexed pledgeId,
        address indexed borrower,
        AssetType indexed assetType,
        uint256 appraisedValue,
        uint256 nftTokenId
    );

    event PledgeApproved(
        uint256 indexed pledgeId,
        address indexed approver,
        uint256 tokenAmount
    );

    event PledgeRejected(
        uint256 indexed pledgeId,
        address indexed rejector,
        string reason
    );

    event TokensMinted(
        uint256 indexed pledgeId,
        address indexed borrower,
        address indexed tokenContract,
        uint256 amount
    );

    event PledgeRedeemed(
        uint256 indexed pledgeId,
        address indexed borrower,
        uint256 tokensBurned
    );

    event PledgeDefaulted(
        uint256 indexed pledgeId,
        address indexed borrower,
        uint256 tokensOutstanding
    );

    event ConfigurationUpdated(
        uint256 minAppraisalValue,
        uint256 maxLTV,
        uint256 defaultThreshold,
        uint256 platformFee
    );

    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    event AssetTokenContractUpdated(
        AssetType indexed assetType,
        address indexed tokenContract
    );

    // Core functions
    
    /**
     * @dev Initialize the contract (for proxy pattern)
     * @param _pledgeNFT Address of the PledgeNFT contract
     */
    function initialize(address _pledgeNFT) external;

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
    ) external returns (uint256 pledgeId);

    /**
     * @dev Approve a pledge and set token amount
     * @param pledgeId ID of the pledge to approve
     * @param tokenAmount Amount of tokens to be minted (in wei)
     */
    function approvePledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external;

    /**
     * @dev Reject a pledge
     * @param pledgeId ID of the pledge to reject
     * @param reason Reason for rejection
     */
    function rejectPledge(
        uint256 pledgeId,
        string calldata reason
    ) external;

    /**
     * @dev Mint tokens for approved pledge
     * @param pledgeId ID of the approved pledge
     * @return tokenContract Address of the asset token contract
     * @return amount Amount of tokens minted
     */
    function mintTokens(
        uint256 pledgeId
    ) external returns (address tokenContract, uint256 amount);

    /**
     * @dev Redeem pledge by burning tokens
     * @param pledgeId ID of the pledge to redeem
     * @param tokenAmount Amount of tokens to burn
     */
    function redeemPledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external;

    /**
     * @dev Default a pledge (admin function)
     * @param pledgeId ID of the pledge to default
     */
    function defaultPledge(
        uint256 pledgeId
    ) external;

    // Configuration functions
    
    /**
     * @dev Set asset token contract addresses (enum version)
     * @param assetType Type of asset
     * @param tokenContract Address of the token contract
     */
    function setAssetTokenContract(
        AssetType assetType,
        address tokenContract
    ) external;

    /**
     * @dev Set asset token contract addresses (uint8 version for compatibility)
     * @param assetType Type of asset (uint8)
     * @param tokenContract Address of the token contract
     */
    function setAssetTokenContract(
        uint8 assetType,
        address tokenContract
    ) external;

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
    ) external;

    /**
     * @dev Update fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external;

    // View functions
    
    /**
     * @dev Get pledge information
     * @param pledgeId ID of the pledge
     * @return Pledge information struct
     */
    function getPledgeInfo(uint256 pledgeId) external view returns (PledgeInfo memory);

    /**
     * @dev Get all pledges for a user
     * @param user Address of the user
     * @return Array of pledge IDs
     */
    function getUserPledges(address user) external view returns (uint256[] memory);

    /**
     * @dev Get all pending pledges
     * @return Array of pending pledge IDs
     */
    function getPendingPledges() external view returns (uint256[] memory);

    /**
     * @dev Get total number of pledges
     * @return Total pledge count
     */
    function getTotalPledges() external view returns (uint256);

    /**
     * @dev Get asset token contract for asset type
     * @param assetType Type of asset
     * @return Address of the token contract
     */
    function getAssetTokenContract(AssetType assetType) external view returns (address);

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
    );

    /**
     * @dev Check if contract is initialized
     * @return Whether the contract is initialized
     */
    function isInitialized() external view returns (bool);

    // Configuration getters
    
    /**
     * @dev Get minimum appraisal value
     * @return Minimum appraisal value in wei
     */
    function minAppraisalValue() external view returns (uint256);

    /**
     * @dev Get maximum loan-to-value ratio
     * @return Maximum LTV in basis points
     */
    function maxLTV() external view returns (uint256);

    /**
     * @dev Get default threshold
     * @return Default threshold in seconds
     */
    function defaultThreshold() external view returns (uint256);

    /**
     * @dev Get platform fee
     * @return Platform fee in basis points
     */
    function platformFee() external view returns (uint256);

    /**
     * @dev Get fee recipient
     * @return Address of the fee recipient
     */
    function feeRecipient() external view returns (address);

    /**
     * @dev Get pledge NFT contract address
     * @return Address of the PledgeNFT contract
     */
    function pledgeNFT() external view returns (address);

    // Admin functions
    
    /**
     * @dev Pause the contract
     */
    function pause() external;

    /**
     * @dev Unpause the contract
     */
    function unpause() external;

    /**
     * @dev Emergency withdrawal of NFTs (only for defaulted pledges)
     * @param nftTokenId ID of the NFT to withdraw
     * @param to Address to send the NFT to
     */
    function emergencyWithdrawNFT(
        uint256 nftTokenId,
        address to
    ) external;

    // State variable access
    
    /**
     * @dev Get pledge information by ID (mapping access)
     * @param pledgeId ID of the pledge
     * @return Pledge information tuple components
     */
    function pledges(uint256 pledgeId) external view returns (
        uint256,      // pledgeId
        address,      // borrower
        AssetType,    // assetType
        uint256,      // appraisedValue
        uint256,      // tokenAmount
        uint256,      // nftTokenId
        PledgeStatus, // status
        uint256,      // createdAt
        uint256,      // approvedAt
        address,      // approvedBy
        string memory, // metadataURI
        bytes32       // documentHash
    );

    /**
     * @dev Get user pledges array element
     * @param user Address of the user
     * @param index Index in the user's pledge array
     * @return Pledge ID at the specified index
     */
    function userPledges(address user, uint256 index) external view returns (uint256);

    /**
     * @dev Get asset token contract mapping
     * @param assetType Asset type enum
     * @return Address of the token contract
     */
    function assetTokenContracts(AssetType assetType) external view returns (address);

    /**
     * @dev Get pledge ID to NFT token ID mapping
     * @param pledgeId ID of the pledge
     * @return NFT token ID
     */
    function pledgeToNFT(uint256 pledgeId) external view returns (uint256);

    /**
     * @dev Get NFT token ID to pledge ID mapping
     * @param nftTokenId ID of the NFT token
     * @return Pledge ID
     */
    function nftToPledge(uint256 nftTokenId) external view returns (uint256);

    /**
     * @dev Get all pledge IDs array element
     * @param index Index in the all pledges array
     * @return Pledge ID at the specified index
     */
    function allPledges(uint256 index) external view returns (uint256);

    /**
     * @dev Get pending pledge IDs array element
     * @param index Index in the pending pledges array
     * @return Pledge ID at the specified index
     */
    function pendingPledges(uint256 index) external view returns (uint256);
}