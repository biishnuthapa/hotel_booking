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
    amoy: {
      url: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
      accounts: privateKey ? [privateKey] : [],
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com',
      accounts: privateKey ? [privateKey] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
      accounts: privateKey ? [privateKey] : [],
    },
  },
}
