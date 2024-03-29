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
      url: 'https://polygon-mumbai.g.alchemy.com/v2/YOem_tciIfjXY-qDfFpUFYUxgsgMr8MN',
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
}
