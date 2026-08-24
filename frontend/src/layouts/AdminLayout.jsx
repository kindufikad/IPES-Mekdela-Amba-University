import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

const AdminLayout = ({ sidebar = null }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    <div className="flex min-h-screen pt-16">
      {sidebar}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  </div>
);

export default AdminLayout;
