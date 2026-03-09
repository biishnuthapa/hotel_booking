import { useRouter } from 'next/router'
import CreateRoomType from '@/components/CreateRoomType'

export default function CreateRoomTypePage() {
  const router = useRouter()
  const apartmentId = Number(router.query.apartmentId || router.query.roomId || 0)

  if (!Number.isFinite(apartmentId) || apartmentId <= 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-slate-700">Missing apartment id. Open this page with `?apartmentId=1`.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10">
      <CreateRoomType apartmentId={apartmentId} onClose={() => router.push(`/room/${apartmentId}`)} />
    </div>
  )
}
