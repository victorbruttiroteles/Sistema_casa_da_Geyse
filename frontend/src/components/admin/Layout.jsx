import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, Map, CalendarDays, Users, Heart,
  Building2, BarChart3, Megaphone, Settings, UserCog, LogOut,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/room-map',    label: 'Mapa de Quartos',  icon: Map             },
  { to: '/reservations',label: 'Reservas',         icon: CalendarDays    },
  { to: '/customers',   label: 'Clientes (CRM)',   icon: Users           },
  { to: '/companions',  label: 'Acompanhantes',    icon: Heart           },
  { to: '/houses',      label: 'Casas & Quartos',  icon: Building2       },
  { to: '/reports',     label: 'Relatórios',       icon: BarChart3       },
  { to: '/campaigns',   label: 'Campanhas',        icon: Megaphone       },
  { to: '/settings',    label: 'Configurações',    icon: Settings        },
  { to: '/admin-users', label: 'Usuários Admin',   icon: UserCog, roles: ['super_admin'] },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role)
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-800 border-r border-pink-900/30 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-pink-900/30">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Casa da Geyse" className="w-10 h-10 object-contain rounded-full shrink-0" />
            <div>
              <p className="font-bold text-white text-sm leading-tight">Casa da Geyse</p>
              <p className="text-pink-400 text-xs">Painel Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-pink-600/20 text-pink-400 border border-pink-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-pink-900/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-pink-900 rounded-full flex items-center justify-center text-pink-400 font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-gray-500 text-xs truncate">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm transition-colors w-full">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-dark-900">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
