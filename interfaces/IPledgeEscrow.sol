// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IPledgeEscrow is IAccessControl {
    
    enum AssetType { RealEstate, Gold, Vehicle, Art, Equipment, Commodity }
    enum PledgeStatus { Pending, Approved, Rejected, Redeemed, Defaulted }

    struct PledgeInfo {
        uint256 pledgeId;
        address borrower;
        AssetType assetType;
        uint256 appraisedValue;
        uint256 tokenAmount;
        uint256 nftTokenId;
        PledgeStatus status;
        uint256 createdAt;
        uint256 approvedAt;
        address approvedBy;
        string metadataURI;
        bytes32 documentHash;
    }

    struct AssetMetadata {
        string description;
        bytes32 documentHash;
        string appraisalDate;
        string appraiserLicense;
    }

    event PledgeCreated(uint256 indexed pledgeId, address indexed borrower, AssetType indexed assetType, uint256 appraisedValue, uint256 nftTokenId);
    event PledgeApproved(uint256 indexed pledgeId, address indexed approver, uint256 tokenAmount);
    event TokensMinted(uint256 indexed pledgeId, address indexed borrower, address indexed tokenContract, uint256 amount);

    function initialize(address _pledgeNFT) external;
    function createPledge(AssetType assetType, uint256 appraisedValue, AssetMetadata calldata metadata) external returns (uint256 pledgeId);
    function approvePledge(uint256 pledgeId, uint256 tokenAmount) external;
    function mintTokens(uint256 pledgeId) external returns (address tokenContract, uint256 amount);
    function setAssetTokenContract(uint8 assetType, address tokenContract) external;
    function getPledgeInfo(uint256 pledgeId) external view returns (PledgeInfo memory);
    function pause() external;
    function unpause() external;
}