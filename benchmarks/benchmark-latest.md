# Gas benchmark — HospitalityBooking

Network: hardhat · Generated: 2026-08-18T20:02:02.148Z

## Runtime sizes (EVM limit 24,576 bytes)

| Contract | Bytes |
|---|---|
| HospitalityBooking | 23,215 |
| ReviewRegistry | 5,650 |
| BookingLens | 6,866 |
| HospitalityBookingMetadata | 3,925 |

## Per-operation gas

| Operation | Gas (mean) | Ethereum L1 (20 gwei) | Polygon PoS (30 gwei) | Arbitrum One (0.1 gwei) |
|---|---|---|---|---|
| deploy core | 6,147,244 | $368.8346 | $0.0738 | $1.844173 |
| deploy review registry | 1,278,510 | $76.7106 | $0.0153 | $0.383553 |
| deploy lens | 1,537,792 | $92.2675 | $0.0185 | $0.461338 |
| createListing | 190,071 | $11.4043 | $0.0023 | $0.057021 |
| addRoomType | 262,625 | $15.7575 | $0.0032 | $0.078788 |
| book (1 night) | 581,532 | $34.8919 | $0.0070 | $0.174460 |
| book (3 nights) | 507,670 | $30.4602 | $0.0061 | $0.152301 |
| book (7 nights) | 599,346 | $35.9608 | $0.0072 | $0.179804 |
| checkIn (host-attested) | 139,474 | $8.3684 | $0.0017 | $0.041842 |
| submitReview | 426,660 | $25.5996 | $0.0051 | $0.127998 |
| completeStay | 99,598 | $5.9759 | $0.0012 | $0.029879 |
| withdraw | 48,739 | $2.9243 | $0.0006 | $0.014622 |
| cancelBooking | 128,236 | $7.6942 | $0.0015 | $0.038471 |
| settleNoShow | 86,394 | $5.1836 | $0.0010 | $0.025918 |
| openDispute | 131,027 | $7.8616 | $0.0016 | $0.039308 |
| resolveDispute | 82,354 | $4.9412 | $0.0010 | $0.024706 |
| tokenURI (view) | 158,786 | $9.5272 | $0.0019 | $0.047636 |

## Cost of one fabricated counted review

| | Booking value required | Non-refundable tax | Counted weight |
|---|---|---|---|
| Without mechanism | 1 atomic unit | 0 | 100% |
| With mechanism | 75.00 USDC | 5.25 USDC | 100% (0% if self-booked) |
