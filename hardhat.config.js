require('dotenv').config()
require('@nomicfoundation/hardhat-toolbox')
module.exports = {
  solidity: '0.8.4', // Or any other version
  networks: {
    mumbai: {
      url: 'https://polygon-mumbai.g.alchemy.com/v2/YOem_tciIfjXY-qDfFpUFYUxgsgMr8MN',
      accounts: [`0x${process.env.PRIVATE_KEY}`],
    },
  },
}
