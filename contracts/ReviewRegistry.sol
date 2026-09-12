// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {HospitalityBooking} from './HospitalityBooking.sol';

/**
 * @title ReviewRegistry
 * @notice Review-integrity layer for HospitalityBooking.
 *
 * @dev Eligibility is conferred by a settled stay in the booking contract, but
 *      a stay alone is not sufficient: a host can transact with themselves. This
 *      registry therefore prices the attack rather than claiming to prevent it,
 *      via three composable rules.
 *
 *      R1 — Value floor (anti price-dilution).
 *      A review counts only if the booking's paid value is at least
 *      `eligibilityBps` of the listing's own reference value, where the
 *      reference is the highest *active* nightly price the host currently
 *      advertises, times nights times rooms. A host cannot cheapen a fake
 *      review by adding a near-zero room type, because the reference is taken
 *      from the top of their own price list. Lowering the reference means
 *      lowering the prices real guests pay.
 *
 *      R2 — Saturating value weight.
 *      Weight rises linearly with paid value and saturates at `saturationBps`
 *      of the reference value, so buying influence costs linearly up to the
 *      listing's own asking price and nothing beyond it.
 *
 *      R4 — Attestation weight.
 *      The registry retains an explicit attestation factor. A record carrying
 *      a host attestation receives full weight; an unattested record receives
 *      `unattestedWeightBps`. The protocol currently exposes only host-attested check-in,
 *      but preserving this rule keeps the review mechanism and stored-booking
 *      provenance explicit.
 *
 *      R3 — Relationship discounts (observable self-dealing only).
 *      Weight is zeroed for a self-booking (guest == host) and for a reciprocal
 *      pair (the host has previously reviewed a listing owned by this guest —
 *      a two-cycle). A guest's second and subsequent reviews of the *same* host
 *      are capped at `repeatWeightBps`.
 *
 *      Deliberately NOT claimed: funding-source netting. `book()` pulls ERC-20
 *      from the guest, so the contract cannot observe where the guest's funds
 *      originated; a host funding a fresh wallet is invisible on-chain here.
 *      Detecting that requires an off-chain graph or a registered-funder design.
 *      Both weighted and unweighted aggregates are published so the effect of
 *      the mechanism can be measured directly.
 */
contract ReviewRegistry {
  error Unauthorized();
  error InvalidState();
  error InvalidInput();
  error InvalidURI();
  error NotEligible();
  error InvalidConfiguration();
  error InvalidPagination();

  uint256 public constant BPS_DENOMINATOR = 10_000;
  uint256 public constant MAX_PAGE_SIZE = 50;

  HospitalityBooking public immutable booking;
  uint16 public immutable eligibilityBps;
  uint16 public immutable saturationBps;
  uint16 public immutable repeatWeightBps;
  uint16 public immutable unattestedWeightBps;

  struct Review {
    uint256 bookingId;
    uint256 listingId;
    address reviewer;
    uint8 rating;
    uint16 weightBps;
    uint64 timestamp;
    string uri;
    bytes32 contentHash;
  }

  mapping(uint256 => Review) private _reviews;
  mapping(uint256 => bool) public reviewed;
  mapping(uint256 => uint256[]) private _listingReviewBookingIds;

  // Weighted aggregate (the mechanism) and unweighted aggregate (the baseline).
  mapping(uint256 => uint256) public listingWeightedRatingSum;
  mapping(uint256 => uint256) public listingWeightSum;
  mapping(uint256 => uint256) public listingRawRatingSum;
  mapping(uint256 => uint256) public listingRawCount;

  mapping(address => mapping(address => uint256)) public guestReviewsForHost;
  mapping(address => mapping(address => bool)) public hasReviewedHost;

  event ReviewSubmitted(
    uint256 indexed bookingId,
    uint256 indexed listingId,
    address indexed reviewer,
    uint8 rating,
    uint16 weightBps,
    string uri,
    bytes32 contentHash
  );

  constructor(
    HospitalityBooking booking_,
    uint16 eligibilityBps_,
    uint16 saturationBps_,
    uint16 repeatWeightBps_,
    uint16 unattestedWeightBps_
  ) {
    if (
      address(booking_) == address(0) ||
      eligibilityBps_ == 0 ||
      eligibilityBps_ > BPS_DENOMINATOR ||
      saturationBps_ == 0 ||
      saturationBps_ > BPS_DENOMINATOR ||
      repeatWeightBps_ > BPS_DENOMINATOR ||
      unattestedWeightBps_ == 0 ||
      unattestedWeightBps_ > BPS_DENOMINATOR
    ) revert InvalidConfiguration();
    booking = booking_;
    eligibilityBps = eligibilityBps_;
    saturationBps = saturationBps_;
    repeatWeightBps = repeatWeightBps_;
    unattestedWeightBps = unattestedWeightBps_;
  }

  /**
   * @notice Submit the single review permitted for a settled booking.
   * @dev Accepts every status in which the guest demonstrably occupied the room,
   *      including both dispute resolutions: a guest who wins an arbitration is
   *      the last person a review system should silence.
   */
  function submitReview(
    uint256 bookingId,
    uint8 rating,
    string calldata uri,
    bytes32 contentHash
  ) external {
    HospitalityBooking.Booking memory b = booking.getBooking(bookingId);
    if (b.id == 0) revert InvalidState();
    if (msg.sender != b.guest) revert Unauthorized();
    if (!_isReviewable(b.status)) revert InvalidState();
    if (reviewed[bookingId]) revert InvalidState();
    if (rating < 1 || rating > 5 || contentHash == bytes32(0)) revert InvalidInput();
    if (!_isIpfsURI(uri)) revert InvalidURI();

    uint256 referenceValue = _referenceValue(b);
    if (referenceValue > 0) {
      // R1: value floor, relative to the listing's own advertised top price.
      if (b.basePrice * BPS_DENOMINATOR < referenceValue * eligibilityBps) {
        revert NotEligible();
      }
    }

    uint16 weightBps = _weightFor(b, referenceValue);

    reviewed[bookingId] = true;
    _reviews[bookingId] = Review({
      bookingId: bookingId,
      listingId: b.listingId,
      reviewer: msg.sender,
      rating: rating,
      weightBps: weightBps,
      timestamp: uint64(block.timestamp),
      uri: uri,
      contentHash: contentHash
    });
    _listingReviewBookingIds[b.listingId].push(bookingId);

    listingWeightedRatingSum[b.listingId] += uint256(rating) * weightBps;
    listingWeightSum[b.listingId] += weightBps;
    listingRawRatingSum[b.listingId] += rating;
    listingRawCount[b.listingId] += 1;

    guestReviewsForHost[msg.sender][b.host] += 1;
    hasReviewedHost[msg.sender][b.host] = true;

    emit ReviewSubmitted(bookingId, b.listingId, msg.sender, rating, weightBps, uri, contentHash);
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  function getReview(uint256 bookingId) external view returns (Review memory) {
    return _reviews[bookingId];
  }

  /// @return ratingScaled Weighted mean rating scaled by BPS_DENOMINATOR (0 if no weighted reviews).
  function weightedRating(uint256 listingId) external view returns (uint256 ratingScaled) {
    uint256 w = listingWeightSum[listingId];
    if (w == 0) return 0;
    return (listingWeightedRatingSum[listingId] * BPS_DENOMINATOR) / w;
  }

  /// @return ratingScaled Unweighted mean rating scaled by BPS_DENOMINATOR (the baseline).
  function rawRating(uint256 listingId) external view returns (uint256 ratingScaled) {
    uint256 n = listingRawCount[listingId];
    if (n == 0) return 0;
    return (listingRawRatingSum[listingId] * BPS_DENOMINATOR) / n;
  }

  /// @notice Minimum booking value that would make a review of this listing count.
  function reviewEligibilityThreshold(
    uint256 listingId,
    uint256 nights,
    uint256 rooms
  ) external view returns (uint256) {
    uint256 refValue = booking.listingMaxActivePrice(listingId) * nights * rooms;
    return (refValue * eligibilityBps) / BPS_DENOMINATOR;
  }

  function listingReviewCount(uint256 listingId) external view returns (uint256) {
    return _listingReviewBookingIds[listingId].length;
  }

  function listingReviewAt(uint256 listingId, uint256 i) external view returns (uint256) {
    return _listingReviewBookingIds[listingId][i];
  }

  function getListingReviewIdsPage(
    uint256 listingId,
    uint256 cursor,
    uint256 limit
  ) external view returns (uint256[] memory page, uint256 nextCursor) {
    uint256[] storage ids = _listingReviewBookingIds[listingId];
    uint256 length = ids.length;
    if (limit == 0 || limit > MAX_PAGE_SIZE || cursor > length) revert InvalidPagination();
    uint256 end = cursor + limit;
    if (end > length) end = length;
    page = new uint256[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = ids[i];
    }
    nextCursor = end < length ? end : 0;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  function _isReviewable(HospitalityBooking.BookingStatus status) internal pure returns (bool) {
    return
      status == HospitalityBooking.BookingStatus.CheckedIn ||
      status == HospitalityBooking.BookingStatus.Completed ||
      status == HospitalityBooking.BookingStatus.ResolvedGuest ||
      status == HospitalityBooking.BookingStatus.ResolvedHost;
  }

  function _referenceValue(
    HospitalityBooking.Booking memory b
  ) internal view returns (uint256) {
    uint256 nights = uint256(b.checkOutDay) - uint256(b.checkInDay);
    return booking.listingMaxActivePrice(b.listingId) * nights * uint256(b.rooms);
  }

  function _weightFor(
    HospitalityBooking.Booking memory b,
    uint256 referenceValue
  ) internal view returns (uint16) {
    // R3a: a host reviewing their own listing carries no weight.
    if (b.guest == b.host) return 0;
    // R3b: reciprocal two-cycle between this guest and this host.
    if (hasReviewedHost[b.host][msg.sender]) return 0;

    // R2: saturating value weight.
    uint256 weight = BPS_DENOMINATOR;
    if (referenceValue > 0) {
      uint256 saturation = (referenceValue * saturationBps) / BPS_DENOMINATOR;
      if (saturation > 0) {
        weight = (b.basePrice * BPS_DENOMINATOR) / saturation;
        if (weight > BPS_DENOMINATOR) weight = BPS_DENOMINATOR;
      }
    }

    // R3c: concentration discount for repeat reviews of the same host.
    if (guestReviewsForHost[msg.sender][b.host] > 0 && weight > repeatWeightBps) {
      weight = repeatWeightBps;
    }

    // R4: an unattested check-in is weaker evidence than a host-attested one.
    if (!b.hostAttested) {
      weight = (weight * unattestedWeightBps) / BPS_DENOMINATOR;
    }
    return uint16(weight);
  }

  function _isIpfsURI(string calldata value) internal pure returns (bool) {
    bytes calldata raw = bytes(value);
    if (raw.length < 8 || raw.length > 200) return false;
    return
      raw[0] == 'i' && raw[1] == 'p' && raw[2] == 'f' && raw[3] == 's' &&
      raw[4] == ':' && raw[5] == '/' && raw[6] == '/';
  }
}
