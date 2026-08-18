/**
 * Checks in the booking minted by demo-amoy.js, demonstrating dynamic on-chain
 * NFT metadata: the same token's tokenURI "Status" attribute flips Booked -> CheckedIn.
 *
 * Run: npx hardhat run scripts/checkin-amoy.js --network amoy
 */
const { ethers, network } = require('hardhat')
const fs = require('fs')
const path = require('path')

const decodeStatus = (tokenURI) => {
  const json = JSON.parse(Buffer.from(tokenURI.split('base64,')[1], 'base64').toString('utf8'))
  const attrs = Object.fromEntries(json.attributes.map((a) => [a.trait_type, a.value]))
  return { status: attrs['Status'], name: json.name }
}

async function main() {
  const resultPath = path.join(__dirname, 'demo-amoy-result.json')
  const demo = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
  const { contract: address, apartmentId, tokenId, checkInTimestamp } = demo

  const [account] = await ethers.getSigners()
  const contract = await ethers.getContractAt('HospitalityBookingNFT', address, account)

  const before = await contract.tokenURI(tokenId)
  console.log(`Token #${tokenId} status BEFORE:`, decodeStatus(before).status, '(0 = Booked)')

  const now = Math.floor(Date.now() / 1000)
  if (now < checkInTimestamp) {
    const wait = checkInTimestamp - now + 5
    console.log(`Check-in opens in ~${wait}s; waiting...`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }

  console.log('Sending checkInApartment...')
  const tx = await contract.checkInApartment(apartmentId, 0)
  const receipt = await tx.wait()

  const after = await contract.tokenURI(tokenId)
  const explorer = 'https://amoy.polygonscan.com'

  console.log(`Token #${tokenId} status AFTER: `, decodeStatus(after).status, '(2 = CheckedIn)')
  console.log(`\nCheck-in tx: ${explorer}/tx/${receipt.hash}`)

  demo.checkInTxHash = receipt.hash
  demo.finalStatus = 'CheckedIn'
  fs.writeFileSync(resultPath, JSON.stringify(demo, null, 2))
  console.log('Updated scripts/demo-amoy-result.json')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
