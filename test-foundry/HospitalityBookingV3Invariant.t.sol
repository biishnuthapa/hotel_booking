// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '../contracts/HospitalityBookingV3.sol';
import '../contracts/MockUSDC.sol';

interface Vm {
  function warp(uint256 timestamp) external;

  function addr(uint256 privateKey) external returns (address);

  function prank(address sender) external;

  function sign(
    uint256 privateKey,
    bytes32 digest
  ) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract V3InvariantHandler {
  Vm private constant vm = Vm(address(uint160(uint256(keccak256('hevm cheat code')))));

  MockUSDC public immutable token;
  HospitalityBookingV3 public immutable booking;
  uint256 private constant HOST_PRIVATE_KEY = 0xBEEF;
  address public immutable host;
  uint32 public minDay;
  uint32 public maxDay;
  mapping(uint256 => uint8) public terminalSettlementCount;
  mapping(bytes32 => uint8) public authorizationUseCount;
  bool public authorizationReuseDetected;
  bool public reviewReuseDetected;
  bool public paginationBoundViolation;

  constructor() {
    host = vm.addr(HOST_PRIVATE_KEY);
    token = new MockUSDC();
    booking = new HospitalityBookingV3(
      address(token),
      address(this),
      700,
      500,
      200,
      address(this),
      address(this),
      address(this)
    );
    vm.prank(host);
    booking.createListing('Invariant Hotel', 'ipfs://listing', 'ipfs://image', 10, 0, 0);
    vm.prank(host);
    booking.addRoomType(1, 'Room', 'ipfs://room', 1_000_001, 10);
    token.mint(address(this), type(uint128).max);
    token.approve(address(booking), type(uint256).max);
    minDay = uint32(block.timestamp / 1 days) + 1;
    maxDay = minDay;
  }

  function book(uint8 startOffset, uint8 nightsSeed, uint8 roomsSeed) external {
    uint32 checkInDay = uint32(block.timestamp / 1 days) + 1 + uint32(startOffset % 30);
    uint32 nights = 1 + uint32(nightsSeed % 14);
    uint32 rooms = 1 + uint32(roomsSeed % 10);
    uint32 checkOutDay = checkInDay + nights;
    if (checkInDay < minDay) minDay = checkInDay;
    if (checkOutDay > maxDay) maxDay = checkOutDay;
    try booking.book(1, 1, rooms, checkInDay, checkOutDay) {} catch {}
  }

  function cancel(uint256 seed) external {
    uint256 count = booking.totalBookings();
    if (count == 0) return;
    uint256 bookingId = (seed % count) + 1;
    try booking.cancelBooking(bookingId) {
      terminalSettlementCount[bookingId] += 1;
    } catch {}
  }

  function disputeAndResolve(uint256 seed, bool hostOutcome) external {
    uint256 count = booking.totalBookings();
    if (count == 0) return;
    uint256 bookingId = (seed % count) + 1;
    try booking.openDispute(bookingId, keccak256(abi.encode(seed, hostOutcome))) {
      try
        booking.resolveDispute(
          bookingId,
          hostOutcome
            ? HospitalityBookingV3.DisputeOutcome.HostPayout
            : HospitalityBookingV3.DisputeOutcome.GuestRefund,
          keccak256(abi.encode('reason', seed))
        )
      {
        terminalSettlementCount[bookingId] += 1;
      } catch {}
    } catch {}
  }

  function settleNoShow(uint256 seed) external {
    uint256 count = booking.totalBookings();
    if (count == 0) return;
    uint256 bookingId = (seed % count) + 1;
    try booking.getBooking(bookingId) returns (HospitalityBookingV3.Booking memory record) {
      if (record.status != HospitalityBookingV3.BookingStatus.Booked) return;
      if (block.timestamp <= record.checkInDeadline) {
        vm.warp(uint256(record.checkInDeadline) + 1);
      }
      try booking.settleNoShow(bookingId) {
        terminalSettlementCount[bookingId] += 1;
      } catch {}
    } catch {}
  }

  function checkInAndComplete(uint256 seed) external {
    uint256 count = booking.totalBookings();
    if (count == 0) return;
    uint256 bookingId = (seed % count) + 1;
    try booking.getBooking(bookingId) returns (HospitalityBookingV3.Booking memory record) {
      if (
        record.status == HospitalityBookingV3.BookingStatus.Booked &&
        block.timestamp <= record.checkInDeadline
      ) {
        if (block.timestamp < record.scheduledCheckIn) vm.warp(record.scheduledCheckIn);
        bytes32 digest = booking.checkInAuthorizationDigest(
          bookingId,
          record.scheduledCheckIn,
          record.checkInDeadline,
          record.authorizationNonce
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(HOST_PRIVATE_KEY, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        bytes32 authorizationKey = keccak256(
          abi.encode(bookingId, record.authorizationNonce, digest)
        );
        try
          booking.checkIn(
            bookingId,
            record.scheduledCheckIn,
            record.checkInDeadline,
            record.authorizationNonce,
            signature
          )
        {
          authorizationUseCount[authorizationKey] += 1;
          if (authorizationUseCount[authorizationKey] > 1) {
            authorizationReuseDetected = true;
          }

          // Re-submit the exact same authorization to exercise replay resistance.
          try
            booking.checkIn(
              bookingId,
              record.scheduledCheckIn,
              record.checkInDeadline,
              record.authorizationNonce,
              signature
            )
          {
            authorizationUseCount[authorizationKey] += 1;
            authorizationReuseDetected = true;
          } catch {}
        } catch {}
      }

      HospitalityBookingV3.Booking memory current = booking.getBooking(bookingId);
      if (current.status == HospitalityBookingV3.BookingStatus.CheckedIn) {
        uint256 completionTime =
          uint256(current.scheduledCheckout) + 1 days + 1;
        if (block.timestamp < completionTime) vm.warp(completionTime);
        try booking.completeStay(bookingId) {
          terminalSettlementCount[bookingId] += 1;
        } catch {}
      }
    } catch {}
  }

  function submitReviewTwice(uint256 seed) external {
    uint256 count = booking.totalBookings();
    if (count == 0) return;
    uint256 bookingId = (seed % count) + 1;
    bytes32 contentHash = keccak256(abi.encode('review', bookingId));
    try booking.submitReview(bookingId, 5, 'ipfs://review', contentHash) {
      try booking.submitReview(bookingId, 5, 'ipfs://review', contentHash) {
        reviewReuseDetected = true;
      } catch {}
    } catch {}
  }

  function readBoundedPage(uint256 cursorSeed, uint8 limitSeed) external {
    uint256 count = booking.totalBookings();
    uint256 cursor = count == 0 ? 0 : cursorSeed % (count + 1);
    uint256 limit = 1 + uint256(limitSeed % 50);
    try booking.getGuestBookingIdsPage(address(this), cursor, limit) returns (
      uint256[] memory page,
      uint256 nextCursor
    ) {
      if (
        page.length > limit ||
        page.length > 50 ||
        (nextCursor != 0 && nextCursor <= cursor)
      ) paginationBoundViolation = true;
    } catch {
      paginationBoundViolation = true;
    }
  }

  function withdraw() external {
    try booking.withdraw() {} catch {}
  }
}

contract HospitalityBookingV3InvariantTest {
  V3InvariantHandler public handler;

  function setUp() public {
    handler = new V3InvariantHandler();
  }

  function targetContracts() external view returns (address[] memory targets) {
    targets = new address[](1);
    targets[0] = address(handler);
  }

  function invariant_tokenBalanceCoversAllLiabilities() public view {
    HospitalityBookingV3 booking = handler.booking();
    MockUSDC token = handler.token();
    assert(token.balanceOf(address(booking)) >= booking.liabilityBalance());
  }

  function invariant_activeEscrowMatchesUnsettledBookings() public view {
    HospitalityBookingV3 booking = handler.booking();
    uint256 expectedEscrow;
    uint256 count = booking.totalBookings();
    for (uint256 id = 1; id <= count; id++) {
      HospitalityBookingV3.Booking memory record = booking.getBooking(id);
      if (record.status == HospitalityBookingV3.BookingStatus.Booked) {
        expectedEscrow += record.escrowedAmount;
      } else if (record.status == HospitalityBookingV3.BookingStatus.CheckedIn) {
        expectedEscrow += record.basePrice;
      } else if (record.status == HospitalityBookingV3.BookingStatus.Disputed) {
        expectedEscrow += record.escrowedAmount;
        expectedEscrow +=
          (record.escrowedAmount * booking.disputeBondBps() + 9_999) /
          10_000;
      }
    }
    assert(expectedEscrow == booking.totalActiveEscrow());
  }

  function invariant_capacityNeverExceedsRoomLimit() public view {
    HospitalityBookingV3 booking = handler.booking();
    uint32 start = handler.minDay();
    uint32 end = handler.maxDay();
    for (uint32 day = start; day < end; day++) {
      assert(booking.occupiedRoomsOnDay(1, day) <= 10);
    }
  }

  function invariant_eachBookingHasAtMostOneTerminalSettlement() public view {
    HospitalityBookingV3 booking = handler.booking();
    uint256 count = booking.totalBookings();
    for (uint256 id = 1; id <= count; id++) {
      assert(handler.terminalSettlementCount(id) <= 1);
    }
  }

  function invariant_authorizationsAndReviewsCannotBeConsumedTwice() public view {
    assert(!handler.authorizationReuseDetected());
    assert(!handler.reviewReuseDetected());
  }

  function invariant_paginationWorkIsBoundedByPageSize() public view {
    assert(!handler.paginationBoundViolation());
  }
}
