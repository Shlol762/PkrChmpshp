export default function GameStatsBanner({ liveGame, totalLivePot }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { label: 'Hand Number', value: `#${liveGame.handNumber}`, color: 'text-white' },
        { label: 'Stage', value: liveGame.stage?.replace('_', ' '), color: 'text-amber-400' },
        { label: 'Current Pot', value: totalLivePot.toLocaleString(), color: 'text-emerald-400' },
        { label: 'To Call', value: liveGame.highestBet.toLocaleString(), color: 'text-white' },
        { label: 'Blinds', value: `${liveGame.smallBlind}/${liveGame.bigBlind}`, color: 'text-zinc-300', extra: 'col-span-2 md:col-span-1', mono: true },
      ].map(stat => (
        <div key={stat.label} className={`bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between ${stat.extra || ''}`}>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{stat.label}</span>
          <span className={`text-xl font-bold tabular-nums ${stat.color} ${stat.mono ? 'font-mono' : ''}`}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
