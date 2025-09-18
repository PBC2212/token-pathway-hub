// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./RealEstateToken.sol";
import "./BaseAssetToken.sol";

/**
 * @title AssetTokenFactory
 * @dev Enhanced factory contract for deploying and managing asset-specific tokens
 * @notice This factory deploys and manages all types of asset tokens with comprehensive tracking
 */
contract AssetTokenFactory is AccessControl, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // Roles
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Supported asset types
    enum AssetType {
        RealEstate,  // 0
        Gold,        // 1
        Vehicle,     // 2
        Art,         // 3
        Equipment,   // 4
        Commodity    // 5
    }

    // Contract registry
    struct DeployedContract {
        address contractAddress;
        AssetType assetType;
        string name;
        string symbol;
        uint256 maxSupply;
        uint256 deployedAt;
        address deployer;
        address admin;
        bool isActive;
        uint256 totalSupply;
        uint256 totalAssets;
        uint256 totalValue;
    }

    // State variables
    mapping(AssetType => address[]) public assetTypeContracts;
    mapping(address => DeployedContract) public deployedContracts;
    mapping(address => bool) public isValidContract;
    mapping(AssetType => uint256) public assetTypeCount;
    mapping(address => address[]) public deployerContracts;
    
    address[] public allContracts;
    uint256 public totalContractsDeployed;
    uint256 public activeContractsCount;

    // Default configurations
    struct AssetConfig {
        string name;
        string symbol;
        uint256 defaultMaxSupply;
        bool isEnabled;
    }

    mapping(AssetType => AssetConfig) public assetConfigs;

    // Events
    event ContractDeployed(
        address indexed contractAddress,
        AssetType indexed assetType,
        string name,
        string symbol,
        address indexed deployer,
        address admin,
        uint256 maxSupply
    );

    event ContractStatusChanged(
        address indexed contractAddress,
        bool isActive
    );

    event AssetConfigUpdated(
        AssetType indexed assetType,
        string name,
        string symbol,
        uint256 defaultMaxSupply,
        bool isEnabled
    );

    event ContractUpgraded(
        address indexed oldContract,
        address indexed newContract,
        AssetType assetType
    );

    event BatchOperationCompleted(
        string operation,
        uint256 contractCount,
        bool success
    );

    // Custom errors
    error InvalidAssetType(AssetType assetType);
    error AssetTypeDisabled(AssetType assetType);
    error ContractNotFound(address contractAddress);
    error InvalidMaxSupply(uint256 maxSupply);
    error ZeroAddress();
    error InvalidAdmin(address admin);
    error DeploymentFailed(string reason);
    error UnauthorizedOperation();

    modifier validAssetType(AssetType assetType) {
        if (uint8(assetType) > 5) revert InvalidAssetType(assetType);
        if (!assetConfigs[assetType].isEnabled) revert AssetTypeDisabled(assetType);
        _;
    }

    modifier validContract(address contractAddress) {
        if (!isValidContract[contractAddress]) revert ContractNotFound(contractAddress);
        _;
    }

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEPLOYER_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        // Initialize default asset configurations
        _initializeAssetConfigs();
    }

    /**
     * @dev Initialize default configurations for all asset types
     */
    function _initializeAssetConfigs() internal {
        assetConfigs[AssetType.RealEstate] = AssetConfig({
            name: "Real Estate Token",
            symbol: "RET",
            defaultMaxSupply: 1000000 * 10**18, // 1M tokens
            isEnabled: true
        });

        assetConfigs[AssetType.Gold] = AssetConfig({
            name: "Gold Token",
            symbol: "GLD",
            defaultMaxSupply: 500000 * 10**18, // 500K tokens
            isEnabled: true
        });

        assetConfigs[AssetType.Vehicle] = AssetConfig({
            name: "Vehicle Token",
            symbol: "VET",
            defaultMaxSupply: 2000000 * 10**18, // 2M tokens
            isEnabled: true
        });

        assetConfigs[AssetType.Art] = AssetConfig({
            name: "Art Token",
            symbol: "ART",
            defaultMaxSupply: 100000 * 10**18, // 100K tokens
            isEnabled: true
        });

        assetConfigs[AssetType.Equipment] = AssetConfig({
            name: "Equipment Token",
            symbol: "EQT",
            defaultMaxSupply: 1500000 * 10**18, // 1.5M tokens
            isEnabled: true
        });

        assetConfigs[AssetType.Commodity] = AssetConfig({
            name: "Commodity Token",
            symbol: "COM",
            defaultMaxSupply: 3000000 * 10**18, // 3M tokens
            isEnabled: true
        });
    }

    /**
     * @dev Deploy a Real Estate Token contract
     * @param admin Address that will have admin role
     * @param maxSupply Maximum supply for the token (0 = use default)
     * @return contractAddress Address of the deployed contract
     */
    function deployRealEstateToken(
        address admin,
        uint256 maxSupply
    ) external onlyRole(DEPLOYER_ROLE) whenNotPaused nonReentrant validAssetType(AssetType.RealEstate) returns (address contractAddress) {
        if (admin == address(0)) revert ZeroAddress();
        
        uint256 supply = maxSupply == 0 ? assetConfigs[AssetType.RealEstate].defaultMaxSupply : maxSupply;
        if (supply == 0) revert InvalidMaxSupply(supply);

        try new RealEstateToken(admin) returns (RealEstateToken newContract) {
            contractAddress = address(newContract);
            
            // Update max supply if different from default
            if (maxSupply != 0 && maxSupply != assetConfigs[AssetType.RealEstate].defaultMaxSupply) {
                newContract.updateMaxSupply(supply);
            }
            
            _registerContract(
                contractAddress,
                AssetType.RealEstate,
                assetConfigs[AssetType.RealEstate].name,
                assetConfigs[AssetType.RealEstate].symbol,
                supply,
                admin
            );
        } catch {
            revert DeploymentFailed("Real Estate Token deployment failed");
        }
    }

    /**
     * @dev Deploy a generic asset token contract
     * @param assetType Type of asset token to deploy
     * @param admin Address that will have admin role
     * @param maxSupply Maximum supply for the token (0 = use default)
     * @param customName Custom name for the token (empty = use default)
     * @param customSymbol Custom symbol for the token (empty = use default)
     * @return contractAddress Address of the deployed contract
     */
    function deployAssetToken(
        AssetType assetType,
        address admin,
        uint256 maxSupply,
        string memory customName,
        string memory customSymbol
    ) external onlyRole(DEPLOYER_ROLE) whenNotPaused nonReentrant validAssetType(assetType) returns (address contractAddress) {
        if (admin == address(0)) revert ZeroAddress();
        
        uint256 supply = maxSupply == 0 ? assetConfigs[assetType].defaultMaxSupply : maxSupply;
        if (supply == 0) revert InvalidMaxSupply(supply);

        string memory tokenName = bytes(customName).length > 0 ? customName : assetConfigs[assetType].name;
        string memory tokenSymbol = bytes(customSymbol).length > 0 ? customSymbol : assetConfigs[assetType].symbol;

        // For now, we'll deploy RealEstateToken as the base implementation
        // In a full implementation, you'd have separate contracts for each asset type
        try new RealEstateToken(admin) returns (RealEstateToken newContract) {
            contractAddress = address(newContract);
            
            // Update max supply if different from default
            if (maxSupply != 0 && maxSupply != assetConfigs[assetType].defaultMaxSupply) {
                newContract.updateMaxSupply(supply);
            }
            
            _registerContract(
                contractAddress,
                assetType,
                tokenName,
                tokenSymbol,
                supply,
                admin
            );
        } catch {
            revert DeploymentFailed("Asset token deployment failed");
        }
    }

    /**
     * @dev Deploy contract using CREATE2 with provided bytecode
     * @param bytecode Bytecode of the contract to deploy
     * @param salt Salt for CREATE2 deployment
     * @param assetType Type of asset
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param maxSupply Maximum supply
     * @param admin Admin address
     * @return contractAddress Address of the deployed contract
     */
    function deployContract(
        bytes memory bytecode,
        bytes32 salt,
        AssetType assetType,
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        address admin
    ) external onlyRole(DEPLOYER_ROLE) nonReentrant whenNotPaused validAssetType(assetType) returns (address contractAddress) {
        if (admin == address(0)) revert ZeroAddress();
        if (bytecode.length == 0) revert DeploymentFailed("Empty bytecode");
        
        uint256 supply = maxSupply == 0 ? assetConfigs[assetType].defaultMaxSupply : maxSupply;

        assembly {
            contractAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        if (contractAddress == address(0)) revert DeploymentFailed("CREATE2 deployment failed");

        _registerContract(contractAddress, assetType, name, symbol, supply, admin);
    }

    /**
     * @dev Register a pre-deployed contract
     * @param contractAddress Address of the existing contract
     * @param assetType Type of asset
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param maxSupply Maximum supply
     * @param admin Admin address
     */
    function registerContract(
        address contractAddress,
        AssetType assetType,
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        address admin
    ) external onlyRole(DEPLOYER_ROLE) validAssetType(assetType) {
        if (contractAddress == address(0)) revert ZeroAddress();
        if (contractAddress.code.length == 0) revert DeploymentFailed("Not a contract");
        if (admin == address(0)) revert ZeroAddress();

        _registerContract(contractAddress, assetType, name, symbol, maxSupply, admin);
    }

    /**
     * @dev Internal function to register deployed contracts
     */
    function _registerContract(
        address contractAddress,
        AssetType assetType,
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        address admin
    ) internal {
        // Get current statistics from the contract
        uint256 currentSupply = 0;
        uint256 totalAssets = 0;
        uint256 totalValue = 0;

        try BaseAssetToken(contractAddress).totalSupply() returns (uint256 supply) {
            currentSupply = supply;
        } catch {}

        try BaseAssetToken(contractAddress).getCurrentAssetId() returns (uint256 assetId) {
            totalAssets = assetId > 0 ? assetId.sub(1) : 0;
        } catch {}

        deployedContracts[contractAddress] = DeployedContract({
            contractAddress: contractAddress,
            assetType: assetType,
            name: name,
            symbol: symbol,
            maxSupply: maxSupply,
            deployedAt: block.timestamp,
            deployer: msg.sender,
            admin: admin,
            isActive: true,
            totalSupply: currentSupply,
            totalAssets: totalAssets,
            totalValue: totalValue
        });

        assetTypeContracts[assetType].push(contractAddress);
        allContracts.push(contractAddress);
        isValidContract[contractAddress] = true;
        deployerContracts[msg.sender].push(contractAddress);
        
        // Update counters
        assetTypeCount[assetType] = assetTypeCount[assetType].add(1);
        totalContractsDeployed = totalContractsDeployed.add(1);
        activeContractsCount = activeContractsCount.add(1);

        emit ContractDeployed(contractAddress, assetType, name, symbol, msg.sender, admin, maxSupply);
    }

    /**
     * @dev Set contract active status
     * @param contractAddress Address of the contract
     * @param isActive Whether the contract should be active
     */
    function setContractStatus(
        address contractAddress,
        bool isActive
    ) external onlyRole(MANAGER_ROLE) validContract(contractAddress) {
        bool wasActive = deployedContracts[contractAddress].isActive;
        deployedContracts[contractAddress].isActive = isActive;

        // Update active count
        if (wasActive && !isActive) {
            activeContractsCount = activeContractsCount.sub(1);
        } else if (!wasActive && isActive) {
            activeContractsCount = activeContractsCount.add(1);
        }

        // Pause/unpause the contract if it supports it
        try BaseAssetToken(contractAddress).pause() {
            if (!isActive) {
                // Successfully paused
            }
        } catch {
            // Contract doesn't support pausing or already paused
        }

        try BaseAssetToken(contractAddress).unpause() {
            if (isActive) {
                // Successfully unpaused
            }
        } catch {
            // Contract doesn't support unpausing or already unpaused
        }

        emit ContractStatusChanged(contractAddress, isActive);
    }

    /**
     * @dev Update asset type configuration
     */
    function updateAssetConfig(
        AssetType assetType,
        string memory name,
        string memory symbol,
        uint256 defaultMaxSupply,
        bool isEnabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (uint8(assetType) > 5) revert InvalidAssetType(assetType);

        assetConfigs[assetType] = AssetConfig({
            name: name,
            symbol: symbol,
            defaultMaxSupply: defaultMaxSupply,
            isEnabled: isEnabled
        });

        emit AssetConfigUpdated(assetType, name, symbol, defaultMaxSupply, isEnabled);
    }

    /**
     * @dev Batch operations for multiple contracts
     */
    function batchSetContractStatus(
        address[] calldata contractAddresses,
        bool isActive
    ) external onlyRole(MANAGER_ROLE) {
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < contractAddresses.length; i++) {
            if (isValidContract[contractAddresses[i]]) {
                try this.setContractStatus(contractAddresses[i], isActive) {
                    successCount++;
                } catch {
                    // Continue with next contract
                }
            }
        }

        emit BatchOperationCompleted("setContractStatus", successCount, successCount == contractAddresses.length);
    }

    /**
     * @dev Update contract statistics (for dashboard reporting)
     */
    function updateContractStatistics(address contractAddress) 
        external 
        onlyRole(OPERATOR_ROLE) 
        validContract(contractAddress) 
    {
        DeployedContract storage contract_ = deployedContracts[contractAddress];

        try BaseAssetToken(contractAddress).totalSupply() returns (uint256 supply) {
            contract_.totalSupply = supply;
        } catch {}

        try BaseAssetToken(contractAddress).getCurrentAssetId() returns (uint256 assetId) {
            contract_.totalAssets = assetId > 0 ? assetId.sub(1) : 0;
        } catch {}

        try BaseAssetToken(contractAddress).getTokenStatistics() returns (
            uint256,
            uint256,
            uint256,
            uint256 totalValueBacking,
            uint256,
            uint256
        ) {
            contract_.totalValue = totalValueBacking;
        } catch {}
    }

    /**
     * @dev Batch update statistics for all contracts
     */
    function batchUpdateStatistics() external onlyRole(OPERATOR_ROLE) {
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < allContracts.length; i++) {
            if (deployedContracts[allContracts[i]].isActive) {
                try this.updateContractStatistics(allContracts[i]) {
                    successCount++;
                } catch {
                    // Continue with next contract
                }
            }
        }

        emit BatchOperationCompleted("updateStatistics", successCount, true);
    }

    // View functions

    /**
     * @dev Get contracts by asset type
     */
    function getContractsByAssetType(AssetType assetType) 
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
    function getActiveContractsByAssetType(AssetType assetType) 
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
     * @dev Get contracts deployed by a specific address
     */
    function getContractsByDeployer(address deployer) 
        external 
        view 
        returns (address[] memory) 
    {
        return deployerContracts[deployer];
    }

    /**
     * @dev Get contract info
     */
    function getContractInfo(address contractAddress) 
        external 
        view 
        validContract(contractAddress)
        returns (DeployedContract memory) 
    {
        return deployedContracts[contractAddress];
    }

    /**
     * @dev Get factory statistics
     */
    function getFactoryStatistics() external view returns (
        uint256 totalContracts,
        uint256 activeContracts,
        uint256 totalRealEstate,
        uint256 totalGold,
        uint256 totalVehicle,
        uint256 totalArt,
        uint256 totalEquipment,
        uint256 totalCommodity
    ) {
        return (
            totalContractsDeployed,
            activeContractsCount,
            assetTypeCount[AssetType.RealEstate],
            assetTypeCount[AssetType.Gold],
            assetTypeCount[AssetType.Vehicle],
            assetTypeCount[AssetType.Art],
            assetTypeCount[AssetType.Equipment],
            assetTypeCount[AssetType.Commodity]
        );
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
    function getTotalContractsByAssetType(AssetType assetType) 
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

    /**
     * @dev Emergency functions
     */
    function emergencyPauseContract(address contractAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        validContract(contractAddress) 
    {
        try BaseAssetToken(contractAddress).pause() {
            deployedContracts[contractAddress].isActive = false;
            if (activeContractsCount > 0) {
                activeContractsCount = activeContractsCount.sub(1);
            }
            emit ContractStatusChanged(contractAddress, false);
        } catch {
            revert DeploymentFailed("Failed to pause contract");
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}