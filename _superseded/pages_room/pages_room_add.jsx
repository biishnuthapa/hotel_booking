export default function RetiredV1CreateRoute() { return null }
export function getServerSideProps() {
  return { redirect: { destination: '/manage/new', permanent: false } }
}
