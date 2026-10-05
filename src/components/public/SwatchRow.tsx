type Frame = { id: string; color_hex: string; label: string }

export default function SwatchRow({
  frames,
  selected,
  onSelect,
}: {
  frames: Frame[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-4 flex-wrap justify-center p-2">
      {frames.map(f => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          title={f.label}
          className={`h-11 w-11 rounded-full transition-all ${
            f.id === selected ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-sm' : 'hover:scale-105 border border-gray-200 shadow-sm'
          }`}
          style={{ backgroundColor: f.color_hex }}
        />
      ))}
    </div>
  )
}
