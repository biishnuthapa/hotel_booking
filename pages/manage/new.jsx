import { useState } from 'react'
import { useRouter } from 'next/router'
import { toast } from 'react-toastify'
import { useChainId, useWalletClient } from 'wagmi'
import { sendV3Action } from '@/services/blockchain'
import { ACTIVE_CHAIN_ID } from '@/config/chains'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function pin(body) {
  const response = await fetch('/api/pinata/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hospitality-CSRF': '1' },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Pinning failed')
  return result
}

export default function CreateV3Listing() {
  const router = useRouter()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [form, setForm] = useState({
    name: '',
    description: '',
    totalRooms: 1,
    checkInOffsetMinutes: 900,
    checkOutOffsetMinutes: 660,
  })
  const [image, setImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (!walletClient) throw new Error('Connect the host wallet')
      if (Number(activeChainId) !== ACTIVE_CHAIN_ID) throw new Error(`Switch to chain ${ACTIVE_CHAIN_ID}`)
      if (!image) throw new Error('Choose a property image')
      const imagePin = await pin({
        type: 'file',
        filename: image.name,
        contentType: image.type,
        data: await fileToBase64(image),
      })
      const metadata = {
        schema: 'hospitality-booking-v3/listing/1',
        name: form.name,
        description: form.description,
        image: imagePin.uri,
      }
      const metadataPin = await pin({
        type: 'json',
        content: metadata,
        pinName: `${form.name}-listing.json`,
      })
      await sendV3Action(walletClient, ACTIVE_CHAIN_ID, 'createListing', [
        form.name,
        metadataPin.uri,
        imagePin.uri,
        Number(form.totalRooms),
        Number(form.checkInOffsetMinutes),
        Number(form.checkOutOffsetMinutes),
      ])
      toast.success('V3 listing created.')
      await router.push('/MyNFTs')
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Listing creation failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#00773d]">V3 host</p>
      <h1 className="mt-2 text-3xl font-semibold">Create a listing</h1>
      <p className="mt-2 text-sm text-slate-600">Metadata and the validated image are pinned through the authenticated server endpoint.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border bg-white p-6">
        <label className="text-sm font-medium">Name<input required value={form.name} onChange={(event) => update('name', event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Description<textarea required value={form.description} onChange={(event) => update('description', event.target.value)} className="mt-1 min-h-[100px] w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Image (JPEG, PNG, WebP, or AVIF; maximum 8 MB)<input required type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setImage(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Total room inventory<input required type="number" min="1" value={form.totalRooms} onChange={(event) => update('totalRooms', event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">Check-in UTC offset (minutes)<input required type="number" min="-1440" max="2880" value={form.checkInOffsetMinutes} onChange={(event) => update('checkInOffsetMinutes', event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <label className="text-sm font-medium">Checkout UTC offset (minutes)<input required type="number" min="-1440" max="2880" value={form.checkOutOffsetMinutes} onChange={(event) => update('checkOutOffsetMinutes', event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        </div>
        <button disabled={submitting || !walletClient} type="submit" className="rounded-xl bg-[#00773d] px-5 py-3 font-semibold text-white disabled:opacity-50">{submitting ? 'Pinning and creating…' : 'Create V3 listing'}</button>
      </form>
    </div>
  )
}
