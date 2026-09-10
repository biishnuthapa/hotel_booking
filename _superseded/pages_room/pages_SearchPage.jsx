export default function RetiredV1AdminRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/legacy', permanent: false } }
}
