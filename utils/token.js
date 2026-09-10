import { ethers } from 'ethers'

export function formatTokenAmount(amount, decimals, symbol, maximumFractionDigits = 6) {
  const raw = ethers.formatUnits(BigInt(amount), Number(decimals))
  const [whole, fraction = ''] = raw.split('.')
  const trimmed = fraction.slice(0, maximumFractionDigits).replace(/0+$/, '')
  return `${trimmed ? `${whole}.${trimmed}` : whole} ${symbol}`
}
