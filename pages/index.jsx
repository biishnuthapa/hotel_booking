import React from 'react'
import Head from 'next/head'
import { getApartments } from '@/services/blockchain'
import { Collection,  HeroSection, Information, ParentComponent } from '@/components'
import Accordion from '../components/Questions/Questions'
import UpcomingEvents from '../components/UpcomingEvent/Upcoming'
import NFTWebsiteSteps from '../components/Steps/NFTWebsiteSteps'
import Background from '@/components/Background/Background'

const Home = ({ apartmentsData }) => {
  const images = [
    '/assets/image1.jpg',
    '/assets/image2.jpg',
    '/assets/image3.jpg',
    '/assets/image4.jpg',
    '/assets/image5.jpg',
  ]

  return (
    <div>
      <Head>
        <title>Home Page</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex flex-col">
        <div className="order-5">
          <h1 className="text-3xl font-bold text-center text-green-600 mb-8 leading-tight pt-10">
            Popular Destination
          </h1>

          <Collection appartments={apartmentsData} />
        </div>

        <section className="relative h-screen">
        
          <Background images={images} />

          {/* Overlay */}
          <div className="absolute inset-0 bg-black opacity-60"></div>

          {/* Content container */}
          <div className="absolute inset-0 flex flex-col justify-center items-center text-white z-10">
            {/* SearchBar */}
            <div className="mb-5 mt-30 ">
              <ParentComponent />
            </div>

            {/* HeroSection */}
            <HeroSection />
          </div>
        </section>

        <div className="order-4">
          {' '}
          <UpcomingEvents />
        </div>
      </div>
      <Accordion />
      <NFTWebsiteSteps />
      <Information />
    </div>
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
