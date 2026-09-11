import { useCallback, useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import { getV3RoleState, sendV3Action } from '@/services/blockchain'
import { ACTIVE_CHAIN_ID } from '@/config/chains'

export function RoleControls({ roles, onPause, onResolve }) {
  const [bookingId, setBookingId] = useState('')
  const [outcome, setOutcome] = useState('0')
  const [reason, setReason] = useState('')
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Emergency pause</h2>
        <p className="mt-1 text-sm text-slate-600">Only the configured pauser multisig can change protocol pause state.</p>
        <button
          type="button"
          disabled={!roles.isPauser}
          onClick={() => onPause(roles.paused ? 'unpause' : 'pause')}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {roles.paused ? 'Unpause V3' : 'Pause V3'}
        </button>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Dispute resolution</h2>
        <p className="mt-1 text-sm text-slate-600">Resolution is limited to the predefined guest-refund or host-payout path.</p>
        <input value={bookingId} onChange={(event) => setBookingId(event.target.value)} placeholder="Booking ID" className="mt-4 w-full rounded-xl border p-3" />
        <select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="mt-3 w-full rounded-xl border p-3">
          <option value="0">Guest refund</option>
          <option value="1">Host payout</option>
        </select>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Public resolution reason or evidence reference" className="mt-3 w-full rounded-xl border p-3" />
        <button
          type="button"
          disabled={!roles.isArbitrator || !bookingId || !reason.trim()}
          onClick={() => onResolve(bookingId, outcome, reason)}
          className="mt-3 rounded-xl bg-[#00773d] px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          Resolve dispute
        </button>
      </section>
    </div>
  )
}

export default function AdminPage() {
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [roles, setRoles] = useState({ isPauser: false, isArbitrator: false, paused: false })

  const refresh = useCallback(async () => {
    setRoles(await getV3RoleState(ACTIVE_CHAIN_ID, address))
  }, [address])
  useEffect(() => {
    const timeout = setTimeout(() => refresh().catch(() => {}), 0)
    return () => clearTimeout(timeout)
  }, [refresh])

  const ensureChain = () => {
    if (Number(activeChainId) !== ACTIVE_CHAIN_ID) throw new Error(`Switch to chain ${ACTIVE_CHAIN_ID}`)
  }
  const pause = async (method) => {
    try {
      ensureChain()
      await sendV3Action(walletClient, ACTIVE_CHAIN_ID, method)
      toast.success(`V3 ${method} finalized.`)
      await refresh()
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Role transaction failed')
    }
  }
  const resolve = async (bookingId, outcome, reason) => {
    try {
      ensureChain()
      await sendV3Action(walletClient, ACTIVE_CHAIN_ID, 'resolveDispute', [
        BigInt(bookingId),
        Number(outcome),
        ethers.keccak256(ethers.toUtf8Bytes(reason.trim())),
      ])
      toast.success('Dispute resolution finalized.')
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Resolution failed')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#00773d]">V3 multisig controls</p>
      <h1 className="mt-2 text-3xl font-semibold">Protocol roles</h1>
      <p className="mb-6 mt-2 text-sm text-slate-600">Controls remain disabled unless the connected account holds the required on-chain role.</p>
      <RoleControls roles={roles} onPause={pause} onResolve={resolve} />
    </div>
  )
}
