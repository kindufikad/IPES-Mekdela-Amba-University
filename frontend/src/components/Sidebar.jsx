import { Award, BarChart3, ClipboardCheck, FileText, LayoutDashboard, Settings, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuConfig = {
  academic_directorate: {
    title: 'DIRECTORATE MENU',
    basePath: '/directorate/dashboard',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'evaluate-deans', label: 'Evaluate College Deans', icon: ClipboardCheck },
      { key: 'analytics', label: 'Institutional Analytics', icon: BarChart3 },
      { key: 'reports', label: 'System Reports', icon: FileText },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
  college_dean: {
    title: 'COLLEGE DEAN MENU',
    basePath: '/dean/dashboard',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'evaluate-heads', label: 'Evaluate Dept Heads', icon: ClipboardCheck },
      { key: 'analytics', label: 'College Analytics', icon: BarChart3 },
      { key: 'faculty', label: 'Faculty Performance', icon: Users },
      { key: 'reports', label: 'Reports', icon: FileText },
      { key: 'my-performance', label: 'My Performance', icon: Award },
    ],
  },
};

const Sidebar = ({ role: roleProp }) => {
  const { role: authRole, user } = useAuth();
  const location = useLocation();
  const role = roleProp || user?.role || authRole;
  const config = menuConfig[role];
  if (!config) return null;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-7 lg:block" aria-label={`${config.title} navigation`}>
      <div className="mb-5 px-3 text-[11px] font-bold tracking-[0.22em] text-slate-400">{config.title}</div>
      <nav className="space-y-1.5">
        {config.items.map(({ key, label, icon: Icon }) => {
          const target = `${config.basePath}#${key}`;
          const active = (location.hash.replace('#', '') || 'overview') === key && location.pathname === config.basePath;
          return (
            <NavLink
              key={key}
              to={target}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;