/**
 * Deploys HospitalityBookingNFT to a live network and runs one real booking so
 * a proof-of-stay NFT is minted on-chain — for paper screenshots / verification
 * on a public explorer.
 *
 * Uses the real IPFS-pinned metadata (see NFT_IMAGE / NFT_METADATA below).
 * A single funded account plays host and tenant (fine on a testnet).
 *
 * Run: npx hardhat run scripts/demo-amoy.js --network amoy
 * Output: scripts/demo-amoy-result.json + console links.
 */
const { ethers, network } = require('hardhat')
const fs = require('fs')
const path = require('path')

// Real pins created via the app's /api/pinata/pin route (Pinata account).
const NFT_IMAGE = 'https://gateway.pinata.cloud/ipfs/Qmdu2cdztFaixe6SkHDSfnRGbetmzWx75Jrn8a7r9hSVZU'
const NFT_METADATA = 'ipfs://Qma6WCRpW4QCJkMCrkx4bk6qmVmnbft92N4VWgSxChTEzq'

const TAX_PERCENT = 7
const SECURITY_FEE = 5

async function main() {
  const [account] = await ethers.getSigners()
  const chainId = (await account.provider.getNetwork()).chainId
  const balance = await account.provider.getBalance(account.address)

  console.log(`Network: ${network.name} (chainId ${chainId})`)
  console.log(`Account: ${account.address}`)
  console.log(`Balance: ${ethers.formatEther(balance)} POL\n`)

  // ---- Deploy ----
  console.log('Deploying HospitalityBookingNFT...')
  const contract = await ethers.deployContract('HospitalityBookingNFT', [TAX_PERCENT, SECURITY_FEE])
  await contract.waitForDeployment()
  const address = await contract.getAddress()
  console.log(`  deployed at ${address}`)

  // ---- Create apartment (with real IPFS image) ----
  console.log('Creating apartment...')
  let tx = await contract.createAppartment(
    'Lakeside Meadow Apartment',
    'A cozy lakeside stay with walkable location and fast wifi.',
    'Laramie, Wyoming',
    'https://a0.muscache.com/im/pictures/miso/Hosting-3524556/original/24e9b114-7db5-4fab-8994-bc16f263ad1d.jpeg?im_w=1200',
    4,
    '41.3114',
    '-105.5911',
    NFT_METADATA,
    'Lakeside Meadow Stay Pass',
    'Proof-of-stay check-in NFT for a booking at Lakeside Meadow Apartment.',
    NFT_IMAGE
  )
  await tx.wait()
  const aid = 1

  // ---- Add a room type ----
  console.log('Adding room type...')
  tx = await contract.addRoomTypeToApartment(
    aid,
    'Deluxe Double',
    'Two queen beds, lake view',
    ethers.parseEther('0.0001'),
    'https://gateway.pinata.cloud/ipfs/Qmdu2cdztFaixe6SkHDSfnRGbetmzWx75Jrn8a7r9hSVZU',
    3
  )
  await tx.wait()

  // ---- Book it (mints the NFT) ----
  console.log('Booking (mints proof-of-stay NFT)...')
  const block = await ethers.provider.getBlock('latest')
  const checkIn = Number(block.timestamp) + 90 // ~90s out, so we can check in shortly
  const price = ethers.parseEther('0.0001')
  const fee = (price * BigInt(SECURITY_FEE)) / 100n
  tx = await contract.bookApartment(aid, 0, 1, [checkIn], { value: price + fee })
  const receipt = await tx.wait()

  const bookings = await contract.getBookings(aid)
  const booking = bookings[0]
  const tokenId = booking.tokenId
  const tokenURI = await contract.tokenURI(tokenId)

  // Decode the on-chain metadata for confirmation
  const decoded = JSON.parse(
    Buffer.from(tokenURI.split('base64,')[1], 'base64').toString('utf8')
  )

  const explorer =
    chainId === 80002n ? 'https://amoy.polygonscan.com' : 'https://testnet.bscscan.com'

  const result = {
    network: network.name,
    chainId: chainId.toString(),
    contract: address,
    account: account.address,
    apartmentId: aid,
    tokenId: tokenId.toString(),
    bookTxHash: receipt.hash,
    checkInTimestamp: checkIn,
    nftImage: NFT_IMAGE,
    nftMetadataIpfs: NFT_METADATA,
    onChainTokenURIName: decoded.name,
    onChainTokenURIImage: decoded.image,
    links: {
      contract: `${explorer}/address/${address}`,
      bookTx: `${explorer}/tx/${receipt.hash}`,
      openseaTestnet:
        chainId === 80002n
          ? `https://testnets.opensea.io/assets/amoy/${address}/${tokenId}`
          : null,
    },
    generatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(__dirname, 'demo-amoy-result.json'),
    JSON.stringify(result, null, 2)
  )

  console.log('\n===== MINTED =====')
  console.log(`Contract:  ${result.links.contract}`)
  console.log(`Book tx:   ${result.links.bookTx}`)
  console.log(`Token #${tokenId} — on-chain name: "${decoded.name}"`)
  console.log(`NFT image: ${decoded.image}`)
  if (result.links.openseaTestnet) console.log(`OpenSea:   ${result.links.openseaTestnet}`)
  console.log(`\nCheck-in opens at unix ${checkIn} (~90s); run check-in separately if desired.`)
  console.log('Saved: scripts/demo-amoy-result.json')

  const finalBal = await account.provider.getBalance(account.address)
  console.log(`\nRemaining balance: ${ethers.formatEther(finalBal)} POL`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
