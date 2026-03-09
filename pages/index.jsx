import Head from 'next/head'
import Link from 'next/link'
import { getApartments } from '@/services/blockchain'
import { Collection } from '@/components'

const Home = ({ apartmentsData }) => {
  return (
    <>
      <Head>
        <title>Hospitality NFT | Decentralized Hotel Booking</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid items-center gap-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-[#00773d]/25 bg-[#00773d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#00773d]">
              Web3 Hospitality
            </p>
            <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
              Book Stays Onchain.
              <span className="block text-[#00773d]">Mint Your Check-in NFT.</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-600">
              Discover properties, reserve with transparent smart contracts, and receive an NFT when
              you check in.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="#listings"
                className="rounded-xl bg-[#00773d] px-5 py-3 font-semibold text-white transition hover:brightness-110"
              >
                Browse Listings
              </Link>
              <Link
                href="/room/add"
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:border-[#00773d] hover:text-[#00773d]"
              >
                List a Property
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['/assets/image1.jpg', '/assets/image2.jpg', '/assets/image3.jpg', '/assets/image4.jpg'].map((src) => (
              <img key={src} src={src} alt="Hospitality showcase" className="h-44 w-full rounded-2xl object-cover" />
            ))}
          </div>
        </div>
      </section>

      <section id="listings" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Featured Properties</h2>
          <p className="text-sm text-slate-500">{apartmentsData.length} active listing(s)</p>
        </div>
        <Collection appartments={apartmentsData} />
      </section>
    </>
  )
}

export default Home

export const getServerSideProps = async () => {
  const apartmentsData = await getApartments()

  return {
    props: {
      apartmentsData: JSON.parse(JSON.stringify(apartmentsData)),
    },
  }
}
