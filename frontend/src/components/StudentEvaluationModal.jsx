import React, { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import LanguageToggle from './LanguageToggle';

export default function StudentEvaluationModal({
  open,
  onClose,
  course = {},
  dispatchItem = null,
  sections = [],
  onSubmit,
  isSubmitting = false,
  successMessage = '',
  errorMessage = '',
  mode = 'create',
  evaluationRecord = null,
}) {
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(mode === 'edit');
  const [language, setLanguage] = useState('en');

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
    setFeedback(evaluationRecord?.feedback || evaluationRecord?.comment || '');
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
  const totalItems = useMemo(() => sections.reduce((sum, section) => sum + (section.items?.length || 0), 0), [sections]);
  const totalScore = useMemo(() => {
    const sum = Object.values(responses).reduce((acc, value) => acc + Number(value || 0), 0);
    return totalItems ? (sum / totalItems) * 20 : 0;
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

    if (!dispatchItem || !dispatchItem.id) {
      setSubmitError('No pending evaluation dispatch found for this course. Please contact your administrator.');
      return;
    }

    // Validate that all criteria have been answered
    const allItemIds = sections.reduce((acc, section) => acc.concat((section.items || []).map(item => item.id)), []);
    const unansweredItems = allItemIds.filter(id => !responses[id]);
    
    if (unansweredItems.length > 0) {
      setSubmitError(`Please answer all criteria questions before submitting. ${unansweredItems.length} question(s) remaining.`);
      return;
    }

    try {
      if (typeof onSubmit === 'function') {
        await onSubmit({
          dispatch_id: dispatchItem.id,
          score: Number(totalScore.toFixed(2)),
          feedback,
          responses,
        });
        setSubmitSuccess('Evaluation submitted successfully.');
      } else {
        setSubmitError('Submit handler is not available.');
      }
    } catch (error) {
      console.error('Student evaluation submission error:', error);
      setSubmitError(error?.message || 'Unable to submit evaluation.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Student Evaluation</h2>
            <p className="text-sm text-gray-500">Evaluate the instructor and course using the checklist below.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">
            <FaTimes />
          </button>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>

        <div className="space-y-4 p-6 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Scale</p>
                <p className="text-sm text-gray-600">1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High</p>
              </div>
              {mode === 'view' && !isEditMode && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">View Mode</span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Course</p>
              <p className="mt-2 font-semibold text-gray-900">{course.course_code || course.code || 'N/A'}</p>
              <p className="text-sm text-gray-600">{course.course_name || course.name || 'Unknown Course'}</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Instructor</p>
              <p className="mt-2 font-semibold text-gray-900">{course.instructor_name || course.instructor || 'N/A'}</p>
              <p className="text-sm text-gray-600">Deadline: {course.deadline || 'Not specified'}</p>
            </div>
          </div>

          {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{submitSuccess}</div> : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {sections.map((section) => (
              <div key={section.title} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <h3 className="font-semibold text-gray-900">{section.title}</h3>
                <div className="mt-4 space-y-3">
                  {(section.items || []).map((item) => (
                    <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex-1 pr-4 text-sm font-medium text-gray-700">
                        <span className="mr-3 font-mono text-gray-400">{item.id.replace(/[^0-9]/g, '') || item.id}.</span>
                        {language === 'am' ? (item.am || item.labelAm || item.textAm || item.en || item.label || item.text) : (item.en || item.label || item.text)}
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
              <span className="mb-2 block font-medium">Additional feedback</span>
              <textarea
                rows={4}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder="Add any additional feedback here."
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {mode === 'view' && !isEditMode ? 'Close' : 'Cancel'}
              </button>

              {mode === 'view' && !isEditMode ? (
                <button type="button" onClick={handleEditClick} className="rounded-full bg-gray-700 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                  Edit Evaluation
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting || isReadOnly} className="rounded-full bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ieps-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSubmitting ? 'Submitting...' : mode === 'view' ? 'Update Evaluation' : 'Submit Evaluation'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
