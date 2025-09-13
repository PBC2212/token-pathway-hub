// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title ArtToken (ART)
 * @dev ERC20 token for tokenized art and collectibles
 */
contract ArtToken is BaseAssetToken {
    // Art specific metadata
    struct ArtData {
        string artist;
        string title;
        uint256 yearCreated;
        string medium; // oil, acrylic, sculpture, digital, etc.
        string dimensions; // height x width x depth
        string style; // contemporary, classical, abstract, etc.
        string provenance; // ownership history
        bool isAuthenticated;
        string certificationBody;
        string exhibitions; // exhibition history
        bool isLimitedEdition;
        uint256 editionNumber;
        uint256 totalEditions;
    }
    
    mapping(uint256 => ArtData) public artData;
    
    event ArtTokenized(
        uint256 indexed assetId,
        string artist,
        string title,
        uint256 yearCreated,
        string medium
    );
    
    constructor(address admin) 
        BaseAssetToken(
            "Art Token",
            "ART",
            admin,
            250000 * 10**18 // 250K max supply
        ) 
    {}
    
    /**
     * @dev Mint art tokens with artwork specific data
     */
    function mintArt(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        string memory artist,
        string memory title,
        uint256 yearCreated,
        string memory medium,
        string memory dimensions,
        string memory style,
        string memory provenance,
        bool isAuthenticated,
        string memory certificationBody,
        string memory exhibitions,
        bool isLimitedEdition,
        uint256 editionNumber,
        uint256 totalEditions
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(bytes(artist).length > 0, "Artist cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(yearCreated <= block.timestamp / 365 days + 1970, "Year created cannot be in the future");
        
        if (isLimitedEdition) {
            require(editionNumber > 0 && editionNumber <= totalEditions, "Invalid edition number");
            require(totalEditions > 0, "Total editions must be greater than zero");
        }
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "art",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        artData[assetId] = ArtData({
            artist: artist,
            title: title,
            yearCreated: yearCreated,
            medium: medium,
            dimensions: dimensions,
            style: style,
            provenance: provenance,
            isAuthenticated: isAuthenticated,
            certificationBody: certificationBody,
            exhibitions: exhibitions,
            isLimitedEdition: isLimitedEdition,
            editionNumber: editionNumber,
            totalEditions: totalEditions
        });
        
        emit ArtTokenized(assetId, artist, title, yearCreated, medium);
        
        return assetId;
    }
    
    /**
     * @dev Get art specific data
     */
    function getArtData(uint256 assetId) external view returns (ArtData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return artData[assetId];
    }
    
    /**
     * @dev Authenticate artwork (compliance role only)
     */
    function authenticateArtwork(
        uint256 assetId,
        string memory certificationBody
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        artData[assetId].isAuthenticated = true;
        artData[assetId].certificationBody = certificationBody;
    }
    
    /**
     * @dev Update provenance (compliance role only)
     */
    function updateProvenance(
        uint256 assetId,
        string memory newProvenance
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        artData[assetId].provenance = newProvenance;
    }
    
    /**
     * @dev Add exhibition to history (compliance role only)
     */
    function addExhibition(
        uint256 assetId,
        string memory exhibitionInfo
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        string memory currentExhibitions = artData[assetId].exhibitions;
        if (bytes(currentExhibitions).length > 0) {
            artData[assetId].exhibitions = string(abi.encodePacked(currentExhibitions, "; ", exhibitionInfo));
        } else {
            artData[assetId].exhibitions = exhibitionInfo;
        }
    }
}