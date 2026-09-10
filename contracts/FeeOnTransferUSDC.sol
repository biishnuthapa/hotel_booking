// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/** @notice Test-only token used to prove V3 rejects transfer-fee assets. */
contract FeeOnTransferUSDC is ERC20 {
  constructor() ERC20('Fee USD Coin', 'fUSDC') {}

  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && to != address(0)) {
      uint256 fee = value / 100;
      super._update(from, to, value - fee);
      if (fee > 0) super._update(from, address(0), fee);
      return;
    }
    super._update(from, to, value);
  }
}
