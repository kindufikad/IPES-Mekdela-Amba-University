import { useEffect, useState } from 'react';
import { deanApi } from '../services/api';

const formatScore = (value) => `${Number(value || 0).toFixed(1)}%`;

const DeanPerformanceView = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    deanApi.getMyPerformance()
      .then((data) => { if (mounted) setReport(data || {}); })
      .catch((loadError) => { if (mounted) setError(loadError?.message || 'Unable to load your performance.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading your performance...</section>;
  if (error) return <section className="rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">{error}</section>;

  const feedback = report?.feedback || {};
  const breakdown = report?.breakdown || {};
  const breakdownItems = [
    { key: 'student', label: 'Student Evaluation', weight: '50%' },
    { key: 'directorate', label: 'Directorate Evaluation', weight: '30%' },
    { key: 'peer', label: 'Peer Evaluation', weight: '20%' },
  ];
  const renderList = (items, emptyText) => <ul className="space-y-3 text-sm"><>{items?.length ? items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span>•</span><span>{item}</span></li>) : <li>{emptyText}</li>}</></ul>;

  return (
    <section className="space-y-6" aria-labelledby="dean-performance-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-medium text-slate-500">Total Weighted Evaluation Score</p><p id="dean-performance-title" className="mt-1 text-5xl font-bold text-ieps-blue-700">{formatScore(report?.totalWeightedScore)}</p><p className="mt-1 text-xs text-slate-500">100% total weight</p></div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{report?.status || 'At Risk'}</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {breakdownItems.map((item) => {
          const score = breakdown[item.key] || {};
          return <section key={item.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">{item.label}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.weight} weight</span></div><p className="mt-4 text-3xl font-bold text-ieps-blue-700">{formatScore(score.rawPercentage)}</p><p className="mt-1 text-sm text-slate-500">Raw percentage</p><div className="mt-4 border-t border-slate-100 pt-3"><p className="text-sm text-slate-500">Weighted contribution</p><p className="text-xl font-bold text-slate-900">{formatScore(score.weightedContribution)}</p></div></section>;
        })}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-emerald-950"><h3 className="mb-4 text-lg font-bold text-emerald-800">Strengths &amp; Positive Highlights</h3>{renderList(feedback.strengths, 'No strengths have been recorded yet.')}</section>
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-amber-950"><h3 className="mb-4 text-lg font-bold text-amber-800">Areas for Improvement</h3>{renderList(feedback.improvements, 'No improvement areas have been recorded yet.')}</section>
      </div>
    </section>
  );
};

export default DeanPerformanceView;
