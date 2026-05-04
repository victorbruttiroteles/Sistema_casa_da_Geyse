import clsx from 'clsx';

const map = {
  available:   'badge-available',
  occupied:    'badge-occupied',
  reserved:    'badge-reserved',
  maintenance: 'badge-maintenance',
  vip:         'badge-vip',
  active:      'badge-available',
  inactive:    'badge-maintenance',
  blocked:     'badge-occupied',
  confirmed:   'badge-confirmed',
  completed:   'badge-completed',
  cancelled:   'badge-cancelled',
  pending:     'badge-pending',
  busy:        'badge-occupied',
  paused:      'badge-maintenance',
};

const labels = {
  available:   'Disponível',
  occupied:    'Ocupado',
  reserved:    'Reservado',
  maintenance: 'Manutenção',
  vip:         'VIP',
  active:      'Ativo',
  inactive:    'Inativo',
  blocked:     'Bloqueado',
  confirmed:   'Confirmado',
  completed:   'Concluído',
  cancelled:   'Cancelado',
  pending:     'Pendente',
  busy:        'Ocupado',
  paused:      'Pausado',
};

export default function Badge({ status, className }) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', map[status] || 'badge-maintenance', className)}>
      {labels[status] || status}
    </span>
  );
}
