// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RealEstateToken.sol";
import "./GoldToken.sol";
import "./VehicleToken.sol";
import "./ArtToken.sol";
import "./EquipmentToken.sol";
import "./CommodityToken.sol";

/**
 * @title AssetTokenFactory
 * @dev Factory contract for deploying and managing asset-specific token contracts
 */
contract AssetTokenFactory is AccessControl, ReentrancyGuard {
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    
    // Registry of deployed contracts
    struct DeployedContract {
        address contractAddress;
        string assetType;
        string name;
        string symbol;
        uint256 deployedAt;
        address deployer;
        bool isActive;
    }
    
    mapping(string => address[]) public assetTypeContracts;
    mapping(address => DeployedContract) public deployedContracts;
    address[] public allContracts;
    
    // Events
    event ContractDeployed(
        address indexed contractAddress,
        string indexed assetType,
        string name,
        string symbol,
        address indexed deployer
    );
    
    event ContractStatusChanged(address indexed contractAddress, bool isActive);
    
    constructor(address admin) {
        require(admin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEPLOYER_ROLE, admin);
    }
    
    /**
     * @dev Deploy a new Real Estate Token contract
     */
    function deployRealEstateToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        RealEstateToken newContract = new RealEstateToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "real_estate",
            "Real Estate Token",
            "RET",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Deploy a new Gold Token contract
     */
    function deployGoldToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        GoldToken newContract = new GoldToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "gold",
            "Gold Token",
            "GLD",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Deploy a new Vehicle Token contract
     */
    function deployVehicleToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        VehicleToken newContract = new VehicleToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "vehicle",
            "Vehicle Token",
            "VET",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Deploy a new Art Token contract
     */
    function deployArtToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        ArtToken newContract = new ArtToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "art",
            "Art Token",
            "ART",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Deploy a new Equipment Token contract
     */
    function deployEquipmentToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        EquipmentToken newContract = new EquipmentToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "equipment",
            "Equipment Token",
            "EQT",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Deploy a new Commodity Token contract
     */
    function deployCommodityToken(address admin) 
        external 
        onlyRole(DEPLOYER_ROLE) 
        nonReentrant 
        returns (address) 
    {
        require(admin != address(0), "Invalid admin address");
        
        CommodityToken newContract = new CommodityToken(admin);
        address contractAddress = address(newContract);
        
        _registerContract(
            contractAddress,
            "commodity",
            "Commodity Token",
            "COM",
            msg.sender
        );
        
        return contractAddress;
    }
    
    /**
     * @dev Internal function to register deployed contracts
     */
    function _registerContract(
        address contractAddress,
        string memory assetType,
        string memory name,
        string memory symbol,
        address deployer
    ) internal {
        deployedContracts[contractAddress] = DeployedContract({
            contractAddress: contractAddress,
            assetType: assetType,
            name: name,
            symbol: symbol,
            deployedAt: block.timestamp,
            deployer: deployer,
            isActive: true
        });
        
        assetTypeContracts[assetType].push(contractAddress);
        allContracts.push(contractAddress);
        
        emit ContractDeployed(contractAddress, assetType, name, symbol, deployer);
    }
    
    /**
     * @dev Set contract active status
     */
    function setContractStatus(address contractAddress, bool isActive) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(deployedContracts[contractAddress].contractAddress != address(0), "Contract not found");
        
        deployedContracts[contractAddress].isActive = isActive;
        
        emit ContractStatusChanged(contractAddress, isActive);
    }
    
    /**
     * @dev Get contracts by asset type
     */
    function getContractsByAssetType(string memory assetType) 
        external 
        view 
        returns (address[] memory) 
    {
        return assetTypeContracts[assetType];
    }
    
    /**
     * @dev Get all deployed contracts
     */
    function getAllContracts() external view returns (address[] memory) {
        return allContracts;
    }
    
    /**
     * @dev Get active contracts by asset type
     */
    function getActiveContractsByAssetType(string memory assetType) 
        external 
        view 
        returns (address[] memory) 
    {
        address[] memory contracts = assetTypeContracts[assetType];
        uint256 activeCount = 0;
        
        // Count active contracts
        for (uint256 i = 0; i < contracts.length; i++) {
            if (deployedContracts[contracts[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active contracts
        address[] memory activeContracts = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < contracts.length; i++) {
            if (deployedContracts[contracts[i]].isActive) {
                activeContracts[index] = contracts[i];
                index++;
            }
        }
        
        return activeContracts;
    }
    
    /**
     * @dev Get contract info
     */
    function getContractInfo(address contractAddress) 
        external 
        view 
        returns (DeployedContract memory) 
    {
        require(deployedContracts[contractAddress].contractAddress != address(0), "Contract not found");
        return deployedContracts[contractAddress];
    }
    
    /**
     * @dev Get total number of deployed contracts
     */
    function getTotalContracts() external view returns (uint256) {
        return allContracts.length;
    }
    
    /**
     * @dev Get total contracts by asset type
     */
    function getTotalContractsByAssetType(string memory assetType) 
        external 
        view 
        returns (uint256) 
    {
        return assetTypeContracts[assetType].length;
    }
}