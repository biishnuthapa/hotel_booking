// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** @dev Minimal compatibility helper for the read-only V1/V2 source builds. */
library LegacyCounters {
  struct Counter {
    uint256 _value;
  }

  function current(Counter storage counter) internal view returns (uint256) {
    return counter._value;
  }

  function increment(Counter storage counter) internal {
    unchecked {
      counter._value += 1;
    }
  }
}
