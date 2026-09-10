export default function RetiredV1EditRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/MyNFTs', permanent: false } }
}
