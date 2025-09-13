// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AssetTokenFactory.sol";
import "../RealEstateToken.sol";
import "../GoldToken.sol";
import "../VehicleToken.sol";
import "../ArtToken.sol";
import "../EquipmentToken.sol";
import "../CommodityToken.sol";

/**
 * @title DeploymentScript
 * @dev Script for deploying the complete asset tokenization system
 * @notice This contract should be used for deployment and then can be destroyed
 */
contract DeploymentScript {
    
    struct DeploymentAddresses {
        address factory;
        address realEstateToken;
        address goldToken;
        address vehicleToken;
        address artToken;
        address equipmentToken;
        address commodityToken;
    }
    
    event SystemDeployed(
        address indexed deployer,
        address factory,
        address realEstateToken,
        address goldToken,
        address vehicleToken,
        address artToken,
        address equipmentToken,
        address commodityToken
    );
    
    /**
     * @dev Deploy the complete asset tokenization system
     * @param admin The admin address for all contracts
     * @return addresses Struct containing all deployed contract addresses
     */
    function deployFullSystem(address admin) 
        external 
        returns (DeploymentAddresses memory addresses) 
    {
        require(admin != address(0), "Invalid admin address");
        
        // Deploy the factory contract
        AssetTokenFactory factory = new AssetTokenFactory(admin);
        addresses.factory = address(factory);
        
        // Deploy individual asset token contracts
        addresses.realEstateToken = factory.deployRealEstateToken(admin);
        addresses.goldToken = factory.deployGoldToken(admin);
        addresses.vehicleToken = factory.deployVehicleToken(admin);
        addresses.artToken = factory.deployArtToken(admin);
        
        // Deploy equipment token (not in factory yet, deploy manually)
        EquipmentToken equipmentToken = new EquipmentToken(admin);
        addresses.equipmentToken = address(equipmentToken);
        
        // Deploy commodity token (not in factory yet, deploy manually)  
        CommodityToken commodityToken = new CommodityToken(admin);
        addresses.commodityToken = address(commodityToken);
        
        emit SystemDeployed(
            msg.sender,
            addresses.factory,
            addresses.realEstateToken,
            addresses.goldToken,
            addresses.vehicleToken,
            addresses.artToken,
            addresses.equipmentToken,
            addresses.commodityToken
        );
        
        return addresses;
    }
    
    /**
     * @dev Deploy only the factory contract
     */
    function deployFactory(address admin) external returns (address) {
        require(admin != address(0), "Invalid admin address");
        
        AssetTokenFactory factory = new AssetTokenFactory(admin);
        return address(factory);
    }
    
    /**
     * @dev Deploy individual token contracts using factory
     */
    function deployTokensViaFactory(
        address factoryAddress,
        address admin
    ) external returns (
        address realEstateToken,
        address goldToken,
        address vehicleToken,
        address artToken
    ) {
        require(factoryAddress != address(0), "Invalid factory address");
        require(admin != address(0), "Invalid admin address");
        
        AssetTokenFactory factory = AssetTokenFactory(factoryAddress);
        
        realEstateToken = factory.deployRealEstateToken(admin);
        goldToken = factory.deployGoldToken(admin);
        vehicleToken = factory.deployVehicleToken(admin);
        artToken = factory.deployArtToken(admin);
        
        return (realEstateToken, goldToken, vehicleToken, artToken);
    }
    
    /**
     * @dev Deploy additional token contracts manually
     */
    function deployAdditionalTokens(address admin) 
        external 
        returns (address equipmentToken, address commodityToken) 
    {
        require(admin != address(0), "Invalid admin address");
        
        EquipmentToken equipment = new EquipmentToken(admin);
        CommodityToken commodity = new CommodityToken(admin);
        
        return (address(equipment), address(commodity));
    }
}