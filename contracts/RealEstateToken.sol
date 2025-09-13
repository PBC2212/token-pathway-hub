// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title RealEstateToken (RET)
 * @dev ERC20 token for tokenized real estate assets
 */
contract RealEstateToken is BaseAssetToken {
    // Real estate specific metadata
    struct RealEstateData {
        string propertyType; // residential, commercial, industrial
        uint256 squareFootage;
        uint256 yearBuilt;
        string zoning;
        bool hasRentalIncome;
        uint256 monthlyRent;
        string legalDescription;
    }
    
    mapping(uint256 => RealEstateData) public realEstateData;
    
    event RealEstateTokenized(
        uint256 indexed assetId,
        string propertyType,
        uint256 squareFootage,
        uint256 yearBuilt
    );
    
    constructor(address admin) 
        BaseAssetToken(
            "Real Estate Token",
            "RET",
            admin,
            1000000 * 10**18 // 1M max supply
        ) 
    {}
    
    /**
     * @dev Mint real estate tokens with property-specific data
     */
    function mintRealEstate(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        string memory propertyType,
        uint256 squareFootage,
        uint256 yearBuilt,
        string memory zoning,
        bool hasRentalIncome,
        uint256 monthlyRent,
        string memory legalDescription
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(squareFootage > 0, "Square footage must be greater than zero");
        require(yearBuilt > 1800 && yearBuilt <= block.timestamp / 365 days + 1970, "Invalid year built");
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "real_estate",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        realEstateData[assetId] = RealEstateData({
            propertyType: propertyType,
            squareFootage: squareFootage,
            yearBuilt: yearBuilt,
            zoning: zoning,
            hasRentalIncome: hasRentalIncome,
            monthlyRent: monthlyRent,
            legalDescription: legalDescription
        });
        
        emit RealEstateTokenized(assetId, propertyType, squareFootage, yearBuilt);
        
        return assetId;
    }
    
    /**
     * @dev Get real estate specific data
     */
    function getRealEstateData(uint256 assetId) external view returns (RealEstateData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return realEstateData[assetId];
    }
    
    /**
     * @dev Update rental income data
     */
    function updateRentalIncome(
        uint256 assetId,
        bool hasRentalIncome,
        uint256 monthlyRent
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        realEstateData[assetId].hasRentalIncome = hasRentalIncome;
        realEstateData[assetId].monthlyRent = monthlyRent;
    }
}