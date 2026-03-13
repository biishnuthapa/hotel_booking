Running the Application: Supply the following keys in your .env variable:
i) NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
ii) NEXT_PUBLIC_LOCAL_CHAIN_ID=31337
iii) NEXT_PUBLIC_ALCHEMY_ID=<YOUR_ALCHEMY_PROJECT_ID>
iv) NEXT_PUBLIC_PROJECT_ID=<WALLET_CONNECT_PROJECT_ID>
v) NEXTAUTH_URL=http://localhost:3000
vi) NEXTAUTH_SECRET=somereallysecretsecret
vii) YOUR_ALCHEMY_PROJECT_ID: Get Key Here WALLET_CONNECT_PROJECT_ID: Get Key Here

Follow these steps to run the application:
i) Install the package modules by running the command: yarn install
ii) Start the Hardhat server: yarn blockchain
iii) Run the contract deployment script: yarn deploy
iv) Run the contract seeding script (apartments + room types): yarn seed
v) Spin up the Next.js development server: yarn dev

Recommended Node version: 18 or 20 LTS (Hardhat does not support Node 24).

NFT Metadata (Pinata JSON)
i) Each property requires a Pinata JSON link with name, description, and image.
ii) The NFT image/name/description are stored on-chain at property creation and are immutable.
iii) Booking details are added dynamically on-chain as NFT attributes (check-in/out, nights, status).

Per-Apartment Token IDs
i) Each booking stores both a global ERC721 token ID and a per-apartment token ID.
ii) The UI shows the per-apartment booking number for easier tracking.

Home Page Pricing
i) The home page shows the lowest room price for each property.
ii) Add room types to make prices appear.

Localhost troubleshooting:
i) If you see `Booking date must be in the future` on localhost after prior testing, restart the node (`yarn blockchain`) to reset chain time.
ii) Keep MetaMask on chainId `31337` for local mode.
