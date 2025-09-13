// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title VehicleToken (VET)
 * @dev ERC20 token for tokenized vehicle assets
 */
contract VehicleToken is BaseAssetToken {
    // Vehicle specific metadata
    struct VehicleData {
        string make;
        string model;
        uint256 year;
        string vin; // Vehicle Identification Number
        uint256 mileage;
        string condition; // excellent, good, fair, poor
        string fuelType; // gasoline, diesel, electric, hybrid
        string transmission; // manual, automatic
        string color;
        bool hasAccidents;
        uint256 numberOfOwners;
        string titleStatus; // clean, salvage, flood, lemon
    }
    
    mapping(uint256 => VehicleData) public vehicleData;
    mapping(string => bool) public vinExists; // Prevent duplicate VINs
    
    event VehicleTokenized(
        uint256 indexed assetId,
        string make,
        string model,
        uint256 year,
        string vin
    );
    
    constructor(address admin) 
        BaseAssetToken(
            "Vehicle Token",
            "VET",
            admin,
            500000 * 10**18 // 500K max supply
        ) 
    {}
    
    /**
     * @dev Mint vehicle tokens with automotive specific data
     */
    function mintVehicle(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        string memory make,
        string memory model,
        uint256 year,
        string memory vin,
        uint256 mileage,
        string memory condition,
        string memory fuelType,
        string memory transmission,
        string memory color,
        bool hasAccidents,
        uint256 numberOfOwners,
        string memory titleStatus
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(bytes(make).length > 0, "Make cannot be empty");
        require(bytes(model).length > 0, "Model cannot be empty");
        require(year >= 1885 && year <= block.timestamp / 365 days + 1970 + 1, "Invalid year");
        require(bytes(vin).length == 17, "VIN must be 17 characters");
        require(!vinExists[vin], "VIN already exists");
        require(numberOfOwners > 0, "Number of owners must be greater than zero");
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "vehicle",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        vehicleData[assetId] = VehicleData({
            make: make,
            model: model,
            year: year,
            vin: vin,
            mileage: mileage,
            condition: condition,
            fuelType: fuelType,
            transmission: transmission,
            color: color,
            hasAccidents: hasAccidents,
            numberOfOwners: numberOfOwners,
            titleStatus: titleStatus
        });
        
        vinExists[vin] = true;
        
        emit VehicleTokenized(assetId, make, model, year, vin);
        
        return assetId;
    }
    
    /**
     * @dev Get vehicle specific data
     */
    function getVehicleData(uint256 assetId) external view returns (VehicleData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return vehicleData[assetId];
    }
    
    /**
     * @dev Update vehicle mileage (compliance role only)
     */
    function updateMileage(uint256 assetId, uint256 newMileage) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        require(newMileage >= vehicleData[assetId].mileage, "Mileage cannot decrease");
        
        vehicleData[assetId].mileage = newMileage;
    }
    
    /**
     * @dev Update vehicle condition (compliance role only)
     */
    function updateCondition(uint256 assetId, string memory newCondition) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        vehicleData[assetId].condition = newCondition;
    }
}