import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, KeyRound, LogOut, Settings, UserCircle, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

const dashboardRoutes = {
  systemadmin: '/admin/dashboard',
  admin: '/admin/dashboard',
  depthead: '/dept-head/dashboard',
  dept_head: '/dept-head/dashboard',
  college_dean: '/dean/dashboard',
  dean: '/dean/dashboard',
  academic_directorate: '/directorate/dashboard',
  academic_director: '/directorate/dashboard',
  directorate: '/directorate/dashboard',
  instructor: '/instructor-dashboard',
  student: '/student-dashboard',
};

const roleLabels = {
  systemadmin: 'System Administrator',
  admin: 'System Administrator',
  depthead: 'Department Head',
  dept_head: 'Department Head',
  college_dean: 'College Dean',
  dean: 'College Dean',
  academic_directorate: 'Academic Directorate',
  academic_director: 'Academic Directorate',
  directorate: 'Academic Directorate',
  instructor: 'Instructor',
  student: 'Student',
};

const Header = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  let storedUser = {};
  if (typeof window !== 'undefined') {
    try {
      storedUser = JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      storedUser = {};
    }
  }

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const normalizedRole = String(user?.role || role || storedUser?.role || '').trim().toLowerCase();
  const currentUser = { ...storedUser, ...user };
  const dashboardPath = dashboardRoutes[normalizedRole] || '/login';
  const displayName = currentUser.name || currentUser.full_name || currentUser.fullName || currentUser.username || currentUser.email || 'User';
  const email = currentUser.email || currentUser.username || 'user@university.edu';
  const roleLabel = roleLabels[normalizedRole] || normalizedRole.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'User';

  const handleLogout = async () => {
    setIsOpen(false);
    if (typeof window !== 'undefined') window.localStorage.clear();
    await logout();
  };

  const navigateAndClose = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-[60] h-16 bg-[#1e3a8a] text-white shadow-lg">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-8">
        <Link to={dashboardPath} className="flex min-w-0 items-center gap-3" aria-label="IPES dashboard">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#facc15] text-sm font-extrabold text-[#1e3a8a] shadow-sm">(IPES)</span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold sm:text-base">Instructor Performance Evaluation System</span>
            <span className="block truncate text-[11px] text-blue-100 sm:text-xs">Mekdela Amba University</span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <LanguageSwitcher />
          <NotificationBell />
          <div ref={menuRef} className="relative">
            <button type="button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/10">
              {currentUser.profile_picture ? (
                <img src={currentUser.profile_picture} alt="" className="h-7 w-7 rounded-full border border-white/50 object-cover" />
              ) : (
                <UserCircle className="h-6 w-6" />
              )}
              <span className="hidden max-w-36 truncate text-sm font-semibold sm:block">{email}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
                <div className="border-b border-slate-100 px-4 py-4">
                  <p className="font-semibold">{displayName}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{email}</p>
                  <span className="mt-3 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{roleLabel}</span>
                </div>
                <nav className="p-2" aria-label="Account menu">
                  <button type="button" onClick={() => navigateAndClose(dashboardPath)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><LayoutDashboard className="h-4 w-4" /> My Dashboard</button>
                  <button type="button" onClick={() => navigateAndClose('/profile')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><UserRound className="h-4 w-4" /> View Profile</button>
                  <button type="button" onClick={() => navigateAndClose('/change-password')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><KeyRound className="h-4 w-4" /> Change Password</button>
                  <button type="button" onClick={() => navigateAndClose('/settings')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-900"><Settings className="h-4 w-4" /> Dashboard Settings</button>
                  <button type="button" onClick={handleLogout} className="mt-1 flex w-full items-center gap-3 border-t border-slate-100 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign Out</button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
