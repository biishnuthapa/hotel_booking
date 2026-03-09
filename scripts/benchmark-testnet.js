const { ethers, network } = require('hardhat')
const fs = require('fs')

function nowMs() {
  return Date.now()
}

async function sendAndMeasure(label, txPromise) {
  const start = nowMs()
  const tx = await txPromise
  const receipt = await tx.wait()
  const end = nowMs()

  const gasUsed = receipt.gasUsed
  const effectiveGasPrice = receipt.gasPrice || receipt.effectiveGasPrice || 0n
  const feePaidWei = gasUsed * effectiveGasPrice

  return {
    label,
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    status: receipt.status,
    gasUsed: gasUsed.toString(),
    gasPriceWei: effectiveGasPrice.toString(),
    feePaidNative: ethers.formatEther(feePaidWei),
    confirmMs: end - start,
  }
}

async function main() {
  const [deployer, host, tenant] = await ethers.getSigners()
  const chainId = (await deployer.provider.getNetwork()).chainId

  if (chainId === 137n) {
    throw new Error('Refusing to run benchmark on Polygon mainnet (chainId 137). Use a testnet network.')
  }

  const taxPercent = 7
  const securityFeePercent = 5

  const deployStart = nowMs()
  const contract = await ethers.deployContract('HospitalityBookingNFT', [taxPercent, securityFeePercent])
  await contract.waitForDeployment()
  const deployEnd = nowMs()

  const deploymentTx = contract.deploymentTransaction()
  const deploymentReceipt = deploymentTx ? await deploymentTx.wait() : null
  const deploymentGasUsed = deploymentReceipt ? deploymentReceipt.gasUsed : 0n
  const deploymentGasPrice =
    deploymentReceipt?.gasPrice || deploymentReceipt?.effectiveGasPrice || 0n
  const deploymentFeeWei = deploymentGasUsed * deploymentGasPrice

  const addressPayload = JSON.stringify(
    {
      hospitalityBookingContract: contract.target,
    },
    null,
    2
  )
  fs.writeFileSync('./contracts/contractAddress.json', addressPayload, 'utf8')

  const tests = []
  const block = await ethers.provider.getBlock('latest')
  const bookingDate = Number(block.timestamp) + 3600

  tests.push(
    await sendAndMeasure(
      'createAppartment',
      contract
        .connect(host)
        .createAppartment(
          'Benchmark Apartment',
          'Created during testnet benchmark run',
          'Wyoming',
          [
            'https://a0.muscache.com/im/pictures/miso/Hosting-3524556/original/24e9b114-7db5-4fab-8994-bc16f263ad1d.jpeg?im_w=1200',
            'https://a0.muscache.com/im/pictures/miso/Hosting-5264493/original/10d2c21f-84c2-46c5-b20b-b51d1c2c971a.jpeg?im_w=1200',
            'https://a0.muscache.com/im/pictures/prohost-api/Hosting-584469386220279136/original/227d4c26-43d5-42da-ad84-d039515c0bad.jpeg?im_w=1200',
            'https://a0.muscache.com/im/pictures/miso/Hosting-610511843622686196/original/253bfa1e-8c53-4dc0-a3af-0a75728c0708.jpeg?im_w=1200',
            'https://a0.muscache.com/im/pictures/miso/Hosting-535385560957380751/original/90cc1db6-d31c-48d5-80e8-47259e750d30.jpeg?im_w=1200',
          ].join(','),
          2,
          ethers.parseEther('0.01'),
          '41.31',
          '-105.59',
          'https://ipfs.io/ipfs/bafkreigh2akiscaildc6xv5n2xg2z2z6j5pkzuyit7w3gq2mmbt7xg4wzi'
        )
    )
  )

  const bookingAmount = ethers.parseEther('0.01')
  const totalFee = (bookingAmount * 5n) / 100n
  const totalValue = bookingAmount + totalFee

  tests.push(
    await sendAndMeasure(
      'bookApartment',
      contract.connect(tenant).bookApartment(1, [bookingDate], { value: totalValue })
    )
  )

  tests.push(
    await sendAndMeasure(
      'addRoomTypeToApartment',
      contract
        .connect(host)
        .addRoomTypeToApartment(
          1,
          'Deluxe',
          'Benchmark room type',
          ethers.parseEther('0.01'),
          'https://raw.githubusercontent.com/bthapa-hub/hotel_booking_assets/main/room-details.json',
          2
        )
    )
  )

  tests.push(await sendAndMeasure('refundBooking', contract.connect(tenant).refundBooking(1, 0)))

  const result = {
    network: network.name,
    chainId: chainId.toString(),
    deployer: deployer.address,
    host: host.address,
    tenant: tenant.address,
    contract: contract.target,
    deployment: {
      txHash: deploymentTx?.hash,
      confirmMs: deployEnd - deployStart,
      gasUsed: deploymentGasUsed.toString(),
      gasPriceWei: deploymentGasPrice.toString(),
      feePaidNative: ethers.formatEther(deploymentFeeWei),
    },
    tests,
    generatedAt: new Date().toISOString(),
  }

  fs.writeFileSync('./scripts/benchmark-result.json', JSON.stringify(result, null, 2), 'utf8')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
