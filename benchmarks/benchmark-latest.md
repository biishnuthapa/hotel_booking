# Gas benchmark — HospitalityBookingNFT (V1)

Network: hardhat (chainId 31337) · Iterations: 5 · Generated: 2026-07-24T02:39:30.602Z

| Operation | Gas (mean) | Gas (min–max) | Ethereum L1 (20 gwei, ETH=$3000) | Polygon PoS (30 gwei, POL=$0.40) | Arbitrum One (0.1 gwei, ETH=$3000) |
|---|---|---|---|---|---|
| deploy | 5,378,537 | 5,378,537–5,378,537 | $322.7122 | $0.0645 | $1.6136 |
| createAppartment | 716,798 | 713,378–730,478 | $43.0079 | $0.0086 | $0.215 |
| addRoomTypeToApartment | 169,609 | 169,609–169,609 | $10.1765 | $0.002 | $0.0509 |
| bookApartment (1 night) | 427,039 | 420,199–454,399 | $25.6223 | $0.0051 | $0.1281 |
| bookApartment (3 nights) | 519,285 | 519,285–519,285 | $31.1571 | $0.0062 | $0.1558 |
| bookApartment (7 nights) | 708,621 | 708,621–708,621 | $42.5173 | $0.0085 | $0.2126 |
| tokenURI (estimateGas, view) | 137,576 | 137,418–137,814 | $8.2546 | $0.0017 | $0.0413 |
| refundBooking (3 nights) | 126,384 | 126,384–126,384 | $7.583 | $0.0015 | $0.0379 |
| checkInApartment | 116,856 | 116,856–116,856 | $7.0114 | $0.0014 | $0.0351 |
| checkout | 35,452 | 35,452–35,452 | $2.1271 | $0.0004 | $0.0106 |
| addReview | 187,512 | 187,512–187,512 | $11.2507 | $0.0023 | $0.0563 |
| claimFunds (no-show) | 89,482 | 89,482–89,482 | $5.3689 | $0.0011 | $0.0268 |

## Read scaling (unbounded loops)

| Apartments | getApartments estimateGas |
|---|---|
| 1 | 63,025 |
| 10 | 411,922 |
| 25 | 998,739 |
| 50 | 1,991,551 |
| 100 | 4,032,611 |
