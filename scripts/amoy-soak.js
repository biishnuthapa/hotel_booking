/**
 * Stateful 14-day Amoy soak test.
 *
 * Start once:
 *   SOAK_ACTION=start npx hardhat run scripts/amoy-soak.js --network amoy
 *
 * Check (and perform any due lifecycle transition) at least daily:
 *   npx hardhat run scripts/amoy-soak.js --network amoy
 *
 * Wallet keys and progress are kept in the gitignored `.soak/<chainId>.json`
 * with owner-only permissions. The state is written before wallets are funded,
 * so an interrupted run cannot strand an unrecoverable wallet.
 */
const fs = require('fs')
const path = require('path')
const { ethers, network } = require('hardhat')

const DAY = 86_400
const MINIMUM_SOAK_SECONDS = 14 * DAY
const FUND = ethers.parseEther(process.env.SOAK_FUND_POL || '0.04')
const MINIMUM_BOOKING_GAS = ethers.parseEther(process.env.SOAK_BOOKING_GAS_POL || '0.06')
const STATE_DIRECTORY = path.join(__dirname, '..', '.soak')

function deploymentFile(chainId) {
  return path.join(__dirname, '..', 'contracts', 'deployments', `${chainId}.json`)
}

function stateFile(chainId) {
  return path.join(STATE_DIRECTORY, `${chainId}.json`)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  fs.chmodSync(file, 0o600)
}

async function record(state, label, transaction) {
  const receipt = await transaction.wait()
  state.transactions.push({
    label,
    hash: receipt.hash,
    block: receipt.blockNumber,
    confirmedAt: new Date().toISOString(),
  })
  writeState(state.file, state)
  console.log(`${label.padEnd(28)} ${receipt.hash}`)
  return receipt
}

function recorded(state, label) {
  return state.transactions.find((transaction) => transaction.label === label)
}

async function recordedReceipt(state, label) {
  const transaction = recorded(state, label)
  if (!transaction) return null
  return ethers.provider.getTransactionReceipt(transaction.hash)
}

function eventArgument(contract, receipt, eventName, argumentName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log)
      if (parsed?.name === eventName) return parsed.args[argumentName]
    } catch {
      // Ignore logs emitted by other contracts in the same transaction.
    }
  }
  throw new Error(`Transaction ${receipt.hash} did not emit ${eventName}`)
}

async function assertLiabilityInvariant(booking, token, state) {
  const [balance, activeEscrow, pending] = await Promise.all([
    token.balanceOf(await booking.getAddress()),
    booking.totalActiveEscrow(),
    booking.totalPendingWithdrawals(),
  ])
  const liabilities = activeEscrow + pending
  if (balance < liabilities) {
    throw new Error(`Liability invariant failed: balance ${balance} < liabilities ${liabilities}`)
  }
  const latest = {
    checkedAt: new Date().toISOString(),
    tokenBalance: balance.toString(),
    activeEscrow: activeEscrow.toString(),
    pendingWithdrawals: pending.toString(),
  }
  state.checks.push(latest)
  writeState(state.file, state)
  console.log(`liability invariant          ${balance} >= ${liabilities}`)
}

async function start(chainId, deployment, deployer, file) {
  if (!deployment.mockPaymentToken) {
    throw new Error('The automated testnet soak requires the deployment MockUSDC.')
  }

  let state
  if (fs.existsSync(file)) {
    state = readJson(file)
    if (state.phase !== 'initializing') {
      throw new Error(`Soak already initialized at ${file}; run the check command instead.`)
    }
    if (state.contracts.HospitalityBooking !== deployment.contracts.HospitalityBooking) {
      throw new Error('Partial soak state belongs to a different deployment.')
    }
    state.file = file
    console.log('resuming                     interrupted initialization')
  } else {
    const latest = await ethers.provider.getBlock('latest')
    const freshHost = ethers.Wallet.createRandom()
    const freshGuest = ethers.Wallet.createRandom()
    state = {
      schemaVersion: 1,
      chainId,
      network: network.name,
      deploymentBlock: deployment.deploymentBlock,
      contracts: deployment.contracts,
      startedAt: new Date().toISOString(),
      startedAtTimestamp: Number(latest.timestamp),
      minimumEndTimestamp: Number(latest.timestamp) + MINIMUM_SOAK_SECONDS,
      phase: 'initializing',
      wallets: {
        host: { address: freshHost.address, privateKey: freshHost.privateKey },
        guest: { address: freshGuest.address, privateKey: freshGuest.privateKey },
      },
      transactions: [],
      checks: [],
      file,
    }
    writeState(file, state)
  }

  const host = new ethers.Wallet(state.wallets.host.privateKey, ethers.provider)
  const guest = new ethers.Wallet(state.wallets.guest.privateKey, ethers.provider)

  console.log(`network                      ${network.name} (${chainId})`)
  console.log(`deployment block             ${deployment.deploymentBlock}`)
  console.log(`host                         ${host.address}`)
  console.log(`guest                        ${guest.address}`)
  console.log(`state                        ${file}`)

  if (!recorded(state, 'fund host gas')) {
    await record(state, 'fund host gas', await deployer.sendTransaction({ to: host.address, value: FUND }))
  }
  if (!recorded(state, 'fund guest gas')) {
    await record(state, 'fund guest gas', await deployer.sendTransaction({ to: guest.address, value: FUND }))
  }

  const booking = await ethers.getContractAt(
    'HospitalityBooking',
    deployment.contracts.HospitalityBooking
  )
  const token = await ethers.getContractAt('MockUSDC', deployment.contracts.paymentToken)
  const decimals = Number(await token.decimals())
  const price = ethers.parseUnits(process.env.SOAK_PRICE || '25', decimals)

  const checkInDay = Math.floor(state.startedAtTimestamp / DAY) + 1
  const checkOutDay = checkInDay + 12
  const offsetMinutes = Math.floor((state.startedAtTimestamp % DAY) / 60)
  const basePrice = price * BigInt(checkOutDay - checkInDay)
  const deposit = (basePrice * BigInt(deployment.parameters.securityDepositBps)) / 10_000n
  const total = basePrice + deposit

  if (!recorded(state, 'mint guest MockUSDC')) {
    await record(state, 'mint guest MockUSDC', await token.mint(guest.address, total))
  }

  let listingReceipt = await recordedReceipt(state, 'create soak listing')
  if (!listingReceipt) {
    listingReceipt = await record(
      state,
      'create soak listing',
      await booking
        .connect(host)
        .createListing(
          `14-day Amoy soak ${state.startedAt.slice(0, 10)}`,
          'ipfs://bafyreihospitalitysoaklisting',
          'ipfs://bafyreihospitalitysoakimage',
          2,
          offsetMinutes,
          offsetMinutes
        )
    )
  }
  const listingId = eventArgument(booking, listingReceipt, 'ListingCreated', 'listingId')

  let roomReceipt = await recordedReceipt(state, 'add soak room type')
  if (!roomReceipt) {
    roomReceipt = await record(
      state,
      'add soak room type',
      await booking
        .connect(host)
        .addRoomType(
          listingId,
          'Soak suite',
          'ipfs://bafyreihospitalitysoakroom',
          price,
          2
        )
    )
  }
  const roomTypeId = eventArgument(booking, roomReceipt, 'RoomTypeCreated', 'roomTypeId')

  if (!recorded(state, 'approve booking escrow')) {
    await record(
      state,
      'approve booking escrow',
      await token.connect(guest).approve(deployment.contracts.HospitalityBooking, total)
    )
  }
  if (!recorded(state, 'book 12-night stay')) {
    const gasBalance = await ethers.provider.getBalance(guest.address)
    if (gasBalance < MINIMUM_BOOKING_GAS) {
      await record(
        state,
        'top up guest booking gas',
        await deployer.sendTransaction({ to: guest.address, value: MINIMUM_BOOKING_GAS - gasBalance })
      )
    }
  }
  let bookingReceipt = await recordedReceipt(state, 'book 12-night stay')
  if (!bookingReceipt) {
    bookingReceipt = await record(
      state,
      'book 12-night stay',
      await booking.connect(guest).book(listingId, roomTypeId, 1, checkInDay, checkOutDay)
    )
  }
  const bookingId = eventArgument(booking, bookingReceipt, 'BookingCreated', 'bookingId')
  const booked = await booking.getBooking(bookingId)

  state.phase = 'booked'
  state.listingId = listingId.toString()
  state.roomTypeId = roomTypeId.toString()
  state.bookingId = bookingId.toString()
  state.schedule = {
    checkInDay,
    checkOutDay,
    scheduledCheckIn: Number(booked.scheduledCheckIn),
    checkInDeadline: Number(booked.checkInDeadline),
    scheduledCheckout: Number(booked.scheduledCheckout),
    disputeWindowCloses: Number(booked.scheduledCheckout) + DAY,
  }
  writeState(file, state)
  await assertLiabilityInvariant(booking, token, state)
  console.log(`check-in due                 ${new Date(state.schedule.scheduledCheckIn * 1000).toISOString()}`)
  console.log(`minimum finish               ${new Date(state.minimumEndTimestamp * 1000).toISOString()}`)
}

async function check(chainId, deployment, deployer, file) {
  if (!fs.existsSync(file)) {
    throw new Error(`No soak state at ${file}; run once with SOAK_ACTION=start.`)
  }
  const state = readJson(file)
  state.file = file
  state.transactions ||= []
  state.checks ||= []
  if (state.chainId !== chainId) throw new Error('Soak state chain does not match the active network.')
  if (state.contracts.HospitalityBooking !== deployment.contracts.HospitalityBooking) {
    throw new Error('Soak state belongs to a different deployment; refusing to mix deployments.')
  }

  const host = new ethers.Wallet(state.wallets.host.privateKey, ethers.provider)
  const guest = new ethers.Wallet(state.wallets.guest.privateKey, ethers.provider)
  const booking = await ethers.getContractAt(
    'HospitalityBooking',
    state.contracts.HospitalityBooking
  )
  const token = await ethers.getContractAt('MockUSDC', state.contracts.paymentToken)
  const latest = await ethers.provider.getBlock('latest')
  const now = Number(latest.timestamp)
  let booked = await booking.getBooking(state.bookingId)

  console.log(`network                      ${network.name} (${chainId})`)
  console.log(`booking                      ${state.bookingId}`)
  console.log(`elapsed days                 ${((now - state.startedAtTimestamp) / DAY).toFixed(2)}`)
  console.log(`status                       ${Number(booked.status)}`)

  if (Number(booked.status) === 0 && now >= Number(booked.scheduledCheckIn)) {
    if (now > Number(booked.checkInDeadline)) {
      state.phase = 'failed-missed-check-in'
      writeState(file, state)
      throw new Error('The soak check-in window was missed.')
    }
    const signature = await host.signTypedData(
      {
        name: 'HospitalityBooking',
        version: '1',
        chainId,
        verifyingContract: state.contracts.HospitalityBooking,
      },
      {
        CheckInAuthorization: [
          { name: 'bookingId', type: 'uint256' },
          { name: 'guest', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'validAfter', type: 'uint64' },
          { name: 'validUntil', type: 'uint64' },
        ],
      },
      {
        bookingId: booked.id,
        guest: guest.address,
        nonce: booked.authorizationNonce,
        validAfter: booked.scheduledCheckIn,
        validUntil: booked.checkInDeadline,
      }
    )
    await record(
      state,
      'host-attested check-in',
      await booking
        .connect(guest)
        .checkInAttested(
          booked.id,
          booked.scheduledCheckIn,
          booked.checkInDeadline,
          booked.authorizationNonce,
          signature
        )
    )
    if ((await booking.pendingWithdrawals(guest.address)) > 0n) {
      await record(state, 'guest deposit withdrawal', await booking.connect(guest).withdraw())
    }
    state.phase = 'checked-in'
    writeState(file, state)
    booked = await booking.getBooking(state.bookingId)
  }

  const canFinish =
    Number(booked.status) === 2 &&
    now > state.schedule.disputeWindowCloses &&
    now >= state.minimumEndTimestamp
  if (canFinish) {
    await record(state, 'permissionless completion', await booking.completeStay(booked.id))
    if ((await booking.pendingWithdrawals(host.address)) > 0n) {
      await record(state, 'host payout withdrawal', await booking.connect(host).withdraw())
    }
    if ((await booking.pendingWithdrawals(deployer.address)) > 0n) {
      await record(state, 'treasury withdrawal', await booking.connect(deployer).withdraw())
    }
    state.phase = 'completed'
    state.completedAt = new Date().toISOString()
    writeState(file, state)
  }

  await assertLiabilityInvariant(booking, token, state)
  console.log(`phase                        ${state.phase}`)
  if (state.phase !== 'completed') {
    console.log(`next check                   run this command again within 24 hours`)
  }
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  if (chainId !== 80002) throw new Error('This soak workflow is restricted to Polygon Amoy.')
  const deploymentPath = deploymentFile(chainId)
  if (!fs.existsSync(deploymentPath)) throw new Error(`Missing deployment ${deploymentPath}`)
  const deployment = readJson(deploymentPath)
  const [deployer] = await ethers.getSigners()
  if (!deployer) throw new Error('No signer. Set DEPLOYER_PRIVATE_KEY in .env.')

  const file = stateFile(chainId)
  const action = process.env.SOAK_ACTION || 'check'
  if (action === 'start') return start(chainId, deployment, deployer, file)
  if (action === 'check') return check(chainId, deployment, deployer, file)
  throw new Error(`Unknown SOAK_ACTION ${action}; expected start or check.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
