const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')

const toWei = (num) => ethers.parseEther(num.toString())

const pinataJsonLinks = [
  'https://chocolate-wrong-swordtail-863.mypinata.cloud/ipfs/bafkreia54nlz6luqj5h6uoqrfdxk22eyc2iyijbfojicnpyzxup4bjpdju',
  'https://chocolate-wrong-swordtail-863.mypinata.cloud/ipfs/bafkreia54nlz6luqj5h6uoqrfdxk22eyc2iyijbfojicnpyzxup4bjpdju',
  'https://chocolate-wrong-swordtail-863.mypinata.cloud/ipfs/bafkreigvt3lcpfrn3kltgzz2gllfs4lvhjfvxt4k7axo7zu5ake3umdpqa',
  'https://chocolate-wrong-swordtail-863.mypinata.cloud/ipfs/bafkreicef7hg2sqabameo2xtvdlbqvhpetxxdui3njaeeitrtmidczhteq',
  'https://chocolate-wrong-swordtail-863.mypinata.cloud/ipfs/bafkreifwlvb3jycqhectb4akvekqazj4yy5gsmf4zsbf2yrfleepicriaq',
]
const dataCount = pinataJsonLinks.length
const maxPrice = 3.5
const imagesUrls = [
  'https://a0.muscache.com/im/pictures/miso/Hosting-3524556/original/24e9b114-7db5-4fab-8994-bc16f263ad1d.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-5264493/original/10d2c21f-84c2-46c5-b20b-b51d1c2c971a.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/prohost-api/Hosting-584469386220279136/original/227d4c26-43d5-42da-ad84-d039515c0bad.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-610511843622686196/original/253bfa1e-8c53-4dc0-a3af-0a75728c0708.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-535385560957380751/original/90cc1db6-d31c-48d5-80e8-47259e750d30.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/b7756897-ef31-4080-b881-c4c7b9ec0df7.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/337660c5-939a-439b-976f-19219dbc80c7.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/7739bab3-6dd7-40bb-82e1-50ae68719b7b.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/49ee362b-b47f-49fa-b8c0-18a41dbd4c4d.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-569315897060112509/original/7db7c768-fb46-4934-904e-74a9771f9a60.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/309bee53-311d-4f07-a2e7-14daadbbfb77.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-660654516377752568/original/be407e38-ad1e-4b2b-a547-2185068229f6.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/miso/Hosting-10989371/original/46c0c87f-d9bc-443c-9b64-24d9e594b54c.jpeg?im_w=1200',
  'https://a0.muscache.com/im/pictures/miso/Hosting-653943444831285144/original/73346136-e0bb-46a8-8ce4-a9fb5229e6b3.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/71993873/b158891b_original.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/prohost-api/Hosting-686901689015576288/original/2cd072fa-8c03-4ef3-a061-268b9b957e28.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/b88162e9-9ce3-4254-8129-2ea8719ab2c3.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/prohost-api/Hosting-585362898291824332/original/8a92bd09-9795-4586-bc32-6ab474d0922b.jpeg?im_w=720',
  'https://a0.muscache.com/im/pictures/3757edd0-8d4d-4d51-9d2e-3000e8c3797e.jpg?im_w=720',
  'https://a0.muscache.com/im/pictures/b7811ddd-b5e6-43ee-aa41-1fa28cf5ef95.jpg?im_w=720',
]

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randomFloat = (min, max, precision = 2) =>
  Number((Math.random() * (max - min) + min).toFixed(precision))

const apartmentWords = ['River', 'Summit', 'Maple', 'Willow', 'Cedar', 'Pine', 'Lakeside', 'Meadow']
const locations = ['Laramie', 'Cheyenne', 'Denver', 'Boulder', 'Fort Collins', 'Jackson']
const descriptionParts = [
  'spacious rooms and mountain views',
  'modern kitchen and quiet neighborhood',
  'walkable location and fast wifi',
  'comfortable beds and bright interiors',
  'easy parking and family-friendly layout',
]

const roomTypeTemplates = [
  {
    name: 'Standard Suite',
    description: 'Ideal for solo travelers and couples.',
    price: 0.08,
    images: 'https://a0.muscache.com/im/pictures/miso/Hosting-3524556/original/24e9b114-7db5-4fab-8994-bc16f263ad1d.jpeg?im_w=720,https://a0.muscache.com/im/pictures/miso/Hosting-5264493/original/10d2c21f-84c2-46c5-b20b-b51d1c2c971a.jpeg?im_w=720',
    capacity: 2,
  },
  {
    name: 'Family Loft',
    description: 'Extra beds and lounge area for families.',
    price: 0.14,
    images: 'https://a0.muscache.com/im/pictures/prohost-api/Hosting-584469386220279136/original/227d4c26-43d5-42da-ad84-d039515c0bad.jpeg?im_w=720,https://a0.muscache.com/im/pictures/miso/Hosting-610511843622686196/original/253bfa1e-8c53-4dc0-a3af-0a75728c0708.jpeg?im_w=720',
    capacity: 4,
  },
]

const metadataDir = path.join(__dirname, '..', 'public', 'assets', 'Metadata')

const fetchMetadata = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status}`)
  }
  const metadata = await response.json()
  return {
    name: typeof metadata?.name === 'string' ? metadata.name.trim() : '',
    description: typeof metadata?.description === 'string' ? metadata.description.trim() : '',
    image: typeof metadata?.image === 'string' ? metadata.image.trim() : '',
  }
}

const generateFakeApartment = async (count) => {
  fs.mkdirSync(metadataDir, { recursive: true })
  const apartments = []
  for (let i = 0; i < count; i++) {
    const id = i + 1
    const name = `${pick(apartmentWords)} ${pick(apartmentWords)} Apartment ${id}`
    const description = `A cozy stay with ${pick(descriptionParts)}.`
    const location = pick(locations)
    const price = randomFloat(0.1, maxPrice, 2)
    const rooms = randomInt(2, 5)
    const latitude = (25 + Math.random() * 24).toFixed(6)
    const longitude = (-124 + Math.random() * 58).toFixed(6)
    const images = []

    for (let i = 0; i < 5; i++) {
      images.push(shuffleArray(imagesUrls)[0])
    }

    const pinataJsonLink = pinataJsonLinks[i]
    const metadata = await fetchMetadata(pinataJsonLink)
    if (!metadata.name || !metadata.description || !metadata.image) {
      throw new Error(`Invalid metadata at ${pinataJsonLink}`)
    }

    apartments.push({
      id,
      name,
      description,
      location,
      images: images.join(','),
      rooms,
      latitude,
      longitude,
      pinataJsonLink,
      nftName: metadata.name,
      nftDescription: metadata.description,
      nftImageUrl: metadata.image,
    })
  }

  return apartments
}

async function createApartments(contract, apartment) {
  const tx = await contract.createAppartment(
    apartment.name,
    apartment.description,
    apartment.location,
    apartment.images,
    apartment.rooms,
    apartment.latitude,
    apartment.longitude,
    apartment.pinataJsonLink,
    apartment.nftName,
    apartment.nftDescription,
    apartment.nftImageUrl
  )
  await tx.wait()
}

async function seedRoomTypes(contract, apartmentId) {
  for (const roomType of roomTypeTemplates) {
    const tx = await contract.addRoomTypeToApartment(
      apartmentId,
      roomType.name,
      roomType.description,
      toWei(roomType.price),
      roomType.images,
      roomType.capacity
    )
    await tx.wait()
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function clearData(contract, ownerSigner) {
  const apartments = await contract.getApartments()
  const apartmentIds = apartments.map((apartment) => apartment.id)

  for (const apartmentId of apartmentIds) {
    try {
      const bookings = await contract.getBookings(apartmentId)
      for (const booking of bookings) {
        if (booking.status === 0) {
          await contract.connect(ownerSigner).refundBooking(apartmentId, booking.id)
          await delay(300)
        }
      }
      const apartment = apartments.find((a) => a.id === apartmentId)
      if (apartment && apartment.owner.toLowerCase() === ownerSigner.address.toLowerCase()) {
        await contract.connect(ownerSigner).deleteAppartment(apartmentId)
        await delay(300)
      }
    } catch (error) {
      console.error(`Error clearing apartment ${apartmentId}:`, error)
    }
  }
}

async function main() {
  let hospitalityBookingContract

  try {
    const [deployer] = await ethers.getSigners()
    const contractAddresses = fs.readFileSync('./contracts/contractAddress.json', 'utf8')
    const { hospitalityBookingContract: hospitalityBookingAddress } = JSON.parse(contractAddresses)

    hospitalityBookingContract = await ethers.getContractAt(
      'HospitalityBookingNFT',
      hospitalityBookingAddress
    )

    await clearData(hospitalityBookingContract, deployer)
    console.log('Previous data cleared (refunded + deleted where owner matched)...')

    const apartments = await generateFakeApartment(dataCount)
    for (const apartment of apartments) {
      await createApartments(hospitalityBookingContract.connect(deployer), apartment)
      await seedRoomTypes(hospitalityBookingContract.connect(deployer), apartment.id)
      await delay(200)
    }

    console.log('Items dummy data seeded...')
  } catch (error) {
    console.error('Unhandled error:', error)
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exitCode = 1
})
