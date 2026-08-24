import { useEffect, useMemo, useState } from 'react';
import { Database, Search } from 'lucide-react';

const PAGE_SIZE = 10;
const programLabel = (value) => (value === 'extension' ? 'Extension' : value ? 'Regular' : '-');

const ViewDataView = ({ instructors = [], students = [], departments = [], onResetPassword }) => {
  const [activeTab, setActiveTab] = useState('instructors');
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [page, setPage] = useState(1);

  const entityConfig = useMemo(() => ({
    instructors: {
      label: 'Instructors',
      rows: instructors,
      searchValues: (row) => [row.username, row.email, row.employeeId, row.employee_id],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.fullName || row.full_name || '-'],
        ['Username / Email', (row) => row.username || row.email || '-'],
        ['Employee ID', (row) => row.employeeId || row.employee_id || '-'],
        ['Department', (row) => row.departmentName || row.department || '-'],
        ['Status', (row) => row.status || 'Active'],
        ['Actions', (row) => onResetPassword ? <button type="button" onClick={() => onResetPassword(row)} className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200">Reset Password</button> : '-'],
      ],
    },
    students: {
      label: 'Students',
      rows: students,
      searchValues: (row) => [row.studentId, row.student_id, row.fullName, row.full_name],
      columns: [
        ['ID', (row) => row.id],
        ['Student ID', (row) => row.studentId || row.student_id || '-'],
        ['Name', (row) => row.fullName || row.full_name || '-'],
        ['Department', (row) => row.departmentName || row.department || '-'],
        ['Program Type', (row) => programLabel(row.programType || row.program_type)],
        ['Year / Section', (row) => `${row.year || row.year_level || '-'} / ${row.section || '-'}`],
        ['Status', (row) => row.status || 'Active'],
        ['Actions', (row) => onResetPassword ? <button type="button" onClick={() => onResetPassword(row)} className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200">Reset Password</button> : '-'],
      ],
    },
    departments: {
      label: 'Departments',
      rows: departments,
      searchValues: (row) => [row.name, row.department_name],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.name || '-'],
        ['Code', (row) => row.code || '-'],
        ['Category', (row) => row.category || 'Custom'],
        ['Registered On', (row) => row.registeredAt || row.created_at || '-'],
        ['Status', (row) => row.status || 'Active'],
      ],
    },
  }), [departments, instructors, onResetPassword, students]);

  const activeEntity = entityConfig[activeTab];
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const yearNumber = (value) => normalize(value).match(/\d+/)?.[0] || '';
    const sectionValue = (value) => normalize(value).replace(/^section\s*/, '');
    return activeEntity.rows.filter((row) => {
      const rowDepartment = String(row.department_id || row.departmentId || '').trim();
      const rowProgram = normalize(row.program_type || row.programType || row.program);
      const rowYear = yearNumber(row.year_level || row.year || row.yearLevel);
      const rowSection = sectionValue(row.section);
      const matchesDepartment = !['students', 'instructors'].includes(activeTab)
        || departmentFilter === 'all'
        || rowDepartment === departmentFilter;
      const matchesProgram = activeTab !== 'students'
        || programFilter === 'all'
        || rowProgram === programFilter;
      const matchesYear = activeTab !== 'students'
        || yearFilter === 'all'
        || rowYear === yearFilter;
      const matchesSection = activeTab !== 'students'
        || sectionFilter === 'all'
        || rowSection === sectionFilter;
      const matchesQuery = !normalizedQuery
        || activeEntity.searchValues(row).some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesDepartment && matchesProgram && matchesYear && matchesSection && matchesQuery;
    });
  }, [activeEntity, activeTab, departmentFilter, programFilter, query, sectionFilter, yearFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstEntry = filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastEntry = Math.min(currentPage * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    setPage(1);
  }, [activeTab, departmentFilter, programFilter, query, sectionFilter, yearFilter]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Database size={22} className="text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">View Data</h2>
            <p className="mt-1 text-slate-600">Browse registered instructors, students, and departments.</p>
          </div>
        </div>
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">Search {activeEntity.label}</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activeTab === 'instructors' ? 'username, email, or employee ID' : activeTab === 'students' ? 'student ID or name' : 'department name'}...`} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
            {Object.entries(entityConfig).map(([id, entity]) => (
          <button key={id} type="button" onClick={() => { setActiveTab(id); setQuery(''); setDepartmentFilter('all'); setProgramFilter('all'); setYearFilter('all'); setSectionFilter('all'); }} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeTab === id ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'}`}>
            {entity.label}
          </button>
        ))}
      </div>

      {['students', 'instructors'].includes(activeTab) && (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Department<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="all">All Departments</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name || department.department_name}</option>)}</select></label>
          {activeTab === 'students' && <>
            <label className="text-sm font-medium text-slate-700">Program Type<select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="all">All Programs</option><option value="regular">Regular</option><option value="extension">Extension</option></select></label>
            <label className="text-sm font-medium text-slate-700">Year Level<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="all">All Years</option>{Array.from({ length: 7 }, (_, index) => <option key={index + 1} value={String(index + 1)}>{index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Year</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Section<select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="all">All Sections</option>{'A B C D E F G H I J K L'.split(' ').map((section) => <option key={section} value={section.toLowerCase()}>Section {section}</option>)}</select></label>
          </>}
        </div>
      )}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-slate-900">{activeEntity.label}</h3>
          <span className="text-sm text-slate-500">{filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50"><tr>{activeEntity.columns.map(([label]) => <th key={label} className="whitespace-nowrap px-5 py-3 font-semibold text-slate-600">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length ? pageRows.map((row, index) => <tr key={row.id ?? index} className="hover:bg-blue-50/40">{activeEntity.columns.map(([label, getValue]) => <td key={label} className="whitespace-nowrap px-5 py-4 text-slate-700">{getValue(row)}</td>)}</tr>) : <tr><td colSpan={activeEntity.columns.length} className="px-5 py-12 text-center text-slate-500">No matching {activeEntity.label.toLowerCase()} found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Showing {firstEntry} to {lastEntry} of {filteredRows.length} entries</p>
          <div className="flex items-center justify-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`min-w-9 rounded-lg px-3 py-2 text-sm font-semibold ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>{pageNumber}</button>)}
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ViewDataView;
