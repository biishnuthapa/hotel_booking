import Link from 'next/link'
import { ConnectBtn } from '..'
import { useAccount } from 'wagmi'

const Header = () => {
  return (
    <header className="flex justify-between items-center p-4 px-8 sm:px-10 md:px-14 border-b-2 border-b-slate-200 w-full">
      <Link href={'/'}>
        <img
          src="/assets/img.jpg"
          alt="HospitalityNFT Logo"
          className="h-12 w-auto inline-block mr-4"
        />
      </Link>
      <ButtonGroup />
      <ConnectBtn />
    </header>
  )
}

const ButtonGroup = () => {
  const { address } = useAccount()

  return (
    <div className="md:flex hidden items-center justify-center border-gray-300 border overflow-hidden rounded-full cursor-pointer">
      <div className="inline-flex" role="group">
        <button className="rounded-l-full px-5 py-3 text-[#00773d] font-medium text-sm leading-tight hover:bg-black hover:bg-opacity-5 focus:outline-none focus:ring-0 transition duration-150 ease-in-out">
          Anywhere
        </button>
        {address && (
          <Link href={'/room/add'}>
            <button
              type="button"
              className="px-5 py-3 border-x border-gray-300 text-[#00773d] font-medium text-sm leading-tight hover:bg-black hover:bg-opacity-5 focus:outline-none focus:ring-0 transition duration-150 ease-in-out"
            >
              Add Hotels
            </button>
          </Link>
        )}
        <button className="rounded-r-full px-5 py-3 text-[#00773d] font-medium text-sm leading-tight hover:bg-black hover:bg-opacity-5 focus:outline-none focus:ring-0 transition duration-150 ease-in-out">
          <p className="flex items-center">Any week</p>
        </button>
      </div>
    </div>
  )
}

export default Header
