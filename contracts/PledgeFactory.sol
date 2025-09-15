// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IPledgeNFT.sol";
import "./interfaces/IPledgeEscrow.sol";
import "./PledgeNFT.sol";
import "./PledgeEscrow.sol";

/**
 * @title PledgeFactory
 * @dev Factory contract that deploys pledge systems using minimal proxies
 * @notice This factory creates complete pledge systems with NFT and Escrow contracts
 */
contract PledgeFactory is AccessControl, Pausable, ReentrancyGuard {
    using Clones for address;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    // Implementation contracts
    address public pledgeNFTImplementation;
    address public pledgeEscrowImplementation;

    // Events
    event PledgeSystemDeployed(
        address indexed escrow,
        address indexed nft,
        address indexed deployer,
        string name
    );

    event PledgeSystemStatusChanged(
        address indexed escrow,
        bool isActive
    );

    event ImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation,
        string contractType
    );

    event AssetTokensConfigured(
        address indexed escrow,
        address[] tokenContracts,
        uint8[] assetTypes
    );

    // State
    address[] public allPledgeSystems;
    mapping(address => bool) public isValidPledgeSystem;
    mapping(address => bool) public pledgeSystemStatus;
    mapping(address => address) public escrowToNFT;
    mapping(address => string) public systemNames;
    mapping(address => uint256) public systemDeployedAt;
    mapping(address => address) public systemDeployer;
    
    // System statistics
    uint256 public totalSystemsDeployed;
    uint256 public activeSystemsCount;

    struct PledgeSystemInfo {
        address escrowContract;
        address nftContract;
        string name;
        bool isActive;
        uint256 deployedAt;
        address deployer;
        uint256 totalPledges;
        uint256 pendingPledges;
    }

    modifier validImplementations() {
        require(
            pledgeNFTImplementation != address(0) && pledgeEscrowImplementation != address(0),
            "PledgeFactory: implementations not set"
        );
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
        
        // Deploy implementation contracts
        pledgeNFTImplementation = address(new PledgeNFT());
        pledgeEscrowImplementation = address(new PledgeEscrow());
    }

    /**
     * @dev Deploy new pledge system using minimal proxies
     * @param name Name of the pledge system
     * @param nftName Name of the NFT collection
     * @param nftSymbol Symbol of the NFT collection
     * @return escrow Address of the deployed escrow contract
     * @return nft Address of the deployed NFT contract
     */
    function deployPledgeSystem(
        string memory name,
        string memory nftName,
        string memory nftSymbol
    ) external onlyRole(DEPLOYER_ROLE) whenNotPaused validImplementations nonReentrant returns (address escrow, address nft) {
        require(bytes(name).length > 0, "PledgeFactory: invalid system name");
        require(bytes(nftName).length > 0, "PledgeFactory: invalid NFT name");
        require(bytes(nftSymbol).length > 0, "PledgeFactory: invalid NFT symbol");

        // Deploy minimal proxy clones
        nft = pledgeNFTImplementation.clone();
        escrow = pledgeEscrowImplementation.clone();

        // Initialize contracts
        IPledgeNFT(nft).initialize(nftName, nftSymbol, escrow);
        IPledgeEscrow(escrow).initialize(nft);

        // Grant necessary roles
        IPledgeNFT(nft).grantRole(keccak256("ADMIN_ROLE"), msg.sender);
        IPledgeNFT(nft).grantRole(keccak256("MINTER_ROLE"), escrow);
        
        IPledgeEscrow(escrow).grantRole(keccak256("ADMIN_ROLE"), msg.sender);
        IPledgeEscrow(escrow).grantRole(keccak256("APPROVER_ROLE"), msg.sender);
        IPledgeEscrow(escrow).grantRole(keccak256("MINTER_ROLE"), msg.sender);

        // Store system information
        allPledgeSystems.push(escrow);
        isValidPledgeSystem[escrow] = true;
        pledgeSystemStatus[escrow] = true;
        escrowToNFT[escrow] = nft;
        systemNames[escrow] = name;
        systemDeployedAt[escrow] = block.timestamp;
        systemDeployer[escrow] = msg.sender;
        
        // Update counters
        totalSystemsDeployed++;
        activeSystemsCount++;

        emit PledgeSystemDeployed(escrow, nft, msg.sender, name);
    }

    /**
     * @dev Configure asset token contracts for escrow
     * @param escrowContract Address of the escrow contract
     * @param tokenContracts Array of asset token contract addresses
     * @param assetTypes Array of corresponding asset types
     */
    function configureAssetTokens(
        address escrowContract,
        address[] calldata tokenContracts,
        uint8[] calldata assetTypes
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");
        require(tokenContracts.length == assetTypes.length, "PledgeFactory: length mismatch");
        require(tokenContracts.length > 0, "PledgeFactory: empty arrays");

        for (uint256 i = 0; i < tokenContracts.length; i++) {
            require(tokenContracts[i] != address(0), "PledgeFactory: invalid token address");
            require(assetTypes[i] <= 5, "PledgeFactory: invalid asset type");

            IPledgeEscrow(escrowContract).setAssetTokenContract(
                assetTypes[i],
                tokenContracts[i]
            );
        }

        emit AssetTokensConfigured(escrowContract, tokenContracts, assetTypes);
    }

    /**
     * @dev Toggle system status (active/inactive)
     * @param escrowContract Address of the escrow contract
     * @param isActive Whether the system should be active
     */
    function setPledgeSystemStatus(address escrowContract, bool isActive) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");

        bool wasActive = pledgeSystemStatus[escrowContract];
        pledgeSystemStatus[escrowContract] = isActive;

        // Update active count
        if (wasActive && !isActive) {
            activeSystemsCount--;
        } else if (!wasActive && isActive) {
            activeSystemsCount++;
        }

        // Pause/unpause contracts
        if (isActive) {
            IPledgeEscrow(escrowContract).unpause();
            IPledgeNFT(escrowToNFT[escrowContract]).unpause();
        } else {
            IPledgeEscrow(escrowContract).pause();
            IPledgeNFT(escrowToNFT[escrowContract]).pause();
        }

        emit PledgeSystemStatusChanged(escrowContract, isActive);
    }

    /**
     * @dev Emergency pause a specific system
     * @param escrowContract Address of the escrow contract to pause
     */
    function emergencyPauseSystem(address escrowContract) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");
        
        IPledgeEscrow(escrowContract).pause();
        IPledgeNFT(escrowToNFT[escrowContract]).pause();
        
        if (pledgeSystemStatus[escrowContract]) {
            pledgeSystemStatus[escrowContract] = false;
            activeSystemsCount--;
        }
        
        emit PledgeSystemStatusChanged(escrowContract, false);
    }

    /**
     * @dev Get full system info for a deployed escrow
     * @param escrowContract Address of the escrow contract
     * @return systemInfo Complete information about the pledge system
     */
    function getPledgeSystemInfo(address escrowContract) external view returns (PledgeSystemInfo memory systemInfo) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");

        // Get pledge statistics from escrow contract
        uint256 totalPledges = 0;
        uint256 pendingPledges = 0;
        
        try IPledgeEscrow(escrowContract).getTotalPledges() returns (uint256 total) {
            totalPledges = total;
        } catch {
            // Ignore error for older implementations
        }
        
        try IPledgeEscrow(escrowContract).getPendingPledges() returns (uint256[] memory pending) {
            pendingPledges = pending.length;
        } catch {
            // Ignore error for older implementations
        }

        return PledgeSystemInfo({
            escrowContract: escrowContract,
            nftContract: escrowToNFT[escrowContract],
            name: systemNames[escrowContract],
            isActive: pledgeSystemStatus[escrowContract],
            deployedAt: systemDeployedAt[escrowContract],
            deployer: systemDeployer[escrowContract],
            totalPledges: totalPledges,
            pendingPledges: pendingPledges
        });
    }

    /**
     * @dev List all pledge systems
     * @return Array of all escrow contract addresses
     */
    function getAllPledgeSystems() external view returns (address[] memory) {
        return allPledgeSystems;
    }

    /**
     * @dev Get active pledge systems only
     * @return activeEscrows Array of active escrow contract addresses
     */
    function getActivePledgeSystems() external view returns (address[] memory activeEscrows) {
        uint256 count = 0;
        
        // Count active systems
        for (uint256 i = 0; i < allPledgeSystems.length; i++) {
            if (pledgeSystemStatus[allPledgeSystems[i]]) {
                count++;
            }
        }
        
        // Populate array
        activeEscrows = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPledgeSystems.length; i++) {
            if (pledgeSystemStatus[allPledgeSystems[i]]) {
                activeEscrows[index] = allPledgeSystems[i];
                index++;
            }
        }
    }

    /**
     * @dev Get factory statistics
     * @return totalSystems Total number of systems deployed
     * @return activeSystems Number of currently active systems
     * @return totalPledges Total pledges across all systems
     * @return totalPendingPledges Total pending pledges across all systems
     */
    function getFactoryStatistics() external view returns (
        uint256 totalSystems,
        uint256 activeSystems,
        uint256 totalPledges,
        uint256 totalPendingPledges
    ) {
        totalSystems = totalSystemsDeployed;
        activeSystems = activeSystemsCount;
        
        // Calculate total pledges across all systems
        for (uint256 i = 0; i < allPledgeSystems.length; i++) {
            address escrowContract = allPledgeSystems[i];
            
            try IPledgeEscrow(escrowContract).getTotalPledges() returns (uint256 systemTotal) {
                totalPledges += systemTotal;
            } catch {
                // Ignore errors for older implementations
            }
            
            try IPledgeEscrow(escrowContract).getPendingPledges() returns (uint256[] memory pending) {
                totalPendingPledges += pending.length;
            } catch {
                // Ignore errors for older implementations
            }
        }
    }

    /**
     * @dev Total systems deployed
     */
    function totalPledgeSystems() external view returns (uint256) {
        return totalSystemsDeployed;
    }

    /**
     * @dev Update implementation contracts (admin only)
     * @param newNFTImplementation New NFT implementation address
     * @param newEscrowImplementation New Escrow implementation address
     */
    function updateImplementations(
        address newNFTImplementation,
        address newEscrowImplementation
    ) external onlyRole(ADMIN_ROLE) {
        require(newNFTImplementation != address(0), "PledgeFactory: invalid NFT implementation");
        require(newEscrowImplementation != address(0), "PledgeFactory: invalid Escrow implementation");
        
        address oldNFTImpl = pledgeNFTImplementation;
        address oldEscrowImpl = pledgeEscrowImplementation;
        
        pledgeNFTImplementation = newNFTImplementation;
        pledgeEscrowImplementation = newEscrowImplementation;
        
        emit ImplementationUpdated(oldNFTImpl, newNFTImplementation, "PledgeNFT");
        emit ImplementationUpdated(oldEscrowImpl, newEscrowImplementation, "PledgeEscrow");
    }

    /**
     * @dev Get implementation addresses
     * @return nftImpl Current NFT implementation address
     * @return escrowImpl Current Escrow implementation address
     */
    function getImplementations() external view returns (address nftImpl, address escrowImpl) {
        return (pledgeNFTImplementation, pledgeEscrowImplementation);
    }

    /**
     * @dev Pause the factory
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the factory
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Grant roles in factory
     * @param role Role to grant
     * @param account Address to grant role to
     */
    function grantFactoryRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        require(account != address(0), "PledgeFactory: invalid account");
        _grantRole(role, account);
    }

    /**
     * @dev Revoke roles in factory
     * @param role Role to revoke
     * @param account Address to revoke role from
     */
    function revokeFactoryRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    /**
     * @dev Grant roles in a specific pledge system
     * @param escrowContract Address of the escrow contract
     * @param role Role to grant
     * @param account Address to grant role to
     */
    function grantSystemRole(
        address escrowContract,
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");
        require(account != address(0), "PledgeFactory: invalid account");
        
        IPledgeEscrow(escrowContract).grantRole(role, account);
    }

    /**
     * @dev Revoke roles in a specific pledge system
     * @param escrowContract Address of the escrow contract
     * @param role Role to revoke
     * @param account Address to revoke role from
     */
    function revokeSystemRole(
        address escrowContract,
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");
        
        IPledgeEscrow(escrowContract).revokeRole(role, account);
    }

    /**
     * @dev Check if a system is valid and active
     * @param escrowContract Address of the escrow contract
     * @return isValid Whether the system is valid
     * @return isActive Whether the system is active
     */
    function checkSystemStatus(address escrowContract) external view returns (bool isValid, bool isActive) {
        isValid = isValidPledgeSystem[escrowContract];
        isActive = pledgeSystemStatus[escrowContract];
    }

    /**
     * @dev Predict addresses for a new pledge system deployment
     * @param deployer Address that will deploy the system
     * @param nonce Current nonce for the deployer
     * @return predictedNFT Predicted NFT contract address
     * @return predictedEscrow Predicted Escrow contract address
     */
    function predictSystemAddresses(address deployer, uint256 nonce) 
        external 
        view 
        returns (address predictedNFT, address predictedEscrow) 
    {
        // This is a simplified prediction - actual addresses depend on CREATE2 salt
        predictedNFT = Clones.predictDeterministicAddress(
            pledgeNFTImplementation,
            keccak256(abi.encodePacked(deployer, nonce, "NFT")),
            address(this)
        );
        
        predictedEscrow = Clones.predictDeterministicAddress(
            pledgeEscrowImplementation,
            keccak256(abi.encodePacked(deployer, nonce, "ESCROW")),
            address(this)
        );
    }
}