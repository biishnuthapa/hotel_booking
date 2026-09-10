export default function RetiredV1BookingsRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/legacy', permanent: false } }
}
