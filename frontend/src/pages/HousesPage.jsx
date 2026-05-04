import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import toast from 'react-hot-toast';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';

function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

const emptyRoom = { name: '', description: '', price_1h: '', price_2h: '', price_4h: '', price_8h: '', price_daily: '', amenities: [] };

export default function HousesPage() {
  const queryClient = useQueryClient();
  const [expandedHouse, setExpandedHouse] = useState(null);
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ ...emptyRoom, house_id: '' });
  const [saving, setSaving] = useState(false);

  const { data: cities = [] } = useQuery({ queryKey: ['cities'], queryFn: () => api.get('/cities').then(r => r.data) });
  const { data: houses = [], isLoading } = useQuery({ queryKey: ['houses'], queryFn: () => api.get('/houses').then(r => r.data) });

  const groupedByCity = cities.reduce((acc, city) => {
    acc[city.id] = { city, houses: houses.filter(h => h.city_id === city.id) };
    return acc;
  }, {});

  async function saveRoom() {
    setSaving(true);
    try {
      const amenities = roomForm.amenities_text ? roomForm.amenities_text.split(',').map(s => s.trim()) : [];
      await api.post('/rooms', { ...roomForm, amenities });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Quarto cadastrado com sucesso');
      setRoomModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  function openRoomModal(houseId) {
    setRoomForm({ ...emptyRoom, house_id: houseId });
    setRoomModal(true);
  }

  const { data: rooms = [] } = useQuery({ queryKey: ['rooms'], queryFn: () => api.get('/rooms').then(r => r.data) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Casas & Quartos</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-24 bg-dark-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(groupedByCity).map(({ city, houses: cityHouses }) => (
            <div key={city.id}>
              <h2 className="text-sm font-semibold text-pink-400 uppercase tracking-wider mb-3">{city.name} — {city.state}</h2>
              <div className="space-y-3">
                {cityHouses.map((house) => {
                  const houseRooms = rooms.filter(r => r.house_id === house.id);
                  const isExpanded = expandedHouse === house.id;
                  return (
                    <div key={house.id} className="card !p-0 overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                        onClick={() => setExpandedHouse(isExpanded ? null : house.id)}
                      >
                        <div>
                          <p className="font-semibold text-white">{house.name}</p>
                          <p className="text-gray-400 text-sm">📍 {house.address} · {houseRooms.length} quartos</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); openRoomModal(house.id); }} className="btn-secondary text-xs py-1.5 px-3">
                            <Plus size={14} className="inline mr-1" /> Quarto
                          </button>
                          {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-pink-900/30 p-5">
                          {houseRooms.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">Nenhum quarto cadastrado. Clique em "+ Quarto" para adicionar.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {houseRooms.map((room) => (
                                <div key={room.id} className="bg-dark-700 rounded-xl p-4 border border-pink-900/20">
                                  <div className="flex items-start justify-between gap-2 mb-3">
                                    <p className="font-semibold text-white text-sm">{room.name}</p>
                                    <Badge status={room.status} />
                                  </div>
                                  <p className="text-gray-400 text-xs mb-3">{room.description}</p>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    {room.price_1h && <span className="text-gray-400">1h: <span className="text-pink-400 font-semibold">{fmtCurrency(room.price_1h)}</span></span>}
                                    {room.price_2h && <span className="text-gray-400">2h: <span className="text-pink-400 font-semibold">{fmtCurrency(room.price_2h)}</span></span>}
                                    {room.price_4h && <span className="text-gray-400">4h: <span className="text-pink-400 font-semibold">{fmtCurrency(room.price_4h)}</span></span>}
                                    {room.price_8h && <span className="text-gray-400">8h: <span className="text-pink-400 font-semibold">{fmtCurrency(room.price_8h)}</span></span>}
                                    {room.price_daily && <span className="text-gray-400 col-span-2">Diária: <span className="text-pink-400 font-semibold">{fmtCurrency(room.price_daily)}</span></span>}
                                  </div>
                                  {room.amenities?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-3">
                                      {room.amenities.slice(0, 4).map((a) => (
                                        <span key={a} className="px-1.5 py-0.5 bg-dark-800 text-gray-400 rounded text-xs">{a}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo quarto */}
      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Cadastrar Quarto" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome do quarto</label>
              <input className="input" value={roomForm.name} onChange={(e) => setRoomForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Descrição</label>
              <textarea rows={2} className="input resize-none" value={roomForm.description} onChange={(e) => setRoomForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {[['price_1h','1 hora'],['price_2h','2 horas'],['price_4h','4 horas'],['price_8h','8 horas'],['price_daily','Diária']].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label} (R$)</label>
                <input type="number" step="0.01" className="input" value={roomForm[key]} onChange={(e) => setRoomForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <label className="label">Comodidades (separadas por vírgula)</label>
              <input className="input" placeholder="TV, Ar condicionado, Wi-Fi, Frigobar" value={roomForm.amenities_text || ''} onChange={(e) => setRoomForm(f => ({ ...f, amenities_text: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRoomModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={saveRoom} disabled={saving || !roomForm.name} className="btn-primary">
              {saving ? 'Salvando...' : 'Cadastrar Quarto'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
