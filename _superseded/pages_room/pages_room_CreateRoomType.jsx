export default function RetiredV1RoomRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/MyNFTs', permanent: false } }
}
