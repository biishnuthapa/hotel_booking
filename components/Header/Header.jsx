import Link from 'next/link'
import ConnectBtn from '../ConnectBtn'

const Header = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <img src="/assets/img.jpg" alt="Hospitality NFT Logo" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#00773d]">Hospitality NFT</p>
            <p className="text-xs text-slate-500">Book stays. Mint experiences.</p>
          </div>
        </Link>

        <div className="hidden md:block">
          <NavLinks />
        </div>

        <ConnectBtn />
      </div>
      <div className="mx-auto block max-w-7xl px-4 pb-3 md:hidden">
        <NavLinks mobile />
      </div>
    </header>
  )
}

const NavLinks = ({ mobile = false }) => {
  const baseClass =
    'rounded-full px-4 py-2 text-sm font-medium transition hover:bg-slate-100 hover:text-slate-900'

  return (
    <nav className={`flex ${mobile ? 'flex-wrap gap-2' : 'items-center gap-2'}`}>
      <Link href="/" className={`${baseClass} text-slate-700`}>
        Explore
      </Link>
      <Link href="/MyBookings" className={`${baseClass} text-slate-700`}>
        My Trips
      </Link>
      <Link href="/MyNFTs" className={`${baseClass} text-slate-700`}>
        Property Management
      </Link>
      <Link href="/admin" className={`${baseClass} text-slate-700`}>
        Protocol Roles
      </Link>
      <Link
        href="/manage/new"
        className="rounded-full bg-[#00773d] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
      >
        List Property
      </Link>
    </nav>
  )
}

export default Header
