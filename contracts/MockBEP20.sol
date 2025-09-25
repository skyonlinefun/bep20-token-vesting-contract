// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockBEP20
 * @dev Mock BEP20 token for testing purposes
 */
contract MockBEP20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }

    /**
     * @dev Mint tokens to a specific address (for testing)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}