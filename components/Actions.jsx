import { useState } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useRouter } from 'next/router'
import { CiEdit } from 'react-icons/ci'
import { MdDeleteOutline } from 'react-icons/md'
import { deleteApartment } from '@/services/blockchain'
import { toast } from 'react-toastify'
import CreateRoomType from '@/components/CreateRoomType'

const formatToastError = (error) =>
  error?.shortMessage || error?.reason || error?.message || 'Encountered error'

const Actions = ({ apartment }) => {
  const navigate = useRouter()
  const { address } = useAccount()
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete Hotel ${apartment?.id}?`)) {
      toast.promise(
        new Promise((resolve, reject) => {
          deleteApartment(apartment?.id)
            .then(() => {
              navigate.push('/')
              resolve()
            })
            .catch((error) => reject(error))
        }),
        {
          pending: 'Approve transaction...',
          success: 'Hotel deleted successfully.',
          error: {
            render({ data }) {
              return formatToastError(data)
            },
          },
        }
      )
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {address == apartment?.owner && (
        <>
          <Link
            href={'/room/edit/' + apartment?.id}
            className="flex items-center space-x-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[#00773d] hover:text-[#00773d]"
          >
            <CiEdit size={15} />
            <small>Edit</small>
          </Link>
          <button
            className="flex items-center space-x-1 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            onClick={handleDelete}
          >
            <MdDeleteOutline size={15} />
            <small>Delete</small>
          </button>
          <button
            className="flex items-center space-x-1 rounded-xl bg-[#00773d] px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
            onClick={() => setShowCreateRoomModal(true)}
          >
            <span className="text-lg leading-none">+</span>
            <small>Add Rooms</small>
          </button>
          {showCreateRoomModal && (
            <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
              <CreateRoomType apartmentId={apartment.id} onClose={() => setShowCreateRoomModal(false)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Actions
