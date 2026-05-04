import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { Plus, Star, ImagePlus } from 'lucide-react';
import clsx from 'clsx';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

const GENDERS = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'nao_binario', label: 'Não-binário' },
  { value: 'trans_feminina', label: 'Trans Feminina' },
  { value: 'trans_masculino', label: 'Trans Masculino' },
];

const AGE_RANGES = ['18-25', '26-35', '36-45', '46+'];

const emptyForm = { artistic_name: '', bio: '', gender: 'feminino', age_range: '18-25', price_per_hour: '', languages: [], categories: [] };

export default function CompanionsPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: companions = [], isLoading } = useQuery({
    queryKey: ['companions', filterStatus],
    queryFn: () => api.get(`/companions?available=${filterStatus === 'available' ? 'true' : ''}`).then(r => r.data),
  });

  function openNew() { setSelected(null); setForm(emptyForm); setModal(true); }
  function openEdit(c) { setSelected(c); setForm({ artistic_name: c.artistic_name, bio: c.bio || '', gender: c.gender, age_range: c.age_range, price_per_hour: c.price_per_hour }); setModal(true); }

  async function save() {
    setSaving(true);
    try {
      if (selected) {
        await api.patch(`/companions/${selected.id}`, form);
        toast.success('Acompanhante atualizado');
      } else {
        await api.post('/companions', form);
        toast.success('Acompanhante cadastrado');
      }
      queryClient.invalidateQueries({ queryKey: ['companions'] });
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    try {
      await api.patch(`/companions/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ['companions'] });
      toast.success('Status atualizado');
    } catch { toast.error('Erro'); }
  }

  async function addPhoto(companionId) {
    if (!photoUrl.trim()) return;
    try {
      await api.post(`/companions/${companionId}/photos`, { url: photoUrl, is_cover: true, approved: false });
      toast.success('Foto enviada para aprovação');
      setPhotoUrl('');
      queryClient.invalidateQueries({ queryKey: ['companions'] });
    } catch { toast.error('Erro ao adicionar foto'); }
  }

  const filtered = filterStatus ? companions.filter(c => c.status === filterStatus) : companions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Acompanhantes</h1>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Cadastrar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        {['', 'available', 'busy', 'paused', 'inactive'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              filterStatus === s ? 'bg-pink-600/20 text-pink-400 border-pink-600/30' : 'text-gray-400 border-pink-900/20 hover:border-pink-600/30')}>
            {s === '' ? 'Todos' : s === 'available' ? 'Disponíveis' : s === 'busy' ? 'Ocupados' : s === 'paused' ? 'Pausados' : 'Inativos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-64 bg-dark-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="card !p-4 flex flex-col gap-3 hover:border-pink-600/40 transition-colors cursor-pointer" onClick={() => openEdit(c)}>
              {/* Foto */}
              <div className="aspect-[3/4] bg-dark-700 rounded-lg overflow-hidden relative">
                {c.cover_photo ? (
                  <img src={c.cover_photo} alt={c.artistic_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <ImagePlus size={32} />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge status={c.status} />
                </div>
              </div>

              <div>
                <p className="font-semibold text-white text-sm">{c.artistic_name}</p>
                <p className="text-gray-400 text-xs">{c.gender} · {c.age_range}</p>
                <p className="text-pink-400 text-sm font-semibold mt-1">{fmtCurrency(c.price_per_hour)}/h</p>
                {c.rating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-yellow-400 text-xs font-semibold">{parseFloat(c.rating).toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Quick status */}
              <select
                value={c.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); updateStatus(c.id, e.target.value); }}
                className="w-full bg-dark-700 border border-pink-900/40 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="available">Disponível</option>
                <option value="busy">Ocupado</option>
                <option value="paused">Pausado</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Modal cadastro/edição */}
      <Modal open={modal} onClose={() => setModal(false)} title={selected ? 'Editar Acompanhante' : 'Cadastrar Acompanhante'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome artístico</label>
              <input className="input" value={form.artistic_name} onChange={(e) => setForm(f => ({ ...f, artistic_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Gênero</label>
              <select className="input" value={form.gender} onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}>
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Faixa etária</label>
              <select className="input" value={form.age_range} onChange={(e) => setForm(f => ({ ...f, age_range: e.target.value }))}>
                {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor/hora (R$)</label>
              <input type="number" step="0.01" className="input" value={form.price_per_hour} onChange={(e) => setForm(f => ({ ...f, price_per_hour: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Bio (máx. 200 caracteres)</label>
              <textarea rows={2} maxLength={200} className="input resize-none" value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} />
            </div>

            {selected && (
              <div className="col-span-2">
                <label className="label">Adicionar foto (URL)</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="https://..." value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                  <button onClick={() => addPhoto(selected.id)} className="btn-secondary shrink-0">Enviar</button>
                </div>
                <p className="text-gray-500 text-xs mt-1">A foto passará por aprovação antes de aparecer.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.artistic_name || !form.price_per_hour} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
