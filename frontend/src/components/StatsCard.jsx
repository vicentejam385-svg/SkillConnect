export default function StatsCard({ icon: Icon, label, value, sub, accent = 'amber' }) {
  const colors = {
    amber:   { bg: 'bg-amber-500/10',   icon: 'text-amber-400',   border: 'border-amber-500/20'  },
    blue:    { bg: 'bg-blue-500/10',    icon: 'text-blue-400',    border: 'border-blue-400/20'   },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-400/20' },
    red:     { bg: 'bg-red-500/10',     icon: 'text-red-400',     border: 'border-red-400/20'    },
  }
  const c = colors[accent] || colors.amber
  return (
    <div className={`card-steel p-5 flex items-start gap-4 border ${c.border}`}>
      <div className={`w-11 h-11 ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={c.icon} />
      </div>
      <div>
        <div className="font-display font-bold text-2xl text-slate-100">{value}</div>
        <div className="font-body text-sm text-slate-400 mt-0.5">{label}</div>
        {sub && <div className="font-body text-xs text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  )
}