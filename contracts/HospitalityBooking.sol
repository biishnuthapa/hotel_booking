// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {EIP712} from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import {HospitalityBookingMetadata} from './HospitalityBookingMetadata.sol';

/**
 * @title HospitalityBooking
 * @notice Immutable stable-token hospitality escrow with dual-path check-in.
 * @dev Dates are UTC epoch-day identifiers. A stay covers [checkInDay, checkOutDay).
 */
contract HospitalityBooking is
  AccessControl,
  Pausable,
  ReentrancyGuard,
  EIP712,
  ERC721
{
  using SafeERC20 for IERC20;

  error InvalidConfiguration();
  error InvalidInput();
  error InvalidURI();
  error NotFound();
  error Unauthorized();
  error InvalidState();
  error InvalidTiming();
  error CapacityExceeded();
  error PaymentMismatch();
  error NonTransferable();
  error InvalidPagination();
  error NoFunds();

  uint256 public constant BPS_DENOMINATOR = 10_000;
  uint256 public constant MAX_STAY_NIGHTS = 90;
  uint256 public constant MAX_PAGE_SIZE = 50;
  uint256 public constant CHECK_IN_WINDOW = 24 hours;
  uint256 private constant POST_CHECKOUT_DISPUTE_WINDOW = 24 hours;
  uint256 private constant DISPUTE_RESOLUTION_WINDOW = 7 days;
  int32 public constant MIN_SCHEDULE_OFFSET_MINUTES = -1_440;
  int32 public constant MAX_SCHEDULE_OFFSET_MINUTES = 2_880;

  bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');
  bytes32 public constant ARBITRATOR_ROLE = keccak256('ARBITRATOR_ROLE');
  bytes32 public constant CHECKIN_AUTH_TYPEHASH =
    keccak256(
      'CheckInAuthorization(uint256 bookingId,address guest,uint256 nonce,uint64 validAfter,uint64 validUntil)'
    );

  IERC20 public immutable paymentToken;
  uint8 public immutable paymentTokenDecimals;
  HospitalityBookingMetadata public immutable metadataRenderer;
  address public immutable platformTreasury;
  uint16 public immutable taxBps;
  uint16 public immutable securityDepositBps;
  uint16 public immutable disputeBondBps;

  enum BookingStatus {
    Booked,
    Cancelled,
    CheckedIn,
    Completed,
    NoShow,
    Disputed,
    ResolvedGuest,
    ResolvedHost
  }

  enum DisputeOutcome {
    GuestRefund,
    HostPayout
  }

  struct Listing {
    uint256 id;
    address owner;
    string name;
    string metadataURI;
    string imageURI;
    uint32 totalRooms;
    uint32 allocatedCapacity;
    int32 checkInOffsetMinutes;
    int32 checkOutOffsetMinutes;
    bool active;
    uint64 createdAt;
  }

  struct RoomType {
    uint256 id;
    uint256 listingId;
    string name;
    string metadataURI;
    uint256 pricePerNight;
    uint32 capacity;
    bool active;
  }

  struct Booking {
    uint256 id;
    uint256 listingId;
    uint256 roomTypeId;
    address host;
    address guest;
    uint32 rooms;
    uint32 checkInDay;
    uint32 checkOutDay;
    uint64 scheduledCheckIn;
    uint64 checkInDeadline;
    uint64 scheduledCheckout;
    uint256 pricePerNight;
    uint256 basePrice;
    uint256 securityDeposit;
    uint256 escrowedAmount;
    uint256 tokenId;
    uint256 authorizationNonce;
    BookingStatus status;
    bool hostAttested;
  }

  struct Dispute {
    uint64 deadline;
    bool afterCheckIn;
    bool openerIsGuest;
  }

  uint256 private _listingCount;
  uint256 private _roomTypeCount;
  uint256 private _bookingCount;

  mapping(uint256 => Listing) private _listings;
  mapping(uint256 => RoomType) private _roomTypes;
  mapping(uint256 => Booking) private _bookings;
  mapping(uint256 => Dispute) private _disputes;

  mapping(uint256 => uint256) public listingMaxActivePrice;
  mapping(uint256 => uint256[]) private _listingRoomTypeIds;
  mapping(uint256 => uint256[]) private _listingBookingIds;
  mapping(address => uint256[]) private _guestBookingIds;
  mapping(address => uint256[]) private _hostBookingIds;
  mapping(uint256 => mapping(uint32 => uint32)) public occupiedRoomsOnDay;
  mapping(uint256 => bytes32) public disputeEvidenceHash;

  mapping(address => uint256) public pendingWithdrawals;
  uint256 public totalActiveEscrow;
  uint256 public totalPendingWithdrawals;

  event ListingCreated(uint256 indexed listingId, address indexed owner, string name);
  event ListingUpdated(uint256 indexed listingId);
  event ListingActiveChanged(uint256 indexed listingId, bool active);
  event RoomTypeCreated(
    uint256 indexed roomTypeId,
    uint256 indexed listingId,
    uint256 pricePerNight,
    uint32 capacity
  );
  event RoomTypeUpdated(uint256 indexed roomTypeId);
  event RoomTypeActiveChanged(uint256 indexed roomTypeId, bool active);
  event BookingCreated(
    uint256 indexed bookingId,
    uint256 indexed listingId,
    address indexed guest,
    uint256 roomTypeId,
    uint32 checkInDay,
    uint32 checkOutDay,
    uint32 rooms,
    uint256 escrowedAmount
  );
  event BookingStatusChanged(
    uint256 indexed bookingId,
    BookingStatus previousStatus,
    BookingStatus newStatus
  );
  event CheckInAuthorizationRevoked(uint256 indexed bookingId, uint256 newNonce);
  event DisputeOpened(
    uint256 indexed bookingId,
    address indexed openedBy,
    bytes32 evidenceHash
  );
  event DisputeResolved(
    uint256 indexed bookingId,
    DisputeOutcome outcome,
    bytes32 reasonHash
  );
  event WithdrawalCredited(address indexed account, uint256 amount, uint256 indexed bookingId);
  event WithdrawalCompleted(address indexed account, uint256 amount);
  event ExcessPaymentTokenRecovered(uint256 amount);

  modifier onlyListingOwner(uint256 listingId) {
    if (_listings[listingId].id == 0) revert NotFound();
    if (_listings[listingId].owner != msg.sender) revert Unauthorized();
    _;
  }

  constructor(
    address paymentToken_,
    address platformTreasury_,
    uint16 taxBps_,
    uint16 securityDepositBps_,
    uint16 disputeBondBps_,
    address admin_,
    address pauser_,
    address arbitrator_
  ) ERC721('Hospitality Stay', 'HSTAY') EIP712('HospitalityBooking', '1') {
    if (
      paymentToken_ == address(0) ||
      platformTreasury_ == address(0) ||
      admin_ == address(0) ||
      pauser_ == address(0) ||
      arbitrator_ == address(0) ||
      taxBps_ > BPS_DENOMINATOR ||
      securityDepositBps_ > BPS_DENOMINATOR ||
      disputeBondBps_ == 0 ||
      disputeBondBps_ > BPS_DENOMINATOR
    ) revert InvalidConfiguration();

    paymentToken = IERC20(paymentToken_);
    paymentTokenDecimals = IERC20Metadata(paymentToken_).decimals();
    metadataRenderer = new HospitalityBookingMetadata();
    platformTreasury = platformTreasury_;
    taxBps = taxBps_;
    securityDepositBps = securityDepositBps_;
    disputeBondBps = disputeBondBps_;

    _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    _grantRole(PAUSER_ROLE, pauser_);
    _grantRole(ARBITRATOR_ROLE, arbitrator_);
  }

  // ---------------------------------------------------------------------------
  // Administration
  // ---------------------------------------------------------------------------

  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  function recoverExcessPaymentToken() external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
    uint256 liabilities = totalActiveEscrow + totalPendingWithdrawals;
    uint256 balance = paymentToken.balanceOf(address(this));
    if (balance <= liabilities) revert NoFunds();
    uint256 excess = balance - liabilities;
    paymentToken.safeTransfer(platformTreasury, excess);
    emit ExcessPaymentTokenRecovered(excess);
  }

  // ---------------------------------------------------------------------------
  // Listings and room types
  // ---------------------------------------------------------------------------

  function createListing(
    string calldata name,
    string calldata metadataURI,
    string calldata imageURI,
    uint32 totalRooms,
    int32 checkInOffsetMinutes,
    int32 checkOutOffsetMinutes
  ) external whenNotPaused returns (uint256 listingId) {
    if (bytes(name).length == 0 || bytes(imageURI).length == 0 || totalRooms == 0) {
      revert InvalidInput();
    }
    if (!_isIpfsURI(metadataURI)) revert InvalidURI();
    _validateScheduleOffset(checkInOffsetMinutes);
    _validateScheduleOffset(checkOutOffsetMinutes);

    listingId = ++_listingCount;
    _listings[listingId] = Listing({
      id: listingId,
      owner: msg.sender,
      name: name,
      metadataURI: metadataURI,
      imageURI: imageURI,
      totalRooms: totalRooms,
      allocatedCapacity: 0,
      checkInOffsetMinutes: checkInOffsetMinutes,
      checkOutOffsetMinutes: checkOutOffsetMinutes,
      active: true,
      createdAt: uint64(block.timestamp)
    });
    emit ListingCreated(listingId, msg.sender, name);
  }

  function updateListingMetadata(
    uint256 listingId,
    string calldata name,
    string calldata metadataURI,
    string calldata imageURI
  ) external whenNotPaused onlyListingOwner(listingId) {
    if (bytes(name).length == 0 || bytes(imageURI).length == 0) revert InvalidInput();
    if (!_isIpfsURI(metadataURI)) revert InvalidURI();
    Listing storage listing = _listings[listingId];
    listing.name = name;
    listing.metadataURI = metadataURI;
    listing.imageURI = imageURI;
    emit ListingUpdated(listingId);
  }

  function updateListingSchedule(
    uint256 listingId,
    int32 checkInOffsetMinutes,
    int32 checkOutOffsetMinutes
  ) external whenNotPaused onlyListingOwner(listingId) {
    _validateScheduleOffset(checkInOffsetMinutes);
    _validateScheduleOffset(checkOutOffsetMinutes);
    Listing storage listing = _listings[listingId];
    listing.checkInOffsetMinutes = checkInOffsetMinutes;
    listing.checkOutOffsetMinutes = checkOutOffsetMinutes;
    emit ListingUpdated(listingId);
  }

  function increaseListingRooms(
    uint256 listingId,
    uint32 newTotalRooms
  ) external whenNotPaused onlyListingOwner(listingId) {
    Listing storage listing = _listings[listingId];
    if (newTotalRooms <= listing.totalRooms) revert InvalidInput();
    listing.totalRooms = newTotalRooms;
    emit ListingUpdated(listingId);
  }

  function setListingActive(
    uint256 listingId,
    bool active
  ) external whenNotPaused onlyListingOwner(listingId) {
    _listings[listingId].active = active;
    emit ListingActiveChanged(listingId, active);
  }

  function addRoomType(
    uint256 listingId,
    string calldata name,
    string calldata metadataURI,
    uint256 pricePerNight,
    uint32 capacity
  ) external whenNotPaused onlyListingOwner(listingId) returns (uint256 roomTypeId) {
    if (bytes(name).length == 0 || pricePerNight == 0 || capacity == 0) revert InvalidInput();
    if (!_isIpfsURI(metadataURI)) revert InvalidURI();

    Listing storage listing = _listings[listingId];
    if (uint256(listing.allocatedCapacity) + capacity > listing.totalRooms) {
      revert CapacityExceeded();
    }

    roomTypeId = ++_roomTypeCount;
    _roomTypes[roomTypeId] = RoomType({
      id: roomTypeId,
      listingId: listingId,
      name: name,
      metadataURI: metadataURI,
      pricePerNight: pricePerNight,
      capacity: capacity,
      active: true
    });
    listing.allocatedCapacity += capacity;
    _listingRoomTypeIds[listingId].push(roomTypeId);
    if (pricePerNight > listingMaxActivePrice[listingId]) {
      listingMaxActivePrice[listingId] = pricePerNight;
    }
    emit RoomTypeCreated(roomTypeId, listingId, pricePerNight, capacity);
  }

  function updateRoomTypeMetadata(
    uint256 roomTypeId,
    string calldata name,
    string calldata metadataURI
  ) external whenNotPaused onlyListingOwner(_roomTypes[roomTypeId].listingId) {
    if (_roomTypes[roomTypeId].id == 0) revert NotFound();
    if (bytes(name).length == 0) revert InvalidInput();
    if (!_isIpfsURI(metadataURI)) revert InvalidURI();
    RoomType storage room = _roomTypes[roomTypeId];
    room.name = name;
    room.metadataURI = metadataURI;
    emit RoomTypeUpdated(roomTypeId);
  }

  function updateRoomTypePrice(
    uint256 roomTypeId,
    uint256 newPricePerNight
  ) external whenNotPaused onlyListingOwner(_roomTypes[roomTypeId].listingId) {
    if (_roomTypes[roomTypeId].id == 0) revert NotFound();
    if (newPricePerNight == 0) revert InvalidInput();
    _roomTypes[roomTypeId].pricePerNight = newPricePerNight;
    _refreshListingMaxPrice(_roomTypes[roomTypeId].listingId);
    emit RoomTypeUpdated(roomTypeId);
  }

  function increaseRoomTypeCapacity(
    uint256 roomTypeId,
    uint32 newCapacity
  ) external whenNotPaused onlyListingOwner(_roomTypes[roomTypeId].listingId) {
    RoomType storage room = _roomTypes[roomTypeId];
    if (room.id == 0) revert NotFound();
    if (newCapacity <= room.capacity) revert InvalidInput();
    Listing storage listing = _listings[room.listingId];
    uint32 increase = newCapacity - room.capacity;
    if (uint256(listing.allocatedCapacity) + increase > listing.totalRooms) {
      revert CapacityExceeded();
    }
    room.capacity = newCapacity;
    listing.allocatedCapacity += increase;
    emit RoomTypeUpdated(roomTypeId);
  }

  function setRoomTypeActive(
    uint256 roomTypeId,
    bool active
  ) external whenNotPaused onlyListingOwner(_roomTypes[roomTypeId].listingId) {
    if (_roomTypes[roomTypeId].id == 0) revert NotFound();
    _roomTypes[roomTypeId].active = active;
    _refreshListingMaxPrice(_roomTypes[roomTypeId].listingId);
    emit RoomTypeActiveChanged(roomTypeId, active);
  }

  // ---------------------------------------------------------------------------
  // Booking and settlement
  // ---------------------------------------------------------------------------

  function book(
    uint256 listingId,
    uint256 roomTypeId,
    uint32 rooms,
    uint32 checkInDay,
    uint32 checkOutDay
  ) external whenNotPaused nonReentrant returns (uint256 bookingId) {
    Listing storage listing = _listings[listingId];
    RoomType storage room = _roomTypes[roomTypeId];
    if (listing.id == 0 || !listing.active) revert InvalidState();
    if (room.id == 0 || !room.active || room.listingId != listingId) revert InvalidState();
    if (rooms == 0 || rooms > room.capacity) revert InvalidInput();

    uint256 nights = _validateStayRange(checkInDay, checkOutDay);
    uint64 scheduledCheckIn = _timestampForDay(checkInDay, listing.checkInOffsetMinutes);
    uint64 scheduledCheckout = _timestampForDay(checkOutDay, listing.checkOutOffsetMinutes);
    if (scheduledCheckIn <= block.timestamp || scheduledCheckout <= scheduledCheckIn) {
      revert InvalidTiming();
    }

    for (uint32 day = checkInDay; day < checkOutDay; day++) {
      if (uint256(occupiedRoomsOnDay[roomTypeId][day]) + rooms > room.capacity) {
        revert CapacityExceeded();
      }
    }

    uint256 basePrice = room.pricePerNight * rooms * nights;
    uint256 securityDeposit = (basePrice * securityDepositBps) / BPS_DENOMINATOR;
    uint256 escrowedAmount = basePrice + securityDeposit;

    _pullExact(msg.sender, escrowedAmount);

    for (uint32 day = checkInDay; day < checkOutDay; day++) {
      occupiedRoomsOnDay[roomTypeId][day] += rooms;
    }

    bookingId = ++_bookingCount;
    _bookings[bookingId] = Booking({
      id: bookingId,
      listingId: listingId,
      roomTypeId: roomTypeId,
      host: listing.owner,
      guest: msg.sender,
      rooms: rooms,
      checkInDay: checkInDay,
      checkOutDay: checkOutDay,
      scheduledCheckIn: scheduledCheckIn,
      checkInDeadline: uint64(uint256(scheduledCheckIn) + CHECK_IN_WINDOW),
      scheduledCheckout: scheduledCheckout,
      pricePerNight: room.pricePerNight,
      basePrice: basePrice,
      securityDeposit: securityDeposit,
      escrowedAmount: escrowedAmount,
      tokenId: bookingId,
      authorizationNonce: 0,
      status: BookingStatus.Booked,
      hostAttested: false
    });

    _listingBookingIds[listingId].push(bookingId);
    _guestBookingIds[msg.sender].push(bookingId);
    _hostBookingIds[listing.owner].push(bookingId);
    totalActiveEscrow += escrowedAmount;
    _safeMint(msg.sender, bookingId);

    emit BookingCreated(
      bookingId,
      listingId,
      msg.sender,
      roomTypeId,
      checkInDay,
      checkOutDay,
      rooms,
      escrowedAmount
    );
  }

  function cancelBooking(uint256 bookingId) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    if (msg.sender != booking.guest) revert Unauthorized();
    if (booking.status != BookingStatus.Booked) revert InvalidState();
    if (block.timestamp >= booking.scheduledCheckIn) revert InvalidTiming();

    _setStatus(booking, BookingStatus.Cancelled);
    _releaseInventory(booking);
    _burn(booking.tokenId);
    _removeEscrow(booking.escrowedAmount);

    uint256 hostShare = booking.securityDeposit / 2;
    uint256 platformShare = booking.securityDeposit - hostShare;
    _credit(booking.guest, booking.basePrice, bookingId);
    _credit(booking.host, hostShare, bookingId);
    _credit(platformTreasury, platformShare, bookingId);
  }

  /**
   * @notice Check in without a host signature.
   * @dev The guest controls this fallback path so a host cannot suppress
   *      check-in or later review eligibility by withholding authorization.
   *      The booking remains explicitly marked as unattested so downstream
   *      reputation systems can apply a lower evidentiary weight.
   */
  function checkIn(uint256 bookingId) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    _requireCheckInWindow(booking);
    _completeCheckIn(booking, bookingId, false);
  }

  /**
   * @notice Check in with the host's EIP-712 authorization.
   * @dev The authorization is single-use, guest-bound, time-bounded and
   *      revocable. This stronger proof receives the full attestation weight.
   */
  function checkInAttested(
    uint256 bookingId,
    uint64 validAfter,
    uint64 validUntil,
    uint256 nonce,
    bytes calldata signature
  ) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    _requireCheckInWindow(booking);
    if (
      validAfter < booking.scheduledCheckIn ||
      validUntil > booking.checkInDeadline ||
      validAfter > block.timestamp ||
      block.timestamp > validUntil
    ) revert InvalidTiming();
    if (nonce != booking.authorizationNonce) revert InvalidState();

    bytes32 structHash = keccak256(
      abi.encode(CHECKIN_AUTH_TYPEHASH, bookingId, booking.guest, nonce, validAfter, validUntil)
    );
    if (ECDSA.recover(_hashTypedDataV4(structHash), signature) != booking.host) {
      revert Unauthorized();
    }

    booking.authorizationNonce += 1;
    _completeCheckIn(booking, bookingId, true);
  }

  function _requireCheckInWindow(Booking storage booking) internal view {
    if (msg.sender != booking.guest) revert Unauthorized();
    if (booking.status != BookingStatus.Booked) revert InvalidState();
    if (
      block.timestamp < booking.scheduledCheckIn ||
      block.timestamp > booking.checkInDeadline
    ) revert InvalidTiming();
  }

  function _completeCheckIn(
    Booking storage booking,
    uint256 bookingId,
    bool attested
  ) internal {
    booking.hostAttested = attested;
    _setStatus(booking, BookingStatus.CheckedIn);
    _removeEscrow(booking.securityDeposit);
    _credit(booking.guest, booking.securityDeposit, bookingId);
  }

  function revokeCheckInAuthorization(uint256 bookingId) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    if (msg.sender != booking.host) revert Unauthorized();
    if (booking.status != BookingStatus.Booked) revert InvalidState();
    booking.authorizationNonce += 1;
    emit CheckInAuthorizationRevoked(bookingId, booking.authorizationNonce);
  }

  function settleNoShow(uint256 bookingId) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    if (booking.status != BookingStatus.Booked) revert InvalidState();
    if (block.timestamp <= booking.checkInDeadline) revert InvalidTiming();

    _setStatus(booking, BookingStatus.NoShow);
    _removeEscrow(booking.escrowedAmount);
    _creditHostPayout(booking, bookingId);
  }

  function completeStay(uint256 bookingId) external whenNotPaused {
    Booking storage booking = _requireBooking(bookingId);
    if (booking.status != BookingStatus.CheckedIn) revert InvalidState();
    if (block.timestamp <= _disputeWindowClosesAt(booking)) revert InvalidTiming();
    _setStatus(booking, BookingStatus.Completed);
    _removeEscrow(booking.basePrice);
    _creditCheckedInHostPayout(booking, bookingId);
  }

  function openDispute(
    uint256 bookingId,
    bytes32 evidenceHash
  ) external whenNotPaused nonReentrant {
    Booking storage booking = _requireBooking(bookingId);
    if (msg.sender != booking.guest && msg.sender != booking.host) revert Unauthorized();
    bool afterCheckIn = booking.status == BookingStatus.CheckedIn;
    if (!afterCheckIn && booking.status != BookingStatus.Booked) {
      revert InvalidState();
    }
    if (
      afterCheckIn &&
      block.timestamp > _disputeWindowClosesAt(booking)
    ) revert InvalidTiming();
    if (evidenceHash == bytes32(0)) revert InvalidInput();

    uint256 bond = _disputeBond(booking);
    uint64 resolutionDeadline = uint64(block.timestamp + DISPUTE_RESOLUTION_WINDOW);
    _pullExact(msg.sender, bond);
    totalActiveEscrow += bond;
    _disputes[bookingId] = Dispute(
      resolutionDeadline,
      afterCheckIn,
      msg.sender == booking.guest
    );
    disputeEvidenceHash[bookingId] = evidenceHash;
    _setStatus(booking, BookingStatus.Disputed);
    emit DisputeOpened(bookingId, msg.sender, evidenceHash);
  }

  function resolveDispute(
    uint256 bookingId,
    DisputeOutcome outcome,
    bytes32 reasonHash
  ) external whenNotPaused onlyRole(ARBITRATOR_ROLE) {
    Booking storage booking = _requireBooking(bookingId);
    if (booking.status != BookingStatus.Disputed) revert InvalidState();
    Dispute storage dispute = _disputes[bookingId];
    if (block.timestamp > dispute.deadline) revert InvalidTiming();
    if (reasonHash == bytes32(0)) revert InvalidInput();
    _resolveDispute(booking, outcome, reasonHash, dispute.afterCheckIn);
  }

  function resolveDisputeAfterDeadline(uint256 bookingId) external {
    Booking storage booking = _requireBooking(bookingId);
    if (booking.status != BookingStatus.Disputed) revert InvalidState();
    Dispute storage dispute = _disputes[bookingId];
    if (block.timestamp <= dispute.deadline) revert InvalidTiming();
    DisputeOutcome outcome = dispute.openerIsGuest
      ? DisputeOutcome.HostPayout
      : DisputeOutcome.GuestRefund;
    _resolveDispute(booking, outcome, bytes32(uint256(1)), dispute.afterCheckIn);
  }

  function disputeDeadline(uint256 bookingId) external view returns (uint64) {
    return _disputes[bookingId].deadline;
  }

  function withdraw() external nonReentrant {
    uint256 amount = pendingWithdrawals[msg.sender];
    if (amount == 0) revert NoFunds();
    pendingWithdrawals[msg.sender] = 0;
    totalPendingWithdrawals -= amount;
    paymentToken.safeTransfer(msg.sender, amount);
    emit WithdrawalCompleted(msg.sender, amount);
  }

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Bounded reads
  // ---------------------------------------------------------------------------

  function getListing(uint256 listingId) external view returns (Listing memory) {
    if (_listings[listingId].id == 0) revert NotFound();
    return _listings[listingId];
  }

  function getRoomType(uint256 roomTypeId) external view returns (RoomType memory) {
    if (_roomTypes[roomTypeId].id == 0) revert NotFound();
    return _roomTypes[roomTypeId];
  }

  function getBooking(uint256 bookingId) external view returns (Booking memory) {
    if (_bookings[bookingId].id == 0) revert NotFound();
    return _bookings[bookingId];
  }

  function totalListings() external view returns (uint256) {
    return _listingCount;
  }

  function totalRoomTypes() external view returns (uint256) {
    return _roomTypeCount;
  }

  function totalBookings() external view returns (uint256) {
    return _bookingCount;
  }

  function isAvailable(
    uint256 roomTypeId,
    uint32 rooms,
    uint32 checkInDay,
    uint32 checkOutDay
  ) external view returns (bool) {
    RoomType storage room = _roomTypes[roomTypeId];
    if (
      room.id == 0 ||
      !room.active ||
      !_listings[room.listingId].active ||
      rooms == 0 ||
      rooms > room.capacity
    ) return false;
    uint256 nights = uint256(checkOutDay) > checkInDay ? checkOutDay - checkInDay : 0;
    if (nights == 0 || nights > MAX_STAY_NIGHTS) return false;
    for (uint32 day = checkInDay; day < checkOutDay; day++) {
      if (uint256(occupiedRoomsOnDay[roomTypeId][day]) + rooms > room.capacity) return false;
    }
    return true;
  }

  // --- Index accessors (the lens paginates over these) -----------------------

  function listingRoomTypeCount(uint256 listingId) external view returns (uint256) {
    return _listingRoomTypeIds[listingId].length;
  }

  function listingRoomTypeAt(uint256 listingId, uint256 i) external view returns (uint256) {
    return _listingRoomTypeIds[listingId][i];
  }

  function listingBookingCount(uint256 listingId) external view returns (uint256) {
    return _listingBookingIds[listingId].length;
  }

  function listingBookingAt(uint256 listingId, uint256 i) external view returns (uint256) {
    return _listingBookingIds[listingId][i];
  }

  function guestBookingCount(address guest) external view returns (uint256) {
    return _guestBookingIds[guest].length;
  }

  function guestBookingAt(address guest, uint256 i) external view returns (uint256) {
    return _guestBookingIds[guest][i];
  }

  function hostBookingCount(address host) external view returns (uint256) {
    return _hostBookingIds[host].length;
  }

  function hostBookingAt(address host, uint256 i) external view returns (uint256) {
    return _hostBookingIds[host][i];
  }

  function liabilityBalance() external view returns (uint256) {
    return totalActiveEscrow + totalPendingWithdrawals;
  }

  function checkInAuthorizationDigest(
    uint256 bookingId,
    uint64 validAfter,
    uint64 validUntil,
    uint256 nonce
  ) external view returns (bytes32) {
    Booking storage booking = _bookings[bookingId];
    if (booking.id == 0) revert NotFound();
    bytes32 structHash = keccak256(
      abi.encode(CHECKIN_AUTH_TYPEHASH, bookingId, booking.guest, nonce, validAfter, validUntil)
    );
    return _hashTypedDataV4(structHash);
  }

  // ---------------------------------------------------------------------------
  // NFT metadata and transfer restrictions
  // ---------------------------------------------------------------------------

  function approve(address, uint256) public pure override {
    revert NonTransferable();
  }

  function setApprovalForAll(address, bool) public pure override {
    revert NonTransferable();
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (_ownerOf(tokenId) == address(0)) revert NotFound();
    Booking storage booking = _bookings[tokenId];
    Listing storage listing = _listings[booking.listingId];
    RoomType storage room = _roomTypes[booking.roomTypeId];
    return
      metadataRenderer.tokenURI(
        HospitalityBookingMetadata.TokenData({
          bookingId: tokenId,
          listingId: booking.listingId,
          roomTypeId: booking.roomTypeId,
          host: booking.host,
          guest: booking.guest,
          checkInDay: booking.checkInDay,
          checkOutDay: booking.checkOutDay,
          status: uint8(booking.status),
          imageURI: listing.imageURI,
          listingURI: listing.metadataURI,
          roomName: room.name
        })
      );
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(AccessControl, ERC721) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override returns (address from) {
    from = _ownerOf(tokenId);
    if (from != address(0) && to != address(0)) revert NonTransferable();
    return super._update(to, tokenId, auth);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function _isIpfsURI(string memory value) internal pure returns (bool) {
    bytes memory raw = bytes(value);
    if (raw.length < 8 || raw.length > 200) return false;
    return
      raw[0] == 'i' && raw[1] == 'p' && raw[2] == 'f' && raw[3] == 's' &&
      raw[4] == ':' && raw[5] == '/' && raw[6] == '/';
  }

  function _refreshListingMaxPrice(uint256 listingId) internal {
    uint256[] storage ids = _listingRoomTypeIds[listingId];
    uint256 best = 0;
    for (uint256 i = 0; i < ids.length; i++) {
      RoomType storage rt = _roomTypes[ids[i]];
      if (rt.active && rt.pricePerNight > best) best = rt.pricePerNight;
    }
    listingMaxActivePrice[listingId] = best;
  }

  function _requireBooking(uint256 bookingId) internal view returns (Booking storage booking) {
    booking = _bookings[bookingId];
    if (booking.id == 0) revert NotFound();
  }

  function _validateStayRange(
    uint32 checkInDay,
    uint32 checkOutDay
  ) internal pure returns (uint256 nights) {
    if (checkOutDay <= checkInDay) revert InvalidInput();
    nights = checkOutDay - checkInDay;
    if (nights > MAX_STAY_NIGHTS) revert InvalidInput();
  }

  function _validateScheduleOffset(int32 offsetMinutes) internal pure {
    if (
      offsetMinutes < MIN_SCHEDULE_OFFSET_MINUTES ||
      offsetMinutes > MAX_SCHEDULE_OFFSET_MINUTES
    ) revert InvalidInput();
  }

  function _timestampForDay(uint32 day, int32 offsetMinutes) internal pure returns (uint64) {
    int256 value = int256(uint256(day) * 1 days) + int256(offsetMinutes) * 1 minutes;
    if (value <= 0 || uint256(value) > type(uint64).max) revert InvalidInput();
    return uint64(uint256(value));
  }

  function _setStatus(Booking storage booking, BookingStatus next) internal {
    BookingStatus previous = booking.status;
    booking.status = next;
    emit BookingStatusChanged(booking.id, previous, next);
  }

  function _removeEscrow(uint256 amount) internal {
    totalActiveEscrow -= amount;
  }

  function _pullExact(address account, uint256 amount) internal {
    uint256 beforeBalance = paymentToken.balanceOf(address(this));
    paymentToken.safeTransferFrom(account, address(this), amount);
    if (paymentToken.balanceOf(address(this)) - beforeBalance != amount) {
      revert PaymentMismatch();
    }
  }

  function _credit(address account, uint256 amount, uint256 bookingId) internal {
    if (amount == 0) return;
    pendingWithdrawals[account] += amount;
    totalPendingWithdrawals += amount;
    emit WithdrawalCredited(account, amount, bookingId);
  }

  function _creditCheckedInHostPayout(
    Booking storage booking,
    uint256 bookingId
  ) internal {
    uint256 tax = (booking.basePrice * taxBps) / BPS_DENOMINATOR;
    _credit(booking.host, booking.basePrice - tax, bookingId);
    _credit(platformTreasury, tax, bookingId);
  }

  function _creditHostPayout(Booking storage booking, uint256 bookingId) internal {
    uint256 tax = (booking.basePrice * taxBps) / BPS_DENOMINATOR;
    _credit(booking.host, booking.basePrice - tax + booking.securityDeposit, bookingId);
    _credit(platformTreasury, tax, bookingId);
  }

  function _disputeWindowClosesAt(
    Booking storage booking
  ) internal view returns (uint256) {
    return uint256(booking.scheduledCheckout) + POST_CHECKOUT_DISPUTE_WINDOW;
  }

  function _disputeBond(Booking storage booking) internal view returns (uint256) {
    return
      (booking.escrowedAmount * disputeBondBps + BPS_DENOMINATOR - 1) /
      BPS_DENOMINATOR;
  }

  function _resolveDispute(
    Booking storage booking,
    DisputeOutcome outcome,
    bytes32 reasonHash,
    bool afterCheckIn
  ) internal {
    uint256 heldEscrow = afterCheckIn ? booking.basePrice : booking.escrowedAmount;
    uint256 bond = _disputeBond(booking);

    if (!afterCheckIn) _releaseInventory(booking);
    _removeEscrow(heldEscrow + bond);

    bool guestWins = outcome == DisputeOutcome.GuestRefund;
    _setStatus(
      booking,
      guestWins ? BookingStatus.ResolvedGuest : BookingStatus.ResolvedHost
    );
    if (guestWins) {
      // A stay that actually happened keeps its proof-of-stay token; only
      // pre-arrival resolutions burn it, matching the cancellation path.
      if (!afterCheckIn) _burn(booking.tokenId);
      _credit(booking.guest, heldEscrow + bond, booking.id);
    } else {
      if (afterCheckIn) {
        _creditCheckedInHostPayout(booking, booking.id);
      } else {
        _creditHostPayout(booking, booking.id);
      }
      _credit(booking.host, bond, booking.id);
    }
    emit DisputeResolved(booking.id, outcome, reasonHash);
  }

  function _releaseInventory(Booking storage booking) internal {
    for (uint32 day = booking.checkInDay; day < booking.checkOutDay; day++) {
      uint32 occupied = occupiedRoomsOnDay[booking.roomTypeId][day];
      if (occupied < booking.rooms) revert InvalidState();
      occupiedRoomsOnDay[booking.roomTypeId][day] = occupied - booking.rooms;
    }
  }


}
