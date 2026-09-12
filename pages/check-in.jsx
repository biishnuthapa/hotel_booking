import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import {
  AddressLink,
  DeploymentNotice,
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
import { submitCheckIn } from '@/services/blockchain'
import { decodeAuthorizationPayload, parseCheckInAuthorization } from '@/utils/checkInAuthorization'

function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(Number(value) * 1000))
}

export default function CheckInPage() {
  const router = useRouter()
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const configured = isDeploymentConfigured(ACTIVE_CHAIN_ID)
  const missing = getMissingDeploymentConfiguration(ACTIVE_CHAIN_ID)
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [manualAuthorization, setManualAuthorization] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [transactionState, setTransactionState] = useState(null)

  let linkedAuthorization = ''
  let linkError = null
  if (typeof router.query.authorization === 'string') {
    try {
      linkedAuthorization = decodeAuthorizationPayload(router.query.authorization)
    } catch (error) {
      linkError = error.message
    }
  }
  const displayedAuthorization = manualAuthorization ?? linkedAuthorization
  let parsedAuthorization = null
  let authorizationError = linkError
  if (!authorizationError && displayedAuthorization) {
    try {
      parsedAuthorization = parseCheckInAuthorization(displayedAuthorization, {
        chainId: ACTIVE_CHAIN_ID,
        verifyingContract: chain.bookingAddress,
        guest: address,
      })
    } catch (error) {
      authorizationError = error.message
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setTransactionState(null)
    try {
      if (!configured) throw new Error(`${chain.name} contract configuration is incomplete`)
      if (!walletClient || !address) throw new Error('Connect the booked guest wallet')
      if (Number(activeChainId) !== ACTIVE_CHAIN_ID)
        throw new Error(`Switch your wallet to ${chain.name}`)
      if (!parsedAuthorization)
        throw new Error(authorizationError || 'Paste a valid host authorization')
      await submitCheckIn(walletClient, ACTIVE_CHAIN_ID, parsedAuthorization, setTransactionState)
      toast.success('Host-authorized check-in finalized.')
      await router.push('/MyBookings')
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Check-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Guest check-in · HospitalityBooking</title>
        <meta name="description" content="Submit a guest-bound host check-in authorization." />
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Guest arrival"
          title="Submit host authorization"
          description="The authorization must match this chain, the configured contract, your connected guest wallet, the booking nonce, and the on-chain arrival window."
          actions={
            <Link href="/MyBookings" className="button-secondary inline-flex">
              Back to my trips
            </Link>
          }
        />

        {!configured && <DeploymentNotice chainId={chain.id} missing={missing} />}
        {configured && !address && (
          <WalletPrompt
            role="guest wallet"
            description="Connect the same wallet that owns the booking and received the authorization."
          />
        )}

        {configured && address && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="app-card p-5 sm:p-7">
              <label className="text-sm font-semibold text-slate-800">
                Authorization JSON
                <textarea
                  value={displayedAuthorization}
                  onChange={(event) => setManualAuthorization(event.target.value)}
                  placeholder="Paste the complete authorization JSON from the host"
                  spellCheck="false"
                  className="field min-h-64 font-mono text-xs leading-5"
                />
              </label>
              {authorizationError && displayedAuthorization && (
                <p
                  className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  role="alert"
                >
                  {authorizationError}
                </p>
              )}
              {!displayedAuthorization && (
                <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Scan the host’s QR code to open a prefilled link, or paste the JSON they provided.
                </p>
              )}
              <TransactionStatus transaction={transactionState} chainId={chain.id} />
              <button
                type="button"
                disabled={!walletClient || !parsedAuthorization || submitting}
                onClick={submit}
                className="button-primary mt-5 flex w-full"
              >
                {submitting ? 'Submitting check-in…' : 'Confirm check-in'}
              </button>
            </section>

            <aside className="space-y-4">
              {parsedAuthorization ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
                  <p className="font-semibold">Authorization matches this wallet</p>
                  <dl className="mt-4 grid gap-3 text-xs">
                    <div>
                      <dt className="text-emerald-800">Booking</dt>
                      <dd className="mt-1 font-semibold">
                        #{parsedAuthorization.bookingId.toString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-emerald-800">Guest</dt>
                      <dd className="mt-1">
                        <AddressLink chainId={chain.id} address={parsedAuthorization.guest} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-emerald-800">Valid from</dt>
                      <dd className="mt-1 font-semibold">
                        {formatTimestamp(parsedAuthorization.validAfter)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-emerald-800">Valid until</dt>
                      <dd className="mt-1 font-semibold">
                        {formatTimestamp(parsedAuthorization.validUntil)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="app-card p-5">
                  <p className="eyebrow">Before signing</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Check the booking number and time window. A valid signature cannot be reused
                    after its nonce is consumed or revoked.
                  </p>
                </div>
              )}
              <div className="app-card p-5">
                <p className="text-sm font-semibold text-slate-950">No private keys are shared</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  The host signs structured data. The guest sends the check-in transaction from
                  their own wallet.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  )
}
