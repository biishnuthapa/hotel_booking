import Head from 'next/head'
import { EmptyState } from '@/components/AppUI'

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page not found · HospitalityBooking</title>
      </Head>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState
          title="Page not found"
          headingLevel="h1"
          description="The requested route does not exist in the current HospitalityBooking application."
          actionHref="/"
          actionLabel="Return home"
        />
      </div>
    </>
  )
}
