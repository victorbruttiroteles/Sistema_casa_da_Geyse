import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';

const SETTING_LABELS = {
  split_platform_percent:    { label: 'Plataforma (%)', group: 'Financeiro', type: 'number' },
  split_house_percent:       { label: 'Casa (%)', group: 'Financeiro', type: 'number' },
  split_companion_percent:   { label: 'Acompanhante (%)', group: 'Financeiro', type: 'number' },
  pix_expiry_minutes:        { label: 'Expiração do Pix (min)', group: 'Pagamentos', type: 'number' },
  renewal_alert_minutes:     { label: 'Alerta de renovação (min antes)', group: 'Automações', type: 'number' },
  nps_delay_minutes:         { label: 'Enviar NPS após (min)', group: 'Automações', type: 'number' },
  reactivation_days:         { label: 'Reativar clientes inativos há (dias)', group: 'Automações', type: 'number' },
  vip_min_reservations:      { label: 'Mínimo de reservas para VIP', group: 'CRM', type: 'number' },
  loyalty_points_per_100:    { label: 'Pontos por R$100 gastos', group: 'Fidelidade', type: 'number' },
  loyalty_points_for_reward: { label: 'Pontos para resgatar recompensa', group: 'Fidelidade', type: 'number' },
  bot_welcome_message:       { label: 'Mensagem de boas-vindas', group: 'Bot WhatsApp', type: 'textarea' },
  bot_underage_message:      { label: 'Mensagem para menores de idade', group: 'Bot WhatsApp', type: 'textarea' },
  business_hours_start:      { label: 'Abertura', group: 'Horários', type: 'time' },
  business_hours_end:        { label: 'Fechamento', group: 'Horários', type: 'time' },
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    onSuccess: (data) => {
      const map = {};
      data.forEach(s => { map[s.key] = s.value; });
      setValues(map);
    },
  });

  // Inicializar values quando os dados chegam
  if (settings.length && Object.keys(values).length === 0) {
    const map = {};
    settings.forEach(s => { map[s.key] = s.value; });
    setValues(map);
  }

  async function saveSetting(key) {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.patch(`/settings/${key}`, { value: values[key] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Configuração salva');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(s => ({ ...s, [key]: false }));
    }
  }

  const groups = [...new Set(Object.values(SETTING_LABELS).map(s => s.group))];

  if (isLoading) return <div className="h-64 bg-dark-800 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Configurações do Sistema</h1>

      {groups.map((group) => {
        const groupSettings = Object.entries(SETTING_LABELS).filter(([, meta]) => meta.group === group);
        return (
          <div key={group} className="card space-y-5">
            <h2 className="text-base font-semibold text-pink-400 uppercase tracking-wider">{group}</h2>
            {groupSettings.map(([key, meta]) => (
              <div key={key} className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="label">{meta.label}</label>
                  {meta.type === 'textarea' ? (
                    <textarea
                      rows={4}
                      className="input resize-none text-sm"
                      value={values[key] || ''}
                      onChange={(e) => setValues(v => ({ ...v, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={meta.type || 'text'}
                      className="input"
                      value={values[key] || ''}
                      onChange={(e) => setValues(v => ({ ...v, [key]: e.target.value }))}
                    />
                  )}
                </div>
                <button
                  onClick={() => saveSetting(key)}
                  disabled={saving[key]}
                  className="btn-primary flex items-center gap-2 shrink-0 mb-0.5"
                >
                  <Save size={16} />
                  {saving[key] ? '...' : 'Salvar'}
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
