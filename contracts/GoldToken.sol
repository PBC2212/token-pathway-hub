// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseAssetToken.sol";

/**
 * @title GoldToken (GLD)
 * @dev ERC20 token for tokenized gold assets
 */
contract GoldToken is BaseAssetToken {
    // Gold specific metadata
    struct GoldData {
        uint256 purity; // in basis points (9999 = 99.99%)
        uint256 weight; // in grams
        string form; // bar, coin, jewelry, etc.
        string mint; // mint or manufacturer
        string serialNumber;
        string certificationHash; // IPFS hash of certification
        bool isAllocated; // allocated vs unallocated gold
        string storageLocation;
    }
    
    mapping(uint256 => GoldData) public goldData;
    
    event GoldTokenized(
        uint256 indexed assetId,
        uint256 purity,
        uint256 weight,
        string form,
        string mint
    );
    
    constructor(address admin) 
        BaseAssetToken(
            "Gold Token",
            "GLD",
            admin,
            100000 * 10**18 // 100K max supply
        ) 
    {}
    
    /**
     * @dev Mint gold tokens with precious metal specific data
     */
    function mintGold(
        address to,
        uint256 amount,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash,
        uint256 purity,
        uint256 weight,
        string memory form,
        string memory mint,
        string memory serialNumber,
        string memory certificationHash,
        bool isAllocated,
        string memory storageLocation
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        
        require(purity >= 5000 && purity <= 9999, "Purity must be between 50% and 99.99%");
        require(weight > 0, "Weight must be greater than zero");
        require(bytes(form).length > 0, "Form cannot be empty");
        
        uint256 assetId = mintAsset(
            to,
            amount,
            "gold",
            description,
            location,
            appraisedValue,
            appraisalCompany,
            documentHash
        );
        
        goldData[assetId] = GoldData({
            purity: purity,
            weight: weight,
            form: form,
            mint: mint,
            serialNumber: serialNumber,
            certificationHash: certificationHash,
            isAllocated: isAllocated,
            storageLocation: storageLocation
        });
        
        emit GoldTokenized(assetId, purity, weight, form, mint);
        
        return assetId;
    }
    
    /**
     * @dev Get gold specific data
     */
    function getGoldData(uint256 assetId) external view returns (GoldData memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return goldData[assetId];
    }
    
    /**
     * @dev Calculate gold value based on current market price
     */
    function calculateGoldValue(uint256 assetId, uint256 goldPricePerOunce) external view returns (uint256) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        GoldData memory gold = goldData[assetId];
        
        // Convert grams to ounces (31.1035 grams per troy ounce)
        uint256 ounces = (gold.weight * 1000) / 31103; // multiply by 1000 for precision
        
        // Calculate value based on purity
        uint256 pureOunces = (ounces * gold.purity) / 10000;
        
        return (pureOunces * goldPricePerOunce) / 1000; // divide back for precision
    }
}