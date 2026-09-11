import { ethers } from 'ethers'

export function formatTokenAmount(amount, decimals, symbol, maximumFractionDigits = 6) {
  const raw = ethers.formatUnits(BigInt(amount), Number(decimals))
  const [whole, fraction = ''] = raw.split('.')
  const trimmed = fraction.slice(0, maximumFractionDigits).replace(/0+$/, '')
  return `${trimmed ? `${whole}.${trimmed}` : whole} ${symbol}`
}

export function parseTokenAmount(value, decimals) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error('Enter a token amount')
  const amount = ethers.parseUnits(normalized, Number(decimals))
  if (amount <= 0n) throw new Error('Token amount must be greater than zero')
  return amount
}
