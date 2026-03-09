import { Card } from '.'

const Collection = ({ appartments }) => {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {appartments.map((room, i) => (
        <Card appartment={room} key={i} />
      ))}
      {appartments.length < 1 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
          No apartments available yet.
        </div>
      )}
    </div>
  )
}

export default Collection
