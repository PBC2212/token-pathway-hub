// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title IPledgeNFT
 * @dev Interface for the PledgeNFT contract used within the PledgeFactory system.
 */
interface IPledgeNFT is IERC721, IAccessControl {
    
    // Emitted when an asset is pledged
    event AssetPledged(
        uint256 indexed tokenId,
        uint256 indexed pledgeId,
        address indexed owner,
        string assetType,
        uint256 appraisedValue
    );
    
    // Emitted when the document associated with a token is updated
    event DocumentUpdated(
        uint256 indexed tokenId,
        bytes32 oldHash,
        bytes32 newHash
    );

    /**
     * @dev Initializes the NFT contract (for use with proxies/upgrades)
     */
    function initialize(
        string memory name,
        string memory symbol,
        address escrowContract
    ) external;

    /**
     * @dev Mints a pledge NFT to the specified address with asset metadata
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
     */
    function updateDocumentHash(uint256 tokenId, bytes32 newDocumentHash) external;

    /**
     * @dev Updates the appraised value stored for a given token ID
     */
    function updateAppraisedValue(uint256 tokenId, uint256 newAppraisedValue) external;

    /**
     * @dev Transfers token to the specified escrow contract
     */
    function transferToEscrow(uint256 tokenId, address escrowContract) external;

    /**
     * @dev Returns metadata info for a token ID
     */
    function getAssetInfo(uint256 tokenId) external view returns (
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        bytes32 documentHash,
        address originalOwner
    );

    /**
     * @dev Pauses the contract
     */
    function pause() external;

    /**
     * @dev Unpauses the contract
     */
    function unpause() external;

    /**
     * @dev Returns total minted supply
     */
    function totalSupply() external view returns (uint256);
}
