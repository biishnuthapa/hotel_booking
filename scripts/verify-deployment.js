const fs = require('fs')
const path = require('path')
const { artifacts, ethers } = require('hardhat')

const SOURCIFY_API = 'https://sourcify.dev/server'
const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'
const POLL_INTERVAL_MS = 3_000
const POLL_LIMIT = 60

const CONTRACT_PATHS = {
  HospitalityBooking: 'contracts/HospitalityBooking.sol:HospitalityBooking',
  ReviewRegistry: 'contracts/ReviewRegistry.sol:ReviewRegistry',
  BookingLens: 'contracts/BookingLens.sol:BookingLens',
  HospitalityBookingMetadata:
    'contracts/HospitalityBookingMetadata.sol:HospitalityBookingMetadata',
  MockUSDC: 'contracts/MockUSDC.sol:MockUSDC',
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function responseJson(response) {
  const body = await response.text()
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`Verifier returned HTTP ${response.status} with a non-JSON response`)
  }
  if (!response.ok) {
    throw new Error(parsed.message || parsed.error || `Verifier returned HTTP ${response.status}`)
  }
  return parsed
}

async function lookupSourcify(chainId, address) {
  const response = await fetch(`${SOURCIFY_API}/v2/contract/${chainId}/${address}`)
  if (response.status === 404) return null
  return responseJson(response)
}

async function verifyOnSourcify(name, chainId, address, creationTransactionHash) {
  const existing = await lookupSourcify(chainId, address)
  if (existing?.match) {
    console.log(`${name.padEnd(29)} Sourcify ${existing.match}`)
    return existing
  }

  const contractIdentifier = CONTRACT_PATHS[name]
  const buildInfo = await artifacts.getBuildInfo(contractIdentifier)
  if (!buildInfo) throw new Error(`Missing Hardhat build info for ${contractIdentifier}`)

  const payload = {
    stdJsonInput: buildInfo.input,
    compilerVersion: buildInfo.solcLongVersion,
    contractIdentifier,
  }
  if (creationTransactionHash) payload.creationTransactionHash = creationTransactionHash

  const submission = await responseJson(
    await fetch(`${SOURCIFY_API}/v2/verify/${chainId}/${address}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  )
  if (!submission.verificationId) {
    throw new Error(`${name} Sourcify submission did not return a verification ID`)
  }

  let result = submission
  for (let attempt = 0; !result.isJobCompleted && attempt < POLL_LIMIT; attempt += 1) {
    await wait(POLL_INTERVAL_MS)
    result = await responseJson(
      await fetch(`${SOURCIFY_API}/v2/verify/${submission.verificationId}`)
    )
  }
  if (!result.isJobCompleted) throw new Error(`${name} Sourcify verification timed out`)
  if (result.error) {
    throw new Error(
      `${name} Sourcify verification failed: ${result.error.message || JSON.stringify(result.error)}`
    )
  }
  if (!result.contract?.match) throw new Error(`${name} Sourcify verification completed without a match`)
  console.log(`${name.padEnd(29)} Sourcify ${result.contract.match}`)
  return result.contract
}

async function verifyOnPolygonScan(name, address, constructorArguments) {
  if (!process.env.POLYGONSCAN_API_KEY) {
    console.log(`${name.padEnd(29)} PolygonScan skipped (POLYGONSCAN_API_KEY is not set)`)
    return
  }
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const apiKey = process.env.POLYGONSCAN_API_KEY
  const lookup = new URL(ETHERSCAN_API)
  lookup.search = new URLSearchParams({
    chainid: String(chainId),
    module: 'contract',
    action: 'getsourcecode',
    address,
    apikey: apiKey,
  })
  const current = await responseJson(await fetch(lookup))
  if (current.status === '1' && current.result?.[0]?.SourceCode) {
    console.log(`${name.padEnd(29)} PolygonScan already verified`)
    return
  }

  const contractIdentifier = CONTRACT_PATHS[name]
  const buildInfo = await artifacts.getBuildInfo(contractIdentifier)
  const artifact = await artifacts.readArtifact(name)
  if (!buildInfo) throw new Error(`Missing Hardhat build info for ${contractIdentifier}`)
  const constructor = artifact.abi.find((entry) => entry.type === 'constructor')
  const types = constructor?.inputs?.map((input) => input.type) || []
  const encodedArguments = ethers.AbiCoder.defaultAbiCoder()
    .encode(types, constructorArguments || [])
    .slice(2)
  const body = new URLSearchParams({
    chainid: String(chainId),
    module: 'contract',
    action: 'verifysourcecode',
    apikey: apiKey,
    contractaddress: address,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: 'solidity-standard-json-input',
    contractname: contractIdentifier,
    compilerversion: `v${buildInfo.solcLongVersion}`,
    optimizationUsed: buildInfo.input.settings.optimizer?.enabled ? '1' : '0',
    runs: String(buildInfo.input.settings.optimizer?.runs || 200),
    constructorArguments: encodedArguments,
    evmVersion: buildInfo.input.settings.evmVersion || 'default',
    licenseType: '3',
  })
  let result = await responseJson(
    await fetch(ETHERSCAN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  )
  if (result.status !== '1') {
    if (/already verified/i.test(result.result || '')) {
      console.log(`${name.padEnd(29)} PolygonScan already verified`)
      return
    }
    throw new Error(`${name} PolygonScan submission failed: ${result.result || result.message}`)
  }

  const guid = result.result
  for (let attempt = 0; attempt < POLL_LIMIT; attempt += 1) {
    await wait(POLL_INTERVAL_MS)
    const status = new URL(ETHERSCAN_API)
    status.search = new URLSearchParams({
      chainid: String(chainId),
      module: 'contract',
      action: 'checkverifystatus',
      guid,
      apikey: apiKey,
    })
    result = await responseJson(await fetch(status))
    if (result.status === '1' && /Pass - Verified/i.test(result.result || '')) {
      console.log(`${name.padEnd(29)} PolygonScan verified`)
      return
    }
    if (!/Pending in queue/i.test(result.result || '')) {
      throw new Error(`${name} PolygonScan verification failed: ${result.result || result.message}`)
    }
  }
  throw new Error(`${name} PolygonScan verification timed out`)
}

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const file = path.join(__dirname, '..', 'contracts', 'deployments', `${chainId}.json`)
  if (!fs.existsSync(file)) throw new Error(`Missing deployment record ${file}`)
  const deployment = JSON.parse(fs.readFileSync(file, 'utf8'))

  const contracts = [
    ['HospitalityBooking', deployment.contracts.HospitalityBooking],
    ['ReviewRegistry', deployment.contracts.ReviewRegistry],
    ['BookingLens', deployment.contracts.BookingLens],
    ['HospitalityBookingMetadata', deployment.contracts.HospitalityBookingMetadata],
  ]
  if (deployment.mockPaymentToken) contracts.push(['MockUSDC', deployment.contracts.paymentToken])

  for (const [name, address] of contracts) {
    const code = await ethers.provider.getCode(address)
    if (code === '0x') throw new Error(`${name} has no bytecode at ${address}`)
    await verifyOnPolygonScan(name, address, deployment.constructorArguments[name])
    const transactionKey = name === 'MockUSDC' ? 'paymentToken' : name
    await verifyOnSourcify(
      name,
      chainId,
      address,
      deployment.transactions[transactionKey] || null
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
