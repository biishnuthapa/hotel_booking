import { ToastContainer } from 'react-toastify'
import Head from 'next/head'
import '@/styles/globals.css'
import 'react-toastify/dist/ReactToastify.css'
import '@rainbow-me/rainbowkit/styles.css'
import Providers from '@/services/provider'
import Header from '@/components/Header/Header'
import Footer from '@/components/Footer/Footer'

export default function App({ Component, pageProps }) {
  return (
    <Providers pageProps={pageProps}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f766e" />
        <meta name="color-scheme" content="light" />
      </Head>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main-content" className="w-full flex-1">
          <Component {...pageProps} />
        </main>
        <Footer />
      </div>

      <ToastContainer
        position="bottom-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </Providers>
  )
}
