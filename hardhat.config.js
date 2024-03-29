require('dotenv').config()
require('@nomicfoundation/hardhat-toolbox')
module.exports = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    mumbai: {
      url: 'https://testnet.bitfinity.network',
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
}