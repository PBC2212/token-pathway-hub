// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/IPledgeNFT.sol";
import "../interfaces/IPledgeEscrow.sol";

/**
 * @title PledgeFactory
 * @dev Factory contract that deploys pledge systems using minimal proxies
 */
contract PledgeFactory is AccessControl, Pausable {
    using Clones for address;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");

    // Implementation contracts
    address public immutable pledgeNFTImplementation;
    address public immutable pledgeEscrowImplementation;

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

    // State
    address[] public allPledgeSystems;
    mapping(address => bool) public isValidPledgeSystem;
    mapping(address => bool) public pledgeSystemStatus;
    mapping(address => address) public escrowToNFT;
    mapping(address => string) public systemNames;
    mapping(address => uint256) public systemDeployedAt;
    mapping(address => address) public systemDeployer;

    struct PledgeSystemInfo {
        address escrowContract;
        address nftContract;
        string name;
        bool isActive;
        uint256 deployedAt;
        address deployer;
    }

    constructor(address _pledgeNFTImpl, address _pledgeEscrowImpl) {
        require(_pledgeNFTImpl != address(0), "PledgeFactory: invalid NFT impl");
        require(_pledgeEscrowImpl != address(0), "PledgeFactory: invalid Escrow impl");

        pledgeNFTImplementation = _pledgeNFTImpl;
        pledgeEscrowImplementation = _pledgeEscrowImpl;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DEPLOYER_ROLE, msg.sender);
    }

    /**
     * @dev Deploy new pledge system using minimal proxies
     */
    function deployPledgeSystem(
        string memory name,
        string memory nftName,
        string memory nftSymbol
    ) external onlyRole(DEPLOYER_ROLE) whenNotPaused returns (address escrow, address nft) {
        require(bytes(name).length > 0, "Invalid system name");
        require(bytes(nftName).length > 0, "Invalid NFT name");
        require(bytes(nftSymbol).length > 0, "Invalid NFT symbol");

        nft = pledgeNFTImplementation.clone();
        escrow = pledgeEscrowImplementation.clone();

        IPledgeNFT(nft).initialize(nftName, nftSymbol, escrow);
        IPledgeEscrow(escrow).initialize(nft);

        IPledgeNFT(nft).grantRole(keccak256("ADMIN_ROLE"), msg.sender);
        IPledgeEscrow(escrow).grantRole(keccak256("ADMIN_ROLE"), msg.sender);
        IPledgeEscrow(escrow).grantRole(keccak256("APPROVER_ROLE"), msg.sender);
        IPledgeEscrow(escrow).grantRole(keccak256("MINTER_ROLE"), msg.sender);

        allPledgeSystems.push(escrow);
        isValidPledgeSystem[escrow] = true;
        pledgeSystemStatus[escrow] = true;
        escrowToNFT[escrow] = nft;
        systemNames[escrow] = name;
        systemDeployedAt[escrow] = block.timestamp;
        systemDeployer[escrow] = msg.sender;

        emit PledgeSystemDeployed(escrow, nft, msg.sender, name);
    }

    /**
     * @dev Configure asset token contracts for escrow
     */
    function configureAssetTokens(
        address escrowContract,
        address[] calldata tokenContracts,
        uint8[] calldata assetTypes
    ) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "Invalid escrow");
        require(tokenContracts.length == assetTypes.length, "Length mismatch");

        for (uint256 i = 0; i < tokenContracts.length; i++) {
            require(tokenContracts[i] != address(0), "Invalid token");
            require(assetTypes[i] <= 5, "Invalid asset type");

            IPledgeEscrow(escrowContract).setAssetTokenContract(
                assetTypes[i],
                tokenContracts[i]
            );
        }
    }

    /**
     * @dev Toggle system status (active/inactive)
     */
    function setPledgeSystemStatus(address escrowContract, bool isActive) external onlyRole(ADMIN_ROLE) {
        require(isValidPledgeSystem[escrowContract], "Invalid escrow");

        pledgeSystemStatus[escrowContract] = isActive;

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
     * @dev Get full system info for a deployed escrow
     */
    function getPledgeSystemInfo(address escrowContract) external view returns (PledgeSystemInfo memory) {
        require(isValidPledgeSystem[escrowContract], "Invalid escrow");

        return PledgeSystemInfo({
            escrowContract: escrowContract,
            nftContract: escrowToNFT[escrowContract],
            name: systemNames[escrowContract],
            isActive: pledgeSystemStatus[escrowContract],
            deployedAt: systemDeployedAt[escrowContract],
            deployer: systemDeployer[escrowContract]
        });
    }

    /**
     * @dev List all pledge systems
     */
    function getAllPledgeSystems() external view returns (address[] memory) {
        return allPledgeSystems;
    }

    /**
     * @dev Total systems deployed
     */
    function totalPledgeSystems() external view returns (uint256) {
        return allPledgeSystems.length;
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
     */
    function grantFactoryRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @dev Revoke roles in factory
     */
    function revokeFactoryRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        _revokeRole(role, account);
    }
}
