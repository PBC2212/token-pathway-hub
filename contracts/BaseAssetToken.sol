// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IAssetMetadata.sol";

/**
 * @title BaseAssetToken
 * @dev Enhanced ERC20 token for tokenized real-world assets with metadata and compliance
 */
abstract contract BaseAssetToken is 
    ERC20, 
    ERC20Permit, 
    ERC20Pausable, 
    AccessControl, 
    ReentrancyGuard,
    IAssetMetadata 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    // Token to asset mapping - using imported AssetMetadata struct
    mapping(uint256 => AssetMetadata) public assets;
    mapping(address => uint256[]) public ownerAssets;
    
    // Compliance features
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => bool) public whitelistedAddresses;
    bool public complianceEnabled = true;
    
    uint256 internal _currentAssetId;
    uint256 public maxSupply;
    
    // Events
    event AssetTokenized(
        uint256 indexed assetId,
        address indexed owner,
        uint256 amount,
        string assetType,
        uint256 appraisedValue
    );
    
    event AssetMetadataUpdated(uint256 indexed assetId, string field, string newValue);
    event ComplianceStatusChanged(address indexed account, bool blacklisted);
    event SupplyCapUpdated(uint256 oldCap, uint256 newCap);
    
    // Custom errors
    error AssetNotExists(uint256 assetId);
    error InsufficientAllowance(uint256 requested, uint256 available);
    error BlacklistedAddress(address account);
    error ExceedsMaxSupply(uint256 requested, uint256 maxSupply);
    error InvalidAppraisalValue(uint256 value);
    error UnauthorizedTransfer(address from, address to);
    
    /**
     * @dev Constructor
     */
    constructor(
        string memory name,
        string memory symbol,
        address admin,
        uint256 _maxSupply
    ) ERC20(name, symbol) ERC20Permit(name) {
        require(admin != address(0), "Invalid admin address");
        require(_maxSupply > 0, "Max supply must be greater than 0");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        
        maxSupply = _maxSupply;
        _currentAssetId = 1;
    }
    
    /**
     * @dev Mint tokens representing a new asset
     */
    function mintAsset(
        address to,
        uint256 amount,
        string memory assetType,
        string memory description,
        string memory location,
        uint256 appraisedValue,
        string memory appraisalCompany,
        string memory documentHash
    ) public onlyRole(MINTER_ROLE) nonReentrant whenNotPaused returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(appraisedValue > 0, "Appraised value must be greater than zero");
        require(bytes(assetType).length > 0, "Asset type cannot be empty");
        
        if (totalSupply() + amount > maxSupply) {
            revert ExceedsMaxSupply(totalSupply() + amount, maxSupply);
        }
        
        // Compliance check
        if (complianceEnabled && blacklistedAddresses[to]) {
            revert BlacklistedAddress(to);
        }
        
        uint256 assetId = _currentAssetId++;
        
        // Store asset metadata
        assets[assetId] = AssetMetadata({
            assetType: assetType,
            description: description,
            location: location,
            appraisedValue: appraisedValue,
            appraisalDate: block.timestamp,
            appraisalCompany: appraisalCompany,
            documentHash: documentHash,
            isVerified: false,
            createdAt: block.timestamp
        });
        
        ownerAssets[to].push(assetId);
        
        _mint(to, amount);
        
        emit AssetTokenized(assetId, to, amount, assetType, appraisedValue);
        
        return assetId;
    }
    
    /**
     * @dev Update asset metadata (compliance role only)
     */
    function updateAssetMetadata(
        uint256 assetId,
        string memory field,
        string memory newValue
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) {
            revert AssetNotExists(assetId);
        }
        
        // Update specific fields based on field parameter
        if (keccak256(bytes(field)) == keccak256(bytes("description"))) {
            assets[assetId].description = newValue;
        } else if (keccak256(bytes(field)) == keccak256(bytes("location"))) {
            assets[assetId].location = newValue;
        } else if (keccak256(bytes(field)) == keccak256(bytes("appraisalCompany"))) {
            assets[assetId].appraisalCompany = newValue;
        } else if (keccak256(bytes(field)) == keccak256(bytes("documentHash"))) {
            assets[assetId].documentHash = newValue;
        }
        
        emit AssetMetadataUpdated(assetId, field, newValue);
    }
    
    /**
     * @dev Verify asset (compliance role only)
     */
    function verifyAsset(uint256 assetId) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) {
            revert AssetNotExists(assetId);
        }
        
        assets[assetId].isVerified = true;
        emit AssetMetadataUpdated(assetId, "verified", "true");
    }
    
    /**
     * @dev Update appraised value (compliance role only)
     */
    function updateAppraisedValue(
        uint256 assetId,
        uint256 newValue,
        string memory newAppraisalCompany
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) {
            revert AssetNotExists(assetId);
        }
        if (newValue == 0) {
            revert InvalidAppraisalValue(newValue);
        }
        
        assets[assetId].appraisedValue = newValue;
        assets[assetId].appraisalDate = block.timestamp;
        assets[assetId].appraisalCompany = newAppraisalCompany;
        
        emit AssetMetadataUpdated(assetId, "appraisedValue", _toString(newValue));
    }
    
    /**
     * @dev Compliance management
     */
    function setBlacklisted(address account, bool blacklisted) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        blacklistedAddresses[account] = blacklisted;
        emit ComplianceStatusChanged(account, blacklisted);
    }
    
    function setWhitelisted(address account, bool whitelisted) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        whitelistedAddresses[account] = whitelisted;
    }
    
    function setComplianceEnabled(bool enabled) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        complianceEnabled = enabled;
    }
    
    /**
     * @dev Pause/unpause functions
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Update max supply (admin only)
     */
    function updateMaxSupply(uint256 newMaxSupply) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newMaxSupply >= totalSupply(), "New max supply too low");
        
        uint256 oldMaxSupply = maxSupply;
        maxSupply = newMaxSupply;
        
        emit SupplyCapUpdated(oldMaxSupply, newMaxSupply);
    }
    
    /**
     * @dev Get asset metadata
     */
    function getAssetMetadata(uint256 assetId) 
        external 
        view 
        override
        returns (AssetMetadata memory) 
    {
        if (assets[assetId].createdAt == 0) {
            revert AssetNotExists(assetId);
        }
        return assets[assetId];
    }
    
    /**
     * @dev Get owner assets
     */
    function getOwnerAssets(address owner) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return ownerAssets[owner];
    }
    
    /**
     * @dev Get current asset ID
     */
    function getCurrentAssetId() external view returns (uint256) {
        return _currentAssetId;
    }
    
    /**
     * @dev Simple mint function (for compatibility with external contracts)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than zero");
        
        if (totalSupply() + amount > maxSupply) {
            revert ExceedsMaxSupply(totalSupply() + amount, maxSupply);
        }
        
        // Compliance check
        if (complianceEnabled && blacklistedAddresses[to]) {
            revert BlacklistedAddress(to);
        }
        
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from account (with allowance check)
     */
    function burnFrom(address from, uint256 amount) external {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than zero");
        
        uint256 currentAllowance = allowance(from, msg.sender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) {
                revert InsufficientAllowance(amount, currentAllowance);
            }
            _approve(from, msg.sender, currentAllowance - amount);
        }
        
        _burn(from, amount);
    }
    
    /**
     * @dev Override transfer functions for compliance
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
        
        // Skip compliance for minting and burning
        if (from == address(0) || to == address(0)) return;
        
        // Compliance checks
        if (complianceEnabled) {
            if (blacklistedAddresses[from] || blacklistedAddresses[to]) {
                revert UnauthorizedTransfer(from, to);
            }
        }
    }
    
    /**
     * @dev Utility function to convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @dev Returns the number of decimals
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
    
    // Required override for multiple inheritance
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}