import { useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { deanApi } from '../services/api';
import EvaluateDeptHeads from './EvaluateDeptHeads';
import DeanPerformanceView from '../components/DeanPerformanceView';

const metricCards = [
  { key: 'departmentsCount', label: 'Departments in College', icon: Building2 },
  { key: 'pendingDeptHeadEvals', label: 'Pending Dept Head Evals', icon: ClipboardCheck },
  { key: 'completedEvals', label: 'Completed Evaluations', icon: CheckCircle2 },
];

const downloadCsv = (filename, rows) => {
  const headers = Object.keys(rows[0] || {});
  const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header] ?? '').replaceAll('"', '""')))]
    .map((row) => row.map((value) => `"${value}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const CollegeAnalyticsView = ({ analytics }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-slate-900">College Analytics</h2>
    <div className="mt-6 space-y-4">
      {analytics.length ? analytics.map((row) => <div key={row.departmentId}><div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{row.department}</span><span className="font-semibold text-blue-700">{row.performance}%</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, row.performance))}%` }} /></div></div>) : <p className="text-sm text-slate-500">No department analytics are available yet.</p>}
    </div>
  </section>
);

const FacultyPerformanceView = ({ faculty, facultyFilter, setFacultyFilter }) => {
  const visibleFaculty = faculty.filter((row) => `${row.name} ${row.department}`.toLowerCase().includes(facultyFilter.toLowerCase()));
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Faculty Performance</h2><p className="mt-1 text-sm text-slate-500">{visibleFaculty.length} of {faculty.length} instructors across your college.</p></div><input aria-label="Filter faculty" value={facultyFilter} placeholder="Filter by name or department" onChange={(event) => setFacultyFilter(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div><div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Instructor</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleFaculty.map((row) => <tr key={row.instructorId}><td className="px-3 py-3 font-medium">{row.name}</td><td className="px-3 py-3">{row.department}</td><td className="px-3 py-3">{row.score}%</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'Good' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.status}</span></td></tr>)}</tbody></table></div></section>;
};

const CollegeReportsView = ({ stats, reportRows, totalEvaluations }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Evaluation Reports</h2><p className="mt-1 text-sm text-slate-500">Export the current college evaluation summary.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><button type="button" onClick={() => downloadCsv('college-evaluation-summary.csv', reportRows)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"><Download className="h-4 w-4" /> Export Excel-compatible CSV</button><button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"><Download className="h-4 w-4" /> Print / Export PDF</button></div><dl className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">Departments</dt><dd className="mt-1 text-2xl font-bold">{stats.departmentsCount || 0}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">Evaluated Heads</dt><dd className="mt-1 text-2xl font-bold">{stats.completedEvals || 0}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">Total Head Evaluations</dt><dd className="mt-1 text-2xl font-bold">{totalEvaluations}</dd></div></dl></section>
);

const CollegeDeanDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [facultyFilter, setFacultyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hashTab = { 'evaluate-heads': 'evaluate' }[location.hash.replace('#', '')] || location.hash.replace('#', '') || 'overview';
    setActiveTab(['overview', 'evaluate', 'analytics', 'faculty', 'reports', 'my-performance'].includes(hashTab) ? hashTab : 'overview');
  }, [location.hash]);

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, departmentAnalytics, facultyPerformance] = await Promise.all([
        deanApi.getOverviewStats(),
        deanApi.getDepartmentAnalytics(),
        deanApi.getFacultyPerformance(),
      ]);
      setStats(overview || {});
      setAnalytics(Array.isArray(departmentAnalytics) ? departmentAnalytics : []);
      setFaculty(Array.isArray(facultyPerformance) ? facultyPerformance : []);
    } catch (loadError) {
      setStats({ departmentsCount: 0, pendingDeptHeadEvals: 0, completedEvals: 0 });
      setAnalytics([]);
      setFaculty([]);
      setError(loadError?.message || 'Unable to load college dean dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadOverview(); }, []);

  const startEvaluations = () => {
    navigate('/dean/dashboard#evaluate-heads');
    setMessage('');
  };

  const reportRows = faculty.map((row) => ({ Instructor: row.name, Department: row.department, Score: row.score, Status: row.status }));
  const totalEvaluations = Number(stats.pendingDeptHeadEvals || 0) + Number(stats.completedEvals || 0);

  return (
    <section className="space-y-6" aria-labelledby="dean-dashboard-title">
      {activeTab === 'overview' ? <header className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50 px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Mekdela Amba University</p>
        <h1 id="dean-dashboard-title" className="mt-3 text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">Welcome, {user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'College Dean'}</h1>
        <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm">College Dean</span><span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">College-level access</span></div>
      </header> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading college data...</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div> : null}

      {!loading && activeTab === 'overview' ? <>
        <div className="grid gap-4 md:grid-cols-3">{metricCards.map(({ key, label, icon: Icon }) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-blue-50 p-2 text-blue-700"><Icon className="h-5 w-5" /></span></div><p className="mt-5 text-3xl font-bold text-slate-950">{stats[key] ?? 0}</p></article>)}</div>
        <button type="button" onClick={startEvaluations} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800">Start Pending Department Head Evaluations <ArrowRight className="h-4 w-4" /></button>
      </> : null}

      {!loading && activeTab === 'evaluate' ? <EvaluateDeptHeads /> : null}
      {!loading && activeTab === 'analytics' ? <CollegeAnalyticsView analytics={analytics} /> : null}
      {!loading && activeTab === 'faculty' ? <FacultyPerformanceView faculty={faculty} facultyFilter={facultyFilter} setFacultyFilter={setFacultyFilter} /> : null}
      {!loading && activeTab === 'reports' ? <CollegeReportsView stats={stats} reportRows={reportRows} totalEvaluations={totalEvaluations} /> : null}
      {!loading && activeTab === 'my-performance' ? <DeanPerformanceView /> : null}
    </section>
  );
};

export default CollegeDeanDashboard;
