import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { criteriaApi } from '../services/api';
import LanguageToggle from './LanguageToggle';
import { getQuestionText, groupCriteriaByCategory } from '../utils/evaluationCriteria';

export default function PeerEvaluationModal({
  open,
  onClose,
  evaluation = {},
  onSubmit,
  isSubmitting = false,
  successMessage = '',
  errorMessage = '',
  mode = 'create',
  evaluationRecord = null,
}) {
  const [responses, setResponses] = useState({});
  const [strengths, setStrengths] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(mode === 'edit');
  const [criteria, setCriteria] = useState([]);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (!open) return;
    criteriaApi.get('peer').then((rows) => {
      setCriteria(Array.isArray(rows) ? rows : []);
    }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const nextResponses = (() => {
      if (!evaluationRecord) return {};
      if (typeof evaluationRecord.responses === 'string') {
        try {
          return JSON.parse(evaluationRecord.responses);
        } catch {
          return {};
        }
      }
      return evaluationRecord.responses || {};
    })();

    setResponses(nextResponses);
    setStrengths(evaluationRecord?.strengths || '');
    setSuggestions(evaluationRecord?.suggestions || '');
    setSubmitError('');
    setSubmitSuccess('');
    setIsEditMode(mode === 'edit');
  }, [open, evaluationRecord, mode]);

  useEffect(() => {
    setSubmitError(errorMessage || '');
  }, [errorMessage]);

  useEffect(() => {
    setSubmitSuccess(successMessage || '');
  }, [successMessage]);

  const isReadOnly = mode === 'view' && !isEditMode;
  const criteriaSections = groupCriteriaByCategory(criteria);
  const totalItems = useMemo(() => criteriaSections.reduce((sum, section) => sum + (section.criteria?.length || 0), 0), [criteriaSections]);
  const totalScore = useMemo(() => {
    const values = Object.values(responses)
      .map((value) => (typeof value === 'string' && value.trim().toUpperCase() === 'NA' ? null : Number(value)))
      .filter((value) => Number.isFinite(value) && value > 0);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return values.length ? (sum / values.length) * 20 : 0;
  }, [responses, totalItems]);

  const setAnswer = (id, value) => setResponses((prev) => ({ ...prev, [id]: value }));

  const handleEditClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditMode(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!evaluation || !evaluation.id) {
      setSubmitError('No peer evaluation selected. Please contact your administrator.');
      return;
    }

    // Validate that all criteria have been answered
    const allItemIds = criteriaSections.reduce((acc, section) => acc.concat((section.criteria || []).map(item => String(item.id))), []);
    const unansweredItems = allItemIds.filter(id => !responses[id]);
    
    if (unansweredItems.length > 0) {
      setSubmitError(`Please answer all criteria questions before submitting. ${unansweredItems.length} question(s) remaining.`);
      return;
    }

    try {
      await onSubmit({
        peer_evaluation_id: evaluation.id,
        score: Number(totalScore.toFixed(2)),
        strengths,
        suggestions,
        responses,
      });
      setSubmitSuccess('Peer evaluation submitted successfully.');
    } catch (error) {
      setSubmitError(error?.message || 'Unable to submit peer evaluation.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl max-h-[calc(100vh-80px)] overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Peer Evaluation</h2>
            <p className="text-sm text-gray-500">To be completed by colleagues.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <FaTimes />
          </button>
        </div>

        <div className="relative space-y-4 p-6 overflow-y-auto max-h-[calc(100vh-160px)] pr-6 pb-24">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Scale</p>
                <p className="text-sm text-gray-600">1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High</p>
              </div>
              <LanguageToggle language={language} onChange={setLanguage} />
              {mode === 'view' && !isEditMode && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">View Mode</span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Evaluatee</p>
              <p className="mt-2 font-semibold text-gray-900">{evaluation.instructor_name || 'N/A'}</p>
              <p className="text-sm text-gray-600">Instructor being evaluated</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Course</p>
              <p className="mt-2 font-semibold text-gray-900">{evaluation.course_code || evaluation.course_name || 'N/A'}</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Deadline</p>
              <p className="mt-2 font-semibold text-gray-900">{evaluation.deadline || 'Not specified'}</p>
            </div>
          </div>

          {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{submitSuccess}</div> : null}

          <form id="peer-evaluation-form" onSubmit={handleSubmit} className="space-y-5">
            {criteriaSections.map((section) => (
              <div key={section.category} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <h3 className="font-semibold text-gray-900">{section.category}</h3>
                <div className="mt-4 space-y-3">
                  {(section.criteria || []).map((item) => (
                    <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex-1 pr-4 text-sm font-medium text-gray-700">
                        <span className="mr-3 font-mono text-gray-400">{String(item.id).replace(/[^0-9]/g, '') || item.id}.</span>
                        {getQuestionText(item, language)}
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        {[1, 2, 3, 4, 5].map((value) => {
                          const selected = responses[item.id] === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => !isReadOnly && setAnswer(item.id, value)}
                              disabled={isReadOnly}
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-150 ${
                                selected
                                  ? 'scale-105 bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-300'
                                  : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
                              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Overall score</p>
                  <p className="text-xs text-gray-500">Calculated from selected ratings</p>
                </div>
                <div className="rounded-full bg-ieps-blue-50 px-4 py-2 text-sm font-semibold text-ieps-blue-700">{totalScore.toFixed(1)} / 100</div>
              </div>
            </div>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">Strengths</span>
              <textarea
                rows={3}
                value={strengths}
                onChange={(event) => setStrengths(event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder="Describe strengths and positive contributions."
              />
            </label>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">Suggestions for improvement</span>
              <textarea
                rows={3}
                value={suggestions}
                onChange={(event) => setSuggestions(event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder="Provide constructive suggestions for growth."
              />
            </label>

            <div className="h-16" />
          </form>
        </div>

        <div className="sticky bottom-0 left-0 z-20 border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              {mode === 'view' && !isEditMode ? 'Close' : 'Cancel'}
            </button>

            {mode === 'view' && !isEditMode ? (
              <button type="button" onClick={handleEditClick} className="rounded-full bg-gray-700 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                Edit Evaluation
              </button>
            ) : (
              <button type="submit" form="peer-evaluation-form" disabled={isSubmitting || isReadOnly} className="rounded-full bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ieps-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? 'Submitting...' : mode === 'view' ? 'Update Evaluation' : 'Submit Peer Evaluation'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
