import { useState } from 'react'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { useChainId, useWalletClient } from 'wagmi'
import { submitCheckIn } from '@/services/blockchain'
import { ACTIVE_CHAIN_ID } from '@/config/chains'

function decodeAuthorization(value) {
  if (!value) return ''
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    return decodeURIComponent(escape(atob(normalized)))
  } catch {
    return ''
  }
}

export default function CheckInPage() {
  const router = useRouter()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [rawAuthorization, setRawAuthorization] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const linkedAuthorization =
    typeof router.query.authorization === 'string'
      ? decodeAuthorization(router.query.authorization)
      : ''
  const displayedAuthorization = rawAuthorization || linkedAuthorization

  const submit = async () => {
    setSubmitting(true)
    try {
      if (!walletClient) throw new Error('Connect the guest wallet')
      if (Number(activeChainId) !== ACTIVE_CHAIN_ID) throw new Error(`Switch to chain ${ACTIVE_CHAIN_ID}`)
      const parsed = JSON.parse(displayedAuthorization)
      await submitCheckIn(walletClient, ACTIVE_CHAIN_ID, {
        bookingId: BigInt(parsed.bookingId),
        validAfter: BigInt(parsed.validAfter),
        validUntil: BigInt(parsed.validUntil),
        nonce: BigInt(parsed.nonce),
        signature: parsed.signature,
      })
      toast.success('Host-authorized check-in finalized.')
      await router.push('/MyBookings')
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Check-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#00773d]">V3 guest check-in</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Submit host authorization</h1>
      <p className="mt-2 text-sm text-slate-600">
        The signature is bound to this chain, contract, booking, guest wallet, nonce, and validity window.
      </p>
      <textarea
        value={displayedAuthorization}
        onChange={(event) => setRawAuthorization(event.target.value)}
        placeholder="Authorization JSON from the host"
        className="mt-6 min-h-[220px] w-full rounded-2xl border border-slate-300 p-4 font-mono text-xs"
      />
      <button
        type="button"
        disabled={!walletClient || !displayedAuthorization || submitting}
        onClick={submit}
        className="mt-4 rounded-xl bg-[#00773d] px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Check in on V3'}
      </button>
    </div>
  )
}
