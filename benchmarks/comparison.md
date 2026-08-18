# Gas comparison — V1 (on-chain metadata) vs V2 (off-chain metadata + paginated reads)

V1 run: 2026-07-24T02:45:32.511Z · V2 run: 2026-07-24T02:44:17.061Z · network: hardhat · iterations: 5

| Operation | V1 gas (mean) | V2 gas (mean) | Δ | Reduction |
|---|---|---|---|---|
| deploy | 5,378,537 | 4,841,593 | -536,944 | **10%** |
| createAppartment | 716,798 | 373,567 | -343,231 | **47.9%** |
| addRoomTypeToApartment | 169,609 | 169,587 | -22 | **0%** |
| bookApartment (1 night) | 427,039 | 427,017 | -22 | **0%** |
| bookApartment (3 nights) | 519,285 | 519,263 | -22 | **0%** |
| bookApartment (7 nights) | 708,621 | 708,599 | -22 | **0%** |
| tokenURI (estimateGas, view) | 137,576 | 140,624 | +3,048 | -2.2% |
| refundBooking (3 nights) | 126,384 | 126,384 | 0 | 0% |
| checkInApartment | 116,856 | 116,856 | 0 | 0% |
| checkout | 35,452 | 35,452 | 0 | 0% |
| addReview | 187,512 | 187,512 | 0 | 0% |
| claimFunds (no-show) | 89,482 | 89,482 | 0 | 0% |

## Listing read cost vs marketplace size

V1 `getApartments()` reads all listings in one unbounded call; V2 `getApartmentsPaged(0, 25)` reads one bounded page.

| Apartments | V1 estimateGas | V2 estimateGas (page of 25) |
|---|---|---|
| 1 | 63,025 | 55,169 |
| 10 | 411,922 | 249,589 |
| 25 | 998,739 | 575,046 |
| 50 | 1,991,551 | 575,052 |
| 100 | 4,032,611 | 575,052 |
