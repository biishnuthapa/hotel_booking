// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {HospitalityBooking} from './HospitalityBooking.sol';
import {ReviewRegistry} from './ReviewRegistry.sol';

/**
 * @title BookingLens
 * @notice Stateless read layer for HospitalityBooking and ReviewRegistry.
 * @dev Separated from the core so the booking contract stays inside the
 *      24,576-byte EVM runtime limit. Every page reads at most `limit`
 *      entries and never filters while scanning, so read cost is bounded by
 *      page size regardless of how many listings or room types have been
 *      deactivated. These are `view` functions intended for `eth_call`.
 */
contract BookingLens {
  error InvalidPagination();

  uint256 public constant MAX_PAGE_SIZE = 50;

  HospitalityBooking public immutable booking;
  ReviewRegistry public immutable reviews;

  struct RatedListing {
    HospitalityBooking.Listing listing;
    uint256 weightedRatingScaled;
    uint256 rawRatingScaled;
    uint256 reviewCount;
  }

  constructor(HospitalityBooking booking_, ReviewRegistry reviews_) {
    booking = booking_;
    reviews = reviews_;
  }

  function _window(
    uint256 cursor,
    uint256 limit,
    uint256 total
  ) private pure returns (uint256 end, uint256 nextCursor) {
    if (limit == 0 || limit > MAX_PAGE_SIZE || cursor > total) revert InvalidPagination();
    end = cursor + limit;
    if (end > total) end = total;
    nextCursor = end < total ? end : 0;
  }

  function getListingsPage(
    uint256 cursor,
    uint256 limit
  ) external view returns (HospitalityBooking.Listing[] memory page, uint256 nextCursor) {
    uint256 total = booking.totalListings();
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new HospitalityBooking.Listing[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = booking.getListing(i + 1);
    }
  }

  /// @notice Listings with both the weighted and unweighted rating, for side-by-side display.
  function getRatedListingsPage(
    uint256 cursor,
    uint256 limit
  ) external view returns (RatedListing[] memory page, uint256 nextCursor) {
    uint256 total = booking.totalListings();
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new RatedListing[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      uint256 listingId = i + 1;
      page[i - cursor] = RatedListing({
        listing: booking.getListing(listingId),
        weightedRatingScaled: reviews.weightedRating(listingId),
        rawRatingScaled: reviews.rawRating(listingId),
        reviewCount: reviews.listingRawCount(listingId)
      });
    }
  }

  function getListingRoomTypesPage(
    uint256 listingId,
    uint256 cursor,
    uint256 limit
  ) external view returns (HospitalityBooking.RoomType[] memory page, uint256 nextCursor) {
    uint256 total = booking.listingRoomTypeCount(listingId);
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new HospitalityBooking.RoomType[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = booking.getRoomType(booking.listingRoomTypeAt(listingId, i));
    }
  }

  function getListingBookingsPage(
    uint256 listingId,
    uint256 cursor,
    uint256 limit
  ) external view returns (HospitalityBooking.Booking[] memory page, uint256 nextCursor) {
    uint256 total = booking.listingBookingCount(listingId);
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new HospitalityBooking.Booking[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = booking.getBooking(booking.listingBookingAt(listingId, i));
    }
  }

  function getGuestBookingsPage(
    address guest,
    uint256 cursor,
    uint256 limit
  ) external view returns (HospitalityBooking.Booking[] memory page, uint256 nextCursor) {
    uint256 total = booking.guestBookingCount(guest);
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new HospitalityBooking.Booking[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = booking.getBooking(booking.guestBookingAt(guest, i));
    }
  }

  function getHostBookingsPage(
    address host,
    uint256 cursor,
    uint256 limit
  ) external view returns (HospitalityBooking.Booking[] memory page, uint256 nextCursor) {
    uint256 total = booking.hostBookingCount(host);
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new HospitalityBooking.Booking[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = booking.getBooking(booking.hostBookingAt(host, i));
    }
  }

  function getListingReviewsPage(
    uint256 listingId,
    uint256 cursor,
    uint256 limit
  ) external view returns (ReviewRegistry.Review[] memory page, uint256 nextCursor) {
    uint256 total = reviews.listingReviewCount(listingId);
    uint256 end;
    (end, nextCursor) = _window(cursor, limit, total);
    page = new ReviewRegistry.Review[](end - cursor);
    for (uint256 i = cursor; i < end; i++) {
      page[i - cursor] = reviews.getReview(reviews.listingReviewAt(listingId, i));
    }
  }
}
