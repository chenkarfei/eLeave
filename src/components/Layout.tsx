import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  CalendarPlus, 
  History, 
  CheckSquare, 
  Users, 
  LogOut, 
  Menu,
  X,
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['Employee', 'Approver', 'HR', 'SuperAdmin'] },
    { name: 'Apply Leave', path: '/apply', icon: CalendarPlus, roles: ['Employee', 'Approver', 'HR', 'SuperAdmin'] },
    { name: 'My Leaves', path: '/my-leaves', icon: History, roles: ['Employee', 'Approver', 'HR', 'SuperAdmin'] },
    { name: 'Approvals', path: '/approvals', icon: CheckSquare, roles: ['Approver', 'HR', 'SuperAdmin'] },
    { name: 'Manage Users', path: '/admin/users', icon: Users, roles: ['HR', 'SuperAdmin'] },
    { name: 'Blackout Dates', path: '/admin/blackout-dates', icon: CalendarPlus, roles: ['HR', 'SuperAdmin'] },
  ];

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Globe className="w-6 h-6" />
          eLeave
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:flex items-center gap-2 font-bold text-2xl text-blue-600 border-b">
          <Globe className="w-8 h-8" />
          eLeave
        </div>

        <div className="p-4 border-b bg-blue-50/50">
          <p className="font-semibold text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.role} • {user?.department}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-blue-700" : "text-gray-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
