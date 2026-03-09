const { ethers, network } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners()
  const provider = deployer.provider
  const net = await provider.getNetwork()
  const balance = await provider.getBalance(deployer.address)
  const feeData = await provider.getFeeData()

  const factory = await ethers.getContractFactory('HospitalityBookingNFT')
  const deployTxReq = await factory.getDeployTransaction(7, 5)
  deployTxReq.from = deployer.address

  const gasEstimate = await provider.estimateGas(deployTxReq)
  const gasPrice = feeData.gasPrice || 0n
  const estimatedDeployCost = gasEstimate * gasPrice

  const result = {
    network: network.name,
    chainId: net.chainId.toString(),
    deployer: deployer.address,
    balanceWei: balance.toString(),
    balanceNative: ethers.formatEther(balance),
    gasPriceWei: gasPrice.toString(),
    gasEstimateDeploy: gasEstimate.toString(),
    estimatedDeployCostWei: estimatedDeployCost.toString(),
    estimatedDeployCostNative: ethers.formatEther(estimatedDeployCost),
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
