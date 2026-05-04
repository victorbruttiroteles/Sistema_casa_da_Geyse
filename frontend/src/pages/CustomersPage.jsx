import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search } from 'lucide-react';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return api.get(`/customers?${params}`).then(r => r.data);
    },
  });

  const columns = [
    { key: 'whatsapp',             label: 'WhatsApp',       render: (v) => <span className="font-mono text-sm">{v}</span> },
    { key: 'name',                 label: 'Nome',           render: (v) => v || <span className="text-gray-500">—</span> },
    { key: 'status',               label: 'Status',         render: (v) => <Badge status={v} /> },
    { key: 'total_reservations',   label: 'Reservas',       render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'total_spent',          label: 'Total Gasto',    render: (v) => <span className="text-emerald-400 font-semibold">{fmtCurrency(v)}</span> },
    { key: 'loyalty_points',       label: 'Pontos',         render: (v) => <span className="text-pink-400">{v}</span> },
    { key: 'nps_average',          label: 'NPS',            render: (v) => v ? parseFloat(v).toFixed(1) : '—' },
    { key: 'last_reservation_at',  label: 'Última Reserva', render: (v) => v ? format(new Date(v), 'dd/MM/yy', { locale: ptBR }) : '—' },
    { key: 'tags',                 label: 'Tags',           render: (v) => (
      <div className="flex flex-wrap gap-1">
        {(v || []).map((tag) => (
          <span key={tag} className="px-1.5 py-0.5 bg-pink-900/40 text-pink-300 rounded text-xs">{tag}</span>
        ))}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Clientes — CRM</h1>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input !pl-9 !w-64"
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="vip">VIP</option>
          <option value="inactive">Inativo</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{data?.total || 0} clientes encontrados</span>
      </div>

      {isLoading ? (
        <div className="h-64 bg-dark-800 rounded-xl animate-pulse" />
      ) : (
        <Table
          columns={columns}
          data={data?.data || []}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
          emptyMessage="Nenhum cliente encontrado."
        />
      )}
    </div>
  );
}
