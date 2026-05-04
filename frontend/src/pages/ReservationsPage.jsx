import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function fmtDateTime(v) {
  if (!v) return '—';
  return format(new Date(v), "dd/MM/yy HH:mm", { locale: ptBR });
}

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ date: format(new Date(), 'yyyy-MM-dd'), status: '' });
  const [selected, setSelected] = useState(null);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.date) params.set('date', filters.date);
      if (filters.status) params.set('status', filters.status);
      return api.get(`/reservations?${params}`).then(r => r.data);
    },
    refetchInterval: 30000,
  });

  async function handleCancel(id) {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      await api.patch(`/reservations/${id}/cancel`, { cancel_reason: 'Cancelado pelo admin' });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setSelected(null);
      toast.success('Reserva cancelada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cancelar');
    }
  }

  const columns = [
    { key: 'id',               label: 'ID',         render: (v) => <span className="font-mono text-xs text-gray-400">{v?.slice(0,8)}</span> },
    { key: 'customer_name',    label: 'Cliente',     render: (v, row) => v || row.customer_whatsapp },
    { key: 'house_name',       label: 'Casa',        render: (v, row) => `${v} — ${row.room_name}` },
    { key: 'check_in',         label: 'Check-in',    render: (v) => fmtDateTime(v) },
    { key: 'check_out',        label: 'Check-out',   render: (v) => fmtDateTime(v) },
    { key: 'total_price',      label: 'Total',       render: (v) => <span className="text-emerald-400 font-semibold">{fmtCurrency(v)}</span> },
    { key: 'status',           label: 'Status',      render: (v) => <Badge status={v} /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Reservas</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          className="input !w-auto"
          value={filters.date}
          onChange={(e) => setFilters(f => ({ ...f, date: e.target.value }))}
        />
        <select
          className="input !w-auto"
          value={filters.status}
          onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmado</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <button onClick={() => setFilters({ date: '', status: '' })} className="btn-secondary text-sm">
          Limpar filtros
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 bg-dark-800 rounded-xl animate-pulse" />
      ) : (
        <Table
          columns={columns}
          data={reservations}
          onRowClick={setSelected}
          emptyMessage="Nenhuma reserva encontrada para os filtros selecionados."
        />
      )}

      {/* Modal detalhe */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes da Reserva" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['ID', selected.id?.slice(0, 8)],
                ['Status', <Badge status={selected.status} />],
                ['Cliente', selected.customer_name || selected.customer_whatsapp],
                ['Casa', selected.house_name],
                ['Quarto', selected.room_name],
                ['Cidade', selected.city_name],
                ['Check-in', fmtDateTime(selected.check_in)],
                ['Check-out', fmtDateTime(selected.check_out)],
                ['Duração', selected.duration_type],
                ['Código de acesso', <span className="font-mono font-bold text-pink-400">{selected.access_code}</span>],
                ['Quarto', fmtCurrency(selected.room_price)],
                ['Acompanhantes', fmtCurrency(selected.companions_price)],
                ['Total', <span className="text-emerald-400 font-bold">{fmtCurrency(selected.total_price)}</span>],
                ['Renovações', selected.renewal_count],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs mb-0.5">{label}</p>
                  <p className="text-white font-medium">{value ?? '—'}</p>
                </div>
              ))}
            </div>

            {selected.companions?.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Acompanhantes</p>
                <div className="space-y-2">
                  {selected.companions.map((c) => (
                    <div key={c.id} className="flex justify-between bg-dark-700 rounded-lg px-3 py-2 text-sm">
                      <span className="text-white">{c.name}</span>
                      <span className="text-pink-400 font-semibold">{fmtCurrency(c.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {['pending', 'confirmed'].includes(selected.status) && (
              <div className="flex justify-end pt-2">
                <button onClick={() => handleCancel(selected.id)} className="btn-danger text-sm">
                  Cancelar Reserva
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
