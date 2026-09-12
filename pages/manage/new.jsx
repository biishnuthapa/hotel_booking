import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { toast } from 'react-toastify'
import { useAccount, useChainId, useWalletClient } from 'wagmi'
import { DeploymentNotice, PageHeader, TransactionStatus, WalletPrompt } from '@/components/AppUI'
import {
  ACTIVE_CHAIN_ID,
  getChainConfig,
  getMissingDeploymentConfiguration,
  isDeploymentConfigured,
} from '@/config/chains'
import { sendBookingAction } from '@/services/blockchain'
import { validateListingDraft, validatePropertyImage } from '@/utils/listing'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Unable to read the selected image'))
    reader.readAsDataURL(file)
  })
}

async function pin(body) {
  const response = await fetch('/api/pinata/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hospitality-CSRF': '1' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Secure metadata upload failed')
  return result
}

export default function CreateListing() {
  const router = useRouter()
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const configured = isDeploymentConfigured(ACTIVE_CHAIN_ID)
  const missing = getMissingDeploymentConfiguration(ACTIVE_CHAIN_ID)
  const { address } = useAccount()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const { data: session, status: sessionStatus } = useSession()
  const [form, setForm] = useState({
    name: '',
    description: '',
    totalRooms: 1,
    checkInTime: '15:00',
    checkOutTime: '11:00',
  })
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [stage, setStage] = useState(null)
  const [formError, setFormError] = useState(null)
  const [transactionState, setTransactionState] = useState(null)

  const sessionWallet = session?.address || session?.user?.name
  const authenticated = Boolean(
    address && sessionWallet && address.toLowerCase() === sessionWallet.toLowerCase()
  )
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const selectImage = (file) => {
    try {
      validatePropertyImage(file)
      setImage(file)
      setFormError(null)
    } catch (error) {
      setImage(null)
      setFormError(error.message)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setTransactionState(null)
    try {
      if (!configured) throw new Error(`${chain.name} contract configuration is incomplete`)
      if (!walletClient || !address) throw new Error('Connect the host wallet')
      if (Number(activeChainId) !== ACTIVE_CHAIN_ID)
        throw new Error(`Switch your wallet to ${chain.name}`)
      if (!authenticated) throw new Error('Complete the wallet sign-in before uploading metadata')
      const validated = validateListingDraft(form)
      validatePropertyImage(image)

      setStage('Uploading the validated property image')
      const imagePin = await pin({
        type: 'file',
        filename: image.name,
        contentType: image.type,
        data: await fileToBase64(image),
      })
      setStage('Pinning canonical listing metadata')
      const metadataPin = await pin({
        type: 'json',
        content: {
          schema: 'hospitality-booking/listing/1',
          name: validated.name,
          description: validated.description,
          image: imagePin.uri,
        },
        pinName: `${validated.name}-listing.json`,
      })
      setStage('Confirming the listing transaction')
      await sendBookingAction(
        walletClient,
        ACTIVE_CHAIN_ID,
        'createListing',
        [
          validated.name,
          metadataPin.uri,
          imagePin.uri,
          validated.totalRooms,
          validated.checkInOffsetMinutes,
          validated.checkOutOffsetMinutes,
        ],
        setTransactionState
      )
      toast.success('Property created successfully.')
      await router.push('/MyNFTs')
    } catch (error) {
      const message = error?.shortMessage || error?.message || 'Listing creation failed'
      setFormError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
      setStage(null)
    }
  }

  return (
    <>
      <Head>
        <title>Create a property · HospitalityBooking</title>
        <meta name="description" content="Create a property on the HospitalityBooking protocol." />
      </Head>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <PageHeader
          eyebrow="Host onboarding"
          title="Create a property"
          description="Pin validated metadata, define UTC arrival times, and create immutable inventory ownership on-chain. Room types and prices are added from the host dashboard after creation."
          actions={
            <Link href="/MyNFTs" className="button-secondary inline-flex">
              Back to host dashboard
            </Link>
          }
        />

        {!configured && <DeploymentNotice chainId={chain.id} missing={missing} />}
        {configured && !address && (
          <WalletPrompt
            role="host wallet"
            description="Connect and sign in with the wallet that will own this property."
          />
        )}

        {configured && address && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <form onSubmit={submit} className="app-card p-5 sm:p-7">
              <div className="grid gap-5">
                <label className="text-sm font-semibold text-slate-800">
                  Property name
                  <input
                    required
                    maxLength="120"
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    className="field"
                    placeholder="Harbour House"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Description
                  <textarea
                    required
                    maxLength="5000"
                    value={form.description}
                    onChange={(event) => update('description', event.target.value)}
                    className="field min-h-32"
                    placeholder="Describe the stay, its location, and what guests should expect."
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-slate-500">
                    {form.description.length}/5,000
                  </span>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Property image
                  <input
                    required
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(event) => selectImage(event.target.files?.[0] || null)}
                    className="field file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    JPEG, PNG, WebP, or AVIF. Maximum 8 MB.
                  </span>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Total room inventory
                  <input
                    required
                    type="number"
                    min="1"
                    max="4294967295"
                    value={form.totalRooms}
                    onChange={(event) => update('totalRooms', event.target.value)}
                    className="field"
                  />
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-800">
                    Daily schedule in UTC
                  </legend>
                  <div className="mt-2 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-slate-700">
                      Check-in time
                      <input
                        required
                        type="time"
                        value={form.checkInTime}
                        onChange={(event) => update('checkInTime', event.target.value)}
                        className="field"
                      />
                    </label>
                    <label className="text-sm text-slate-700">
                      Checkout time
                      <input
                        required
                        type="time"
                        value={form.checkOutTime}
                        onChange={(event) => update('checkOutTime', event.target.value)}
                        className="field"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Checkout belongs to the exclusive checkout date, so 11:00 means 11:00 UTC on
                    that later day.
                  </p>
                </fieldset>
              </div>

              {formError && (
                <p
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              {stage && (
                <p
                  className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-900"
                  aria-live="polite"
                >
                  {stage}…
                </p>
              )}
              <TransactionStatus transaction={transactionState} chainId={chain.id} />
              <button
                disabled={
                  submitting || !walletClient || !authenticated || sessionStatus === 'loading'
                }
                type="submit"
                className="button-primary mt-6 flex w-full"
              >
                {submitting ? 'Creating property…' : 'Create property'}
              </button>
            </form>

            <aside className="space-y-4">
              <div className="app-card p-5">
                <p className="eyebrow">Wallet ownership</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The connected wallet becomes the permanent listing owner. Ownership is snapshotted
                  into every booking.
                </p>
              </div>
              <div
                className={`rounded-3xl border p-5 ${authenticated ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
              >
                <p className="text-sm font-semibold text-slate-950">Secure upload session</p>
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  {authenticated
                    ? 'Wallet sign-in is active. Upload requests are bound to this address.'
                    : 'Use the wallet control to complete SIWE authentication before submitting.'}
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  )
}
