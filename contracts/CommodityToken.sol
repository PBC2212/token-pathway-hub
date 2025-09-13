// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title CommodityToken (COM)
 * @dev ERC20 token for tokenized commodities and raw materials
 */
contract CommodityToken is BaseAssetToken {
    // Commodity specific metadata
    struct CommodityData {
        string commodityType; // crude_oil, natural_gas, wheat, corn, coffee, etc.
        string grade; // quality grade or classification
        uint256 quantity; // amount in standard units
        string unit; // barrel, bushel, ton, etc.
        string origin; // country or region of origin
        uint256 harvestDate; // for agricultural products
        uint256 expiryDate; // for perishable commodities
        string storageLocation;
        string storageConditions; // temperature, humidity requirements
        bool isOrganic; // for agricultural products
        string certifications; // organic, fair trade, etc.
        string qualityReports; // lab reports, inspection certificates
    }
    
    mapping(uint256 => CommodityData) public commodityData;
    
    // Commodity price feeds (for reference)
    mapping(string => uint256) public lastKnownPrices; // commodity type to price
    mapping(string => uint256) public priceUpdatedAt; // commodity type to timestamp
    
    event CommodityTokenized(
        uint256 indexed assetId,
        string commodityType,
        uint256 quantity,
        string unit,
        string origin
    );
    
    event PriceUpdated(string commodityType, uint256 newPrice, uint256 timestamp);
    
    constructor(address admin) 
        BaseAssetToken(
            "Commodity Token",
            "COM",
            admin,
            2000000 * 10**18 // 2M max supply
        ) 
    {}
    
    /**
     * @dev Mint commodity tokens with commodity specific data
     */
    function mintCommodity(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        string memory commodityType,
        string memory grade,
        uint256 quantity,
        string memory unit,
        string memory origin,
        uint256 harvestDate,
        uint256 expiryDate,
        string memory storageLocation,
        string memory storageConditions,
        bool isOrganic,
        string memory certifications,
        string memory qualityReports
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(bytes(commodityType).length > 0, "Commodity type cannot be empty");
        require(quantity > 0, "Quantity must be greater than zero");
        require(bytes(unit).length > 0, "Unit cannot be empty");
        require(bytes(origin).length > 0, "Origin cannot be empty");
        
        if (expiryDate > 0) {
            require(expiryDate > block.timestamp, "Expiry date must be in the future");
        }
        
        if (harvestDate > 0) {
            require(harvestDate <= block.timestamp, "Harvest date cannot be in the future");
        }
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "commodity",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        commodityData[assetId] = CommodityData({
            commodityType: commodityType,
            grade: grade,
            quantity: quantity,
            unit: unit,
            origin: origin,
            harvestDate: harvestDate,
            expiryDate: expiryDate,
            storageLocation: storageLocation,
            storageConditions: storageConditions,
            isOrganic: isOrganic,
            certifications: certifications,
            qualityReports: qualityReports
        });
        
        emit CommodityTokenized(assetId, commodityType, quantity, unit, origin);
        
        return assetId;
    }
    
    /**
     * @dev Get commodity specific data
     */
    function getCommodityData(uint256 assetId) external view returns (CommodityData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return commodityData[assetId];
    }
    
    /**
     * @dev Update commodity price (compliance role only)
     */
    function updateCommodityPrice(string memory commodityType, uint256 newPrice) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(bytes(commodityType).length > 0, "Commodity type cannot be empty");
        require(newPrice > 0, "Price must be greater than zero");
        
        lastKnownPrices[commodityType] = newPrice;
        priceUpdatedAt[commodityType] = block.timestamp;
        
        emit PriceUpdated(commodityType, newPrice, block.timestamp);
    }
    
    /**
     * @dev Calculate current market value based on quantity and last known price
     */
    function calculateMarketValue(uint256 assetId) external view returns (uint256) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        CommodityData memory commodity = commodityData[assetId];
        uint256 pricePerUnit = lastKnownPrices[commodity.commodityType];
        
        if (pricePerUnit == 0) {
            return 0; // No price data available
        }
        
        return commodity.quantity * pricePerUnit;
    }
    
    /**
     * @dev Get price information for a commodity type
     */
    function getCommodityPrice(string memory commodityType) 
        external 
        view 
        returns (uint256 price, uint256 updatedAt) 
    {
        return (lastKnownPrices[commodityType], priceUpdatedAt[commodityType]);
    }
    
    /**
     * @dev Update storage location (compliance role only)
     */
    function updateStorageLocation(uint256 assetId, string memory newLocation) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        commodityData[assetId].storageLocation = newLocation;
    }
    
    /**
     * @dev Update quality reports (compliance role only)
     */
    function addQualityReport(uint256 assetId, string memory qualityReport) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        string memory currentReports = commodityData[assetId].qualityReports;
        if (bytes(currentReports).length > 0) {
            commodityData[assetId].qualityReports = string(abi.encodePacked(currentReports, "; ", qualityReport));
        } else {
            commodityData[assetId].qualityReports = qualityReport;
        }
    }
    
    /**
     * @dev Check if commodity is expired
     */
    function isExpired(uint256 assetId) external view returns (bool) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        uint256 expiryDate = commodityData[assetId].expiryDate;
        
        if (expiryDate == 0) {
            return false; // No expiry date set
        }
        
        return block.timestamp > expiryDate;
    }
    
    /**
     * @dev Get commodities by type
     */
    function getCommoditiesByType(string memory commodityType) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory result = new uint256[](100); // Temporary array
        uint256 count = 0;
        
        // This is a simplified implementation. In production, you might want
        // to maintain a mapping for better gas efficiency
        for (uint256 i = 1; i <= _currentAssetId; i++) {
            if (assets[i].createdAt != 0 && 
                keccak256(bytes(commodityData[i].commodityType)) == keccak256(bytes(commodityType))) {
                if (count < 100) {
                    result[count] = i;
                    count++;
                }
            }
        }
        
        // Resize array to actual count
        uint256[] memory finalResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
}