import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ConnectBtn from '../ConnectBtn'
import { ACTIVE_CHAIN_ID, getChainConfig } from '@/config/chains'

const navItems = [
  { href: '/', label: 'Explore' },
  { href: '/MyBookings', label: 'My trips' },
  { href: '/MyNFTs', label: 'Host dashboard' },
  { href: '/admin', label: 'Protocol' },
  { href: '/legacy', label: 'Legacy V1', legacy: true },
]

function BrandMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
        <path d="M4 19V8.5L12 4l8 4.5V19M8 19v-6h8v6M8 9h.01M12 9h.01M16 9h.01" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function NavLinks({ onNavigate }) {
  const router = useRouter()
  return (
    <nav aria-label="Primary navigation" className="flex flex-col gap-1 lg:flex-row lg:items-center">
      {navItems.map((item) => {
        const active = item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              active
                ? item.legacy
                  ? 'bg-amber-50 text-amber-900'
                  : 'bg-teal-50 text-teal-800'
                : item.legacy
                  ? 'text-amber-800 hover:bg-amber-50'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const chain = getChainConfig(ACTIVE_CHAIN_ID)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-50 -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="HospitalityBooking home">
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-950">HospitalityBooking</p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span>V3 escrow</span>
              <span aria-hidden="true">•</span>
              <span className="font-semibold text-teal-700">{chain.shortName}</span>
            </div>
          </div>
        </Link>

        <div className="hidden lg:block">
          <NavLinks />
        </div>

        <div className="flex items-center gap-2">
          <Link href="/manage/new" className="button-primary hidden xl:inline-flex">
            List property
          </Link>
          <div className="hidden sm:block">
            <ConnectBtn />
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-700 lg:hidden"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span aria-hidden="true" className="text-xl leading-none">{menuOpen ? '×' : '≡'}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-4">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <div className="sm:hidden"><ConnectBtn /></div>
            <Link href="/manage/new" onClick={() => setMenuOpen(false)} className="button-primary flex">
              List a property
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
