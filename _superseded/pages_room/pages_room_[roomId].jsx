export default function RetiredV1BookingRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/legacy', permanent: false } }
}
