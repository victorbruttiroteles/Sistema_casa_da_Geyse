import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-pink-900/30 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const firstDay = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['reports', dateFrom, dateTo],
    queryFn: () => api.get(`/reports/dashboard?date_from=${dateFrom}&date_to=${dateTo}`).then(r => r.data),
  });

  const { revenue, reservations, occupancy, nps } = data || {};

  const splitData = [
    { name: 'Plataforma', value: parseFloat(revenue?.platform_revenue || 0) },
    { name: 'Casas', value: parseFloat(revenue?.house_revenue || 0) },
    { name: 'Acompanhantes', value: parseFloat(revenue?.companions_revenue || 0) },
  ].filter(d => d.value > 0);

  const npsScore = nps?.total
    ? Math.round(((nps.promoters - nps.detractors) / nps.total) * 100)
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <div className="flex gap-3 items-center">
          <div>
            <label className="label text-xs">De</label>
            <input type="date" className="input !w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Até</label>
            <input type="date" className="input !w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-dark-800 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Receita Total', value: fmtCurrency(revenue?.total_revenue), sub: `${revenue?.total_payments || 0} pagamentos` },
              { label: 'Total Reservas', value: reservations?.total || 0, sub: `${reservations?.confirmed || 0} confirmadas` },
              { label: 'Ticket Médio', value: fmtCurrency(reservations?.avg_ticket), sub: `Duração média: ${parseFloat(reservations?.avg_duration || 0).toFixed(1)}h` },
              { label: 'NPS Score', value: npsScore !== null ? npsScore : '—', sub: `${nps?.total || 0} avaliações` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="card text-center">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Ocupação */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4">Ocupação por Unidade (%)</h2>
              {occupancy?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={occupancy} barSize={36}>
                    <XAxis dataKey="house_name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="occupancy_rate" name="Ocupação %" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-center py-16">Sem dados</p>}
            </div>

            {/* Split financeiro */}
            <div className="card">
              <h2 className="text-base font-semibold text-white mb-4">Distribuição de Receita</h2>
              {splitData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {splitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-500 text-center py-16">Sem dados</p>}
            </div>
          </div>

          {/* NPS breakdown */}
          <div className="card">
            <h2 className="text-base font-semibold text-white mb-4">Análise NPS</h2>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { label: 'Promotores (9-10)', value: nps?.promoters || 0, color: 'text-emerald-400' },
                { label: 'Neutros (7-8)',     value: nps?.neutrals  || 0, color: 'text-yellow-400' },
                { label: 'Detratores (0-6)',  value: nps?.detractors|| 0, color: 'text-red-400'    },
              ].map((s) => (
                <div key={s.label} className="bg-dark-700 rounded-xl p-5 border border-pink-900/20">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            {npsScore !== null && (
              <div className="mt-4 text-center">
                <p className="text-gray-400 text-sm">NPS Score consolidado</p>
                <p className={`text-4xl font-bold mt-1 ${npsScore >= 50 ? 'text-emerald-400' : npsScore >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {npsScore}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
