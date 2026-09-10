import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useChainId, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { toast } from 'react-toastify'
import {
  approveAndBook,
  getV3ListingWithRooms,
  getV3TokenInfo,
} from '@/services/blockchain'
import { validateStayDates } from '@/utils/dates'
import { normalizeIpfsUrl } from '@/utils/helper'

const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 80002)

export default function StayPage({ listing, rooms, token, loadError }) {
  const router = useRouter()
  const activeChainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const [roomTypeId, setRoomTypeId] = useState(rooms[0]?.id || '')
  const [roomsRequested, setRoomsRequested] = useState(1)
  const [checkInDate, setCheckInDate] = useState('')
  const [checkOutDate, setCheckOutDate] = useState('')
  const [transactionState, setTransactionState] = useState(null)

  const selectedRoom = rooms.find((room) => room.id === roomTypeId)
  const quotedTotal = useMemo(() => {
    if (!selectedRoom || !checkInDate || !checkOutDate) return null
    try {
      const { nights } = validateStayDates(checkInDate, checkOutDate)
      const base = BigInt(selectedRoom.pricePerNight) * BigInt(roomsRequested) * BigInt(nights)
      return base + (base * BigInt(token.securityDepositBps)) / 10_000n
    } catch {
      return null
    }
  }, [selectedRoom, roomsRequested, checkInDate, checkOutDate, token.securityDepositBps])

  const submit = async (event) => {
    event.preventDefault()
    try {
      if (Number(activeChainId) !== DEFAULT_CHAIN_ID) {
        throw new Error(`Switch your wallet to chain ${DEFAULT_CHAIN_ID}`)
      }
      await approveAndBook(
        walletClient,
        DEFAULT_CHAIN_ID,
        {
          listingId: listing.id,
          roomTypeId,
          rooms: Number(roomsRequested),
          checkInDate,
          checkOutDate,
        },
        setTransactionState
      )
      toast.success('V3 booking finalized.')
      await router.replace(router.asPath)
    } catch (error) {
      toast.error(error?.shortMessage || error?.message || 'Booking failed')
    }
  }

  if (loadError) {
    return <p className="mx-auto max-w-3xl p-8 text-red-700">{loadError}</p>
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px] sm:px-6">
      <div>
        <Link href="/" className="text-sm font-semibold text-[#00773d]">← Back to V3 listings</Link>
        <img
          src={normalizeIpfsUrl(listing.imageURI)}
          alt=""
          className="mt-5 h-80 w-full rounded-3xl bg-slate-100 object-cover"
        />
        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">{listing.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Listing #{listing.id}</p>
          </div>
          {!listing.active && (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold">Deactivated</span>
          )}
        </div>

        <div className="mt-8 grid gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{room.name}</h2>
                  <p className="text-sm text-slate-500">Capacity: {room.capacity} rooms</p>
                </div>
                <p className="font-semibold text-slate-900">
                  {ethers.formatUnits(room.pricePerNight, token.decimals)} {token.symbol} / night
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Book with {token.symbol}</h2>
        <p className="mt-1 text-xs text-slate-500">Checkout is exclusive. Maximum stay: 90 nights.</p>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          Room type
          <select
            value={roomTypeId}
            onChange={(event) => setRoomTypeId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          >
            {rooms.filter((room) => room.active).map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Rooms
          <input
            type="number"
            min="1"
            max={selectedRoom?.capacity || 1}
            value={roomsRequested}
            onChange={(event) => setRoomsRequested(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-700">
            Check-in
            <input
              type="date"
              value={checkInDate}
              onChange={(event) => setCheckInDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Checkout
            <input
              type="date"
              value={checkOutDate}
              onChange={(event) => setCheckOutDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              required
            />
          </label>
        </div>
        {quotedTotal !== null && (
          <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            Estimated escrow: <strong>{ethers.formatUnits(quotedTotal, token.decimals)} {token.symbol}</strong>
          </p>
        )}
        {transactionState && (
          <p className="mt-3 text-xs text-slate-500">Transaction: {transactionState.state}</p>
        )}
        <button
          type="submit"
          disabled={!listing.active || !walletClient || !roomTypeId}
          className="mt-5 w-full rounded-xl bg-[#00773d] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Approve and book
        </button>
      </form>
    </div>
  )
}

export async function getServerSideProps({ params }) {
  try {
    const [{ listing, rooms }, token] = await Promise.all([
      getV3ListingWithRooms(DEFAULT_CHAIN_ID, params.listingId),
      getV3TokenInfo(DEFAULT_CHAIN_ID),
    ])
    return {
      props: {
        listing: {
          id: listing.id.toString(),
          name: listing.name,
          imageURI: listing.imageURI,
          metadataURI: listing.metadataURI,
          owner: listing.owner,
          active: listing.active,
        },
        rooms: rooms.map((room) => ({
          id: room.id.toString(),
          name: room.name,
          pricePerNight: room.pricePerNight.toString(),
          capacity: Number(room.capacity),
          active: room.active,
        })),
        token,
        loadError: null,
      },
    }
  } catch (error) {
    return {
      props: {
        listing: null,
        rooms: [],
        token: null,
        loadError: error?.shortMessage || error?.message || 'Unable to load listing.',
      },
    }
  }
}
