import { ArrowRight, Building2, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const metricCards = [
  { key: 'departmentsInCollege', label: 'Departments in College', icon: Building2 },
  { key: 'pendingDeptHeadEvaluations', label: 'Pending Dept Head Evals', icon: ClipboardCheck },
  { key: 'completedEvaluations', label: 'Completed Evaluations', icon: CheckCircle2 },
];

const DeanDashboard = ({ stats = {}, onStartEvaluations }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email || user?.username || 'dean@university.edu';

  const startEvaluations = () => {
    if (onStartEvaluations) return onStartEvaluations();
    navigate('/dean/dashboard#evaluate-heads');
  };

  return (
    <section className="space-y-6" aria-labelledby="dean-dashboard-title">
      <header className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50 px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Mekdela Amba University</p>
        <h1 id="dean-dashboard-title" className="mt-3 text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Welcome, {email}</h1>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm">College Dean</span>
          <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">College-level access</span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {metricCards.map(({ key, label, icon: Icon }) => (
          <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></span>
            </div>
            <p className="mt-5 text-3xl font-bold text-slate-950">{stats[key] ?? 0}</p>
          </article>
        ))}
      </div>

      <button type="button" onClick={startEvaluations} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        Start Pending Department Head Evaluations <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
};

export default DeanDashboard;
