// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./interfaces/IPledgeEscrow.sol";
import "./interfaces/IAssetMetadata.sol";
import "./PledgeNFT.sol";
import "./BaseAssetToken.sol";

/**
 * @title PledgeEscrow
 * @dev Main escrow contract for managing asset pledges and token minting
 */
contract PledgeEscrow is IPledgeEscrow, AccessControl, Pausable, ReentrancyGuard, IERC721Receiver {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // State variables
    uint256 private _pledgeIdCounter;
    PledgeNFT public pledgeNFT;
    
    // Mappings
    mapping(uint256 => PledgeInfo) public pledges;
    mapping(address => uint256[]) public userPledges;
    mapping(AssetType => address) public assetTokenContracts;
    mapping(uint256 => uint256) public pledgeToNFT; // pledgeId => nftTokenId
    mapping(uint256 => uint256) public nftToPledge; // nftTokenId => pledgeId
    
    // Arrays for enumeration
    uint256[] public allPledges;
    uint256[] public pendingPledges;
    
    // Configuration
    uint256 public minAppraisalValue = 1000e18; // $1,000 minimum
    uint256 public maxLTV = 7000; // 70% max loan-to-value (basis points)
    uint256 public defaultThreshold = 90 days; // Time before default
    
    modifier onlyPledgeOwner(uint256 pledgeId) {
        require(pledges[pledgeId].borrower == msg.sender, "PledgeEscrow: not pledge owner");
        _;
    }
    
    modifier validPledge(uint256 pledgeId) {
        require(pledges[pledgeId].pledgeId != 0, "PledgeEscrow: invalid pledge");
        _;
    }

    constructor(address _pledgeNFT) {
        require(_pledgeNFT != address(0), "PledgeEscrow: invalid NFT address");
        
        pledgeNFT = PledgeNFT(_pledgeNFT);
        _pledgeIdCounter = 1; // Start at 1
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(APPROVER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Create a new asset pledge
     */
    function createPledge(
        AssetType assetType,
        uint256 appraisedValue,
        AssetMetadata calldata metadata
    ) external nonReentrant whenNotPaused returns (uint256 pledgeId) {
        require(appraisedValue >= minAppraisalValue, "PledgeEscrow: value too low");
        require(bytes(metadata.description).length > 0, "PledgeEscrow: invalid metadata");
        require(metadata.documentHash != bytes32(0), "PledgeEscrow: invalid document hash");

        pledgeId = _pledgeIdCounter++;
        
        // Create NFT representing the pledged asset
        uint256 nftTokenId = pledgeNFT.mintPledgeNFT(
            msg.sender,
            pledgeId,
            _assetTypeToString(assetType),
            appraisedValue,
            metadata.description,
            metadata.documentHash
        );

        // Store pledge information
        pledges[pledgeId] = PledgeInfo({
            pledgeId: pledgeId,
            borrower: msg.sender,
            assetType: assetType,
            appraisedValue: appraisedValue,
            tokenAmount: 0, // Set during approval
            nftTokenId: nftTokenId,
            status: PledgeStatus.Pending,
            createdAt: block.timestamp,
            approvedAt: 0,
            approvedBy: address(0),
            metadataURI: metadata.description,
            documentHash: metadata.documentHash
        });

        // Update mappings
        pledgeToNFT[pledgeId] = nftTokenId;
        nftToPledge[nftTokenId] = pledgeId;
        userPledges[msg.sender].push(pledgeId);
        allPledges.push(pledgeId);
        pendingPledges.push(pledgeId);

        emit PledgeCreated(pledgeId, msg.sender, assetType, appraisedValue, nftTokenId);
    }

    /**
     * @dev Approve a pledge and set token amount
     */
    function approvePledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external onlyRole(APPROVER_ROLE) validPledge(pledgeId) nonReentrant {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Pending, "PledgeEscrow: not pending");
        require(tokenAmount > 0, "PledgeEscrow: invalid token amount");
        
        // Check LTV ratio
        uint256 ltv = (tokenAmount * 10000) / pledge.appraisedValue;
        require(ltv <= maxLTV, "PledgeEscrow: LTV too high");

        // Update pledge status
        pledge.status = PledgeStatus.Approved;
        pledge.tokenAmount = tokenAmount;
        pledge.approvedAt = block.timestamp;
        pledge.approvedBy = msg.sender;

        // Remove from pending pledges
        _removePendingPledge(pledgeId);

        // Transfer NFT to escrow
        pledgeNFT.transferToEscrow(pledge.nftTokenId, address(this));

        emit PledgeApproved(pledgeId, msg.sender, tokenAmount);
    }

    /**
     * @dev Reject a pledge
     */
    function rejectPledge(
        uint256 pledgeId,
        string calldata reason
    ) external onlyRole(APPROVER_ROLE) validPledge(pledgeId) nonReentrant {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Pending, "PledgeEscrow: not pending");

        pledge.status = PledgeStatus.Rejected;
        
        // Remove from pending pledges
        _removePendingPledge(pledgeId);

        emit PledgeRejected(pledgeId, msg.sender, reason);
    }

    /**
     * @dev Mint tokens for approved pledge
     */
    function mintTokens(
        uint256 pledgeId
    ) external onlyRole(MINTER_ROLE) validPledge(pledgeId) nonReentrant returns (address tokenContract, uint256 amount) {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");

        tokenContract = assetTokenContracts[pledge.assetType];
        require(tokenContract != address(0), "PledgeEscrow: token contract not set");

        amount = pledge.tokenAmount;
        
        // Mint tokens to borrower
        BaseAssetToken(tokenContract).mint(pledge.borrower, amount);

        emit TokensMinted(pledgeId, pledge.borrower, tokenContract, amount);
    }

    /**
     * @dev Redeem pledge by burning tokens
     */
    function redeemPledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external onlyPledgeOwner(pledgeId) validPledge(pledgeId) nonReentrant {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");
        require(tokenAmount == pledge.tokenAmount, "PledgeEscrow: incorrect amount");

        address tokenContract = assetTokenContracts[pledge.assetType];
        require(tokenContract != address(0), "PledgeEscrow: token contract not set");

        // Burn tokens from user
        BaseAssetToken(tokenContract).burnFrom(msg.sender, tokenAmount);

        // Update pledge status
        pledge.status = PledgeStatus.Redeemed;

        // Transfer NFT back to owner
        pledgeNFT.transferFrom(address(this), msg.sender, pledge.nftTokenId);

        emit PledgeRedeemed(pledgeId, msg.sender, tokenAmount);
    }

    /**
     * @dev Default a pledge (admin function)
     */
    function defaultPledge(
        uint256 pledgeId
    ) external onlyRole(ADMIN_ROLE) validPledge(pledgeId) nonReentrant {
        PledgeInfo storage pledge = pledges[pledgeId];
        require(pledge.status == PledgeStatus.Approved, "PledgeEscrow: not approved");
        require(
            block.timestamp >= pledge.approvedAt + defaultThreshold,
            "PledgeEscrow: not in default"
        );

        pledge.status = PledgeStatus.Defaulted;

        emit PledgeDefaulted(pledgeId, pledge.borrower, pledge.tokenAmount);
    }

    /**
     * @dev Set asset token contract addresses
     */
    function setAssetTokenContract(
        AssetType assetType,
        address tokenContract
    ) external onlyRole(ADMIN_ROLE) {
        require(tokenContract != address(0), "PledgeEscrow: invalid contract");
        assetTokenContracts[assetType] = tokenContract;
    }

    /**
     * @dev Update configuration parameters
     */
    function updateConfiguration(
        uint256 _minAppraisalValue,
        uint256 _maxLTV,
        uint256 _defaultThreshold
    ) external onlyRole(ADMIN_ROLE) {
        require(_maxLTV <= 10000, "PledgeEscrow: invalid LTV");
        
        minAppraisalValue = _minAppraisalValue;
        maxLTV = _maxLTV;
        defaultThreshold = _defaultThreshold;
    }

    // View functions
    function getPledgeInfo(uint256 pledgeId) external view returns (PledgeInfo memory) {
        return pledges[pledgeId];
    }

    function getUserPledges(address user) external view returns (uint256[] memory) {
        return userPledges[user];
    }

    function getPendingPledges() external view returns (uint256[] memory) {
        return pendingPledges;
    }

    function getTotalPledges() external view returns (uint256) {
        return allPledges.length;
    }

    function getAssetTokenContract(AssetType assetType) external view returns (address) {
        return assetTokenContracts[assetType];
    }

    // Internal functions
    function _removePendingPledge(uint256 pledgeId) internal {
        for (uint256 i = 0; i < pendingPledges.length; i++) {
            if (pendingPledges[i] == pledgeId) {
                pendingPledges[i] = pendingPledges[pendingPledges.length - 1];
                pendingPledges.pop();
                break;
            }
        }
    }

    function _assetTypeToString(AssetType assetType) internal pure returns (string memory) {
        if (assetType == AssetType.RealEstate) return "Real Estate";
        if (assetType == AssetType.Gold) return "Gold";
        if (assetType == AssetType.Vehicle) return "Vehicle";
        if (assetType == AssetType.Art) return "Art";
        if (assetType == AssetType.Equipment) return "Equipment";
        if (assetType == AssetType.Commodity) return "Commodity";
        return "Unknown";
    }

    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // Required for receiving NFTs
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}