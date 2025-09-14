// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title AssetTokenFactory
 * @dev Minimal factory contract for deploying asset tokens via CREATE2
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
     * @dev Deploy a contract using CREATE2 with provided bytecode
     */
    function deployContract(
        bytes memory bytecode,
        bytes32 salt,
        string memory assetType,
        string memory name,
        string memory symbol
    ) external onlyRole(DEPLOYER_ROLE) nonReentrant returns (address) {
        address contractAddress;
        
        assembly {
            contractAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        require(contractAddress != address(0), "Deployment failed");
        
        _registerContract(contractAddress, assetType, name, symbol, msg.sender);
        
        return contractAddress;
    }
    
    /**
     * @dev Register a pre-deployed contract
     */
    function registerContract(
        address contractAddress,
        string memory assetType,
        string memory name,
        string memory symbol
    ) external onlyRole(DEPLOYER_ROLE) {
        require(contractAddress != address(0), "Invalid contract address");
        require(contractAddress.code.length > 0, "Not a contract");
        
        _registerContract(contractAddress, assetType, name, symbol, msg.sender);
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
    
    /**
     * @dev Predict contract address for CREATE2 deployment
     */
    function predictAddress(bytes32 salt, bytes32 bytecodeHash) 
        external 
        view 
        returns (address) 
    {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            bytecodeHash
        )))));
    }
}