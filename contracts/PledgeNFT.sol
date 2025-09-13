// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PledgeNFT
 * @dev NFT contract representing pledged real-world assets
 */
contract PledgeNFT is ERC721, ERC721URIStorage, ERC721Burnable, AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    // State variables
    Counters.Counter private _tokenIdCounter;
    
    // NFT metadata
    mapping(uint256 => bytes32) public documentHashes;
    mapping(uint256 => uint256) public appraisedValues;
    mapping(uint256 => string) public assetTypes;
    mapping(uint256 => uint256) public pledgeIds;
    
    // Events
    event AssetPledged(
        uint256 indexed tokenId,
        uint256 indexed pledgeId,
        address indexed owner,
        string assetType,
        uint256 appraisedValue
    );
    
    event DocumentUpdated(
        uint256 indexed tokenId,
        bytes32 oldHash,
        bytes32 newHash
    );

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Start token IDs at 1
        _tokenIdCounter.increment();
    }

    /**
     * @dev Mint NFT representing pledged asset
     */
    function mintPledgeNFT(
        address to,
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        string memory metadataURI,
        bytes32 documentHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(to != address(0), "PledgeNFT: invalid recipient");
        require(appraisedValue > 0, "PledgeNFT: invalid appraised value");
        require(documentHash != bytes32(0), "PledgeNFT: invalid document hash");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Store asset metadata
        pledgeIds[tokenId] = pledgeId;
        assetTypes[tokenId] = assetType;
        appraisedValues[tokenId] = appraisedValue;
        documentHashes[tokenId] = documentHash;

        // Mint NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit AssetPledged(tokenId, pledgeId, to, assetType, appraisedValue);

        return tokenId;
    }

    /**
     * @dev Update document hash for an NFT
     */
    function updateDocumentHash(
        uint256 tokenId,
        bytes32 newDocumentHash
    ) external onlyRole(ADMIN_ROLE) {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(newDocumentHash != bytes32(0), "PledgeNFT: invalid document hash");

        bytes32 oldHash = documentHashes[tokenId];
        documentHashes[tokenId] = newDocumentHash;

        emit DocumentUpdated(tokenId, oldHash, newDocumentHash);
    }

    /**
     * @dev Update appraised value (for re-appraisals)
     */
    function updateAppraisedValue(
        uint256 tokenId,
        uint256 newAppraisedValue
    ) external onlyRole(ADMIN_ROLE) {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(newAppraisedValue > 0, "PledgeNFT: invalid appraised value");

        appraisedValues[tokenId] = newAppraisedValue;
    }

    /**
     * @dev Update metadata URI
     */
    function updateTokenURI(
        uint256 tokenId,
        string memory newURI
    ) external onlyRole(ADMIN_ROLE) {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        _setTokenURI(tokenId, newURI);
    }

    /**
     * @dev Transfer NFT to escrow contract
     */
    function transferToEscrow(
        uint256 tokenId,
        address escrowContract
    ) external onlyRole(ESCROW_ROLE) {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(escrowContract != address(0), "PledgeNFT: invalid escrow address");

        address owner = ownerOf(tokenId);
        _transfer(owner, escrowContract, tokenId);
    }

    /**
     * @dev Get NFT information
     */
    function getAssetInfo(uint256 tokenId) 
        external 
        view 
        returns (
            uint256 pledgeId,
            string memory assetType,
            uint256 appraisedValue,
            bytes32 documentHash,
            address owner
        ) 
    {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        
        return (
            pledgeIds[tokenId],
            assetTypes[tokenId],
            appraisedValues[tokenId],
            documentHashes[tokenId],
            ownerOf(tokenId)
        );
    }

    /**
     * @dev Get tokens owned by address
     */
    function getTokensByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 1; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
            }
        }

        return tokenIds;
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

    function setEscrowContract(address escrowContract) external onlyRole(ADMIN_ROLE) {
        require(escrowContract != address(0), "PledgeNFT: invalid escrow address");
        _grantRole(ESCROW_ROLE, escrowContract);
    }

    // Override functions
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
        
        // Clean up metadata
        delete pledgeIds[tokenId];
        delete assetTypes[tokenId];
        delete appraisedValues[tokenId];
        delete documentHashes[tokenId];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current() - 1; // Subtract 1 because we start at 1
    }
}