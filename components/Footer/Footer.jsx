const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
        <p>Hospitality NFT &copy; {new Date().getFullYear()}</p>
        <p>Built for decentralized stays and NFT-based check-ins.</p>
      </div>
    </footer>
  )
}

export default Footer
