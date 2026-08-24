import { useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import { authApi, studentApi } from '../services/api';
import DepartmentCombobox from './DepartmentCombobox';

const controlClass = 'h-11 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100';
const initialStudent = { first_name: '', last_name: '', student_id: '', department_id: '', semester: 'i', year_level: '1st Year (Freshman)', section: 'A', program_type: 'regular' };
const initialInstructor = { first_name: '', last_name: '', email: '', employee_id: '', department_id: '', program_type: 'regular' };

const RegisterUser = ({ departments = [], onRegistered }) => {
  const [role, setRole] = useState('student');
  const [student, setStudent] = useState(initialStudent);
  const [instructor, setInstructor] = useState(initialInstructor);
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
    setMessage('');
  };

  const submitManual = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    try {
      if (role === 'student') {
        await authApi.registerStudent(student);
      } else {
        await authApi.registerInstructor({ ...instructor, department: instructor.department_id });
      }
      setMessage(`${role === 'student' ? 'Student' : 'Instructor'} registered successfully.`);
      onRegistered?.();
    } catch (error) {
      setMessage(error.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitBulk = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage('Choose a CSV or XLSX file first.');
      return;
    }
    setIsUploading(true);
    setMessage('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('registration_type', role);
      const result = role === 'student' ? await studentApi.bulkUpload(payload) : await authApi.bulkRegister(payload);
      setMessage(`Upload complete. Processed ${result?.created || result?.createdCount || 0} row(s).`);
      setFile(null);
      event.currentTarget.reset();
      onRegistered?.();
    } catch (error) {
      setMessage(error.message || 'Bulk upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="space-y-6" aria-label="User registration">
      <div className="grid grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-2 sm:grid-cols-2">
        {[
          ['student', 'Student Registration'],
          ['instructor', 'Instructor Registration'],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={`h-12 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${role === value ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submitBulk} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
            Bulk Upload ({role === 'student' ? 'students' : 'instructors'})
            <input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:h-8 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:font-semibold file:text-white focus:ring-2 focus:ring-blue-500" />
          </label>
          <button type="submit" disabled={isUploading || !file} aria-busy={isUploading} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400">
            {isUploading ? <RefreshCw size={17} className="animate-spin" aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}
            {isUploading ? 'Uploading...' : 'Upload file'}
          </button>
        </div>
      </form>

      <form onSubmit={submitManual} className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        <h2 className="md:col-span-3 text-lg font-semibold text-slate-900">{role === 'student' ? 'Manual Student Registration' : 'Manual Instructor Registration'}</h2>
        <label className="text-sm font-medium text-slate-700">First Name<input required name="first_name" value={role === 'student' ? student.first_name : instructor.first_name} onChange={role === 'student' ? updateForm(setStudent) : updateForm(setInstructor)} className={`${controlClass} mt-2`} /></label>
        <label className="text-sm font-medium text-slate-700">Last Name<input required name="last_name" value={role === 'student' ? student.last_name : instructor.last_name} onChange={role === 'student' ? updateForm(setStudent) : updateForm(setInstructor)} className={`${controlClass} mt-2`} /></label>
        {role === 'student' ? (
          <label className="text-sm font-medium text-slate-700">Student ID<input required name="student_id" autoComplete="username" value={student.student_id} onChange={updateForm(setStudent)} className={`${controlClass} mt-2`} /></label>
        ) : (
          <label className="text-sm font-medium text-slate-700">Email<input required type="email" name="email" autoComplete="username" value={instructor.email} onChange={updateForm(setInstructor)} className={`${controlClass} mt-2`} /></label>
        )}
        {role === 'instructor' && <label className="text-sm font-medium text-slate-700">Employee ID<input required name="employee_id" value={instructor.employee_id} onChange={updateForm(setInstructor)} className={`${controlClass} mt-2`} /></label>}
        <label className="text-sm font-medium text-slate-700">Department<DepartmentCombobox required departments={departments} value={role === 'student' ? student.department_id : instructor.department_id} onChange={role === 'student' ? updateForm(setStudent) : updateForm(setInstructor)} /></label>
        {role === 'student' ? <>
          <label className="text-sm font-medium text-slate-700">Semester<select name="semester" value={student.semester} onChange={updateForm(setStudent)} className={`${controlClass} mt-2`}><option value="i">I</option><option value="ii">II</option></select></label>
          <label className="text-sm font-medium text-slate-700">Year<select name="year_level" value={student.year_level} onChange={updateForm(setStudent)} className={`${controlClass} mt-2`}><option>1st Year (Freshman)</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option></select></label>
          <label className="text-sm font-medium text-slate-700">Section<select name="section" value={student.section} onChange={updateForm(setStudent)} className={`${controlClass} mt-2`}><option>A</option><option>B</option><option>C</option></select></label>
        </> : <label className="text-sm font-medium text-slate-700">Program type<select name="program_type" value={instructor.program_type} onChange={updateForm(setInstructor)} className={`${controlClass} mt-2`}><option value="regular">Regular</option><option value="extension">Extension</option></select></label>}
        <button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-400 md:col-span-3">{isSubmitting ? 'Registering...' : `Register ${role}`}</button>
      </form>
      {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</p>}
    </section>
  );
};

export default RegisterUser;
