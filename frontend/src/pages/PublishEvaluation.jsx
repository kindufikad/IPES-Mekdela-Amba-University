import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { evaluationApi, registrationApi } from '../services/api';

const PublishEvaluation = ({ departmentId }) => {
  const [target, setTarget] = useState('student');
  const [assignments, setAssignments] = useState([]);
  const [filters, setFilters] = useState({ program_type: '', year_level: '', semester: '', section: '' });
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [alreadyPublished, setAlreadyPublished] = useState({ student: false, instructor: false });

  const unpublish = async () => {
    if (!window.confirm(target === 'student' ? 'Withdraw this student evaluation batch?' : 'Withdraw peer evaluations for this department?')) return;
    setPublishing(true);
    try {
      const payload = target === 'student'
        ? { department_id: departmentId, ...filters, academic_year: new Date().getFullYear() }
        : { academic_year: new Date().getFullYear(), semester: 'Semester I' };
      const result = target === 'student'
        ? await evaluationApi.unpublishStudent(payload)
        : await evaluationApi.unpublishDepartmentPeerEvaluations(payload);
      if (target === 'instructor') {
        await evaluationApi.togglePeerPublish({ department_id: departmentId, publish_status: 0 });
      }
      setAlreadyPublished((current) => ({ ...current, [target]: false }));
      toast.success(result?.message || 'Evaluation unpublished successfully.');
      const rows = await evaluationApi.getPublishAssignments({ department: departmentId });
      setAssignments(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(error.message || 'Unable to unpublish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      setLoading(true);
      try {
        const rows = await evaluationApi.getPublishAssignments({ department: departmentId });
        if (!cancelled) setAssignments(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Unable to load course assignments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (departmentId) void loadAssignments();
    return () => { cancelled = true; };
  }, [departmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadPublishStatuses = async () => {
      try {
        const status = await evaluationApi.getPublishStatuses(departmentId);
        if (!cancelled) setAlreadyPublished({
          student: Boolean(status?.is_student_published),
          instructor: Boolean(status?.is_peer_published),
        });
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Unable to load publish statuses.');
      }
    };
    if (departmentId) void loadPublishStatuses();
    return () => { cancelled = true; };
  }, [departmentId]);

  useEffect(() => {
    let cancelled = false;
    const loadDepartmentStaff = async () => {
      try {
        const rows = await registrationApi.getUsers();
        const staff = (Array.isArray(rows) ? rows : [])
          .filter((user) => ['instructor', 'dept_head', 'college_dean', 'academic_directorate'].includes(String(user.role).toLowerCase()))
          .filter((user) => String(user.status || 'active').toLowerCase() === 'active')
          .map((user) => ({
            ...user,
            displayName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || 'Unnamed Staff',
          }));
        if (!cancelled) setDepartmentStaff(staff);
      } catch (error) {
        if (!cancelled) {
          setDepartmentStaff([]);
          toast.error(error.message || 'Unable to load department instructors.');
        }
      }
    };
    if (departmentId) void loadDepartmentStaff();
    return () => { cancelled = true; };
  }, [departmentId]);

  const updateFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const matchingAssignments = assignments.filter((assignment) => Object.entries(filters).every(([field, value]) => !value || String(assignment[field] || '').toLowerCase() === value.toLowerCase()));
  const targetAlreadyPublished = alreadyPublished[target] || (target === 'student' && matchingAssignments.some((assignment) => assignment.is_student_published));
  const options = (field) => [...new Set(assignments.map((assignment) => assignment[field]).filter(Boolean))];

  const publish = async () => {
    if (targetAlreadyPublished) {
      toast.error(target === 'student' ? 'Evaluation form has already been published for this section/batch.' : 'Peer evaluations have already been published for this department.');
      return;
    }
    setPublishing(true);
    try {
      const payload = { department_id: departmentId, ...filters, academic_year: new Date().getFullYear() };
      if (target === 'instructor') {
        await evaluationApi.togglePeerPublish({ department_id: departmentId, publish_status: 1 });
      }
      const result = target === 'student'
        ? await evaluationApi.publishStudent(payload)
        : await evaluationApi.publishDepartmentPeerEvaluations({
          department_id: departmentId,
          academic_year: new Date().getFullYear(),
          semester: 'Semester I',
        });
      if (result?.isAlreadyPublished) {
        setAlreadyPublished((current) => ({ ...current, [target]: true }));
        toast.error(result.message || 'Evaluation has already been published.');
        return;
      }
      setAlreadyPublished((current) => ({ ...current, [target]: true }));
      toast.success(result?.message || `Evaluation published to ${target}s.`);
      const rows = await evaluationApi.getPublishAssignments({ department: departmentId });
      setAssignments(Array.isArray(rows) ? rows : []);
    } catch (error) {
      if (error.response?.data?.isAlreadyPublished || error.message?.toLowerCase().includes('already published')) {
        setAlreadyPublished((current) => ({ ...current, [target]: true }));
      }
      toast.error(error.message || 'Unable to publish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  const selectClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm';
  const labels = { program_type: 'Program Type', year_level: 'Year Level', semester: 'Semester', section: 'Section' };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-2xl font-semibold text-slate-900">Publish Evaluation Form</h2><p className="mt-1 text-sm text-slate-500">Activate evaluation forms separately from course assignment.</p></div>
          <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
            {['student', 'instructor'].map((value) => <button key={value} type="button" onClick={() => setTarget(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${target === value ? 'bg-white text-ieps-blue-600 shadow-sm' : 'text-slate-600'}`}>{value === 'student' ? 'Student' : 'Instructor'}</button>)}
          </div>
        </div>

        {target === 'student' ? (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {Object.entries(labels).map(([field, label]) => <label key={field} className="text-sm text-slate-600"><span className="mb-1 block font-medium">{label}</span><select value={filters[field]} onChange={updateFilter(field)} className={selectClass}><option value="">All</option>{options(field).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">#</th><th className="px-4 py-3 font-semibold">Instructor Name</th><th className="px-4 py-3 font-semibold">Role</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {departmentStaff.map((staff, index) => <tr key={staff.id} className="hover:bg-gray-50"><td className="px-4 py-3">{index + 1}</td><td className="px-4 py-3 font-medium text-gray-800">{staff.displayName}</td><td className="px-4 py-3 capitalize">{String(staff.role).replaceAll('_', ' ')}</td></tr>)}
                {!departmentStaff.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No active academic staff found for this department.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><p className="text-sm text-slate-500">{target === 'student' ? (loading ? 'Loading assignments...' : `${matchingAssignments.length} assigned course${matchingAssignments.length === 1 ? '' : 's'} match the selected filters.`) : `${departmentStaff.length} active academic staff in this department.`}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={publishing || loading || (target === 'instructor' && departmentStaff.length < 2) || targetAlreadyPublished} onClick={publish} className="rounded-xl bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{targetAlreadyPublished ? '✓ Already Published' : publishing ? 'Publishing...' : `Publish Evaluation to ${target === 'student' ? 'Students' : 'Instructors'}`}</button>{(target === 'instructor' || targetAlreadyPublished) && <button type="button" disabled={publishing} onClick={unpublish} className="rounded-xl border border-amber-300 px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">{publishing ? 'Withdrawing...' : target === 'student' ? 'Unpublish' : 'Unpublish Peer Evaluation'}</button>}</div></div>
      </div>

      {target === 'student' && <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Course</th><th className="px-4 py-3 font-semibold">Instructor</th><th className="px-4 py-3 font-semibold">Program</th><th className="px-4 py-3 font-semibold">Year / Section</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{matchingAssignments.map((assignment) => <tr key={assignment.id}><td className="px-4 py-3">{assignment.course_code} · {assignment.course_name}</td><td className="px-4 py-3">{assignment.instructor_name || '-'}</td><td className="px-4 py-3">{assignment.program_type || '-'}</td><td className="px-4 py-3">{assignment.year_level || '-'} / {assignment.section || '-'}</td><td className="px-4 py-3">{assignment.is_student_published ? 'Published' : 'Not published'}</td></tr>)}{!matchingAssignments.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No assigned courses match the selected filters.</td></tr>}</tbody></table></div>}
    </section>
  );
};

export default PublishEvaluation;
