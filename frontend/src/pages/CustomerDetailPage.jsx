import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, MessageSquare, Star } from 'lucide-react';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [msgModal, setMsgModal] = useState(false);
  const [message, setMessage] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editData, setEditData] = useState({});

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  });

  async function sendMessage() {
    try {
      await api.post(`/customers/${id}/message`, { message });
      toast.success('Mensagem enviada!');
      setMsgModal(false);
      setMessage('');
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  }

  async function saveEdit() {
    try {
      await api.patch(`/customers/${id}`, editData);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Cliente atualizado');
      setEditModal(false);
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  if (isLoading) return <div className="h-64 bg-dark-800 rounded-xl animate-pulse" />;
  if (!customer) return <p className="text-gray-500">Cliente não encontrado.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{customer.name || customer.whatsapp}</h1>
          <p className="text-gray-500 text-sm font-mono">{customer.whatsapp}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setEditData({ name: customer.name, status: customer.status, notes: customer.notes }); setEditModal(true); }} className="btn-secondary text-sm">
            Editar
          </button>
          <button onClick={() => setMsgModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <MessageSquare size={16} /> Enviar Mensagem
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Gasto', value: fmtCurrency(customer.total_spent), color: 'text-emerald-400' },
          { label: 'Reservas', value: customer.total_reservations, color: 'text-white' },
          { label: 'Pontos', value: customer.loyalty_points, color: 'text-pink-400' },
          { label: 'NPS Médio', value: customer.nps_average ? parseFloat(customer.nps_average).toFixed(1) : '—', color: 'text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-gray-400 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Info + Tags */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-white">Informações</h2>
          {[
            ['Status', <Badge status={customer.status} />],
            ['Opt-in', customer.opted_in_at ? format(new Date(customer.opted_in_at), "dd/MM/yyyy 'às' HH:mm") : '—'],
            ['Última Reserva', customer.last_reservation_at ? format(new Date(customer.last_reservation_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'],
            ['Código de Indicação', <span className="font-mono text-pink-400">{customer.referral_code}</span>],
            ['Notas', customer.notes || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-2 text-sm">
              <span className="text-gray-400 shrink-0">{label}</span>
              <span className="text-white text-right">{value}</span>
            </div>
          ))}

          {customer.tags?.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {customer.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-pink-900/40 text-pink-300 rounded-lg text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avaliações NPS */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-4">Avaliações NPS</h2>
          {customer.nps_ratings?.length ? (
            <div className="space-y-3">
              {customer.nps_ratings.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${n.score >= 9 ? 'bg-emerald-900/50 text-emerald-400' : n.score >= 7 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                    {n.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm truncate">{n.comment || 'Sem comentário'}</p>
                    <p className="text-gray-500 text-xs">{format(new Date(n.responded_at), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">Nenhuma avaliação ainda.</p>}
        </div>
      </div>

      {/* Histórico de reservas */}
      <div className="card">
        <h2 className="text-base font-semibold text-white mb-4">Histórico de Reservas</h2>
        {customer.reservations?.length ? (
          <div className="space-y-2">
            {customer.reservations.map((r) => (
              <div key={r.id} className="flex items-center gap-4 bg-dark-700 rounded-lg px-4 py-3 text-sm">
                <Badge status={r.status} />
                <span className="text-gray-300 flex-1">{r.house_name} — {r.room_name}</span>
                <span className="text-gray-400">{r.duration_type}</span>
                <span className="text-emerald-400 font-semibold">{fmtCurrency(r.total_price)}</span>
                <span className="text-gray-500">{format(new Date(r.check_in), 'dd/MM/yy')}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-500 text-sm">Nenhuma reserva.</p>}
      </div>

      {/* Modal mensagem */}
      <Modal open={msgModal} onClose={() => setMsgModal(false)} title="Enviar Mensagem WhatsApp" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Mensagem</label>
            <textarea
              rows={5}
              className="input resize-none"
              placeholder="Digite a mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setMsgModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={sendMessage} disabled={!message.trim()} className="btn-primary">Enviar</button>
          </div>
        </div>
      </Modal>

      {/* Modal editar */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar Cliente" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={editData.name || ''} onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={editData.status || ''} onChange={(e) => setEditData(d => ({ ...d, status: e.target.value }))}>
              <option value="active">Ativo</option>
              <option value="vip">VIP</option>
              <option value="inactive">Inativo</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </div>
          <div>
            <label className="label">Notas internas</label>
            <textarea rows={3} className="input resize-none" value={editData.notes || ''} onChange={(e) => setEditData(d => ({ ...d, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveEdit} className="btn-primary">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
