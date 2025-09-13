// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPledgeEscrow {
    enum PledgeStatus {
        Pending,
        Approved,
        Rejected,
        Redeemed,
        Defaulted
    }

    enum AssetType {
        RealEstate,
        Gold,
        Vehicle,
        Art,
        Equipment,
        Commodity
    }

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
        string name;
        string description;
        string location;
        uint256 appraisedValue;
        string appraisalDocument;
        string[] additionalDocuments;
        bytes32 documentHash;
    }

    // Events
    event PledgeCreated(
        uint256 indexed pledgeId,
        address indexed borrower,
        AssetType indexed assetType,
        uint256 appraisedValue,
        uint256 nftTokenId
    );

    event PledgeApproved(
        uint256 indexed pledgeId,
        address indexed approver,
        uint256 tokenAmount
    );

    event PledgeRejected(
        uint256 indexed pledgeId,
        address indexed rejector,
        string reason
    );

    event TokensMinted(
        uint256 indexed pledgeId,
        address indexed borrower,
        address tokenContract,
        uint256 amount
    );

    event PledgeRedeemed(
        uint256 indexed pledgeId,
        address indexed borrower,
        uint256 tokensBurned
    );

    event PledgeDefaulted(
        uint256 indexed pledgeId,
        address indexed borrower,
        uint256 tokensOutstanding
    );

    // Core functions
    function createPledge(
        AssetType assetType,
        uint256 appraisedValue,
        AssetMetadata calldata metadata
    ) external returns (uint256 pledgeId);

    function approvePledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external;

    function rejectPledge(
        uint256 pledgeId,
        string calldata reason
    ) external;

    function mintTokens(
        uint256 pledgeId
    ) external returns (address tokenContract, uint256 amount);

    function redeemPledge(
        uint256 pledgeId,
        uint256 tokenAmount
    ) external;

    function defaultPledge(
        uint256 pledgeId
    ) external;

    // View functions
    function getPledgeInfo(uint256 pledgeId) external view returns (PledgeInfo memory);
    function getUserPledges(address user) external view returns (uint256[] memory);
    function getPendingPledges() external view returns (uint256[] memory);
    function getTotalPledges() external view returns (uint256);
    function getAssetTokenContract(AssetType assetType) external view returns (address);
}