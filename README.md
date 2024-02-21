Running the Application: Supply the following keys in your .env variable:
i) NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
ii) NEXT_PUBLIC_ALCHEMY_ID=<YOUR_ALCHEMY_PROJECT_ID>
iii) NEXT_PUBLIC_PROJECT_ID=<WALLET_CONNECT_PROJECT_ID>
iv) NEXTAUTH_URL=http://localhost:3000
v) NEXTAUTH_SECRET=somereallysecretsecret
vi) YOUR_ALCHEMY_PROJECT_ID: Get Key Here WALLET_CONNECT_PROJECT_ID: Get Key Here

Follow these steps to run the application:
i) Install the package modules by running the command: yarn install
ii) Start the Hardhat server: yarn blockchain
iii) Run the contract deployment script: yarn deploy
iv) Run the contract seeding script: yarn seed
v) Spin up the Next.js development server: yarn dev
