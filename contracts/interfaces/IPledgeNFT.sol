// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title IPledgeNFT
 * @dev Interface for the PledgeNFT contract used within the PledgeFactory system.
 * @notice This interface defines all functions for managing NFTs that represent pledged real-world assets
 */
interface IPledgeNFT is IERC721, IAccessControl {
    
    // Events
    
    /**
     * @dev Emitted when an asset is pledged and NFT is minted
     */
    event AssetPledged(
        uint256 indexed tokenId,
        uint256 indexed pledgeId,
        address indexed owner,
        string assetType,
        uint256 appraisedValue
    );
    
    /**
     * @dev Emitted when the document associated with a token is updated
     */
    event DocumentUpdated(
        uint256 indexed tokenId,
        bytes32 oldHash,
        bytes32 newHash,
        address updatedBy
    );

    /**
     * @dev Emitted when an asset is verified
     */
    event AssetVerified(
        uint256 indexed tokenId,
        address indexed verifier,
        uint256 timestamp
    );

    /**
     * @dev Emitted when escrow contract is updated
     */
    event EscrowContractUpdated(
        address indexed oldEscrow,
        address indexed newEscrow
    );

    // Core Functions

    /**
     * @dev Initializes the NFT contract (for use with proxies/upgrades)
     * @param name Name of the NFT collection
     * @param symbol Symbol of the NFT collection
     * @param escrowContract Address of the associated escrow contract
     */
    function initialize(
        string memory name,
        string memory symbol,
        address escrowContract
    ) external;

    /**
     * @dev Mints a pledge NFT to the specified address with asset metadata
     * @param to Address to mint the NFT to
     * @param pledgeId ID of the associated pledge
     * @param assetType Type of asset being pledged
     * @param appraisedValue USD value of the asset
     * @param metadataURI URI for the NFT metadata
     * @param documentHash Hash of the asset documentation
     * @return tokenId The ID of the minted NFT
     */
    function mintPledgeNFT(
        address to,
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        string memory metadataURI,
        bytes32 documentHash
    ) external returns (uint256);

    /**
     * @dev Updates the document hash stored for a given token ID
     * @param tokenId ID of the NFT
     * @param newDocumentHash New document hash
     */
    function updateDocumentHash(uint256 tokenId, bytes32 newDocumentHash) external;

    /**
     * @dev Updates the appraised value stored for a given token ID
     * @param tokenId ID of the NFT
     * @param newAppraisedValue New appraised value
     */
    function updateAppraisedValue(uint256 tokenId, uint256 newAppraisedValue) external;

    /**
     * @dev Updates the metadata URI for a given token ID
     * @param tokenId ID of the NFT
     * @param newURI New metadata URI
     */
    function updateTokenURI(uint256 tokenId, string memory newURI) external;

    /**
     * @dev Verifies an asset NFT
     * @param tokenId ID of the NFT to verify
     */
    function verifyAsset(uint256 tokenId) external;

    /**
     * @dev Transfers token to the specified escrow contract
     * @param tokenId ID of the NFT to transfer
     * @param escrowContract Address of the escrow contract
     */
    function transferToEscrow(uint256 tokenId, address escrowContract) external;

    // View Functions

    /**
     * @dev Returns basic metadata info for a token ID
     * @param tokenId ID of the NFT
     * @return pledgeId Associated pledge ID
     * @return assetType Type of asset
     * @return appraisedValue Appraised value
     * @return documentHash Document hash
     * @return owner Current owner address
     */
    function getAssetInfo(uint256 tokenId) external view returns (
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        bytes32 documentHash,
        address owner
    );

    /**
     * @dev Returns extended metadata info for a token ID
     * @param tokenId ID of the NFT
     * @return pledgeId Associated pledge ID
     * @return assetType Type of asset
     * @return appraisedValue Appraised value
     * @return documentHash Document hash
     * @return owner Current owner
     * @return originalOwner Original owner
     * @return creationTime Creation timestamp
     * @return verified Whether asset is verified
     * @return verifier Address that verified the asset
     */
    function getExtendedAssetInfo(uint256 tokenId) external view returns (
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        bytes32 documentHash,
        address owner,
        address originalOwner,
        uint256 creationTime,
        bool verified,
        address verifier
    );

    /**
     * @dev Returns all token IDs owned by a specific address
     * @param owner Address to query
     * @return tokenIds Array of token IDs owned by the address
     */
    function getTokensByOwner(address owner) external view returns (uint256[] memory);

    /**
     * @dev Returns all token IDs of a specific asset type
     * @param assetType Type of asset to filter by
     * @return tokenIds Array of token IDs of the specified asset type
     */
    function getTokensByAssetType(string memory assetType) external view returns (uint256[] memory);

    /**
     * @dev Returns contract information
     * @return contractName Name of the NFT collection
     * @return contractSymbol Symbol of the NFT collection
     * @return escrowAddress Address of the associated escrow contract
     * @return totalMinted Total number of NFTs minted
     * @return isPaused Whether the contract is paused
     */
    function getContractInfo() external view returns (
        string memory contractName,
        string memory contractSymbol,
        address escrowAddress,
        uint256 totalMinted,
        bool isPaused
    );

    /**
     * @dev Returns total minted supply
     * @return Total number of NFTs minted
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Check if contract is initialized
     * @return Whether the contract is initialized
     */
    function isInitialized() external view returns (bool);

    // Admin Functions

    /**
     * @dev Pauses the contract
     */
    function pause() external;

    /**
     * @dev Unpauses the contract
     */
    function unpause() external;

    /**
     * @dev Sets the escrow contract address
     * @param escrowContract New escrow contract address
     */
    function setEscrowContract(address escrowContract) external;

    // State Variable Access (for external contracts)

    /**
     * @dev Get document hash for a token
     * @param tokenId ID of the NFT
     * @return Document hash
     */
    function documentHashes(uint256 tokenId) external view returns (bytes32);

    /**
     * @dev Get appraised value for a token
     * @param tokenId ID of the NFT
     * @return Appraised value
     */
    function appraisedValues(uint256 tokenId) external view returns (uint256);

    /**
     * @dev Get asset type for a token
     * @param tokenId ID of the NFT
     * @return Asset type string
     */
    function assetTypes(uint256 tokenId) external view returns (string memory);

    /**
     * @dev Get pledge ID for a token
     * @param tokenId ID of the NFT
     * @return Associated pledge ID
     */
    function pledgeIds(uint256 tokenId) external view returns (uint256);

    /**
     * @dev Get creation timestamp for a token
     * @param tokenId ID of the NFT
     * @return Creation timestamp
     */
    function creationTimestamps(uint256 tokenId) external view returns (uint256);

    /**
     * @dev Get original owner for a token
     * @param tokenId ID of the NFT
     * @return Original owner address
     */
    function originalOwners(uint256 tokenId) external view returns (address);

    /**
     * @dev Get asset description for a token
     * @param tokenId ID of the NFT
     * @return Asset description
     */
    function assetDescriptions(uint256 tokenId) external view returns (string memory);

    /**
     * @dev Check if asset is verified
     * @param tokenId ID of the NFT
     * @return Whether the asset is verified
     */
    function isVerified(uint256 tokenId) external view returns (bool);

    /**
     * @dev Get verifier address for a token
     * @param tokenId ID of the NFT
     * @return Address that verified the asset
     */
    function verifiedBy(uint256 tokenId) external view returns (address);

    /**
     * @dev Get associated escrow contract address
     * @return Address of the escrow contract
     */
    function escrowContract() external view returns (address);
}