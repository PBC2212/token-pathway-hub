// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAssetMetadata
 * @dev Interface for asset metadata functionality
 */
interface IAssetMetadata {
    struct AssetMetadata {
        string assetType;
        string description;
        string location;
        uint256 appraisedValue;
        uint256 appraisalDate;
        string appraisalCompany;
        string documentHash;
        bool isVerified;
        uint256 createdAt;
    }
    
    /**
     * @dev Get asset metadata by ID
     */
    function getAssetMetadata(uint256 assetId) external view returns (AssetMetadata memory);
    
    /**
     * @dev Get all asset IDs owned by an address
     */
    function getOwnerAssets(address owner) external view returns (uint256[] memory);
}