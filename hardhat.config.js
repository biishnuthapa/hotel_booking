require('dotenv').config()
require('@nomicfoundation/hardhat-ethers')
require('@nomicfoundation/hardhat-chai-matchers')
require('solidity-coverage')

function normalizePrivateKey(value) {
  if (!value) return undefined
  return value.startsWith('0x') ? value : `0x${value}`
}

// PRIVATE_KEY is intentionally unsupported: the historically committed key is compromised.
const deployerPrivateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY)

module.exports = {
  solidity: {
    version: '0.8.30',
    settings: {
      // Polygon PoS activated Shanghai EIPs, including PUSH0 (EIP-3855), in PIP-23.
      evmVersion: 'shanghai',
      optimizer: {
        enabled: true,
        // Favor deployment/runtime size; booking writes are not high-frequency loops.
        runs: 1,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      initialDate: '2026-03-01T00:00:00.000Z',
    },
    localhost: {
      url: process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    amoy: {
      // Polygon Amoy (chainId 80002) — current Polygon PoS testnet, Sepolia-anchored.
      url: process.env.AMOY_RPC_URL || 'https://polygon-amoy.drpc.org',
      chainId: 80002,
      // Amoy base fee is ~0; it only needs the ~25 gwei minimum tip. Pin an
      // explicit price so ethers' inflated fee estimate doesn't overspend.
      gasPrice: 30_000_000_000, // 30 gwei
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      chainId: 137,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
}
