import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function ConnectBtn() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading'
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated')

        if (!ready) {
          return <span className="block h-10 w-32 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        }

        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className="button-secondary inline-flex whitespace-nowrap">
              Connect wallet
            </button>
          )
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900"
            >
              Switch network
            </button>
          )
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChainModal}
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm md:inline-flex"
              title={`Connected to ${chain.name}`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              {chain.name}
            </button>
            <button
              type="button"
              onClick={openAccountModal}
              className="inline-flex max-w-36 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              title={account.address}
            >
              <span className="h-2 w-2 rounded-full bg-teal-300" aria-hidden="true" />
              <span className="truncate">{account.displayName}</span>
            </button>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
