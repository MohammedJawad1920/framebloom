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
    <div className="flex gap-3 flex-wrap justify-center">
      {frames.map(f => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          title={f.label}
          className={`h-8 w-8 rounded-full border-2 transition-transform ${
            f.id === selected ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: f.color_hex }}
        />
      ))}
    </div>
  )
}
