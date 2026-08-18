# Gas benchmark — HospitalityBookingNFTV2 (V2)

Network: hardhat (chainId 31337) · Iterations: 5 · Generated: 2026-07-24T02:44:17.061Z

| Operation | Gas (mean) | Gas (min–max) | Ethereum L1 (20 gwei, ETH=$3000) | Polygon PoS (30 gwei, POL=$0.40) | Arbitrum One (0.1 gwei, ETH=$3000) |
|---|---|---|---|---|---|
| deploy | 4,841,593 | 4,841,593–4,841,593 | $290.4956 | $0.0581 | $1.4525 |
| createAppartment | 373,567 | 370,147–387,247 | $22.414 | $0.0045 | $0.1121 |
| addRoomTypeToApartment | 169,587 | 169,587–169,587 | $10.1752 | $0.002 | $0.0509 |
| bookApartment (1 night) | 427,017 | 420,177–454,377 | $25.621 | $0.0051 | $0.1281 |
| bookApartment (3 nights) | 519,263 | 519,263–519,263 | $31.1558 | $0.0062 | $0.1558 |
| bookApartment (7 nights) | 708,599 | 708,599–708,599 | $42.5159 | $0.0085 | $0.2126 |
| tokenURI (estimateGas, view) | 140,624 | 140,466–140,862 | $8.4374 | $0.0017 | $0.0422 |
| refundBooking (3 nights) | 126,384 | 126,384–126,384 | $7.583 | $0.0015 | $0.0379 |
| checkInApartment | 116,856 | 116,856–116,856 | $7.0114 | $0.0014 | $0.0351 |
| checkout | 35,452 | 35,452–35,452 | $2.1271 | $0.0004 | $0.0106 |
| addReview | 187,512 | 187,512–187,512 | $11.2507 | $0.0023 | $0.0563 |
| claimFunds (no-show) | 89,482 | 89,482–89,482 | $5.3689 | $0.0011 | $0.0268 |

## Read scaling (unbounded loops)

| Apartments | getApartments estimateGas |
|---|---|
| 1 | 55,169 |
| 10 | 249,589 |
| 25 | 575,046 |
| 50 | 575,052 |
| 100 | 575,052 |
