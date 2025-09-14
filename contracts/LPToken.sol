// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LPToken
 * @dev ERC20 token representing liquidity pool shares
 */
contract LPToken is ERC20, Ownable {
    address public pool;
    
    modifier onlyPool() {
        require(msg.sender == pool, "LPToken: caller is not the pool");
        _;
    }
    
    constructor(
        string memory name,
        string memory symbol,
        address _pool
    ) ERC20(name, symbol) Ownable() {
        pool = _pool;
        _transferOwnership(_pool); // Transfer ownership to the pool contract
    }
    
    /**
     * @dev Mint LP tokens to account (only callable by pool)
     */
    function mint(address to, uint256 amount) external onlyPool {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn LP tokens from account (only callable by pool)
     */
    function burn(address from, uint256 amount) external onlyPool {
        _burn(from, amount);
    }
    
    /**
     * @dev Update pool address (only owner)
     */
    function setPool(address _pool) external onlyOwner {
        require(_pool != address(0), "LPToken: invalid pool address");
        pool = _pool;
    }
}