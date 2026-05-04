import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ROLES = [
  { value: 'super_admin',   label: 'Super Admin'      },
  { value: 'house_manager', label: 'Gestor de Casa'   },
  { value: 'receptionist',  label: 'Recepcionista'    },
  { value: 'financial',     label: 'Financeiro'       },
];

const emptyForm = { name: '', email: '', password: '', role: 'receptionist', house_id: '' };

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get('/admin/users').then(r => r.data) });
  const { data: houses = [] } = useQuery({ queryKey: ['houses'], queryFn: () => api.get('/houses').then(r => r.data) });

  function openEdit(user) {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, house_id: user.house_id || '' });
    setModal(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/admin/users/${editing.id}`, { ...form, password: form.password || undefined });
        toast.success('Usuário atualizado');
      } else {
        await api.post('/admin/users', form);
        toast.success('Usuário criado');
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setModal(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  const columns = [
    { key: 'name',       label: 'Nome' },
    { key: 'email',      label: 'E-mail',   render: (v) => <span className="font-mono text-sm">{v}</span> },
    { key: 'role',       label: 'Perfil',   render: (v) => ROLES.find(r => r.value === v)?.label || v },
    { key: 'active',     label: 'Status',   render: (v) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${v ? 'badge-available' : 'badge-cancelled'}`}>
        {v ? 'Ativo' : 'Inativo'}
      </span>
    )},
    { key: 'last_login', label: 'Último acesso', render: (v) => v ? format(new Date(v), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : 'Nunca' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Usuários Admin</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 bg-dark-800 rounded-xl animate-pulse" />
      ) : (
        <Table columns={columns} data={users} onRowClick={openEdit} emptyMessage="Nenhum usuário cadastrado." />
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Usuário' : 'Novo Usuário'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Nome completo</label>
            <input className="input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">{editing ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Perfil de acesso</label>
            <select className="input" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {['house_manager', 'receptionist'].includes(form.role) && (
            <div>
              <label className="label">Unidade vinculada</label>
              <select className="input" value={form.house_id} onChange={(e) => setForm(f => ({ ...f, house_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {houses.map(h => <option key={h.id} value={h.id}>{h.name} — {h.city_name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="flex items-center gap-3">
              <label className="label mb-0">Ativo</label>
              <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-pink-500" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={save} disabled={saving || !form.name || !form.email || (!editing && !form.password)} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
