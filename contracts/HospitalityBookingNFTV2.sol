// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/Base64.sol';

/**
 * @title HospitalityBookingNFTV2
 * @notice Storage-optimized variant of HospitalityBookingNFT for gas comparison.
 *
 * Differences from V1 (booking/escrow logic is intentionally identical so
 * measured gas deltas isolate the storage design):
 *  1. Static listing content (description, image gallery, coordinates, NFT
 *     name/description) lives in a single off-chain metadata document
 *     (IPFS `metadataURI`); on-chain we keep only what the contract logic
 *     or marketplace filtering needs: name, location, one image URI, rooms.
 *     V1 stores 9 strings per apartment; V2 stores 4.
 *  2. Unbounded reads are replaced with cursor-paginated variants
 *     (getApartmentsPaged, getOwnedTokensPaged) so read cost is bounded by
 *     the page size, not global state size.
 *  3. tokenURI stays fully dynamic (status/date attributes rendered on-chain).
 */
contract HospitalityBookingNFTV2 is Ownable, ReentrancyGuard, ERC721 {
  using Counters for Counters.Counter;
  using Strings for uint256;

  Counters.Counter private _totalAppartments;
  Counters.Counter private _totalTokens;
  mapping(uint => Counters.Counter) private apartmentTokenCounters;

  uint public securityFee; // percent (0-100)
  uint public taxPercent; // percent (0-100)

  struct ApartmentStruct {
    uint id;
    string name;
    string location;
    string imageURI; // single NFT/card image
    string metadataURI; // off-chain document: description, gallery, coordinates
    uint rooms;
    address owner;
    bool deleted;
    uint timestamp;
  }

  struct RoomType {
    string name;
    string description;
    uint256 price; // wei per night
    string images;
    uint capacity;
    bool deleted;
  }

  enum BookingStatus {
    Booked,
    Cancelled,
    CheckedIn,
    Expired
  }

  struct BookingStruct {
    uint id;
    uint aid;
    address tenant;
    uint roomTypeIndex;
    uint roomsBooked;
    uint[] dates;
    uint pricePerNight;
    uint totalPrice;
    uint tokenId;
    uint apartmentTokenId;
    BookingStatus status;
    uint timestamp;
  }

  struct ReviewStruct {
    uint id;
    uint aid;
    string reviewText;
    uint timestamp;
    address owner;
  }

  struct BookingKey {
    uint aid;
    uint bookingId;
  }

  mapping(uint => ApartmentStruct) private apartments;
  mapping(uint => bool) private appartmentExist;
  mapping(uint256 => RoomType[]) private roomTypes;
  mapping(uint => BookingStruct[]) private bookingsOf;
  mapping(uint => ReviewStruct[]) private reviewsOf;
  mapping(uint => mapping(uint => mapping(uint => uint))) public roomTypeBookedOnDate;
  mapping(uint => mapping(address => uint256)) private checkedInCount;
  mapping(uint => mapping(uint => uint)) public bookingToToken;
  mapping(uint => BookingKey) private tokenToBooking;

  event ApartmentCreated(uint indexed id, address indexed owner, string name);
  event ApartmentUpdated(uint indexed id, address indexed owner, string name);
  event ApartmentDeleted(uint indexed id, address indexed owner);
  event RoomTypeAdded(uint indexed aid, uint indexed index, string name);
  event RoomTypeDeleted(uint indexed aid, uint indexed index);
  event BookingCreated(
    uint indexed aid,
    uint indexed bookingId,
    address indexed tenant,
    uint roomTypeIndex,
    uint[] dates,
    uint pricePerNight,
    uint totalPrice,
    uint tokenId,
    uint apartmentTokenId
  );
  event BookingRefunded(uint indexed aid, uint indexed bookingId, address indexed tenant);
  event BookingCheckedIn(uint indexed aid, uint indexed bookingId, address indexed tenant);
  event BookingExpired(uint indexed aid, uint indexed bookingId);
  event FundsClaimed(uint indexed aid, uint indexed bookingId, address indexed owner);
  event ReviewAdded(uint indexed aid, uint indexed reviewId, address indexed reviewer);

  constructor(uint _taxPercent, uint _securityFee) ERC721('Hospitality', 'NFT') {
    require(_taxPercent <= 100, 'Tax cannot exceed 100%');
    require(_securityFee <= 100, 'Security fee cannot exceed 100%');
    taxPercent = _taxPercent;
    securityFee = _securityFee;
  }

  // ------------------------------------------------------------
  // Apartment management
  // ------------------------------------------------------------
  function createAppartment(
    string memory apartmentName,
    string memory location,
    string memory imageURI,
    string memory metadataURI,
    uint rooms
  ) external {
    require(bytes(apartmentName).length > 0, 'Name required');
    require(bytes(location).length > 0, 'Location required');
    require(bytes(imageURI).length > 0, 'Image required');
    require(bytes(metadataURI).length > 0, 'Metadata link required');
    require(rooms > 0, 'Rooms cannot be zero');

    _totalAppartments.increment();
    uint id = _totalAppartments.current();

    apartments[id] = ApartmentStruct({
      id: id,
      name: apartmentName,
      location: location,
      imageURI: imageURI,
      metadataURI: metadataURI,
      rooms: rooms,
      owner: msg.sender,
      deleted: false,
      timestamp: currentTime()
    });

    appartmentExist[id] = true;
    emit ApartmentCreated(id, msg.sender, apartmentName);
  }

  function updateAppartment(
    uint id,
    string memory apartmentName,
    string memory location,
    string memory imageURI,
    string memory metadataURI,
    uint rooms
  ) external {
    require(appartmentExist[id], 'Appartment not found');
    require(msg.sender == apartments[id].owner, 'Owner only');
    require(bytes(apartmentName).length > 0, 'Name required');
    require(bytes(location).length > 0, 'Location required');
    require(bytes(imageURI).length > 0, 'Image required');
    require(bytes(metadataURI).length > 0, 'Metadata link required');
    require(rooms > 0, 'Rooms cannot be zero');

    ApartmentStruct storage lodge = apartments[id];
    lodge.name = apartmentName;
    lodge.location = location;
    lodge.imageURI = imageURI;
    lodge.metadataURI = metadataURI;
    lodge.rooms = rooms;

    emit ApartmentUpdated(id, msg.sender, apartmentName);
  }

  function deleteAppartment(uint id) external {
    require(appartmentExist[id], 'Appartment not found');
    require(apartments[id].owner == msg.sender, 'Unauthorized');
    appartmentExist[id] = false;
    apartments[id].deleted = true;
    emit ApartmentDeleted(id, msg.sender);
  }

  /// @notice Cursor-paginated listing read; read cost bounded by `limit`.
  /// @param cursor apartment id to start from (0 starts at the beginning)
  /// @return page non-deleted apartments, at most `limit`
  /// @return nextCursor id to pass as the next cursor, 0 when exhausted
  function getApartmentsPaged(
    uint cursor,
    uint limit
  ) external view returns (ApartmentStruct[] memory page, uint nextCursor) {
    require(limit > 0 && limit <= 100, 'Limit must be 1-100');
    uint total = _totalAppartments.current();
    uint start = cursor == 0 ? 1 : cursor;

    ApartmentStruct[] memory buffer = new ApartmentStruct[](limit);
    uint count;
    uint i = start;
    for (; i <= total && count < limit; i++) {
      if (!apartments[i].deleted) {
        buffer[count++] = apartments[i];
      }
    }

    page = new ApartmentStruct[](count);
    for (uint j = 0; j < count; j++) {
      page[j] = buffer[j];
    }
    nextCursor = i <= total ? i : 0;
  }

  function getApartment(uint id) external view returns (ApartmentStruct memory) {
    require(appartmentExist[id], 'Appartment not found');
    return apartments[id];
  }

  function totalApartments() external view returns (uint) {
    return _totalAppartments.current();
  }

  // ------------------------------------------------------------
  // Room types (identical to V1)
  // ------------------------------------------------------------
  function addRoomTypeToApartment(
    uint256 _apartmentId,
    string memory _name,
    string memory _description,
    uint256 _price,
    string memory _images,
    uint256 _capacity
  ) external {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    require(msg.sender == apartments[_apartmentId].owner, 'Owner only');
    require(bytes(_name).length > 0, 'Room name required');
    require(bytes(_description).length > 0, 'Room description required');
    require(_price > 0, 'Room price must be greater than zero');
    require(bytes(_images).length > 0, 'Room images required');
    require(_capacity > 0, 'Room capacity must be greater than zero');

    roomTypes[_apartmentId].push(
      RoomType({
        name: _name,
        description: _description,
        price: _price,
        images: _images,
        capacity: _capacity,
        deleted: false
      })
    );
    emit RoomTypeAdded(_apartmentId, roomTypes[_apartmentId].length - 1, _name);
  }

  function getRooms(uint256 _apartmentId) external view returns (RoomType[] memory) {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    return roomTypes[_apartmentId];
  }

  function deleteRoomType(uint256 _apartmentId, uint256 _index) external {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    require(_index < roomTypes[_apartmentId].length, 'Invalid room index');
    require(msg.sender == apartments[_apartmentId].owner, 'Owner only');
    require(!roomTypes[_apartmentId][_index].deleted, 'Room already deleted');

    roomTypes[_apartmentId][_index].deleted = true;
    emit RoomTypeDeleted(_apartmentId, _index);
  }

  // ------------------------------------------------------------
  // Booking (identical to V1)
  // ------------------------------------------------------------
  function bookApartment(
    uint aid,
    uint roomTypeIndex,
    uint roomsRequested,
    uint[] memory dates
  ) external payable {
    require(appartmentExist[aid], 'Apartment not found');
    require(roomTypeIndex < roomTypes[aid].length, 'Room type not found');
    RoomType storage room = roomTypes[aid][roomTypeIndex];
    require(!room.deleted, 'Room type deleted');
    require(dates.length > 0, 'Dates required');
    require(room.price > 0, 'Price must be > 0');
    require(roomsRequested > 0, 'Rooms required');
    require(roomsRequested <= room.capacity, 'Rooms exceed capacity');

    uint[] memory normalizedDates = _normalizeAndValidateDates(aid, roomTypeIndex, roomsRequested, dates);

    uint totalPrice = room.price * roomsRequested * normalizedDates.length;
    uint totalFee = (totalPrice * securityFee) / 100;
    uint expectedValue = totalPrice + totalFee;
    require(msg.value == expectedValue, 'Incorrect payment amount');

    for (uint i = 0; i < normalizedDates.length; i++) {
      roomTypeBookedOnDate[aid][roomTypeIndex][normalizedDates[i]] += roomsRequested;
    }

    BookingStruct memory booking;
    booking.aid = aid;
    booking.id = bookingsOf[aid].length;
    booking.tenant = msg.sender;
    booking.roomTypeIndex = roomTypeIndex;
    booking.roomsBooked = roomsRequested;
    booking.dates = normalizedDates;
    booking.pricePerNight = room.price;
    booking.totalPrice = totalPrice;
    booking.status = BookingStatus.Booked;
    booking.timestamp = currentTime();

    apartmentTokenCounters[aid].increment();
    uint apartmentTokenId = apartmentTokenCounters[aid].current();

    _totalTokens.increment();
    uint tokenId = _totalTokens.current();
    booking.tokenId = tokenId;
    booking.apartmentTokenId = apartmentTokenId;
    _mint(msg.sender, tokenId);
    bookingToToken[aid][booking.id] = tokenId;
    tokenToBooking[tokenId] = BookingKey({ aid: aid, bookingId: booking.id });

    bookingsOf[aid].push(booking);
    emit BookingCreated(
      aid,
      booking.id,
      msg.sender,
      roomTypeIndex,
      normalizedDates,
      booking.pricePerNight,
      booking.totalPrice,
      tokenId,
      apartmentTokenId
    );
  }

  function checkInApartment(uint aid, uint bookingId) external nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct storage booking = bookingsOf[aid][bookingId];
    require(msg.sender == booking.tenant, 'Unauthorized tenant');
    require(booking.status == BookingStatus.Booked, 'Not active');
    require(currentTime() >= booking.dates[0], 'Too early');
    require(currentTime() <= booking.dates[0] + 24 hours, 'Check-in window passed');

    booking.status = BookingStatus.CheckedIn;
    uint tax = (booking.totalPrice * taxPercent) / 100;
    uint fee = (booking.totalPrice * securityFee) / 100;

    checkedInCount[aid][msg.sender] += 1;

    payTo(apartments[aid].owner, (booking.totalPrice - tax));
    payTo(owner(), tax);
    payTo(msg.sender, fee);
    emit BookingCheckedIn(aid, bookingId, msg.sender);
  }

  function checkout(uint aid, uint bookingId) external nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct storage booking = bookingsOf[aid][bookingId];
    require(msg.sender == apartments[aid].owner, 'Owner only');
    require(booking.status == BookingStatus.CheckedIn, 'Not checked in');

    booking.status = BookingStatus.Expired;
    emit BookingExpired(aid, bookingId);
  }

  function claimFunds(uint aid, uint bookingId) external nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct storage booking = bookingsOf[aid][bookingId];
    require(msg.sender == apartments[aid].owner, 'Owner only');
    require(booking.status == BookingStatus.Booked, 'Not active');
    require(currentTime() > booking.dates[0], 'Too early');

    uint tax = (booking.totalPrice * taxPercent) / 100;
    uint fee = (booking.totalPrice * securityFee) / 100;
    booking.status = BookingStatus.Expired;

    payTo(apartments[aid].owner, (booking.totalPrice - tax));
    payTo(owner(), tax);
    payTo(apartments[aid].owner, fee);
    emit FundsClaimed(aid, bookingId, msg.sender);
  }

  function refundBooking(uint aid, uint bookingId) external nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct storage booking = bookingsOf[aid][bookingId];
    require(booking.status == BookingStatus.Booked, 'Not refundable');

    if (msg.sender != owner()) {
      require(msg.sender == booking.tenant, 'Tenant only');
      require(booking.dates[0] > currentTime(), 'Stay started');
    }

    booking.status = BookingStatus.Cancelled;

    for (uint i = 0; i < booking.dates.length; i++) {
      uint day = booking.dates[i];
      uint currentCount = roomTypeBookedOnDate[aid][booking.roomTypeIndex][day];
      if (currentCount >= booking.roomsBooked) {
        roomTypeBookedOnDate[aid][booking.roomTypeIndex][day] = currentCount - booking.roomsBooked;
      } else {
        roomTypeBookedOnDate[aid][booking.roomTypeIndex][day] = 0;
      }
    }

    if (booking.tokenId != 0 && _exists(booking.tokenId)) {
      _burn(booking.tokenId);
      delete tokenToBooking[booking.tokenId];
    }
    delete bookingToToken[aid][bookingId];
    booking.tokenId = 0;

    uint fee = (booking.totalPrice * securityFee) / 100;
    uint collateral = fee / 2;

    payTo(apartments[aid].owner, collateral);
    payTo(owner(), collateral);
    payTo(booking.tenant, booking.totalPrice);
    emit BookingRefunded(aid, bookingId, booking.tenant);
  }

  function getBookings(uint aid) external view returns (BookingStruct[] memory) {
    return bookingsOf[aid];
  }

  // ------------------------------------------------------------
  // Reviews (identical to V1)
  // ------------------------------------------------------------
  function addReview(uint aid, string memory reviewText) external {
    require(appartmentExist[aid], 'Appartment not available');
    require(checkedInCount[aid][msg.sender] > 0, 'Check in first');
    require(bytes(reviewText).length > 0, 'Review text required');

    ReviewStruct memory review;
    review.aid = aid;
    review.id = reviewsOf[aid].length;
    review.reviewText = reviewText;
    review.timestamp = currentTime();
    review.owner = msg.sender;

    reviewsOf[aid].push(review);
    emit ReviewAdded(aid, review.id, msg.sender);
  }

  function getReviews(uint aid) external view returns (ReviewStruct[] memory) {
    return reviewsOf[aid];
  }

  function tenantBooked(uint appartmentId) external view returns (bool) {
    return checkedInCount[appartmentId][msg.sender] > 0;
  }

  // ------------------------------------------------------------
  // NFT helpers
  // ------------------------------------------------------------
  struct TokenData {
    uint id;
    string metadataUri;
  }

  /// @notice Cursor-paginated owned-token scan; read cost bounded by `limit` pages of ids.
  /// @param cursor token id to start from (0 starts at 1)
  /// @return page tokens owned by `owner_`, at most `limit`
  /// @return nextCursor token id to resume from, 0 when exhausted
  function getOwnedTokensPaged(
    address owner_,
    uint cursor,
    uint limit
  ) external view returns (TokenData[] memory page, uint nextCursor) {
    require(limit > 0 && limit <= 100, 'Limit must be 1-100');
    uint total = _totalTokens.current();
    uint start = cursor == 0 ? 1 : cursor;

    TokenData[] memory buffer = new TokenData[](limit);
    uint count;
    uint i = start;
    for (; i <= total && count < limit; i++) {
      if (_exists(i) && ownerOf(i) == owner_) {
        buffer[count++] = TokenData(i, tokenURI(i));
      }
    }

    page = new TokenData[](count);
    for (uint j = 0; j < count; j++) {
      page[j] = buffer[j];
    }
    nextCursor = i <= total ? i : 0;
  }

  function getTotalTokens() external view returns (uint256) {
    return _totalTokens.current();
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), 'URI query for nonexistent token');
    BookingKey memory key = tokenToBooking[tokenId];
    BookingStruct storage booking = bookingsOf[key.aid][key.bookingId];
    ApartmentStruct storage apartment = apartments[key.aid];
    bytes memory dataURI = buildTokenJSON(booking, apartment);
    return string(abi.encodePacked('data:application/json;base64,', Base64.encode(dataURI)));
  }

  function buildTokenJSON(
    BookingStruct storage booking,
    ApartmentStruct storage apartment
  ) internal view returns (bytes memory) {
    string memory numberOfNights = booking.dates.length.toString();
    string memory roomTypeName = roomTypes[booking.aid][booking.roomTypeIndex].name;
    string memory tokenId = booking.tokenId.toString();
    string memory apartmentTokenId = booking.apartmentTokenId.toString();

    return
      abi.encodePacked(
        '{',
        '"name":"',
        apartment.name,
        ' - Stay Pass",',
        '"description":"Proof-of-stay booking NFT.",',
        '"external_url":"',
        apartment.metadataURI,
        '",',
        '"image":"',
        apartment.imageURI,
        '",',
        '"attributes":[',
        '{"trait_type":"Apartment","value":"',
        apartment.name,
        '"},',
        '{"trait_type":"Room Type","value":"',
        roomTypeName,
        '"},',
        '{"trait_type":"CheckInDate","value":"',
        booking.dates[0].toString(),
        '"},',
        '{"trait_type":"CheckOutDate","value":"',
        booking.dates[booking.dates.length - 1].toString(),
        '"},',
        '{"trait_type":"Number of Nights","value":"',
        numberOfNights,
        '"},',
        '{"trait_type":"Status","value":"',
        uint(booking.status).toString(),
        '"},',
        '{"trait_type":"ApartmentTokenId","value":"',
        apartmentTokenId,
        '"},',
        '{"trait_type":"GlobalTokenId","value":"',
        tokenId,
        '"}',
        ']',
        '}'
      );
  }

  // ------------------------------------------------------------
  // Internal helpers (identical to V1)
  // ------------------------------------------------------------
  function _normalizeAndValidateDates(
    uint aid,
    uint roomTypeIndex,
    uint roomsRequested,
    uint[] memory dates
  ) internal view returns (uint[] memory normalizedDates) {
    normalizedDates = new uint[](dates.length);
    for (uint i = 0; i < dates.length; i++) {
      uint normalizedDate = normalizeDate(dates[i]);
      require(normalizedDate > currentTime(), 'Date must be in future');
      for (uint j = 0; j < i; j++) {
        require(normalizedDate != normalizedDates[j], 'Duplicate dates');
      }
      require(
        roomTypeBookedOnDate[aid][roomTypeIndex][normalizedDate] + roomsRequested <=
          roomTypes[aid][roomTypeIndex].capacity,
        'Room type full'
      );
      normalizedDates[i] = normalizedDate;
    }
  }

  function normalizeDate(uint rawDate) internal pure returns (uint) {
    return rawDate > 1e12 ? rawDate / 1000 : rawDate; // accept milliseconds
  }

  function payTo(address to, uint256 amount) internal {
    if (amount == 0) return;
    (bool success, ) = payable(to).call{ value: amount }('');
    require(success, 'Payment failed');
  }

  function currentTime() internal view returns (uint256) {
    return block.timestamp;
  }
}
