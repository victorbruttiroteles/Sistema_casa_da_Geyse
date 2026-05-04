import { useQuery } from '@tanstack/react-query';
import { DollarSign, CalendarDays, Users, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../services/api';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

const RADIAN = Math.PI / 180;
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-pink-900/30 rounded-lg p-3 text-sm">
      <p className="text-gray-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const firstDay = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', firstDay, today],
    queryFn: () => api.get(`/reports/dashboard?date_from=${firstDay}&date_to=${today}`).then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-dark-800 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-dark-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const { revenue, reservations, occupancy, topCustomers, nps } = data || {};

  const npsScore = parseFloat(nps?.avg_nps || 0);
  const promoterPct = nps?.total ? Math.round((nps.promoters / nps.total) * 100) : 0;
  const detractorPct = nps?.total ? Math.round((nps.detractors / nps.total) * 100) : 0;
  const calculatedNPS = promoterPct - detractorPct;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Período: {format(new Date(firstDay), "d 'de' MMMM", { locale: ptBR })} — {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Receita do Mês"
          value={fmtCurrency(revenue?.total_revenue)}
          subtitle={`${revenue?.total_payments || 0} pagamentos confirmados`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Reservas"
          value={reservations?.total || 0}
          subtitle={`Ticket médio: ${fmtCurrency(reservations?.avg_ticket)}`}
          icon={CalendarDays}
          color="pink"
        />
        <StatCard
          title="NPS Score"
          value={isNaN(calculatedNPS) ? '—' : calculatedNPS}
          subtitle={`Média: ${npsScore.toFixed(1)} · ${nps?.total || 0} avaliações`}
          icon={Star}
          color="yellow"
        />
        <StatCard
          title="Clientes Ativos"
          value={topCustomers?.length || 0}
          subtitle="Top 10 do período"
          icon={Users}
          color="blue"
        />
      </div>

      {/* Ocupação por Casa + Top Clientes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Ocupação */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Ocupação por Unidade</h2>
          {occupancy?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={occupancy} barSize={32}>
                <XAxis dataKey="house_name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="occupancy_rate" name="Ocupação %" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm text-center py-12">Sem dados de ocupação</p>}
        </div>

        {/* Top Clientes */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Top Clientes do Período</h2>
          <div className="space-y-3">
            {topCustomers?.length ? topCustomers.map((c, i) => (
              <div key={c.whatsapp} className="flex items-center gap-3">
                <span className="text-pink-400 font-bold text-sm w-5 shrink-0">#{i + 1}</span>
                <div className="w-8 h-8 bg-pink-900/50 rounded-full flex items-center justify-center text-pink-400 font-bold text-sm shrink-0">
                  {(c.name || c.whatsapp)?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{c.name || c.whatsapp}</p>
                  <p className="text-gray-500 text-xs">{c.reservation_count} reservas</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-emerald-400 text-sm font-semibold">{fmtCurrency(c.total_spent)}</p>
                  <Badge status={c.status} />
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Receita split */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Split de Receita</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Plataforma', value: revenue?.platform_revenue, color: 'text-pink-400' },
            { label: 'Casas', value: revenue?.house_revenue, color: 'text-blue-400' },
            { label: 'Acompanhantes', value: revenue?.companions_revenue, color: 'text-purple-400' },
          ].map((item) => (
            <div key={item.label} className="bg-dark-700 rounded-xl p-4 text-center border border-pink-900/20">
              <p className="text-gray-400 text-xs mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.color}`}>{fmtCurrency(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
