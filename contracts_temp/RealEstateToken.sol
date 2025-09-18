// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title RealEstateToken (RET)
 * @dev Enhanced ERC20 token for tokenized real estate assets with comprehensive property management
 * @notice This contract manages tokenized real estate with detailed property data, rental income tracking, and valuation management
 */
contract RealEstateToken is BaseAssetToken {
    using SafeMath for uint256;
    using Strings for uint256;

    // Real estate specific enums
    enum PropertyType { 
        Residential,    // 0
        Commercial,     // 1
        Industrial,     // 2
        Mixed,          // 3
        Land,           // 4
        Retail,         // 5
        Office,         // 6
        Warehouse,      // 7
        Apartment,      // 8
        SingleFamily    // 9
    }

    enum PropertyStatus {
        Active,         // 0
        UnderConstruction, // 1
        Renovating,     // 2
        Vacant,         // 3
        Occupied,       // 4
        ForSale,        // 5
        Demolished      // 6
    }

    enum ZoningType {
        Residential,    // 0
        Commercial,     // 1
        Industrial,     // 2
        Agricultural,   // 3
        Mixed,          // 4
        Special         // 5
    }

    // Real estate specific metadata
    struct RealEstateData {
        PropertyType propertyType;
        PropertyStatus status;
        ZoningType zoning;
        uint256 squareFootage;
        uint256 lotSize;
        uint256 yearBuilt;
        uint256 bedrooms;
        uint256 bathrooms;
        uint256 floors;
        uint256 parkingSpaces;
        string legalDescription;
        string propertyTaxId;
        string mls; // Multiple Listing Service ID
        bool hasRentalIncome;
        uint256 monthlyRent;
        uint256 annualPropertyTax;
        uint256 maintenanceCosts;
        uint256 insuranceCosts;
        string[] amenities;
        string[] utilities;
    }

    // Rental income tracking
    struct RentalInfo {
        bool isRentable;
        uint256 currentRent;
        uint256 marketRent;
        uint256 lastRentUpdate;
        uint256 totalRentCollected;
        uint256 occupancyRate; // Basis points (e.g., 9500 = 95%)
        address currentTenant;
        uint256 leaseStartDate;
        uint256 leaseEndDate;
        uint256 securityDeposit;
        string leaseTerms;
    }

    // Property valuation
    struct ValuationHistory {
        uint256 value;
        uint256 timestamp;
        string appraiser;
        string valuationMethod; // "Comparable Sales", "Income Approach", "Cost Approach"
        string documentHash;
        bool isVerified;
    }

    // Property maintenance
    struct MaintenanceRecord {
        uint256 date;
        string description;
        uint256 cost;
        string contractor;
        string category; // "Repair", "Upgrade", "Preventive", "Emergency"
        bool isCompleted;
        string documentHash;
    }

    // State variables
    mapping(uint256 => RealEstateData) public realEstateData;
    mapping(uint256 => RentalInfo) public rentalInfo;
    mapping(uint256 => ValuationHistory[]) public valuationHistory;
    mapping(uint256 => MaintenanceRecord[]) public maintenanceRecords;
    mapping(uint256 => string[]) public propertyImages;
    mapping(uint256 => mapping(string => string)) public propertyDocuments;
    
    // Property statistics
    mapping(PropertyType => uint256) public propertyTypeCount;
    mapping(PropertyStatus => uint256) public propertyStatusCount;
    mapping(ZoningType => uint256) public zoningTypeCount;
    
    // Income tracking
    uint256 public totalRentalIncome;
    uint256 public totalMaintenanceCosts;
    uint256 public totalPropertyTaxes;
    uint256 public averageOccupancyRate;
    uint256 public totalRentableProperties;
    
    // Market data
    uint256 public averagePricePerSqFt;
    uint256 public averageRentPerSqFt;
    uint256 public totalSquareFootage;
    
    // Events
    event RealEstateTokenized(
        uint256 indexed assetId,
        PropertyType indexed propertyType,
        uint256 squareFootage,
        uint256 yearBuilt,
        string location
    );
    
    event RentalIncomeUpdated(
        uint256 indexed assetId,
        uint256 oldRent,
        uint256 newRent,
        uint256 timestamp
    );
    
    event PropertyStatusChanged(
        uint256 indexed assetId,
        PropertyStatus oldStatus,
        PropertyStatus newStatus
    );
    
    event ValuationAdded(
        uint256 indexed assetId,
        uint256 newValue,
        uint256 oldValue,
        string appraiser
    );
    
    event MaintenanceRecorded(
        uint256 indexed assetId,
        uint256 cost,
        string category,
        string description
    );
    
    event TenantChanged(
        uint256 indexed assetId,
        address oldTenant,
        address newTenant,
        uint256 leaseStartDate,
        uint256 leaseEndDate
    );

    // Custom errors
    error InvalidPropertyType(uint8 propertyType);
    error InvalidSquareFootage(uint256 footage);
    error InvalidYearBuilt(uint256 year);
    error PropertyNotRentable(uint256 assetId);
    error InvalidRentAmount(uint256 rent);
    error InvalidOccupancyRate(uint256 rate);
    error MaintenanceRecordNotFound(uint256 assetId, uint256 index);
    error ValuationNotFound(uint256 assetId, uint256 index);
    error InvalidLeaseDates(uint256 startDate, uint256 endDate);
    error PropertyNotVacant(uint256 assetId);

    modifier validPropertyType(uint8 propertyType) {
        if (propertyType > 9) revert InvalidPropertyType(propertyType);
        _;
    }

    modifier validOccupancyRate(uint256 rate) {
        if (rate > 10000) revert InvalidOccupancyRate(rate);
        _;
    }

    constructor(address admin) 
        BaseAssetToken(
            "Real Estate Token",
            "RET",
            admin,
            1000000 * 10**18 // 1M max supply
        ) 
    {}
    
    /**
     * @dev Mint real estate tokens with comprehensive property data
     */
    function mintRealEstate(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        RealEstateData memory propertyData,
        RentalInfo memory rental
    ) external onlyRole(MINTER_ROLE) returns (uint256 assetId) {
        
        // Validate property data
        if (propertyData.squareFootage == 0) revert InvalidSquareFootage(propertyData.squareFootage);
        if (propertyData.yearBuilt < 1800 || propertyData.yearBuilt > block.timestamp / 365 days + 1970) {
            revert InvalidYearBuilt(propertyData.yearBuilt);
        }
        
        // Mint the base asset
        assetId = mintAsset(
            to,
            amount,
            "real_estate",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        // Store real estate specific data
        realEstateData[assetId] = propertyData;
        rentalInfo[assetId] = rental;
        
        // Add initial valuation
        valuationHistory[assetId].push(ValuationHistory({
            value: appraisedValue,
            timestamp: block.timestamp,
            appraiser: appraisalCompany,
            valuationMethod: "Initial Appraisal",
            documentHash: documentHash,
            isVerified: false
        }));
        
        // Update statistics
        _updatePropertyStatistics(assetId, propertyData, true);
        
        emit RealEstateTokenized(
            assetId, 
            propertyData.propertyType, 
            propertyData.squareFootage, 
            propertyData.yearBuilt,
            location
        );
    }
    
    /**
     * @dev Update rental income information
     */
    function updateRentalIncome(
        uint256 assetId,
        uint256 newMonthlyRent,
        uint256 newOccupancyRate
    ) external onlyRole(COMPLIANCE_ROLE) validOccupancyRate(newOccupancyRate) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        if (!rentalInfo[assetId].isRentable) revert PropertyNotRentable(assetId);
        if (newMonthlyRent == 0) revert InvalidRentAmount(newMonthlyRent);
        
        RentalInfo storage rental = rentalInfo[assetId];
        RealEstateData storage property = realEstateData[assetId];
        
        uint256 oldRent = rental.currentRent;
        rental.currentRent = newMonthlyRent;
        rental.occupancyRate = newOccupancyRate;
        rental.lastRentUpdate = block.timestamp;
        
        // Update property data
        property.hasRentalIncome = newMonthlyRent > 0;
        property.monthlyRent = newMonthlyRent;
        
        // Update global statistics
        _updateRentalStatistics();
        
        emit RentalIncomeUpdated(assetId, oldRent, newMonthlyRent, block.timestamp);
    }
    
    /**
     * @dev Change property status
     */
    function updatePropertyStatus(
        uint256 assetId,
        PropertyStatus newStatus
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        PropertyStatus oldStatus = realEstateData[assetId].status;
        realEstateData[assetId].status = newStatus;
        
        // Update status counts
        if (propertyStatusCount[oldStatus] > 0) {
            propertyStatusCount[oldStatus] = propertyStatusCount[oldStatus].sub(1);
        }
        propertyStatusCount[newStatus] = propertyStatusCount[newStatus].add(1);
        
        emit PropertyStatusChanged(assetId, oldStatus, newStatus);
    }
    
    /**
     * @dev Add new property valuation
     */
    function addValuation(
        uint256 assetId,
        uint256 newValue,
        string memory appraiser,
        string memory valuationMethod,
        string memory documentHash,
        bool isVerified
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        if (newValue == 0) revert InvalidAppraisalValue(newValue);
        
        uint256 oldValue = assets[assetId].appraisedValue;
        
        // Add to valuation history
        valuationHistory[assetId].push(ValuationHistory({
            value: newValue,
            timestamp: block.timestamp,
            appraiser: appraiser,
            valuationMethod: valuationMethod,
            documentHash: documentHash,
            isVerified: isVerified
        }));
        
        // Update current appraised value in base contract
        updateAppraisedValue(assetId, newValue, appraiser);
        
        // Update market statistics
        _updateMarketStatistics();
        
        emit ValuationAdded(assetId, newValue, oldValue, appraiser);
    }
    
    /**
     * @dev Record maintenance activity
     */
    function recordMaintenance(
        uint256 assetId,
        string memory description,
        uint256 cost,
        string memory contractor,
        string memory category,
        string memory documentHash
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        maintenanceRecords[assetId].push(MaintenanceRecord({
            date: block.timestamp,
            description: description,
            cost: cost,
            contractor: contractor,
            category: category,
            isCompleted: false,
            documentHash: documentHash
        }));
        
        // Update property maintenance costs
        realEstateData[assetId].maintenanceCosts = realEstateData[assetId].maintenanceCosts.add(cost);
        
        // Update global statistics
        totalMaintenanceCosts = totalMaintenanceCosts.add(cost);
        
        emit MaintenanceRecorded(assetId, cost, category, description);
    }
    
    /**
     * @dev Complete maintenance record
     */
    function completeMaintenance(
        uint256 assetId,
        uint256 recordIndex
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        if (recordIndex >= maintenanceRecords[assetId].length) {
            revert MaintenanceRecordNotFound(assetId, recordIndex);
        }
        
        maintenanceRecords[assetId][recordIndex].isCompleted = true;
    }
    
    /**
     * @dev Update tenant information
     */
    function updateTenant(
        uint256 assetId,
        address newTenant,
        uint256 leaseStartDate,
        uint256 leaseEndDate,
        uint256 securityDeposit,
        string memory leaseTerms
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        if (!rentalInfo[assetId].isRentable) revert PropertyNotRentable(assetId);
        if (leaseEndDate <= leaseStartDate) revert InvalidLeaseDates(leaseStartDate, leaseEndDate);
        
        RentalInfo storage rental = rentalInfo[assetId];
        address oldTenant = rental.currentTenant;
        
        rental.currentTenant = newTenant;
        rental.leaseStartDate = leaseStartDate;
        rental.leaseEndDate = leaseEndDate;
        rental.securityDeposit = securityDeposit;
        rental.leaseTerms = leaseTerms;
        
        // Update occupancy if tenant is being added or removed
        if (oldTenant == address(0) && newTenant != address(0)) {
            rental.occupancyRate = 10000; // 100% occupied
        } else if (oldTenant != address(0) && newTenant == address(0)) {
            rental.occupancyRate = 0; // 0% occupied
        }
        
        emit TenantChanged(assetId, oldTenant, newTenant, leaseStartDate, leaseEndDate);
    }
    
    /**
     * @dev Add property images
     */
    function addPropertyImages(
        uint256 assetId,
        string[] memory imageHashes
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        for (uint256 i = 0; i < imageHashes.length; i++) {
            propertyImages[assetId].push(imageHashes[i]);
        }
    }
    
    /**
     * @dev Add property documents
     */
    function addPropertyDocument(
        uint256 assetId,
        string memory documentType,
        string memory documentHash
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        propertyDocuments[assetId][documentType] = documentHash;
    }
    
    /**
     * @dev Internal function to update property statistics
     */
    function _updatePropertyStatistics(
        uint256 assetId,
        RealEstateData memory propertyData,
        bool isNewProperty
    ) internal {
        if (isNewProperty) {
            propertyTypeCount[propertyData.propertyType] = propertyTypeCount[propertyData.propertyType].add(1);
            propertyStatusCount[propertyData.status] = propertyStatusCount[propertyData.status].add(1);
            zoningTypeCount[propertyData.zoning] = zoningTypeCount[propertyData.zoning].add(1);
            
            totalSquareFootage = totalSquareFootage.add(propertyData.squareFootage);
            
            if (propertyData.hasRentalIncome) {
                totalRentableProperties = totalRentableProperties.add(1);
                totalRentalIncome = totalRentalIncome.add(propertyData.monthlyRent.mul(12));
            }
            
            totalPropertyTaxes = totalPropertyTaxes.add(propertyData.annualPropertyTax);
        }
        
        // Update averages
        _updateMarketStatistics();
    }
    
    /**
     * @dev Update rental statistics
     */
    function _updateRentalStatistics() internal {
        if (totalRentableProperties == 0) return;
        
        uint256 totalOccupancy = 0;
        uint256 totalAnnualRent = 0;
        
        for (uint256 i = 1; i < _currentAssetId; i++) {
            if (assets[i].createdAt != 0 && rentalInfo[i].isRentable) {
                totalOccupancy = totalOccupancy.add(rentalInfo[i].occupancyRate);
                totalAnnualRent = totalAnnualRent.add(rentalInfo[i].currentRent.mul(12));
            }
        }
        
        averageOccupancyRate = totalOccupancy.div(totalRentableProperties);
        totalRentalIncome = totalAnnualRent;
    }
    
    /**
     * @dev Update market statistics
     */
    function _updateMarketStatistics() internal {
        if (totalSquareFootage == 0) return;
        
        uint256 totalValue = 0;
        uint256 totalRent = 0;
        uint256 propertyCount = 0;
        
        for (uint256 i = 1; i < _currentAssetId; i++) {
            if (assets[i].createdAt != 0) {
                totalValue = totalValue.add(assets[i].appraisedValue);
                propertyCount = propertyCount.add(1);
                
                if (rentalInfo[i].isRentable && rentalInfo[i].currentRent > 0) {
                    totalRent = totalRent.add(rentalInfo[i].currentRent.mul(12));
                }
            }
        }
        
        if (propertyCount > 0) {
            averagePricePerSqFt = totalValue.div(totalSquareFootage);
            averageRentPerSqFt = totalRent.div(totalSquareFootage);
        }
    }
    
    // View functions
    
    /**
     * @dev Get real estate specific data
     */
    function getRealEstateData(uint256 assetId) external view returns (RealEstateData memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return realEstateData[assetId];
    }
    
    /**
     * @dev Get rental information
     */
    function getRentalInfo(uint256 assetId) external view returns (RentalInfo memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return rentalInfo[assetId];
    }
    
    /**
     * @dev Get valuation history
     */
    function getValuationHistory(uint256 assetId) external view returns (ValuationHistory[] memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return valuationHistory[assetId];
    }
    
    /**
     * @dev Get maintenance records
     */
    function getMaintenanceRecords(uint256 assetId) external view returns (MaintenanceRecord[] memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return maintenanceRecords[assetId];
    }
    
    /**
     * @dev Get property images
     */
    function getPropertyImages(uint256 assetId) external view returns (string[] memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return propertyImages[assetId];
    }
    
    /**
     * @dev Get property document
     */
    function getPropertyDocument(uint256 assetId, string memory documentType) external view returns (string memory) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        return propertyDocuments[assetId][documentType];
    }
    
    /**
     * @dev Get comprehensive property statistics
     */
    function getPropertyStatistics() external view returns (
        uint256[10] memory typeCount,
        uint256[7] memory statusCount,
        uint256[6] memory zoningCount,
        uint256 totalRentable,
        uint256 avgOccupancy,
        uint256 avgPriceSqFt,
        uint256 avgRentSqFt,
        uint256 totalSqFt,
        uint256 totalRentIncome,
        uint256 totalMaintCosts,
        uint256 totalPropTaxes
    ) {
        // Property type counts
        for (uint256 i = 0; i < 10; i++) {
            typeCount[i] = propertyTypeCount[PropertyType(i)];
        }
        
        // Property status counts
        for (uint256 i = 0; i < 7; i++) {
            statusCount[i] = propertyStatusCount[PropertyStatus(i)];
        }
        
        // Zoning type counts
        for (uint256 i = 0; i < 6; i++) {
            zoningCount[i] = zoningTypeCount[ZoningType(i)];
        }
        
        return (
            typeCount,
            statusCount,
            zoningCount,
            totalRentableProperties,
            averageOccupancyRate,
            averagePricePerSqFt,
            averageRentPerSqFt,
            totalSquareFootage,
            totalRentalIncome,
            totalMaintenanceCosts,
            totalPropertyTaxes
        );
    }
    
    /**
     * @dev Calculate property yield
     */
    function getPropertyYield(uint256 assetId) external view returns (uint256) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        RentalInfo memory rental = rentalInfo[assetId];
        if (!rental.isRentable || rental.currentRent == 0) return 0;
        
        uint256 annualRent = rental.currentRent.mul(12);
        uint256 propertyValue = assets[assetId].appraisedValue;
        
        if (propertyValue == 0) return 0;
        
        // Return yield in basis points (e.g., 500 = 5%)
        return annualRent.mul(10000).div(propertyValue);
    }
    
    /**
     * @dev Get net operating income for a property
     */
    function getNetOperatingIncome(uint256 assetId) external view returns (uint256) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        RealEstateData memory property = realEstateData[assetId];
        RentalInfo memory rental = rentalInfo[assetId];
        
        if (!rental.isRentable) return 0;
        
        uint256 grossIncome = rental.currentRent.mul(12).mul(rental.occupancyRate).div(10000);
        uint256 expenses = property.annualPropertyTax.add(property.maintenanceCosts).add(property.insuranceCosts);
        
        return grossIncome > expenses ? grossIncome.sub(expenses) : 0;
    }
    
    /**
     * @dev Get property cash flow analysis
     */
    function getPropertyCashFlow(uint256 assetId) external view returns (
        uint256 grossIncome,
        uint256 netIncome,
        uint256 expenses,
        uint256 cashFlow,
        uint256 yieldPercentage
    ) {
        if (assets[assetId].createdAt == 0) revert AssetNotExists(assetId);
        
        RealEstateData memory property = realEstateData[assetId];
        RentalInfo memory rental = rentalInfo[assetId];
        
        grossIncome = rental.isRentable ? rental.currentRent.mul(12).mul(rental.occupancyRate).div(10000) : 0;
        expenses = property.annualPropertyTax.add(property.maintenanceCosts).add(property.insuranceCosts);
        netIncome = grossIncome > expenses ? grossIncome.sub(expenses) : 0;
        cashFlow = netIncome; // Simplified - would include debt service in real scenario
        yieldPercentage = assets[assetId].appraisedValue > 0 ? netIncome.mul(10000).div(assets[assetId].appraisedValue) : 0;
    }
}