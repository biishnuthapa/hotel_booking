// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

/** @notice Local/Amoy test token only. Never use this token on mainnet. */
contract MockUSDC is ERC20, Ownable {
  mapping(address => bool) public blockedRecipient;

  constructor() ERC20('Mock USD Coin', 'mUSDC') Ownable(msg.sender) {}

  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function setBlockedRecipient(address account, bool blocked) external onlyOwner {
    blockedRecipient[account] = blocked;
  }

  function _update(address from, address to, uint256 value) internal override {
    require(!blockedRecipient[to], 'MockUSDC: recipient blocked');
    super._update(from, to, value);
  }
}
