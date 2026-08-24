import { useEffect, useState } from 'react';
import { FaPrint } from 'react-icons/fa';
import { evaluationApi } from '../services/api';

const formatScore = (value) => `${Number(value || 0).toFixed(1)}%`;

const getStatus = (score) => {
  if (score >= 85) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-700' };
  if (score >= 70) return { label: 'Good', className: 'bg-blue-100 text-blue-700' };
  if (score >= 50) return { label: 'Needs Improvement', className: 'bg-amber-100 text-amber-700' };
  return { label: 'At Risk', className: 'bg-red-100 text-red-700' };
};

const CommentList = ({ items = [], emptyText }) => (
  items.length ? (
    <ul className="space-y-3 text-sm text-gray-700">
      {items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3"><span className="mt-1 text-current">•</span><span>{item}</span></li>)}
    </ul>
  ) : <p className="text-sm text-gray-500">{emptyText}</p>
);

const PerformanceDashboard = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadReport = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await evaluationApi.getPerformanceDashboard();
        if (mounted) setReport(data);
      } catch (loadError) {
        if (mounted) setError(loadError?.message || 'Unable to load performance dashboard.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadReport();
    return () => { mounted = false; };
  }, []);

  if (loading) return <section className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Loading performance dashboard...</section>;
  if (error) return <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{error}</section>;
  if (report?.published === false) return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm"><h2 className="text-xl font-bold text-amber-900">Results Pending Department Head Publish</h2><p className="mt-2 text-sm text-amber-800">Your weighted performance results will appear here after the department head publishes them.</p></section>;

  const totalWeightedScore = Number(report?.totalWeightedScore || 0);
  const status = getStatus(totalWeightedScore);
  const statusLabel = report?.status || status.label;
  const badgeColor = report?.badgeColor || (totalWeightedScore >= 70 ? 'blue' : totalWeightedScore >= 50 ? 'amber' : 'red');
  const badgeClassName = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }[badgeColor] || 'bg-gray-100 text-gray-700';
  const feedback = report?.feedback || {};
  const breakdown = report?.breakdown || {};
  const breakdownItems = [
    { key: 'student', label: 'Student', color: 'blue' },
    { key: 'deptHead', label: 'Dept Head', color: 'indigo' },
    { key: 'peer', label: 'Peer', color: 'emerald' },
  ];

  return (
    <section id="performance-dashboard" className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between print:shadow-none">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Your overall evaluation score and qualitative feedback.</p>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ieps-blue-700 print:hidden">
          <FaPrint /> Print / Export PDF
        </button>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm print:shadow-none">
        <div className="flex flex-col gap-5 border-b border-gray-100 pb-6 md:flex-row md:items-center md:justify-between">
          <div><p className="text-sm font-medium text-gray-500">Total Weighted Evaluation Score</p><p className="mt-1 text-4xl font-bold text-ieps-blue-700">{formatScore(totalWeightedScore)}</p><p className="mt-1 text-xs text-gray-500">100% total weight</p></div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${badgeClassName}`}>{formatScore(totalWeightedScore)} - {statusLabel}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {breakdownItems.map((item) => {
          const score = breakdown[item.key] || {};
          return <section key={item.key} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">{item.label}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{score.weight || 0}% weight</span></div><p className="mt-4 text-3xl font-bold text-ieps-blue-700">{formatScore(score.rawPercentage)}</p><p className="mt-1 text-sm text-gray-500">Raw percentage</p><div className="mt-4 border-t border-gray-100 pt-3"><p className="text-sm text-gray-500">Weighted contribution</p><p className="text-xl font-bold text-gray-900">{formatScore(score.weightedContribution)}</p></div></section>;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-emerald-800">Strengths &amp; Positive Highlights</h3><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Strengths</span></div>
          <CommentList items={feedback.strengths} emptyText="No strengths have been recorded yet." />
        </section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-bold text-amber-800">Areas for Improvement (Weaknesses)</h3><span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Focus Areas</span></div>
          <CommentList items={feedback.improvements} emptyText="No improvement areas have been recorded yet." />
        </section>
      </div>
    </section>
  );
};

export default PerformanceDashboard;