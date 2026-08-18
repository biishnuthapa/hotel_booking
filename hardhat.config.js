require('dotenv').config()
require('@nomicfoundation/hardhat-toolbox')

const privateKey = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : undefined

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      initialDate: '2026-03-01T00:00:00.000Z',
    },
    amoy: {
      // Polygon Amoy (chainId 80002) — current Polygon PoS testnet, Sepolia-anchored.
      url: process.env.AMOY_RPC_URL || 'https://polygon-amoy.drpc.org',
      chainId: 80002,
      // Amoy base fee is ~0; it only needs the ~25 gwei minimum tip. Pin an
      // explicit price so ethers' inflated fee estimate doesn't overspend.
      gasPrice: 30_000_000_000, // 30 gwei
      accounts: privateKey ? [privateKey] : [],
    },
    bscTestnet: {
      // publicnode's BSC-testnet endpoint intermittently fails TLS; Binance's
      // own data-seed endpoint is reliable. Gas price floor ~0.1 gwei.
      url: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      chainId: 97,
      accounts: privateKey ? [privateKey] : [],
    },
  },
}
