const Title = ({ apartment }) => {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold capitalize text-slate-900">{apartment?.name}</h1>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>{apartment?.rooms} {apartment?.rooms == 1 ? 'room' : 'rooms'}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>{apartment?.location}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span className="font-semibold text-[#00773d]">{apartment?.price} ETH / night</span>
      </div>
    </div>
  )
}

export default Title
