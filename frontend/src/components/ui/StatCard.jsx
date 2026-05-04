import clsx from 'clsx';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'pink', trend }) {
  const colorMap = {
    pink:  'text-pink-400  bg-pink-900/30',
    green: 'text-emerald-400 bg-emerald-900/30',
    blue:  'text-blue-400  bg-blue-900/30',
    yellow:'text-yellow-400 bg-yellow-900/30',
  };
  return (
    <div className="card flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1 truncate">{value}</p>
        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <p className={clsx('text-xs mt-1 font-medium', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs. mês anterior
          </p>
        )}
      </div>
      {Icon && (
        <div className={clsx('p-3 rounded-xl shrink-0', colorMap[color])}>
          <Icon size={22} className={colorMap[color].split(' ')[0]} />
        </div>
      )}
    </div>
  );
}
