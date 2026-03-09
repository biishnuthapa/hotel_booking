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
iv) Run the contract seeding script (apartments + bookings + room types): yarn seed
v) Spin up the Next.js development server: yarn dev

Localhost troubleshooting:
i) If you see `Booking date must be in the future` on localhost after prior testing, restart the node (`yarn blockchain`) to reset chain time.
ii) Keep MetaMask on chainId `31337` for local mode.
