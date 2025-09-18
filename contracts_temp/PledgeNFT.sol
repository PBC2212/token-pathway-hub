// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IPledgeNFT.sol";

/**
 * @title PledgeNFT
 * @dev NFT contract representing pledged real-world assets
 * @notice This contract creates NFTs that represent ownership of pledged physical assets
 */
contract PledgeNFT is 
    IPledgeNFT, 
    ERC721, 
    ERC721URIStorage, 
    ERC721Burnable, 
    AccessControl, 
    Pausable, 
    ReentrancyGuard,
    Initializable 
{
    using Counters for Counters.Counter;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    // State variables
    Counters.Counter private _tokenIdCounter;
    address public escrowContract;
    bool private _initialized;
    
    // NFT metadata
    mapping(uint256 => bytes32) public documentHashes;
    mapping(uint256 => uint256) public appraisedValues;
    mapping(uint256 => string) public assetTypes;
    mapping(uint256 => uint256) public pledgeIds;
    mapping(uint256 => uint256) public creationTimestamps;
    mapping(uint256 => address) public originalOwners; // Track original owners
    
    // Additional metadata
    mapping(uint256 => string) public assetDescriptions;
    mapping(uint256 => bool) public isVerified;
    mapping(uint256 => address) public verifiedBy;
    
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
        bytes32 newHash,
        address updatedBy
    );
    
    event AssetVerified(
        uint256 indexed tokenId,
        address indexed verifier,
        uint256 timestamp
    );
    
    event EscrowContractUpdated(
        address indexed oldEscrow,
        address indexed newEscrow
    );

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "PledgeNFT: caller is not escrow");
        _;
    }

    modifier onlyInitialized() {
        require(_initialized, "PledgeNFT: not initialized");
        _;
    }

    constructor() ERC721("", "") {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract (for proxy pattern)
     * @param name Name of the NFT collection
     * @param symbol Symbol of the NFT collection
     * @param _escrowContract Address of the escrow contract
     */
    function initialize(
        string memory name,
        string memory symbol,
        address _escrowContract
    ) external initializer {
        require(bytes(name).length > 0, "PledgeNFT: invalid name");
        require(bytes(symbol).length > 0, "PledgeNFT: invalid symbol");
        require(_escrowContract != address(0), "PledgeNFT: invalid escrow address");
        
        // Initialize ERC721 with proper name and symbol
        __ERC721_init(name, symbol);
        
        escrowContract = _escrowContract;
        _initialized = true;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(ESCROW_ROLE, _escrowContract);
        
        // Start token IDs at 1
        _tokenIdCounter.increment();
    }

    /**
     * @dev Internal function to initialize ERC721 for proxy pattern
     */
    function __ERC721_init(string memory name, string memory symbol) internal {
        ERC721Storage storage $ = _getERC721Storage();
        $._name = name;
        $._symbol = symbol;
    }

    /**
     * @dev Get ERC721 storage slot for proxy pattern
     */
    function _getERC721Storage() private pure returns (ERC721Storage storage $) {
        assembly {
            $.slot := 0
        }
    }

    struct ERC721Storage {
        mapping(uint256 => address) _owners;
        mapping(address => uint256) _balances;
        mapping(uint256 => address) _tokenApprovals;
        mapping(address => mapping(address => bool)) _operatorApprovals;
        string _name;
        string _symbol;
    }

    /**
     * @dev Override name function for proxy compatibility
     */
    function name() public view override returns (string memory) {
        if (_initialized) {
            ERC721Storage storage $ = _getERC721Storage();
            return $._name;
        }
        return "";
    }

    /**
     * @dev Override symbol function for proxy compatibility
     */
    function symbol() public view override returns (string memory) {
        if (_initialized) {
            ERC721Storage storage $ = _getERC721Storage();
            return $._symbol;
        }
        return "";
    }

    /**
     * @dev Mint NFT representing pledged asset
     * @param to Address to mint the NFT to
     * @param pledgeId ID of the associated pledge
     * @param assetType Type of asset being pledged
     * @param appraisedValue USD value of the asset
     * @param metadataURI URI for the NFT metadata
     * @param documentHash Hash of the asset documentation
     * @return tokenId The ID of the minted NFT
     */
    function mintPledgeNFT(
        address to,
        uint256 pledgeId,
        string memory assetType,
        uint256 appraisedValue,
        string memory metadataURI,
        bytes32 documentHash
    ) external onlyRole(MINTER_ROLE) whenNotPaused onlyInitialized nonReentrant returns (uint256) {
        require(to != address(0), "PledgeNFT: invalid recipient");
        require(pledgeId > 0, "PledgeNFT: invalid pledge ID");
        require(appraisedValue > 0, "PledgeNFT: invalid appraised value");
        require(documentHash != bytes32(0), "PledgeNFT: invalid document hash");
        require(bytes(assetType).length > 0, "PledgeNFT: invalid asset type");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Store asset metadata
        pledgeIds[tokenId] = pledgeId;
        assetTypes[tokenId] = assetType;
        appraisedValues[tokenId] = appraisedValue;
        documentHashes[tokenId] = documentHash;
        creationTimestamps[tokenId] = block.timestamp;
        originalOwners[tokenId] = to;
        assetDescriptions[tokenId] = metadataURI;

        // Mint NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit AssetPledged(tokenId, pledgeId, to, assetType, appraisedValue);

        return tokenId;
    }

    /**
     * @dev Update document hash for an NFT
     * @param tokenId ID of the NFT
     * @param newDocumentHash New document hash
     */
    function updateDocumentHash(
        uint256 tokenId,
        bytes32 newDocumentHash
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(newDocumentHash != bytes32(0), "PledgeNFT: invalid document hash");

        bytes32 oldHash = documentHashes[tokenId];
        documentHashes[tokenId] = newDocumentHash;

        emit DocumentUpdated(tokenId, oldHash, newDocumentHash, msg.sender);
    }

    /**
     * @dev Update appraised value (for re-appraisals)
     * @param tokenId ID of the NFT
     * @param newAppraisedValue New appraised value
     */
    function updateAppraisedValue(
        uint256 tokenId,
        uint256 newAppraisedValue
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(newAppraisedValue > 0, "PledgeNFT: invalid appraised value");

        appraisedValues[tokenId] = newAppraisedValue;
    }

    /**
     * @dev Update metadata URI
     * @param tokenId ID of the NFT
     * @param newURI New metadata URI
     */
    function updateTokenURI(
        uint256 tokenId,
        string memory newURI
    ) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(bytes(newURI).length > 0, "PledgeNFT: invalid URI");
        
        _setTokenURI(tokenId, newURI);
        assetDescriptions[tokenId] = newURI;
    }

    /**
     * @dev Verify an asset NFT
     * @param tokenId ID of the NFT to verify
     */
    function verifyAsset(uint256 tokenId) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(!isVerified[tokenId], "PledgeNFT: already verified");
        
        isVerified[tokenId] = true;
        verifiedBy[tokenId] = msg.sender;
        
        emit AssetVerified(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @dev Transfer NFT to escrow contract
     * @param tokenId ID of the NFT to transfer
     * @param _escrowContract Address of the escrow contract
     */
    function transferToEscrow(
        uint256 tokenId,
        address _escrowContract
    ) external onlyRole(ESCROW_ROLE) onlyInitialized {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        require(_escrowContract != address(0), "PledgeNFT: invalid escrow address");
        require(_escrowContract == escrowContract, "PledgeNFT: unauthorized escrow");

        address owner = ownerOf(tokenId);
        _transfer(owner, _escrowContract, tokenId);
    }

    /**
     * @dev Get NFT information
     * @param tokenId ID of the NFT
     * @return pledgeId Associated pledge ID
     * @return assetType Type of asset
     * @return appraisedValue Appraised value
     * @return documentHash Document hash
     * @return owner Current owner
     */
    function getAssetInfo(uint256 tokenId) 
        external 
        view 
        onlyInitialized
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
     * @dev Get extended asset information
     * @param tokenId ID of the NFT
     * @return pledgeId Associated pledge ID
     * @return assetType Type of asset
     * @return appraisedValue Appraised value
     * @return documentHash Document hash
     * @return owner Current owner
     * @return originalOwner Original owner
     * @return creationTime Creation timestamp
     * @return verified Whether asset is verified
     * @return verifier Address that verified the asset
     */
    function getExtendedAssetInfo(uint256 tokenId)
        external
        view
        onlyInitialized
        returns (
            uint256 pledgeId,
            string memory assetType,
            uint256 appraisedValue,
            bytes32 documentHash,
            address owner,
            address originalOwner,
            uint256 creationTime,
            bool verified,
            address verifier
        )
    {
        require(_exists(tokenId), "PledgeNFT: nonexistent token");
        
        return (
            pledgeIds[tokenId],
            assetTypes[tokenId],
            appraisedValues[tokenId],
            documentHashes[tokenId],
            ownerOf(tokenId),
            originalOwners[tokenId],
            creationTimestamps[tokenId],
            isVerified[tokenId],
            verifiedBy[tokenId]
        );
    }

    /**
     * @dev Get tokens owned by address
     * @param owner Address to query
     * @return tokenIds Array of token IDs owned by the address
     */
    function getTokensByOwner(address owner) external view onlyInitialized returns (uint256[] memory) {
        require(owner != address(0), "PledgeNFT: invalid owner address");
        
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 1; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
                if (index >= balance) break; // Optimization
            }
        }

        return tokenIds;
    }

    /**
     * @dev Get tokens by asset type
     * @param assetType Type of asset to filter by
     * @return tokenIds Array of token IDs of the specified asset type
     */
    function getTokensByAssetType(string memory assetType) 
        external 
        view 
        onlyInitialized 
        returns (uint256[] memory) 
    {
        require(bytes(assetType).length > 0, "PledgeNFT: invalid asset type");
        
        uint256 count = 0;
        uint256 totalSupply = _tokenIdCounter.current() - 1;
        
        // First pass: count matching tokens
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (_exists(i) && keccak256(bytes(assetTypes[i])) == keccak256(bytes(assetType))) {
                count++;
            }
        }
        
        // Second pass: populate array
        uint256[] memory tokenIds = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (_exists(i) && keccak256(bytes(assetTypes[i])) == keccak256(bytes(assetType))) {
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

    function setEscrowContract(address _escrowContract) external onlyRole(ADMIN_ROLE) onlyInitialized {
        require(_escrowContract != address(0), "PledgeNFT: invalid escrow address");
        
        address oldEscrow = escrowContract;
        
        // Revoke role from old escrow
        if (oldEscrow != address(0)) {
            _revokeRole(ESCROW_ROLE, oldEscrow);
        }
        
        // Grant role to new escrow
        _grantRole(ESCROW_ROLE, _escrowContract);
        escrowContract = _escrowContract;
        
        emit EscrowContractUpdated(oldEscrow, _escrowContract);
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
        delete creationTimestamps[tokenId];
        delete originalOwners[tokenId];
        delete assetDescriptions[tokenId];
        delete isVerified[tokenId];
        delete verifiedBy[tokenId];
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
        override(ERC721, ERC721URIStorage, AccessControl, IERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function totalSupply() external view override returns (uint256) {
        return _tokenIdCounter.current() - 1; // Subtract 1 because we start at 1
    }

    /**
     * @dev Check if contract is initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }

    /**
     * @dev Get contract information
     */
    function getContractInfo() external view returns (
        string memory contractName,
        string memory contractSymbol,
        address escrowAddress,
        uint256 totalMinted,
        bool isPaused
    ) {
        return (
            name(),
            symbol(),
            escrowContract,
            totalSupply(),
            paused()
        );
    }
}