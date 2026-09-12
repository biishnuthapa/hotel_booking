import Link from 'next/link'
import { ACTIVE_CHAIN_ID, explorerAddressUrl, getChainConfig } from '@/config/chains'

const Footer = () => {
  const chain = getChainConfig(ACTIVE_CHAIN_ID)
  const contractUrl = explorerAddressUrl(ACTIVE_CHAIN_ID, chain.bookingAddress)
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/80">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-8 text-sm text-slate-500 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-semibold text-slate-800">HospitalityBooking</p>
          <p className="mt-1 max-w-xl leading-6">
            Stable-token escrow with guest-controlled check-in and optional host attestation.
            On-chain status does not independently prove physical presence.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end">
          <Link href="/admin" className="hover:text-slate-900">
            Protocol roles
          </Link>
          {contractUrl && (
            <a href={contractUrl} target="_blank" rel="noreferrer" className="hover:text-slate-900">
              {chain.shortName} contract ↗
            </a>
          )}
          <span>&copy; HospitalityBooking</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
