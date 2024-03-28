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
      url: 'https://polygon-amoy.g.alchemy.com/v2/mwYAzy0HL3Vnxos255Iqbf5GCLtE54Kn',
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
}
