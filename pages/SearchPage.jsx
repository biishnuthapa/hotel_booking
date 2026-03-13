import { useEffect, useMemo, useState } from 'react'
import {
  getApartments,
  getBookings,
  getRevenueEvents,
  getSecurityFee,
  getTaxPercent,
  getTotalTokens,
} from '@/services/blockchain'

const formatCurrency = (value) => Number(value || 0).toFixed(4)

const buildSeries = (entries) => {
  const byDate = new Map()
  entries.forEach((entry) => {
    const date = new Date(entry.timestamp * 1000).toISOString().slice(0, 10)
    byDate.set(date, (byDate.get(date) || 0) + entry.amount)
  })
  return Array.from(byDate.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => (a.date > b.date ? 1 : -1))
}

const buildPath = (points, width, height, padding) => {
  if (!points.length) return ''
  const max = Math.max(...points.map((p) => p.amount))
  const min = Math.min(...points.map((p) => p.amount))
  const span = max - min || 1
  const step = (width - padding * 2) / Math.max(points.length - 1, 1)

  return points
    .map((point, index) => {
      const x = padding + index * step
      const y = height - padding - ((point.amount - min) / span) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

function SearchPage() {
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({ apartments: 0, tokens: 0, revenue: 0 })
  const [series, setSeries] = useState([])

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true)
        const apartments = await getApartments()
        const [totalTokens, taxPercent, securityFee] = await Promise.all([
          getTotalTokens(),
          getTaxPercent(),
          getSecurityFee(),
        ])

        const bookingsByKey = new Map()
        await Promise.all(
          apartments.map(async (apartment) => {
            const bookings = await getBookings(apartment.id)
            bookings.forEach((booking) => {
              bookingsByKey.set(`${booking.aid}-${booking.id}`, booking)
            })
          })
        )

        const events = await getRevenueEvents(0)
        const entries = events
          .map((event) => {
            const booking = bookingsByKey.get(`${event.aid}-${event.bookingId}`)
            if (!booking) return null
            const totalPrice = Number(booking.totalPrice || 0)
            let amount = 0
            if (event.type === 'checked_in' || event.type === 'claimed') {
              amount = (totalPrice * taxPercent) / 100
            } else if (event.type === 'refunded') {
              amount = ((totalPrice * securityFee) / 100) / 2
            }
            return { ...event, amount }
          })
          .filter(Boolean)

        const revenueSeries = buildSeries(entries)
        const totalRevenue = revenueSeries.reduce((sum, item) => sum + item.amount, 0)

        setMetrics({
          apartments: apartments.length,
          tokens: totalTokens,
          revenue: totalRevenue,
        })
        setSeries(revenueSeries)
      } catch (error) {
        console.error('Failed to load admin metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [])

  const chartPath = useMemo(() => buildPath(series, 700, 220, 24), [series])

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Platform Admin</h1>
        <p className="text-sm text-slate-600">Analytics for global activity and revenue.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Apartments</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.apartments}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">NFTs Minted</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{metrics.tokens}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Admin Earned (ETH)</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(metrics.revenue)}</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Revenue Over Time</h2>
            <p className="text-sm text-slate-600">Based on check-ins, no-shows, and refunds.</p>
          </div>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>

        <div className="mt-4">
          {series.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
              No revenue events yet.
            </p>
          ) : (
            <svg viewBox="0 0 700 220" className="w-full" aria-label="Revenue chart">
              <defs>
                <linearGradient id="revGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00773d" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00773d" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                d={`${chartPath} L 676 196 L 24 196 Z`}
                fill="url(#revGradient)"
                stroke="none"
              />
              <path d={chartPath} fill="none" stroke="#00773d" strokeWidth="3" />
              {series.map((point, index) => {
                const step = (700 - 48) / Math.max(series.length - 1, 1)
                const max = Math.max(...series.map((p) => p.amount))
                const min = Math.min(...series.map((p) => p.amount))
                const span = max - min || 1
                const x = 24 + index * step
                const y = 220 - 24 - ((point.amount - min) / span) * (220 - 48)
                return <circle key={point.date} cx={x} cy={y} r="4" fill="#00773d" />
              })}
            </svg>
          )}
        </div>
      </div>
    </main>
  )
}

export default SearchPage
