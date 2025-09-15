// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IAssetMetadata.sol";

/**
 * @title BaseAssetToken
 * @dev Enhanced ERC20 token for tokenized real-world assets with metadata and compliance
 * @notice This contract provides the foundation for all asset-specific token contracts
 */
abstract contract BaseAssetToken is 
    ERC20, 
    ERC20Permit, 
    ERC20Pausable, 
    AccessControl, 
    ReentrancyGuard,
    IAssetMetadata 
{
    using SafeMath for uint256;

    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    
    // Token to asset mapping
    mapping(uint256 => AssetMetadata) public assets;
    mapping(address => uint256[]) public ownerAssets;
    mapping(uint256 => address) public assetToOwner; // Track which address owns which asset
    mapping(address => uint256) public ownerAssetCount; // Count of assets per owner
    
    // Compliance features
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => bool) public whitelistedAddresses;
    mapping(address => uint256) public maxTransferAmount; // Per-address transfer limits
    mapping(address => uint256) public dailyTransferAmount; // Daily transfer tracking
    mapping(address => uint256) public lastTransferDay; // Last transfer day tracking
    bool public complianceEnabled = true;
    bool public whitelistRequired = false;
    bool public transferLimitsEnabled = false;
    
    uint256 internal _currentAssetId;
    uint256 public maxSupply;
    uint256 public maxHoldingAmount; // Maximum tokens one address can hold
    uint256 public minTransferAmount; // Minimum transfer amount
    uint256 public maxDailyTransfer = type(uint256).max; // Global daily transfer limit
    
    // Fee structure
    uint256 public transferFeeRate = 0; // Fee rate in basis points (0-10000)
    address public feeRecipient;
    bool public feesEnabled = false;
    
    // Asset backing tracking
    uint256 public totalAssetValue; // Total USD value of backing assets
    uint256 public averageAppraisalValue; // Average appraisal value
    
    // Events
    event AssetTokenized(
        uint256 indexed assetId,
        address indexed owner,
        uint256 amount,
        string assetType,
        uint256 appraisedValue
    );
    
    event AssetMetadataUpdated(
        uint256 indexed assetId, 
        string field, 
        string newValue
    );
    
    event ComplianceStatusChanged(
        address indexed account, 
        bool blacklisted
    );
    
    event SupplyCapUpdated(
        uint256 oldCap, 
        uint256 newCap
    );
    
    event TransferFeePaid(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee
    );
    
    event ComplianceConfigUpdated(
        bool complianceEnabled,
        bool whitelistRequired,
        bool transferLimitsEnabled
    );
    
    event TransferLimitsUpdated(
        uint256 maxHoldingAmount,
        uint256 minTransferAmount,
        uint256 maxDailyTransfer
    );

    // Custom errors
    error AssetNotExists(uint256 assetId);
    error InsufficientAllowance(uint256 requested, uint256 available);
    error BlacklistedAddress(address account);
    error NotWhitelisted(address account);
    error ExceedsMaxSupply(uint256 requested, uint256 maxSupply);
    error ExceedsMaxHolding(uint256 amount, uint256 maxHolding);
    error InvalidAppraisalValue(uint256 value);
    error UnauthorizedTransfer(address from, address to);
    error TransferAmountTooLow(uint256 amount, uint256 minimum);
    error DailyLimitExceeded(uint256 amount, uint256 limit);
    error InvalidFeeRate(uint256 rate);
    error ZeroAddress();
    error InvalidAmount(uint256 amount);

    /**
     * @dev Constructor
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param admin Address that will have admin role
     * @param _maxSupply Maximum supply of tokens
     */
    constructor(
        string memory name,
        string memory symbol,
        address admin,
        uint256 _maxSupply
    ) ERC20(name, symbol) ERC20Permit(name) {
        if (admin == address(0)) revert ZeroAddress();
        if (_maxSupply == 0) revert InvalidAmount(_maxSupply);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(TRANSFER_ROLE, admin);
        
        maxSupply = _maxSupply;
        _currentAssetId = 1;
        feeRecipient = admin; // Default fee recipient
        maxHoldingAmount = _maxSupply; // Default to max supply
        minTransferAmount = 1; // Default minimum transfer
    }
    
    /**
     * @dev Mint tokens representing a new asset
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @param assetType Type of asset being tokenized
     * @param description Description of the asset
     * @param location Location of the asset
     * @param appraisedValue USD value of the asset
     * @param appraisalCompany Company that appraised the asset
     * @param documentHash Hash of the asset documentation
     * @return assetId ID of the created asset
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
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        if (appraisedValue == 0) revert InvalidAppraisalValue(appraisedValue);
        if (bytes(assetType).length == 0) revert InvalidAmount(0);
        
        if (totalSupply().add(amount) > maxSupply) {
            revert ExceedsMaxSupply(totalSupply().add(amount), maxSupply);
        }
        
        if (balanceOf(to).add(amount) > maxHoldingAmount) {
            revert ExceedsMaxHolding(balanceOf(to).add(amount), maxHoldingAmount);
        }
        
        // Compliance check
        _checkComplianceForMint(to);
        
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
        
        // Update tracking mappings
        ownerAssets[to].push(assetId);
        assetToOwner[assetId] = to;
        ownerAssetCount[to] = ownerAssetCount[to].add(1);
        
        // Update totals
        totalAssetValue = totalAssetValue.add(appraisedValue);
        if (_currentAssetId > 1) {
            averageAppraisalValue = totalAssetValue.div(_currentAssetId.sub(1));
        } else {
            averageAppraisalValue = appraisedValue;
        }
        
        _mint(to, amount);
        
        emit AssetTokenized(assetId, to, amount, assetType, appraisedValue);
        
        return assetId;
    }
    
    /**
     * @dev Simple mint function (for compatibility with external contracts)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        if (totalSupply().add(amount) > maxSupply) {
            revert ExceedsMaxSupply(totalSupply().add(amount), maxSupply);
        }
        
        if (balanceOf(to).add(amount) > maxHoldingAmount) {
            revert ExceedsMaxHolding(balanceOf(to).add(amount), maxHoldingAmount);
        }
        
        // Compliance check
        _checkComplianceForMint(to);
        
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens with proper authorization
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) external nonReentrant {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        // Check if caller has BURNER_ROLE or sufficient allowance
        if (!hasRole(BURNER_ROLE, msg.sender)) {
            uint256 currentAllowance = allowance(from, msg.sender);
            if (currentAllowance != type(uint256).max) {
                if (currentAllowance < amount) {
                    revert InsufficientAllowance(amount, currentAllowance);
                }
                _approve(from, msg.sender, currentAllowance.sub(amount));
            }
        }
        
        _burn(from, amount);
    }
    
    /**
     * @dev Update asset metadata (compliance role only)
     * @param assetId ID of the asset to update
     * @param field Field to update
     * @param newValue New value for the field
     */
    function updateAssetMetadata(
        uint256 assetId,
        string memory field,
        string memory newValue
    ) external onlyRole(COMPLIANCE_ROLE) {
        if (assets[assetId].createdAt == 0) {
            revert AssetNotExists(assetId);
        }
        
        bytes32 fieldHash = keccak256(bytes(field));
        
        if (fieldHash == keccak256(bytes("description"))) {
            assets[assetId].description = newValue;
        } else if (fieldHash == keccak256(bytes("location"))) {
            assets[assetId].location = newValue;
        } else if (fieldHash == keccak256(bytes("appraisalCompany"))) {
            assets[assetId].appraisalCompany = newValue;
        } else if (fieldHash == keccak256(bytes("documentHash"))) {
            assets[assetId].documentHash = newValue;
        }
        
        emit AssetMetadataUpdated(assetId, field, newValue);
    }
    
    /**
     * @dev Verify asset (compliance role only)
     * @param assetId ID of the asset to verify
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
     * @param assetId ID of the asset
     * @param newValue New appraised value
     * @param newAppraisalCompany New appraisal company
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
        
        uint256 oldValue = assets[assetId].appraisedValue;
        assets[assetId].appraisedValue = newValue;
        assets[assetId].appraisalDate = block.timestamp;
        assets[assetId].appraisalCompany = newAppraisalCompany;
        
        // Update total asset value
        totalAssetValue = totalAssetValue.sub(oldValue).add(newValue);
        if (_currentAssetId > 1) {
            averageAppraisalValue = totalAssetValue.div(_currentAssetId.sub(1));
        }
        
        emit AssetMetadataUpdated(assetId, "appraisedValue", _toString(newValue));
    }
    
    /**
     * @dev Compliance management functions
     */
    function setBlacklisted(address account, bool blacklisted) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        if (account == address(0)) revert ZeroAddress();
        blacklistedAddresses[account] = blacklisted;
        emit ComplianceStatusChanged(account, blacklisted);
    }
    
    function setWhitelisted(address account, bool whitelisted) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        if (account == address(0)) revert ZeroAddress();
        whitelistedAddresses[account] = whitelisted;
    }
    
    function setComplianceConfig(
        bool _complianceEnabled,
        bool _whitelistRequired,
        bool _transferLimitsEnabled
    ) external onlyRole(COMPLIANCE_ROLE) {
        complianceEnabled = _complianceEnabled;
        whitelistRequired = _whitelistRequired;
        transferLimitsEnabled = _transferLimitsEnabled;
        
        emit ComplianceConfigUpdated(_complianceEnabled, _whitelistRequired, _transferLimitsEnabled);
    }
    
    /**
     * @dev Transfer limit management
     */
    function setTransferLimits(
        uint256 _maxHoldingAmount,
        uint256 _minTransferAmount,
        uint256 _maxDailyTransfer
    ) external onlyRole(COMPLIANCE_ROLE) {
        maxHoldingAmount = _maxHoldingAmount;
        minTransferAmount = _minTransferAmount;
        maxDailyTransfer = _maxDailyTransfer;
        
        emit TransferLimitsUpdated(_maxHoldingAmount, _minTransferAmount, _maxDailyTransfer);
    }
    
    function setMaxTransferAmount(address account, uint256 amount) 
        external 
        onlyRole(COMPLIANCE_ROLE) 
    {
        if (account == address(0)) revert ZeroAddress();
        maxTransferAmount[account] = amount;
    }
    
    /**
     * @dev Fee management
     */
    function setTransferFee(uint256 _feeRate, address _feeRecipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (_feeRate > 1000) revert InvalidFeeRate(_feeRate); // Max 10%
        if (_feeRecipient == address(0)) revert ZeroAddress();
        
        transferFeeRate = _feeRate;
        feeRecipient = _feeRecipient;
        feesEnabled = _feeRate > 0;
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
        if (newMaxSupply < totalSupply()) revert InvalidAmount(newMaxSupply);
        
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
        override
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
     * @dev Get token statistics
     */
    function getTokenStatistics() external view returns (
        uint256 currentSupply,
        uint256 maxSupplyLimit,
        uint256 totalAssets,
        uint256 totalValueBacking,
        uint256 avgAppraisalValue,
        uint256 utilizationRate
    ) {
        currentSupply = totalSupply();
        maxSupplyLimit = maxSupply;
        totalAssets = _currentAssetId > 0 ? _currentAssetId.sub(1) : 0;
        totalValueBacking = totalAssetValue;
        avgAppraisalValue = averageAppraisalValue;
        utilizationRate = maxSupply > 0 ? currentSupply.mul(10000).div(maxSupply) : 0; // In basis points
    }
    
    /**
     * @dev Internal compliance checks
     */
    function _checkComplianceForMint(address to) internal view {
        if (complianceEnabled && blacklistedAddresses[to]) {
            revert BlacklistedAddress(to);
        }
        
        if (whitelistRequired && !whitelistedAddresses[to]) {
            revert NotWhitelisted(to);
        }
    }
    
    function _checkComplianceForTransfer(address from, address to, uint256 amount) internal {
        if (complianceEnabled) {
            if (blacklistedAddresses[from] || blacklistedAddresses[to]) {
                revert UnauthorizedTransfer(from, to);
            }
        }
        
        if (whitelistRequired) {
            if (!whitelistedAddresses[from] || !whitelistedAddresses[to]) {
                revert UnauthorizedTransfer(from, to);
            }
        }
        
        if (transferLimitsEnabled) {
            if (amount < minTransferAmount) {
                revert TransferAmountTooLow(amount, minTransferAmount);
            }
            
            if (balanceOf(to).add(amount) > maxHoldingAmount) {
                revert ExceedsMaxHolding(balanceOf(to).add(amount), maxHoldingAmount);
            }
            
            // Check daily limits
            uint256 currentDay = block.timestamp.div(86400); // 24 hours
            if (lastTransferDay[from] != currentDay) {
                dailyTransferAmount[from] = 0;
                lastTransferDay[from] = currentDay;
            }
            
            if (dailyTransferAmount[from].add(amount) > maxDailyTransfer) {
                revert DailyLimitExceeded(amount, maxDailyTransfer);
            }
            
            // Check per-address limits
            if (maxTransferAmount[from] > 0 && amount > maxTransferAmount[from]) {
                revert DailyLimitExceeded(amount, maxTransferAmount[from]);
            }
        }
    }
    
    /**
     * @dev Override transfer functions for compliance and fees
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
        
        // Skip compliance for minting and burning
        if (from == address(0) || to == address(0)) return;
        
        _checkComplianceForTransfer(from, to, amount);
    }
    
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // Handle transfer fees
        if (feesEnabled && transferFeeRate > 0 && from != address(0) && to != address(0)) {
            uint256 fee = amount.mul(transferFeeRate).div(10000);
            uint256 amountAfterFee = amount.sub(fee);
            
            if (fee > 0) {
                super._transfer(from, feeRecipient, fee);
                emit TransferFeePaid(from, to, amount, fee);
            }
            
            super._transfer(from, to, amountAfterFee);
            
            // Update daily transfer tracking
            if (transferLimitsEnabled) {
                dailyTransferAmount[from] = dailyTransferAmount[from].add(amount);
            }
        } else {
            super._transfer(from, to, amount);
            
            // Update daily transfer tracking
            if (transferLimitsEnabled && from != address(0)) {
                dailyTransferAmount[from] = dailyTransferAmount[from].add(amount);
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
            temp = temp.div(10);
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits = digits.sub(1);
            buffer[digits] = bytes1(uint8(48 + uint256(value.mod(10))));
            value = value.div(10);
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