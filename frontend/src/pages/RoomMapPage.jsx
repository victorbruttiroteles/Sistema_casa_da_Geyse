import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '../services/api';
import Badge from '../components/ui/Badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const statusColors = {
  available:   'border-emerald-500/50 bg-emerald-900/10 hover:bg-emerald-900/20',
  occupied:    'border-red-500/50    bg-red-900/10    hover:bg-red-900/20',
  reserved:    'border-yellow-500/50 bg-yellow-900/10 hover:bg-yellow-900/20',
  maintenance: 'border-gray-600/50   bg-gray-900/10   hover:bg-gray-900/20',
};

function RoomCard({ room, onStatusChange }) {
  const res = room.current_reservation;
  const checkOut = res?.check_out ? new Date(res.check_out) : null;
  const minutesLeft = checkOut ? Math.floor((checkOut - Date.now()) / 60000) : null;

  return (
    <div className={clsx('rounded-xl border p-4 transition-all cursor-default', statusColors[room.status] || statusColors.maintenance)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-semibold text-white text-sm leading-tight">{room.name}</p>
        <Badge status={room.status} />
      </div>

      {res && (
        <div className="text-xs text-gray-400 space-y-1 mb-3">
          <p className="truncate">👤 {res.customer}</p>
          <p>⏰ Saída: {format(new Date(res.check_out), 'HH:mm', { locale: ptBR })}</p>
          {minutesLeft !== null && minutesLeft <= 20 && (
            <p className={clsx('font-semibold', minutesLeft <= 5 ? 'text-red-400' : 'text-yellow-400')}>
              ⚠️ {minutesLeft <= 0 ? 'Expirado!' : `${minutesLeft} min restantes`}
            </p>
          )}
        </div>
      )}

      <select
        value={room.status}
        onChange={(e) => onStatusChange(room.id, e.target.value)}
        className="w-full bg-dark-700 border border-pink-900/40 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-pink-500"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="available">Disponível</option>
        <option value="occupied">Ocupado</option>
        <option value="reserved">Reservado</option>
        <option value="maintenance">Manutenção</option>
      </select>
    </div>
  );
}

export default function RoomMapPage() {
  const queryClient = useQueryClient();

  const { data: houses, isLoading } = useQuery({
    queryKey: ['room-map'],
    queryFn: () => api.get('/reports/room-map').then(r => r.data),
    refetchInterval: 30000,
  });

  async function handleStatusChange(roomId, status) {
    try {
      await api.patch(`/rooms/${roomId}/status`, { status });
      queryClient.invalidateQueries({ queryKey: ['room-map'] });
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-dark-800 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-dark-800 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const allRooms = houses?.flatMap(h => h.rooms || []) || [];
  const counts = {
    available:   allRooms.filter(r => r.status === 'available').length,
    occupied:    allRooms.filter(r => r.status === 'occupied').length,
    reserved:    allRooms.filter(r => r.status === 'reserved').length,
    maintenance: allRooms.filter(r => r.status === 'maintenance').length,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mapa de Quartos</h1>
          <p className="text-gray-500 text-sm mt-1">Atualizado automaticamente a cada 30 segundos</p>
        </div>
        <div className="flex gap-3 text-xs">
          {[
            { label: 'Disponíveis', count: counts.available, cls: 'text-emerald-400' },
            { label: 'Ocupados',    count: counts.occupied,  cls: 'text-red-400'    },
            { label: 'Reservados',  count: counts.reserved,  cls: 'text-yellow-400' },
            { label: 'Manutenção',  count: counts.maintenance, cls: 'text-gray-400' },
          ].map((s) => (
            <div key={s.label} className="card !p-3 text-center min-w-[80px]">
              <p className={`text-xl font-bold ${s.cls}`}>{s.count}</p>
              <p className="text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {houses?.map((house) => (
        <div key={house.house_id} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{house.house_name}</h2>
            <span className="text-gray-500 text-sm">— {house.city_name}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {house.rooms?.map((room) => (
              <RoomCard key={room.id} room={room} onStatusChange={handleStatusChange} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
