import { ToastContainer } from 'react-toastify'
import '@/styles/globals.css'
import 'react-toastify/dist/ReactToastify.css'
import '@rainbow-me/rainbowkit/styles.css'
import Providers from '@/services/provider'
import Header from '@/components/Header/Header'
import Footer from '@/components/Footer/Footer'

export default function App({ Component, pageProps }) {
  return (
    <Providers pageProps={pageProps}>
      <div className="min-h-screen bg-[#f6f8fb]">
        <Header />
        <main className="mx-auto w-full">
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
