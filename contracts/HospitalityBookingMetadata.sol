// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base64} from '@openzeppelin/contracts/utils/Base64.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

/**
 * @notice Stateless renderer deployed once by HospitalityBooking.
 * @dev Keeping rendering outside the escrow contract reduces the V3 runtime
 *      bytecode without introducing an upgrade or administration surface.
 */
contract HospitalityBookingMetadata {
  using Strings for uint256;

  struct TokenData {
    uint256 bookingId;
    uint256 listingId;
    uint256 roomTypeId;
    address host;
    address guest;
    uint32 checkInDay;
    uint32 checkOutDay;
    uint8 status;
    string imageURI;
    string listingURI;
    string roomName;
  }

  function tokenURI(TokenData calldata data) external pure returns (string memory) {
    bytes memory json = abi.encodePacked(
      '{"name":"Hospitality Stay #',
      data.bookingId.toString(),
      '","description":"Host-attested hospitality booking credential.","image":"',
      _escapeJSON(data.imageURI),
      '","external_url":"',
      _escapeJSON(data.listingURI),
      '","attributes":[',
      '{"trait_type":"Listing ID","value":"',
      data.listingId.toString(),
      '"},{"trait_type":"Room Type ID","value":"',
      data.roomTypeId.toString(),
      '"},{"trait_type":"Room Type","value":"',
      _escapeJSON(data.roomName),
      '"},{"trait_type":"Host","value":"',
      Strings.toHexString(uint160(data.host), 20),
      '"},{"trait_type":"Guest","value":"',
      Strings.toHexString(uint160(data.guest), 20),
      '"},{"trait_type":"CheckInDay","value":"',
      uint256(data.checkInDay).toString(),
      '"},{"trait_type":"CheckOutDay","value":"',
      uint256(data.checkOutDay).toString(),
      '"},{"trait_type":"Nights","value":"',
      uint256(data.checkOutDay - data.checkInDay).toString(),
      '"},{"trait_type":"Status","value":"',
      _statusName(data.status),
      '"}]}'
    );
    return string(abi.encodePacked('data:application/json;base64,', Base64.encode(json)));
  }

  function _escapeJSON(string memory value) private pure returns (string memory) {
    bytes memory input = bytes(value);
    bytes memory output = new bytes(input.length * 6);
    bytes16 symbols = '0123456789abcdef';
    uint256 length;

    for (uint256 i = 0; i < input.length; i++) {
      uint8 character = uint8(input[i]);
      if (character == 0x22 || character == 0x5c) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(character);
      } else if (character == 0x08) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x62));
      } else if (character == 0x0c) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x66));
      } else if (character == 0x0a) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x6e));
      } else if (character == 0x0d) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x72));
      } else if (character == 0x09) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x74));
      } else if (character < 0x20) {
        output[length++] = bytes1(uint8(0x5c));
        output[length++] = bytes1(uint8(0x75));
        output[length++] = bytes1(uint8(0x30));
        output[length++] = bytes1(uint8(0x30));
        output[length++] = symbols[character >> 4];
        output[length++] = symbols[character & 0x0f];
      } else {
        output[length++] = bytes1(character);
      }
    }
    assembly {
      mstore(output, length)
    }
    return string(output);
  }

  function _statusName(uint8 status) private pure returns (string memory) {
    if (status == 0) return 'Booked';
    if (status == 1) return 'Cancelled';
    if (status == 2) return 'CheckedIn';
    if (status == 3) return 'Completed';
    if (status == 4) return 'NoShow';
    if (status == 5) return 'Disputed';
    if (status == 6) return 'ResolvedGuest';
    return 'ResolvedHost';
  }
}
