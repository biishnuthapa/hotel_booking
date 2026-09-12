import Link from 'next/link'
import { explorerAddressUrl, explorerTransactionUrl, getChainConfig } from '@/config/chains'

const statusStyles = {
  Booked: 'border-sky-200 bg-sky-50 text-sky-800',
  Cancelled: 'border-slate-200 bg-slate-100 text-slate-700',
  CheckedIn: 'border-teal-200 bg-teal-50 text-teal-800',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  NoShow: 'border-orange-200 bg-orange-50 text-orange-800',
  Disputed: 'border-amber-200 bg-amber-50 text-amber-900',
  ResolvedGuest: 'border-violet-200 bg-violet-50 text-violet-800',
  ResolvedHost: 'border-indigo-200 bg-indigo-50 text-indigo-800',
}

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
        statusStyles[status] || statusStyles.Cancelled
      }`}
    >
      {status || 'Unknown'}
    </span>
  )
}

export function EmptyState({ title, description, actionHref, actionLabel, headingLevel = 'h2' }) {
  const Heading = headingLevel === 'h1' ? 'h1' : 'h2'
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-xl text-teal-800">
        ◇
      </div>
      <Heading className="mt-4 text-lg font-semibold text-slate-900">{title}</Heading>
      {description && (
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
      )}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="button-primary mt-5 inline-flex">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

export function LoadingState({ label = 'Loading records…' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" />
      {label}
    </div>
  )
}

export function DeploymentNotice({ chainId, missing = [], message }) {
  const chain = getChainConfig(chainId)
  return (
    <div
      className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950"
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em]">Configuration required</p>
      <h2 className="mt-2 text-xl font-semibold">Connect the finalized deployment.</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6">
        {message ||
          `${chain.name} is selected, but its public contract configuration is incomplete.`}
      </p>
      {missing.length > 0 && (
        <p className="mt-3 text-sm">
          Missing: <strong>{missing.join(', ')}</strong>
        </p>
      )}
      <p className="mt-3 text-xs text-amber-800">
        Writes remain unavailable until the deployed addresses and block are supplied at build time.
      </p>
    </div>
  )
}

export function TransactionStatus({ transaction, chainId }) {
  if (!transaction) return null
  const labels = {
    pending: 'Waiting for confirmation',
    replaced: 'Transaction replaced; tracking the new hash',
    finalized: 'Finalized on-chain',
    failed: 'Transaction failed',
    cancelled: 'Transaction cancelled',
  }
  const href = explorerTransactionUrl(chainId, transaction.hash)
  const isError = transaction.state === 'failed' || transaction.state === 'cancelled'
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-teal-200 bg-teal-50 text-teal-900'
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>{transaction.action ? `${transaction.action}: ` : ''}</strong>
          {labels[transaction.state] || transaction.state}
        </p>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="font-semibold underline">
            View transaction ↗
          </a>
        )}
      </div>
    </div>
  )
}

export function AddressLink({ chainId, address, label }) {
  if (!address) return null
  const href = explorerAddressUrl(chainId, address)
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  if (!href) return <span title={address}>{label || short}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={address}
      className="font-medium hover:underline"
    >
      {label || short} ↗
    </a>
  )
}

export function WalletPrompt({ role = 'wallet', description }) {
  return (
    <EmptyState
      title={`Connect your ${role}`}
      description={description || 'Connect through the wallet control above to load your records.'}
    />
  )
}
