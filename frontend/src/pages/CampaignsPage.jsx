import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';
import { Plus, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const emptyForm = {
  name: '', message: '',
  target_status: [], target_tags: [],
  min_reservations: '', max_reservations: '',
  last_reservation_days: '',
};

const statusOptions = ['active', 'vip', 'inactive'];

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
  });

  async function saveCampaign() {
    setSaving(true);
    try {
      await api.post('/campaigns', {
        ...form,
        min_reservations: form.min_reservations || null,
        max_reservations: form.max_reservations || null,
        last_reservation_days: form.last_reservation_days || null,
      });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada');
      setModal(false);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar campanha');
    } finally { setSaving(false); }
  }

  async function sendCampaign(id) {
    if (!confirm('Enviar esta campanha para todos os clientes segmentados?')) return;
    setSending(id);
    try {
      const { data } = await api.post(`/campaigns/${id}/send`);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao enviar');
    } finally { setSending(null); }
  }

  function toggleStatus(s) {
    setForm(f => ({
      ...f,
      target_status: f.target_status.includes(s)
        ? f.target_status.filter(x => x !== s)
        : [...f.target_status, s],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        <button onClick={() => { setForm(emptyForm); setModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nova Campanha
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-dark-800 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {campaigns.length === 0 && <p className="text-gray-500 text-center py-12">Nenhuma campanha criada ainda.</p>}
          {campaigns.map((c) => (
            <div key={c.id} className="card flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-semibold text-white">{c.name}</p>
                  <Badge status={c.status === 'draft' ? 'pending' : c.status === 'sent' ? 'completed' : 'confirmed'} />
                </div>
                <p className="text-gray-400 text-sm line-clamp-2">{c.message}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  {c.sent_at && <span>Enviado: {format(new Date(c.sent_at), 'dd/MM/yyyy HH:mm')}</span>}
                  {c.sent_count > 0 && <span>✉️ {c.sent_count} destinatários</span>}
                  {c.target_status?.length > 0 && <span>Alvo: {c.target_status.join(', ')}</span>}
                </div>
              </div>
              {c.status === 'draft' && (
                <button
                  onClick={() => sendCampaign(c.id)}
                  disabled={sending === c.id}
                  className="btn-primary flex items-center gap-2 text-sm shrink-0"
                >
                  <Send size={16} />
                  {sending === c.id ? 'Enviando...' : 'Enviar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Campanha">
        <div className="space-y-4">
          <div>
            <label className="label">Nome da campanha</label>
            <input className="input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Mensagem (WhatsApp)</label>
            <textarea rows={5} className="input resize-none" placeholder="Use *negrito*, _itálico_..." value={form.message} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} />
          </div>

          <div>
            <label className="label">Segmentar por status</label>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((s) => (
                <button key={s} type="button"
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                    ${form.target_status.includes(s) ? 'bg-pink-600/20 text-pink-400 border-pink-600/30' : 'text-gray-400 border-pink-900/30 hover:border-pink-600/30'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Mín. reservas</label>
              <input type="number" className="input" value={form.min_reservations} onChange={(e) => setForm(f => ({ ...f, min_reservations: e.target.value }))} />
            </div>
            <div>
              <label className="label">Máx. reservas</label>
              <input type="number" className="input" value={form.max_reservations} onChange={(e) => setForm(f => ({ ...f, max_reservations: e.target.value }))} />
            </div>
            <div>
              <label className="label">Inativo há (dias)</label>
              <input type="number" className="input" value={form.last_reservation_days} onChange={(e) => setForm(f => ({ ...f, last_reservation_days: e.target.value }))} />
            </div>
          </div>

          <p className="text-gray-500 text-xs">Deixe os filtros em branco para enviar para todos os clientes ativos.</p>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveCampaign} disabled={saving || !form.name || !form.message} className="btn-primary">
              {saving ? 'Salvando...' : 'Criar Campanha'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
