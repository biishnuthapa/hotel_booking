import Head from 'next/head'
import { EmptyState } from '@/components/AppUI'

export default function ServerErrorPage() {
  return (
    <>
      <Head>
        <title>Service unavailable · HospitalityBooking</title>
      </Head>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <EmptyState
          title="The service is temporarily unavailable"
          headingLevel="h1"
          description="No transaction was submitted from this page. Please retry after checking the selected network and RPC status."
          actionHref="/"
          actionLabel="Return home"
        />
      </div>
    </>
  )
}
