// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title EquipmentToken (EQT)
 * @dev ERC20 token for tokenized equipment and machinery
 */
contract EquipmentToken is BaseAssetToken {
    // Equipment specific metadata
    struct EquipmentData {
        string manufacturer;
        string model;
        string serialNumber;
        uint256 yearManufactured;
        string equipmentType; // construction, manufacturing, agricultural, etc.
        string condition; // new, excellent, good, fair, poor
        uint256 operatingHours;
        string maintenanceHistory;
        bool isOperational;
        string specifications; // technical specifications
        uint256 warrantyExpiry;
        string certifications; // safety certifications, compliance
    }
    
    mapping(uint256 => EquipmentData) public equipmentData;
    mapping(string => bool) public serialNumberExists; // Prevent duplicate serial numbers
    
    event EquipmentTokenized(
        uint256 indexed assetId,
        string manufacturer,
        string model,
        uint256 yearManufactured,
        string equipmentType
    );
    
    constructor(address admin) 
        BaseAssetToken(
            "Equipment Token",
            "EQT",
            admin,
            750000 * 10**18 // 750K max supply
        ) 
    {}
    
    /**
     * @dev Mint equipment tokens with machinery specific data
     */
    function mintEquipment(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        string memory manufacturer,
        string memory model,
        string memory serialNumber,
        uint256 yearManufactured,
        string memory equipmentType,
        string memory condition,
        uint256 operatingHours,
        string memory maintenanceHistory,
        bool isOperational,
        string memory specifications,
        uint256 warrantyExpiry,
        string memory certifications
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(bytes(manufacturer).length > 0, "Manufacturer cannot be empty");
        require(bytes(model).length > 0, "Model cannot be empty");
        require(bytes(serialNumber).length > 0, "Serial number cannot be empty");
        require(!serialNumberExists[serialNumber], "Serial number already exists");
        require(yearManufactured >= 1800 && yearManufactured <= block.timestamp / 365 days + 1970, "Invalid year manufactured");
        require(bytes(equipmentType).length > 0, "Equipment type cannot be empty");
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "equipment",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        equipmentData[assetId] = EquipmentData({
            manufacturer: manufacturer,
            model: model,
            serialNumber: serialNumber,
            yearManufactured: yearManufactured,
            equipmentType: equipmentType,
            condition: condition,
            operatingHours: operatingHours,
            maintenanceHistory: maintenanceHistory,
            isOperational: isOperational,
            specifications: specifications,
            warrantyExpiry: warrantyExpiry,
            certifications: certifications
        });
        
        serialNumberExists[serialNumber] = true;
        
        emit EquipmentTokenized(assetId, manufacturer, model, yearManufactured, equipmentType);
        
        return assetId;
    }
    
    /**
     * @dev Get equipment specific data
     */
    function getEquipmentData(uint256 assetId) external view returns (EquipmentData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return equipmentData[assetId];
    }
    
    /**
     * @dev Update operating hours (compliance role only)
     */
    function updateOperatingHours(uint256 assetId, uint256 newHours) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        require(newHours >= equipmentData[assetId].operatingHours, "Operating hours cannot decrease");
        
        equipmentData[assetId].operatingHours = newHours;
    }
    
    /**
     * @dev Update operational status (compliance role only)
     */
    function updateOperationalStatus(uint256 assetId, bool isOperational) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        equipmentData[assetId].isOperational = isOperational;
    }
    
    /**
     * @dev Update maintenance history (compliance role only)
     */
    function addMaintenanceRecord(uint256 assetId, string memory maintenanceRecord) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        string memory currentHistory = equipmentData[assetId].maintenanceHistory;
        if (bytes(currentHistory).length > 0) {
            equipmentData[assetId].maintenanceHistory = string(abi.encodePacked(currentHistory, "; ", maintenanceRecord));
        } else {
            equipmentData[assetId].maintenanceHistory = maintenanceRecord;
        }
    }
    
    /**
     * @dev Update condition (compliance role only)
     */
    function updateCondition(uint256 assetId, string memory newCondition) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        equipmentData[assetId].condition = newCondition;
    }
}