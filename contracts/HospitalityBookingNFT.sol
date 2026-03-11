// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/Base64.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol';

contract HospitalityBookingNFT is Ownable, ReentrancyGuard, ERC721URIStorage {
  using Counters for Counters.Counter;
  using Strings for uint256;
  Counters.Counter private _totalAppartments;
  Counters.Counter private _totalTokens;

  struct ApartmentStruct {
    uint id;
    string name;
    string description;
    string longitude;
    string images;
    uint rooms;
    uint price;
    address owner;
    bool booked;
    bool deleted;
    uint timestamp;
    string location;
    string latitude;
    string pinataJsonLink;
  }

  struct RoomType {
    string name;
    string description;
    uint256 price;
    string details;
    uint capacity;
    bool deleted;
  }

  struct BookingStruct {
    uint id;
    uint aid;
    address tenant;
    uint date;
    uint price;
    uint tokenId;
    BookingStatus status;
    uint timestamp;
  }

  enum BookingStatus {
    Booked,
    Cancelled,
    CheckedIn,
    Expired
  }

  struct ReviewStruct {
    uint id;
    uint aid;
    string reviewText;
    uint timestamp;
    address owner;
  }

  uint public securityFee;
  uint public taxPercent;

  mapping(uint => ApartmentStruct) apartments;
  mapping(uint => BookingStruct[]) bookingsOf;
  mapping(uint => ReviewStruct[]) reviewsOf;
  mapping(uint => bool) appartmentExist;
  mapping(uint => uint[]) bookedDates;
  mapping(uint => mapping(address => uint256)) checkedInCount;
  mapping(uint256 => RoomType[]) roomTypes;
  mapping(uint => mapping(uint => uint)) public bookingToToken;

  struct BookingKey {
    uint aid;
    uint bookingId;
  }
  mapping(uint => BookingKey) private tokenToBooking;

  mapping(uint => mapping(uint => bool)) isDateBooked;

  constructor(uint _taxPercent, uint _securityFee) ERC721('Hospitality', 'NFT') {
    require(_taxPercent <= 100, 'Tax cannot exceed 100%');
    require(_securityFee <= 100, 'Security fee cannot exceed 100%');
    taxPercent = _taxPercent;
    securityFee = _securityFee;
  }

  function createAppartment(
    string memory name,
    string memory description,
    string memory location,
    string memory images,
    uint rooms,
    uint price,
    string memory latitude,
    string memory longitude,
    string memory pinataJsonLink
  ) public {
    require(bytes(name).length > 0, 'Name cannot be empty');
    require(bytes(description).length > 0, 'Description cannot be empty');
    require(bytes(location).length > 0, 'Location cannot be empty');
    require(bytes(images).length > 0, 'Images cannot be empty');
    require(bytes(pinataJsonLink).length > 0, 'Give the link for Metadata');
    require(rooms > 0, 'Rooms cannot be zero');
    require(price > 0 ether, 'Price cannot be zero');

    _totalAppartments.increment();
    ApartmentStruct memory lodge;
    lodge.id = _totalAppartments.current();
    lodge.name = name;
    lodge.description = description;
    lodge.location = location;
    lodge.images = images;
    lodge.rooms = rooms;
    lodge.price = price;
    lodge.owner = msg.sender;
    lodge.timestamp = currentTime();
    lodge.latitude = latitude;
    lodge.longitude = longitude;
    lodge.pinataJsonLink = pinataJsonLink;

    appartmentExist[lodge.id] = true;
    apartments[_totalAppartments.current()] = lodge;
  }

  function updateAppartment(
    uint id,
    string memory name,
    string memory description,
    string memory location,
    string memory images,
    uint rooms,
    uint price
  ) public {
    require(appartmentExist[id] == true, 'Appartment not found');
    require(msg.sender == apartments[id].owner, 'Unauthorized personnel, owner only');
    require(bytes(name).length > 0, 'Name cannot be empty');
    require(bytes(description).length > 0, 'Description cannot be empty');
    require(bytes(location).length > 0, 'Location cannot be empty');
    require(bytes(images).length > 0, 'Images cannot be empty');
    require(rooms > 0, 'Rooms cannot be zero');
    require(price > 0 ether, 'Price cannot be zero');

    ApartmentStruct memory lodge = apartments[id];
    lodge.name = name;
    lodge.description = description;
    lodge.location = location;
    lodge.images = images;
    lodge.rooms = rooms;
    lodge.price = price;

    apartments[id] = lodge;
  }

  function addRoomTypeToApartment(
    uint256 _apartmentId,
    string memory _name,
    string memory _description,
    uint256 _price,
    string memory _details,
    uint256 _capacity
) public {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    require(msg.sender == apartments[_apartmentId].owner, 'Unauthorized: owner only');
    require(bytes(_name).length > 0, 'Room name cannot be empty');
    require(bytes(_description).length > 0, 'Room description cannot be empty');
    require(_price > 0, 'Room price must be greater than zero');
    require(bytes(_details).length > 0, 'Room details cannot be empty');
    require(_capacity > 0, 'Room capacity must be greater than zero');

    RoomType memory newRoomType;
    newRoomType.name = _name;
    newRoomType.description = _description;
    newRoomType.price = _price;
    newRoomType.details = _details;
    newRoomType.capacity = _capacity;
    newRoomType.deleted = false;

    roomTypes[_apartmentId].push(newRoomType);
  }

  function getRooms(uint256 _apartmentId) public view returns (RoomType[] memory) {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    return roomTypes[_apartmentId];
  }

  function deleteRoomType(uint256 _apartmentId, uint256 _index) public {
    require(appartmentExist[_apartmentId], 'Apartment does not exist');
    require(_index < roomTypes[_apartmentId].length, 'Invalid room index');
    require(msg.sender == apartments[_apartmentId].owner, 'Unauthorized: owner only');
    require(!roomTypes[_apartmentId][_index].deleted, 'Room already deleted');

    roomTypes[_apartmentId][_index].deleted = true;
  }

  function deleteAppartment(uint id) public {
    require(appartmentExist[id] == true, 'Appartment not found');
    require(apartments[id].owner == msg.sender, 'Unauthorized entity');

    appartmentExist[id] = false;
    apartments[id].deleted = true;
  }

  function getApartments() public view returns (ApartmentStruct[] memory Apartments) {
    uint256 available;
    for (uint i = 1; i <= _totalAppartments.current(); i++) {
      if (!apartments[i].deleted) available++;
    }

    Apartments = new ApartmentStruct[](available);

    uint256 index;
    for (uint i = 1; i <= _totalAppartments.current(); i++) {
      if (!apartments[i].deleted) {
        Apartments[index++] = apartments[i];
      }
    }
  }

  function getApartment(uint id) public view returns (ApartmentStruct memory) {
    require(appartmentExist[id], 'Appartment not found');
    return apartments[id];
  }

  function normalizeDate(uint rawDate) internal pure returns (uint) {
    if (rawDate > 1e12) return rawDate / 1000; // accept milliseconds inputs
    return rawDate;
  }

  function bookApartment(uint aid, uint[] memory dates) public payable {
    require(appartmentExist[aid], 'Apartment not found!');
    require(dates.length > 0, 'Dates required');

    uint totalPrice = apartments[aid].price * dates.length;
    uint totalFee = (totalPrice * securityFee) / 100;
    uint expectedValue = totalPrice + totalFee;
    require(
      msg.value == expectedValue,
      'Incorrect payment amount'
    );

    uint[] memory normalizedDates = new uint[](dates.length);
    for (uint i = 0; i < dates.length; i++) {
      uint normalizedDate = normalizeDate(dates[i]);
      require(normalizedDate > currentTime(), 'Booking date must be in the future');
      for (uint j = 0; j < i; j++) {
        require(normalizedDate != normalizedDates[j], 'Duplicate dates in request');
      }
      require(!isDateBooked[aid][normalizedDate], 'One or more dates already booked');
      normalizedDates[i] = normalizedDate;
    }

    for (uint i = 0; i < dates.length; i++) {
      BookingStruct memory booking;
      booking.aid = aid;
      booking.id = bookingsOf[aid].length;
      booking.tenant = msg.sender;
      booking.date = normalizedDates[i];
      booking.price = apartments[aid].price;
      booking.status = BookingStatus.Booked;
      booking.timestamp = currentTime();

      _totalTokens.increment();
      uint tokenId = _totalTokens.current();
      booking.tokenId = tokenId;
      _mint(msg.sender, tokenId);
      bookingToToken[aid][booking.id] = tokenId;
      tokenToBooking[tokenId] = BookingKey({ aid: aid, bookingId: booking.id });

      bookingsOf[aid].push(booking);
      bookedDates[aid].push(normalizedDates[i]);
      isDateBooked[aid][normalizedDates[i]] = true;
    }
  }

  function checkInApartment(uint aid, uint bookingId) public nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct memory booking = bookingsOf[aid][bookingId];
    require(msg.sender == booking.tenant, 'Unauthorized tenant!');
    require(booking.status == BookingStatus.Booked, 'Booking is not active');
    require(currentTime() >= booking.date, 'Cannot check in before booking date!');

    bookingsOf[aid][bookingId].status = BookingStatus.CheckedIn;
    uint tax = (booking.price * taxPercent) / 100;
    uint fee = (booking.price * securityFee) / 100;

    checkedInCount[aid][msg.sender] += 1;

    payTo(apartments[aid].owner, (booking.price - tax));
    payTo(owner(), tax);
    payTo(msg.sender, fee);
  }

  function claimFunds(uint aid, uint bookingId) public nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct memory booking = bookingsOf[aid][bookingId];
    require(msg.sender == apartments[aid].owner, 'Unauthorized entity');
    require(booking.status == BookingStatus.Booked, 'Booking is not active');
    require(currentTime() > booking.date, 'Cannot claim before booking date');

    uint tax = (booking.price * taxPercent) / 100;
    uint fee = (booking.price * securityFee) / 100;
    bookingsOf[aid][bookingId].status = BookingStatus.Expired;

    payTo(apartments[aid].owner, (booking.price - tax));
    payTo(owner(), tax);
    payTo(msg.sender, fee);
  }

  function refundBooking(uint aid, uint bookingId) public nonReentrant {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct memory booking = bookingsOf[aid][bookingId];
    require(booking.status == BookingStatus.Booked, 'Booking is not refundable');

    if (msg.sender != owner()) {
      require(msg.sender == booking.tenant, 'Unauthorized tenant!');
      require(booking.date > currentTime(), 'Can no longer refund, booking date started');
    }

    bookingsOf[aid][bookingId].status = BookingStatus.Cancelled;

    uint[] storage dates = bookedDates[aid];
    for (uint i = 0; i < dates.length; i++) {
      if (dates[i] == booking.date) {
        dates[i] = dates[dates.length - 1];
        dates.pop();
        break;
      }
    }
    isDateBooked[aid][booking.date] = false;

    if (booking.tokenId != 0 && _exists(booking.tokenId)) {
      _burn(booking.tokenId);
      delete tokenToBooking[booking.tokenId];
    }
    delete bookingToToken[aid][bookingId];

    uint fee = (booking.price * securityFee) / 100;
    uint collateral = fee / 2;

    payTo(apartments[aid].owner, collateral);
    payTo(owner(), collateral);
    payTo(booking.tenant, booking.price);
  }

  function getBookings(uint aid) public view returns (BookingStruct[] memory) {
    return bookingsOf[aid];
  }

  function getQualifiedReviewers(uint aid) public view returns (address[] memory Tenants) {
    uint256 available;
    for (uint i = 0; i < bookingsOf[aid].length; i++) {
      if (bookingsOf[aid][i].status == BookingStatus.CheckedIn) available++;
    }

    Tenants = new address[](available);

    uint256 index;
    for (uint i = 0; i < bookingsOf[aid].length; i++) {
      if (bookingsOf[aid][i].status == BookingStatus.CheckedIn) {
        Tenants[index++] = bookingsOf[aid][i].tenant;
      }
    }
  }

  function getBooking(uint aid, uint bookingId) public view returns (BookingStruct memory) {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    return bookingsOf[aid][bookingId];
  }

  function payTo(address to, uint256 amount) internal {
    if (amount == 0) return;
    (bool success, ) = payable(to).call{ value: amount }('');
    require(success, 'Payment failed');
  }

  function addReview(uint aid, string memory reviewText) public {
    require(appartmentExist[aid], 'Appartment not available');
    require(checkedInCount[aid][msg.sender] > 0, 'Book first before review');
    require(bytes(reviewText).length > 0, 'Review text cannot be empty');

    ReviewStruct memory review;

    review.aid = aid;
    review.id = reviewsOf[aid].length;
    review.reviewText = reviewText;
    review.timestamp = currentTime();
    review.owner = msg.sender;

    reviewsOf[aid].push(review);
  }

  function getReviews(uint aid) public view returns (ReviewStruct[] memory) {
    return reviewsOf[aid];
  }

  function tenantBooked(uint appartmentId) public view returns (bool) {
    return checkedInCount[appartmentId][msg.sender] > 0;
  }

  function currentTime() internal view returns (uint256) {
    return block.timestamp;
  }

  function expireBooking(uint aid, uint bookingId) public {
    require(bookingId < bookingsOf[aid].length, 'Booking not found');
    BookingStruct memory booking = bookingsOf[aid][bookingId];
    require(booking.status == BookingStatus.Booked, 'Booking is not active');
    require(currentTime() > booking.date, 'Booking date not passed');
    bookingsOf[aid][bookingId].status = BookingStatus.Expired;
  }

  struct TokenData {
    uint id;
    string metadataUri;
  }

  function getOwnedTokens(address owner) public view returns (TokenData[] memory) {
    TokenData[] memory ownedTokens = new TokenData[](_totalTokens.current());
    uint count = 0;

    for (uint i = 1; i <= _totalTokens.current(); i++) {
      if (ownerOf(i) == owner) {
        ownedTokens[count] = TokenData(i, tokenURI(i));
        count++;
      }
    }

    TokenData[] memory result = new TokenData[](count);
    for (uint i = 0; i < count; i++) {
      result[i] = ownedTokens[i];
    }

    return result;
  }

  function getTotalTokens() public view returns (uint256) {
    return _totalTokens.current();
  }

  function statusToString(BookingStatus status) internal pure returns (string memory) {
    if (status == BookingStatus.Booked) return 'Booked';
    if (status == BookingStatus.Cancelled) return 'Cancelled';
    if (status == BookingStatus.CheckedIn) return 'CheckedIn';
    return 'Expired';
  }

  function firstImage(string memory images) internal pure returns (string memory) {
    bytes memory data = bytes(images);
    if (data.length == 0) return '';
    uint i = 0;
    while (i < data.length && data[i] != ',') {
      i++;
    }
    bytes memory result = new bytes(i);
    for (uint j = 0; j < i; j++) {
      result[j] = data[j];
    }
    return string(result);
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), 'ERC721Metadata: URI query for nonexistent token');
    BookingKey memory key = tokenToBooking[tokenId];
    BookingStruct memory booking = bookingsOf[key.aid][key.bookingId];
    ApartmentStruct memory apartment = apartments[key.aid];

    string memory image = firstImage(apartment.images);
    string memory status = statusToString(booking.status);

    bytes memory dataURI = abi.encodePacked(
      '{',
        '"name":"Hotel Reservation #', tokenId.toString(), '",',
        '"description":"NFT reservation ticket",',
        '"image":"', image, '",',
        '"attributes":[',
          '{"trait_type":"Apartment","value":"', apartment.name, '"},',
          '{"trait_type":"CheckIn","value":"', booking.date.toString(), '"},',
          '{"trait_type":"Status","value":"', status, '"}',
        ']',
      '}'
    );

    return string(abi.encodePacked('data:application/json;base64,', Base64.encode(dataURI)));
  }

}
