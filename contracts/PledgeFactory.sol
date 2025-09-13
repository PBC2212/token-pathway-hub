// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./PledgeEscrow.sol";
import "./PledgeNFT.sol";

/**
 * @title PledgeFactory
 * @dev Factory contract for deploying pledge escrow systems
 */
contract PledgeFactory is AccessControl, Pausable {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

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

    // State variables
    address[] public allPledgeSystems;
    mapping(address => bool) public isValidPledgeSystem;
    mapping(address => bool) public pledgeSystemStatus; // true = active
    mapping(address => address) public escrowToNFT; // escrow => nft contract
    mapping(address => string) public systemNames;

    struct PledgeSystemInfo {
        address escrowContract;
        address nftContract;
        string name;
        bool isActive;
        uint256 deployedAt;
        address deployer;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
    }

    /**
     * @dev Deploy a new pledge system (NFT + Escrow)
     */
    function deployPledgeSystem(
        string memory name,
        string memory nftName,
        string memory nftSymbol
    ) external onlyRole(DEPLOYER_ROLE) whenNotPaused returns (address escrow, address nft) {
        require(bytes(name).length > 0, "PledgeFactory: invalid name");
        require(bytes(nftName).length > 0, "PledgeFactory: invalid NFT name");
        require(bytes(nftSymbol).length > 0, "PledgeFactory: invalid NFT symbol");

        // Deploy NFT contract
        PledgeNFT pledgeNFT = new PledgeNFT(nftName, nftSymbol);
        nft = address(pledgeNFT);

        // Deploy Escrow contract
        PledgeEscrow pledgeEscrow = new PledgeEscrow(nft);
        escrow = address(pledgeEscrow);

        // Grant escrow role to the escrow contract
        pledgeNFT.grantRole(pledgeNFT.ESCROW_ROLE(), escrow);

        // Transfer ownership to factory admin
        pledgeNFT.grantRole(pledgeNFT.ADMIN_ROLE(), msg.sender);
        pledgeEscrow.grantRole(pledgeEscrow.ADMIN_ROLE(), msg.sender);

        // Store system info
        allPledgeSystems.push(escrow);
        isValidPledgeSystem[escrow] = true;
        pledgeSystemStatus[escrow] = true; // Active by default
        escrowToNFT[escrow] = nft;
        systemNames[escrow] = name;

        emit PledgeSystemDeployed(escrow, nft, msg.sender, name);
    }

    /**
     * @dev Configure asset token contracts for a pledge system
     */
    function configureAssetTokens(
        address escrowContract,
        address[] calldata tokenContracts,
        uint8[] calldata assetTypes
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");
        require(tokenContracts.length == assetTypes.length, "PledgeFactory: length mismatch");

        PledgeEscrow escrow = PledgeEscrow(escrowContract);
        
        for (uint256 i = 0; i < tokenContracts.length; i++) {
            require(tokenContracts[i] != address(0), "PledgeFactory: invalid token contract");
            require(assetTypes[i] <= 5, "PledgeFactory: invalid asset type"); // 0-5 for enum values
            
            escrow.setAssetTokenContract(
                IPledgeEscrow.AssetType(assetTypes[i]),
                tokenContracts[i]
            );
        }
    }

    /**
     * @dev Set pledge system status (active/inactive)
     */
    function setPledgeSystemStatus(
        address escrowContract,
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");

        pledgeSystemStatus[escrowContract] = isActive;

        // Pause/unpause the contracts
        PledgeEscrow escrow = PledgeEscrow(escrowContract);
        PledgeNFT nft = PledgeNFT(escrowToNFT[escrowContract]);

        if (isActive) {
            escrow.unpause();
            nft.unpause();
        } else {
            escrow.pause();
            nft.pause();
        }

        emit PledgeSystemStatusChanged(escrowContract, isActive);
    }

    /**
     * @dev Emergency pause a pledge system
     */
    function emergencyPausePledgeSystem(
        address escrowContract
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");

        PledgeEscrow(escrowContract).pause();
        PledgeNFT(escrowToNFT[escrowContract]).pause();
        
        pledgeSystemStatus[escrowContract] = false;
        emit PledgeSystemStatusChanged(escrowContract, false);
    }

    /**
     * @dev Get all pledge systems
     */
    function getAllPledgeSystems() external view returns (address[] memory) {
        return allPledgeSystems;
    }

    /**
     * @dev Get active pledge systems
     */
    function getActivePledgeSystems() external view returns (address[] memory activeSystems) {
        uint256 activeCount = 0;
        
        // Count active systems
        for (uint256 i = 0; i < allPledgeSystems.length; i++) {
            if (pledgeSystemStatus[allPledgeSystems[i]]) {
                activeCount++;
            }
        }
        
        // Create array of active systems
        activeSystems = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allPledgeSystems.length; i++) {
            if (pledgeSystemStatus[allPledgeSystems[i]]) {
                activeSystems[index] = allPledgeSystems[i];
                index++;
            }
        }
    }

    /**
     * @dev Get pledge system information
     */
    function getPledgeSystemInfo(
        address escrowContract
    ) external view returns (PledgeSystemInfo memory) {
        require(isValidPledgeSystem[escrowContract], "PledgeFactory: invalid escrow");

        return PledgeSystemInfo({
            escrowContract: escrowContract,
            nftContract: escrowToNFT[escrowContract],
            name: systemNames[escrowContract],
            isActive: pledgeSystemStatus[escrowContract],
            deployedAt: block.timestamp, // This should be stored during deployment
            deployer: msg.sender // This should be stored during deployment
        });
    }

    /**
     * @dev Get NFT contract for escrow
     */
    function getNFTContract(address escrowContract) external view returns (address) {
        return escrowToNFT[escrowContract];
    }

    /**
     * @dev Get total number of pledge systems
     */
    function totalPledgeSystems() external view returns (uint256) {
        return allPledgeSystems.length;
    }

    /**
     * @dev Admin functions
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Grant roles to external addresses
     */
    function grantFactoryRole(
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeFactoryRole(
        bytes32 role,
        address account
    ) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }
}