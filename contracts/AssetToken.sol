// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title AssetToken
 * @dev ERC20 token representing tokenized real-world assets
 * Only accounts with MINTER_ROLE can mint new tokens
 */
contract AssetToken is ERC20, AccessControl, ERC20Permit {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    event TokensMinted(address indexed to, uint256 amount, string assetType, uint256 appraisedValue);
    
    /**
     * @dev Constructor sets the token name and symbol
     * @param name Token name (e.g., "Real Estate Token")
     * @param symbol Token symbol (e.g., "RET")
     * @param admin Address that will have admin role and initial minter role
     */
    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC20(name, symbol) ERC20Permit(name) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }
    
    /**
     * @dev Mint tokens to a specific address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     * @param assetType Type of asset being tokenized
     * @param appraisedValue USD value of the underlying asset
     */
    function mint(
        address to, 
        uint256 amount, 
        string memory assetType, 
        uint256 appraisedValue
    ) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "AssetToken: mint to zero address");
        require(amount > 0, "AssetToken: mint amount must be greater than 0");
        require(bytes(assetType).length > 0, "AssetToken: asset type cannot be empty");
        require(appraisedValue > 0, "AssetToken: appraised value must be greater than 0");
        
        _mint(to, amount);
        
        emit TokensMinted(to, amount, assetType, appraisedValue);
    }
    
    /**
     * @dev Batch mint tokens to multiple addresses
     * @param recipients Array of addresses to mint tokens to
     * @param amounts Array of amounts to mint to each address
     */
    function batchMint(
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyRole(MINTER_ROLE) {
        require(recipients.length == amounts.length, "AssetToken: arrays length mismatch");
        require(recipients.length > 0, "AssetToken: empty arrays");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "AssetToken: mint to zero address");
            require(amounts[i] > 0, "AssetToken: mint amount must be greater than 0");
            _mint(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev Returns the number of decimals used by the token
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
    
    /**
     * @dev Grant minter role to an address
     * @param minter Address to grant minter role to
     */
    function grantMinterRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Revoke minter role from an address
     * @param minter Address to revoke minter role from
     */
    function revokeMinterRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Check if an address has minter role
     * @param account Address to check
     */
    function isMinter(address account) public view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }
}