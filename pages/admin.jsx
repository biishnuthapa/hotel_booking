import { useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import {
  DeploymentNotice,
  LoadingState,
  PageHeader,
  TransactionStatus,
  WalletPrompt,
} from '@/components/AppUI'
import {
  ACTIVE_CHAIN_ID,
  getChainConfig,
  getMissingDeploymentConfiguration,
  isDeploymentConfigured,
} from '@/config/chains'
import { getRoleState, sendBookingAction } from '@/services/blockchain'

export function RoleControls({ roles, onPause, onResolve, busy = false }) {
  const [bookingId, setBookingId] = useState('')
  const [outcome, setOutcome] = useState('0')
  const [reason, setReason] = useState('')
  const reasonHash = reason.trim() ? ethers.keccak256(ethers.toUtf8Bytes(reason.trim())) : null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="app-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Emergency control</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Protocol pause</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${roles.paused ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}
          >
            {roles.paused ? 'Paused' : 'Operational'}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Only the configured pauser can stop or resume state-changing protocol operations.
        </p>
        {!roles.isPauser && (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            The connected account does not hold the pauser role.
          </p>
        )}
        <button
          type="button"
          disabled={!roles.isPauser || busy}
          onClick={() => onPause(roles.paused ? 'unpause' : 'pause')}
          className={
            roles.paused ? 'button-primary mt-5 inline-flex' : 'button-danger mt-5 inline-flex'
          }
        >
          {roles.paused ? 'Unpause protocol' : 'Pause protocol'}
        </button>
      </section>

      <section className="app-card p-5 sm:p-6">
        <p className="eyebrow">Arbitration</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Resolve a dispute</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Resolution is restricted to the contract’s full guest-refund or host-payout outcome.
        </p>
        <label className="mt-5 block text-sm font-semibold text-slate-800">
          Booking ID
          <input
            type="number"
            min="1"
            step="1"
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            placeholder="123"
            className="field"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Outcome
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="field"
          >
            <option value="0">Full guest refund</option>
            <option value="1">Predefined host payout</option>
          </select>
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Public reason or evidence reference
          <textarea
            value={reason}
            maxLength="5000"
            onChange={(event) => setReason(event.target.value)}
            placeholder="ipfs://… or a concise resolution record"
            className="field min-h-28"
          />
        </label>
        {reasonHash && (
          <code className="mt-3 block break-all rounded-xl bg-slate-50 p-3 text-[10px] text-slate-600">
            Reason hash: {reasonHash}
          </code>
        )}
        {!roles.isArbitrator && (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            The connected account does not hold the arbitrator role.
          </p>
        )}
        <button
          type="button"
          disabled={
            !roles.isArbitrator ||
            !/^\d+$/.test(bookingId) ||
            BigInt(bookingId || 0) === 0n ||
            !reason.trim() ||
            busy
          }
          onClick={() => onResolve(bookingId, outcome, reason)}
          className="button-primary mt-5 inline-flex"
        >
          Resolve dispute
        </button>
      </section>
    </div>
  )
}

export default function AdminPage() {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const configured = isDeploymentConfigured(ACTIVE_CHAIN_ID)
  const missing = getMissingDeploymentConfiguration(ACTIVE_CHAIN_ID)
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [roles, setRoles] = useState({ isPauser: false, isArbitrator: false, paused: false })
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [transactionState, setTransactionState] = useState(null)

  const refresh = useCallback(async () => {
    if (!configured || !address) {
      setRoles({ isPauser: false, isArbitrator: false, paused: false })
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      setRoles(await getRoleState(ACTIVE_CHAIN_ID, address))
    } catch (error) {
      setLoadError(error?.shortMessage || error?.message || 'Unable to load protocol roles')
    } finally {
      setLoading(false)
    }
  }, [address, configured])

  useEffect(() => {
    const timeout = setTimeout(refresh, 0)
    return () => clearTimeout(timeout)
  }, [refresh])

  const ensureReady = () => {
    if (!walletClient || !address) throw new Error('Connect the authorized wallet')
    if (Number(activeChainId) !== ACTIVE_CHAIN_ID)
      throw new Error(`Switch your wallet to ${chain.name}`)
  }

  const run = async (method, args, success) => {
    setBusy(true)
    setTransactionState(null)
    try {
      ensureReady()
      await sendBookingAction(walletClient, ACTIVE_CHAIN_ID, method, args, setTransactionState)
      toast.success(success)
      await refresh()
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Role transaction failed')
    } finally {
      setBusy(false)
    }
  }

  const resolve = (bookingId, outcome, reason) =>
    run(
      'resolveDispute',
      [BigInt(bookingId), Number(outcome), ethers.keccak256(ethers.toUtf8Bytes(reason.trim()))],
      'Dispute resolution finalized.'
    )

  return (
    <>
      <Head>
        <title>Protocol controls · HospitalityBooking</title>
        <meta name="description" content="Multisig-controlled pause and arbitration operations." />
      </Head>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Multisig operations"
          title="Protocol controls"
          description="Role checks come directly from the configured contract. Controls remain disabled unless the connected account holds the required role."
        />

        {!configured && <DeploymentNotice chainId={chain.id} missing={missing} />}
        {configured && !address && (
          <WalletPrompt
            role="authorized wallet"
            description="Connect the pauser or arbitrator multisig wallet to load its permissions."
          />
        )}
        {loadError && (
          <p
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            {loadError}
          </p>
        )}
        {loading && <LoadingState label="Reading protocol roles…" />}
        {configured && address && !loading && (
          <>
            <TransactionStatus transaction={transactionState} chainId={chain.id} />
            <div className="mb-6 mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Network</p>
                <p className="mt-1 font-semibold text-slate-950">{chain.name}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Pauser role</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {roles.isPauser ? 'Authorized' : 'Not held'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">Arbitrator role</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {roles.isArbitrator ? 'Authorized' : 'Not held'}
                </p>
              </div>
            </div>
            <RoleControls
              roles={roles}
              busy={busy}
              onPause={(method) => run(method, [], `Protocol ${method} finalized.`)}
              onResolve={resolve}
            />
          </>
        )}
      </div>
    </>
  )
}
