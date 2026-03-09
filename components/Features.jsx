const features = [
  { icon: 'wifi.png', label: 'High-speed Wi-Fi' },
  { icon: 'parking.png', label: 'On-site parking' },
  { icon: 'swimming.png', label: 'Pool access' },
  { icon: 'air-conditioning.png', label: 'Air conditioning' },
  { icon: '24-hours.png', label: '24/7 guest support' },
]

const Features = () => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Amenities</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {features.map((feature) => (
          <div key={feature.label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <img src={`/assets/flati_icon/${feature.icon}`} alt={feature.label} className="h-10 w-10 object-contain" />
            <p className="text-sm font-medium text-slate-700">{feature.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Features
