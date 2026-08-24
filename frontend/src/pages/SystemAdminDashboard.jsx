import { useState, useContext, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  RefreshCw,
  Activity,
  Megaphone,
  Database,
  Search,
  History,
  UserPlus,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { LanguageContext } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { adminApi, authApi, criteriaApi, departmentApi, registrationApi, studentApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import EvaluationCalendar from '../components/EvaluationCalendar';
import ViewDataView from '../components/ViewDataView';
import ManageRoles from '../components/ManageRoles';
import DepartmentRegistration from '../components/DepartmentRegistration';
import DepartmentCombobox from '../components/DepartmentCombobox';

const initialCollegeData = [
  {
    id: 'college-1',
    en: 'College of Science',
    am: 'የሳይንስ ኮሌጅ',
    departments: [
      { id: 'dept-1-1', en: 'Computer Science', am: 'ኮምፒውተር ሳይንስ' },
      { id: 'dept-1-2', en: 'Mathematics', am: 'ሂሳብ' },
      { id: 'dept-1-3', en: 'Physics', am: 'ፊዚክስ' },
    ],
  },
  {
    id: 'college-2',
    en: 'College of Business',
    am: 'የንግድ ኮሌጅ',
    departments: [
      { id: 'dept-2-1', en: 'Accounting', am: 'አካውንቲንግ' },
      { id: 'dept-2-2', en: 'Marketing', am: 'ማርኬቲንግ' },
      { id: 'dept-2-3', en: 'Finance', am: 'ፋይናንስ' },
    ],
  },
];

const departmentHeadDepartmentOptions = [
  { id: 'dept-eng-civil', name: 'Department of Civil Engineering', category: 'Engineering' },
  { id: 'dept-eng-electrical', name: 'Department of Electrical Engineering', category: 'Engineering' },
  { id: 'dept-eng-mechanical', name: 'Department of Mechanical Engineering', category: 'Engineering' },
  { id: 'dept-eng-chemical', name: 'Department of Chemical Engineering', category: 'Engineering' },
  { id: 'dept-eng-software', name: 'Department of Software Engineering', category: 'Engineering' },
  { id: 'dept-eng-computer', name: 'Department of Computer Engineering', category: 'Engineering' },
  { id: 'dept-tech-ict', name: 'Department of Information and Communication Technology', category: 'Technology' },
  { id: 'dept-tech-electronics', name: 'Department of Electronics and Communication Technology', category: 'Technology' },
  { id: 'dept-tech-robotics', name: 'Department of Robotics and Automation', category: 'Technology' },
  { id: 'dept-tech-architecture', name: 'Department of Architecture and Urban Planning', category: 'Technology' },
  { id: 'dept-tech-industrial', name: 'Department of Industrial Technology', category: 'Technology' },
  { id: 'dept-tech-networking', name: 'Department of Computer Networking', category: 'Technology' },
  { id: 'dept-health-medicine', name: 'Department of Medicine', category: 'Health Sciences' },
  { id: 'dept-health-nursing', name: 'Department of Nursing', category: 'Health Sciences' },
  { id: 'dept-health-pharmacy', name: 'Department of Pharmacy', category: 'Health Sciences' },
  { id: 'dept-health-public', name: 'Department of Public Health', category: 'Health Sciences' },
  { id: 'dept-health-radiology', name: 'Department of Radiology', category: 'Health Sciences' },
  { id: 'dept-health-lab', name: 'Department of Medical Laboratory Science', category: 'Health Sciences' },
  { id: 'dept-biz-accounting', name: 'Department of Accounting', category: 'Business' },
  { id: 'dept-biz-finance', name: 'Department of Finance', category: 'Business' },
  { id: 'dept-biz-marketing', name: 'Department of Marketing', category: 'Business' },
  { id: 'dept-biz-management', name: 'Department of Business Management', category: 'Business' },
  { id: 'dept-biz-economics', name: 'Department of Economics', category: 'Business' },
  { id: 'dept-biz-logistics', name: 'Department of Logistics and Supply Chain', category: 'Business' },
  { id: 'dept-humanities-history', name: 'Department of History', category: 'Humanities' },
  { id: 'dept-humanities-linguistics', name: 'Department of Linguistics', category: 'Humanities' },
  { id: 'dept-humanities-literature', name: 'Department of Literature', category: 'Humanities' },
  { id: 'dept-humanities-philosophy', name: 'Department of Philosophy', category: 'Humanities' },
  { id: 'dept-humanities-sociology', name: 'Department of Sociology', category: 'Humanities' },
  { id: 'dept-humanities-psychology', name: 'Department of Psychology', category: 'Humanities' },
  { id: 'dept-humanities-education', name: 'Department of Education', category: 'Humanities' },
  { id: 'dept-humanities-communication', name: 'Department of Communication and Media', category: 'Humanities' },
];

const fallbackDepartments = [
  { id: 'dept-medicine', name: 'Department of Medicine', code: 'dept-medicine', registeredAt: new Date().toLocaleString() },
  { id: 'dept-nursing', name: 'Department of Nursing', code: 'dept-nursing', registeredAt: new Date().toLocaleString() },
  { id: 'dept-education', name: 'Department of Education', code: 'dept-education', registeredAt: new Date().toLocaleString() },
  { id: 'dept-information-technology', name: 'Department of Information Technology', code: 'dept-information-technology', registeredAt: new Date().toLocaleString() },
];

const initialDeptHeads = [
  {
    id: 1,
    role: 'dept_head',
    fullName: 'Dr. Meskerem Alem',
    username: 'meskerem.alem',
    college: 'college-1',
    department: 'dept-1-1',
    year: '2',
    semester: 'i',
    program: 'regular',
    academicYear: '2025',
    academicDate: '2025-05-15',
    status: 'Active',
    accessScore: 92,
  },
  {
    id: 2,
    role: 'dept_head',
    fullName: 'Prof. Dawit Bekele',
    username: 'dawit.bekele',
    college: 'college-2',
    department: 'dept-2-3',
    year: '3',
    semester: 'ii',
    program: 'extension',
    academicYear: '2024',
    academicDate: '2024-11-20',
    status: 'Active',
    accessScore: 88,
  },
];

const initialInstructors = [
  {
    id: 101,
    role: 'instructor',
    fullName: 'Mr. Samuel Tesfaye',
    username: 'samuel.tesfaye',
    employeeId: 'EMP-1001',
    department: 'dept-eng-software',
    programType: 'regular',
    academicDate: '2025-06-01',
    status: 'Active',
  },
];

const initialStudents = [
  {
    id: 201,
    role: 'student',
    fullName: 'Bethel Bekele',
    username: 'bethel.bekele',
    studentId: 'STU-1001',
    department: 'dept-eng-software',
    programType: 'regular',
    semester: 'i',
    year: '2nd Year',
    section: 'A',
    academicDate: '2025-06-02',
    status: 'Active',
  },
];

const initialBroadcastHistory = [
  { id: 1, audience: 'All', message: 'Evaluation windows are now open.', sentAt: '2025-06-01 08:24' },
  { id: 2, audience: 'Dept Heads', message: 'Please verify your department roster by Friday.', sentAt: '2025-06-03 10:10' },
];

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const SystemAdminDashboard = () => {
  const { language, strings } = useContext(LanguageContext);
  const { role, isAuthenticated, registerUser } = useAuth();
  const navigate = useNavigate();
  const sys = strings.systemAdminDashboard;
  const common = strings.common;

  const t = (key, fallbackEn, fallbackAm) => {
    const value = strings.systemAdminDashboard?.[key];
    if (value) return value;
    return language === 'en' ? fallbackEn : fallbackAm;
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [broadcastAudience, setBroadcastAudience] = useState('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastHistory, setBroadcastHistory] = useState(initialBroadcastHistory);
  const [isComposing, setIsComposing] = useState(true);
  const [dbHealthMetrics, setDbHealthMetrics] = useState({
    status: '--',
    replicationLag: '--',
    connections: '--',
    cacheHitRate: '--',
    diskUsage: '--',
    lastBackup: '--',
    securityScore: '--',
  });
  const [backupRetentionDays, setBackupRetentionDays] = useState(7);
  const [deptHeads, setDeptHeads] = useState(initialDeptHeads);
  const [instructors, setInstructors] = useState(initialInstructors);
  const [students, setStudents] = useState(initialStudents);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const fileInputRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [selectedHead, setSelectedHead] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showForceResetModal, setShowForceResetModal] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [deptHeadTransferMode, setDeptHeadTransferMode] = useState(false);
  const [headEditTransferMode, setHeadEditTransferMode] = useState(false);
  const [departmentCourseTab, setDepartmentCourseTab] = useState('college');
  const [collegeNameInput, setCollegeNameInput] = useState('');
  const [collegeCodeInput, setCollegeCodeInput] = useState('');
  const [registeredDepartments, setRegisteredDepartments] = useState([]);
  const [isDepartmentsLoading, setIsDepartmentsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(true);
  const [criteriaType, setCriteriaType] = useState('student');
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [criteriaForm, setCriteriaForm] = useState({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 });
  const [editingCriterionId, setEditingCriterionId] = useState(null);
  const [showCriterionForm, setShowCriterionForm] = useState(false);

  const normalizeBackendUser = (user) => ({
    id: user.id,
    role: String(user.role || '').toLowerCase(),
    fullName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
    username: user.username,
    employeeId: user.employee_id || user.employeeId || '',
    studentId: user.student_id || user.studentId || '',
    department: user.department || user.department_id || '',
    departmentId: user.department_id || user.departmentId || '',
    department_id: user.department_id || user.departmentId || '',
    departmentName: user.department_name || user.departmentName || '',
    programType: user.program_type || user.programType || '',
    semester: user.semester || '',
    year: user.year || user.year_level || '',
    section: user.section || '',
    academicDate: user.registration_date || user.academicDate || '',
    status: user.status || 'Active',
  });

  const departmentSelectionOptions = useMemo(() => {
    const defaultIds = new Set(departmentHeadDepartmentOptions.map((dept) => dept.id));
    return [
      ...departmentHeadDepartmentOptions,
      ...registeredDepartments.filter((dept) => dept.id && !defaultIds.has(dept.id)),
    ];
  }, [registeredDepartments]);

  const getDepartmentName = (departmentId) => departmentSelectionOptions.find((dept) => dept.id === departmentId)?.name
    || initialCollegeData.flatMap((college) => college.departments).find((dept) => dept.id === departmentId)?.en
    || departmentId;

  const [instructorForm, setInstructorForm] = useState(() => ({
    firstName: '',
    lastName: '',
    gender: '',
    email: '',
    role: 'instructor',
    employeeId: '',
    department: '',
  }));

  const [studentForm, setStudentForm] = useState(() => ({
    firstName: '',
    lastName: '',
    gender: '',
    studentId: '',
    department: '',
    programType: 'regular',
    academicYear: '2024',
    semester: 'i',
    year: '1st Year (Freshman)',
    section: 'A',
  }));

  const handleCollegeRegistrationSubmit = async (event) => {
    event.preventDefault();
    const name = collegeNameInput.trim();
    const code = collegeCodeInput.trim();
    if (!name || !code) {
      toast.error('Please enter the college name and college code.');
      return;
    }

    try {
      await adminApi.createCollege({ name, code });
      setCollegeNameInput('');
      setCollegeCodeInput('');
      toast.success('College registered successfully.');
    } catch (error) {
      toast.error(error?.message || 'Unable to register college.');
    }
  };

  const semesterOptions = [
    { value: 'i', en: 'I', am: 'I' },
    { value: 'ii', en: 'II', am: 'II' },
  ];
  const programOptions = [
    { value: 'regular', en: 'Regular', am: 'ብዙ ነገር' },
    { value: 'extension', en: 'Extension', am: 'እርስ በርስ' },
  ];
  const studentYearOptions = ['1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'];
  const sectionOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const findCollegeById = (id) => initialCollegeData.find((college) => college.id === id);
  const getDepartmentsForCollege = (collegeId) => findCollegeById(collegeId)?.departments || [];

  useEffect(() => {
    if (!isAuthenticated || (role !== 'admin' && role !== 'systemadmin')) {
      navigate('/login');
    }
  }, [isAuthenticated, role, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardStats = async () => {
      try {
        const stats = await adminApi.getDashboardStats();
        if (isMounted) setDashboardStats(stats);
      } catch (error) {
        console.warn('Unable to load admin dashboard statistics:', error);
        if (isMounted) setDashboardStats({});
      }
    };

    if (isAuthenticated && (role === 'admin' || role === 'systemadmin')) {
      void loadDashboardStats();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, role]);

  useEffect(() => {
    let isMounted = true;

    const loadSecurityLogs = async () => {
      setSecurityLogsLoading(true);
      try {
        const result = await adminApi.getSecurityLogs();
        if (!isMounted) return;

        const database = result?.database || {};
        setLogs(Array.isArray(result?.logs) ? result.logs : []);
        setDbHealthMetrics((current) => ({
          ...current,
          ...database,
        }));
        if (Number.isFinite(Number(database.backupRetentionDays)) && Number(database.backupRetentionDays) >= 7) {
          setBackupRetentionDays(Number(database.backupRetentionDays));
        }
        if (database.apiToken) setApiToken(database.apiToken);
      } catch (error) {
        console.warn('Unable to load security logs:', error);
      } finally {
        if (isMounted) setSecurityLogsLoading(false);
      }
    };

    if (isAuthenticated && (role === 'admin' || role === 'systemadmin')) {
      void loadSecurityLogs();
    } else {
      setSecurityLogsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, role]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const departments = await departmentApi.getAll();
        let departmentRecords = [];

        if (Array.isArray(departments) && departments.length) {
          departmentRecords = departments.map((department) => ({
            id: department.id,
            name: department.name,
            code: department.code,
            college_id: department.college_id,
            college_name: department.college_name,
            registeredAt: new Date().toLocaleString(),
          }));
        } else {
          const seededDepartments = await Promise.all(
            fallbackDepartments.map(async (fallback) => {
              try {
                const result = await authApi.createDepartment({ name: fallback.name, code: fallback.code });
                return {
                  id: result.id,
                  name: fallback.name,
                  code: fallback.code,
                  registeredAt: new Date().toLocaleString(),
                };
              } catch (seedError) {
                console.warn('Unable to seed fallback department:', fallback.name, seedError);
                return fallback;
              }
            })
          );
          departmentRecords = seededDepartments;
        }

        setRegisteredDepartments(departmentRecords);
      } catch (error) {
        console.warn('Unable to load persisted departments.', error);
        setRegisteredDepartments(fallbackDepartments);
      } finally {
        setIsDepartmentsLoading(false);
      }
    };

    loadDepartments();
  }, []);

  useEffect(() => {
    if (activeTab !== 'criteria') return;
    criteriaApi.getAll(criteriaType).then(setCriteriaRows).catch((error) => toast.error(error.message || 'Unable to load criteria.'));
  }, [activeTab, criteriaType]);

  const resetCriterionForm = () => {
    setEditingCriterionId(null);
    setShowCriterionForm(false);
    setCriteriaForm({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 });
  };

  const saveCriterion = async (event) => {
    event.preventDefault();
    try {
      if (editingCriterionId) {
        await criteriaApi.update(editingCriterionId, criteriaForm);
      } else {
        await criteriaApi.create({ ...criteriaForm, evaluator_type: criteriaType });
      }
      resetCriterionForm();
      setCriteriaRows(await criteriaApi.getAll(criteriaType));
      toast.success(editingCriterionId ? 'Criterion updated successfully.' : 'Criterion added successfully.');
    } catch (error) {
      toast.error(error.message || 'Unable to save criterion.');
    }
  };

  const toggleCriterion = async (criterion) => {
    const nextActive = !Boolean(criterion.is_active);
    try {
      if (nextActive) await criteriaApi.update(criterion.id, { is_active: true });
      else await criteriaApi.remove(criterion.id);
      setCriteriaRows((current) => current.map((row) => row.id === criterion.id ? { ...row, is_active: nextActive ? 1 : 0 } : row));
      toast.success(nextActive ? 'Criterion enabled.' : 'Criterion disabled.');
    } catch (error) {
      toast.error(error.message || 'Unable to disable criterion.');
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await registrationApi.getUsers();
        if (Array.isArray(allUsers) && allUsers.length) {
          const deptHeadRecords = [];
          const instructorRecords = [];
          const studentRecords = [];

          allUsers.forEach((user) => {
            const normalized = normalizeBackendUser(user);
            if (normalized.role === 'dept_head') {
              deptHeadRecords.push({ ...normalized, accessScore: normalized.accessScore || 90 });
            } else if (normalized.role === 'instructor') {
              instructorRecords.push(normalized);
            } else if (normalized.role === 'student') {
              studentRecords.push(normalized);
            }
          });

          if (deptHeadRecords.length) setDeptHeads(deptHeadRecords);
          if (instructorRecords.length) setInstructors(instructorRecords);
          if (studentRecords.length) setStudents(studentRecords);
        }
      } catch (error) {
        console.warn('Unable to load admin user lists:', error);
      }
    };

    void loadUsers();
  }, []);

  const handleSaveEdit = async (updatedHead) => {
    if (!updatedHead || !updatedHead.id) {
      toast.error('Invalid user selected.');
      return;
    }

    const departmentValue = updatedHead.department || departmentSelectionOptions[0]?.id || departmentHeadDepartmentOptions[0].id;
    const existingDepartmentHead = deptHeads.find((head) => head.department === departmentValue && head.id !== updatedHead.id && head.status !== 'Inactive' && head.status !== 'Reassigned');

    if (updatedHead.role === 'dept_head' && existingDepartmentHead && !headEditTransferMode) {
      toast.error('Department Head already exists for this department. Please update or reassign the existing Department Head.');
      return;
    }

    const payload = {
      full_name: updatedHead.fullName,
      username: updatedHead.username,
      department: departmentValue,
      department_name: getDepartmentName(departmentValue) || updatedHead.departmentName || null,
      registration_date: updatedHead.academicDate || null,
      status: updatedHead.status || 'Active',
    };

    try {
      await registrationApi.updateUser(updatedHead.id, payload);
      const updatedRecord = { ...updatedHead, department: departmentValue, departmentName: payload.department_name };

      setDeptHeads((current) => current.map((head) => (head.id === updatedHead.id ? updatedRecord : head)));
      setInstructors((current) => current.map((instructor) => (instructor.id === updatedHead.id ? updatedRecord : instructor)));
      setStudents((current) => current.map((student) => (student.id === updatedHead.id ? updatedRecord : student)));

      if (existingDepartmentHead && headEditTransferMode) {
        setDeptHeads((current) => current.map((head) => {
          if (head.id === existingDepartmentHead.id) {
            return { ...head, department: '', status: 'Reassigned' };
          }
          return head;
        }));
      }

      setShowEditModal(false);
      setSelectedHead(null);
      setHeadEditTransferMode(false);
      toast.success('User updated successfully.');
    } catch (error) {
      console.error('Update user failed:', error);
      toast.error(error?.message || 'Unable to save user changes.');
    }
  };

  const handleResetPassword = async (user) => {
    if (!user?.id || !window.confirm(`Reset password for ${user.fullName || user.full_name || user.email || 'this user'}?`)) return;
    try {
      await adminApi.resetUserPassword(user.id);
      toast.success('Password reset. The user must change it at next login.');
    } catch (error) {
      toast.error(error.message || 'Unable to reset password.');
    }
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadFile(file);
    setUploadFileName(file ? file.name : '');
  };

  const handleBroadcastSend = (event) => {
    event.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error(strings.systemAdminDashboard.validationBroadcastMessage);
      return;
    }
    const record = { id: Date.now(), audience: broadcastAudience, message: broadcastMessage.trim(), sentAt: new Date().toLocaleString() };
    setBroadcastHistory((current) => [record, ...current]);
    setLogs((current) => [
      ...current,
      { id: Date.now(), user: 'SystemAdmin', action: 'Broadcast sent', time: new Date().toLocaleString(), desc: `Broadcast to ${broadcastAudience}`, ip: '127.0.0.1', browser: navigator.userAgent },
    ]);
    toast.success(strings.systemAdminDashboard.successBroadcastSent);
    setBroadcastMessage('');
    setBroadcastAudience('all');
    setIsComposing(false);
  };

  const handleInstructorChange = (field) => (event) => {
    const value = event.target.value;
    setInstructorForm((current) => ({ ...current, [field]: value }));
    if (field === 'role' && value !== 'dept_head') {
      setDeptHeadTransferMode(false);
    }
  };

  const handleStudentChange = (field) => (event) => {
    const value = event.target.value;
    setStudentForm((current) => {
      if (field === 'college') {
        const nextDepartment = getDepartmentsForCollege(value)[0]?.id || current.department;
        return { ...current, college: value, department: nextDepartment };
      }
      return { ...current, [field]: value };
    });
  };

  const resetInstructorForm = () => {
    setInstructorForm({
      firstName: '',
      lastName: '',
      gender: '',
      email: '',
      role: 'instructor',
      employeeId: '',
      department: '',
    });
  };

  const resetStudentForm = () => {
    setStudentForm({
      firstName: '',
      lastName: '',
      gender: '',
      studentId: '',
      department: '',
      programType: 'regular',
      academicYear: '2024',
      semester: 'i',
      year: '1st Year (Freshman)',
      section: 'A',
    });
  };

  const handleBulkUploadSubmit = async () => {
    if (!uploadFile) {
      toast.error('Please choose a CSV file before uploading.');
      return;
    }

    if (!registrationMode) {
      toast.error('Please select a registration type before uploading.');
      return;
    }

    setIsBulkSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const type = registrationMode;
      formData.append('registration_type', type);

      const result = registrationMode === 'student'
        ? await studentApi.bulkUpload(formData)
        : await authApi.bulkRegister(formData);
      const createdCount = result?.created || 0;
      const failedCount = result?.failed || 0;
      const updatedCount = result?.updated || 0;

      if (result?.created_users?.length) {
        setStudents((current) => {
          if (registrationMode !== 'student') return current;
          const newRows = result.created_users.map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            studentId: row.student_id,
            department: row.department,
            programType: row.program_type,
            semester: row.semester || 'i',
            year: row.year || '1st Year (Freshman)',
            section: row.section || 'A',
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
          }));
          return [...newRows, ...current];
        });

        setInstructors((current) => {
          if (registrationMode !== 'instructor') return current;
          const newRows = result.created_users.filter((row) => row.role !== 'dept_head').map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            employeeId: row.employee_id,
            department: row.department,
            programType: row.program_type,
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
          }));
          return [...newRows, ...current];
        });

        setDeptHeads((current) => {
          if (registrationMode !== 'instructor') return current;
          const newRows = result.created_users.filter((row) => row.role === 'dept_head').map((row) => ({
            id: Date.now() + Math.random(),
            fullName: row.full_name,
            username: row.username,
            employeeId: row.employee_id,
            department: row.department,
            programType: row.program_type,
            academicDate: row.registration_date || getTodayDate(),
            status: 'Active',
            accessScore: 90,
            role: 'Department Head',
          }));
          return [...newRows, ...current];
        });
      }

      setUploadFile(null);
      setUploadFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const summary = `Bulk upload complete. Created: ${createdCount}; Updated: ${updatedCount}; Failed: ${failedCount}.`;
      toast.success(summary);
    } catch (error) {
      const message = error?.response?.data?.message?.en || error.message || 'Bulk upload failed.';
      toast.error(message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleUserRegistrationSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    const parseDepartmentId = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    try {
      if (registrationMode === 'instructor') {
        const email = instructorForm.email.trim().toLowerCase();
        const fullName = [instructorForm.firstName, instructorForm.lastName].filter(Boolean).join(' ').trim();
        const roleValue = 'instructor';

        if (!email || !fullName || !instructorForm.employeeId.trim() || !instructorForm.department) {
          toast.error('Please complete the instructor form before registering.');
          setIsSubmitting(false);
          return;
        }

        if (roleValue === 'dept_head') {
          const existingDepartmentHead = deptHeads.find((head) => head.department === instructorForm.department && head.status !== 'Inactive' && head.status !== 'Reassigned');
          if (existingDepartmentHead && !deptHeadTransferMode) {
            toast.error('Department Head already exists for this department.');
            setIsSubmitting(false);
            return;
          }
        }

        const payload = {
          first_name: instructorForm.firstName.trim(),
          last_name: instructorForm.lastName.trim(),
          gender: instructorForm.gender,
          email,
          role: roleValue,
          department_id: parseDepartmentId(instructorForm.department),
          employee_id: instructorForm.employeeId.trim(),
          password: instructorForm.password?.trim(),
        };

        await authApi.registerInstructor(payload);
        const addedLocally = registerUser({ ...payload, role: roleValue, username: email });
        if (!addedLocally) {
          console.warn(`${roleValue === 'dept_head' ? 'Department Head' : 'Instructor'} ${email} already exists in local auth state.`);
        }

        if (roleValue === 'dept_head') {
          const existingDepartmentHead = deptHeads.find((head) => head.department === instructorForm.department && head.status !== 'Inactive' && head.status !== 'Reassigned');
          setDeptHeads((current) => {
            if (existingDepartmentHead && deptHeadTransferMode) {
              return current.map((head) => {
                if (head.id === existingDepartmentHead.id) {
                  return { ...head, ...instructorForm, fullName, username: email, department: instructorForm.department, status: 'Active', role: 'Department Head' };
                }
                return head;
              });
            }

            return [{ id: Date.now(), ...instructorForm, fullName, username: email, department: instructorForm.department, status: 'Active', accessScore: 90, role: 'Department Head' }, ...current];
          });
          setInstructors((current) => [{
            id: Date.now(),
            fullName,
            username: email,
            role: 'Department Head',
            employeeId: instructorForm.employeeId.trim(),
            department: instructorForm.department,
            status: 'Active',
          }, ...current]);
          setLogs((current) => [
            ...current,
            { id: Date.now(), user: 'SystemAdmin', action: 'Department Head registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
          ]);
          toast.success('Department Head registered successfully.');
        } else {
          setInstructors((current) => [{
            id: Date.now(),
            fullName,
            username: email,
            role: 'Instructor',
            employeeId: instructorForm.employeeId.trim(),
            department: instructorForm.department,
            status: 'Active',
          }, ...current]);
          setLogs((current) => [
            ...current,
            { id: Date.now(), user: 'SystemAdmin', action: 'Instructor registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
          ]);
          toast.success('Instructor registered successfully.');
        }

        resetInstructorForm();
        setDeptHeadTransferMode(false);
        setIsSubmitting(false);
        return;
      }

      const studentId = studentForm.studentId.trim();
      const fullName = [studentForm.firstName, studentForm.lastName].filter(Boolean).join(' ').trim();

      if (!studentId || !fullName || !studentForm.department || !studentForm.section || !studentForm.year) {
        toast.error('Please complete the student form before registering.');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        first_name: studentForm.firstName.trim(),
        last_name: studentForm.lastName.trim(),
        gender: studentForm.gender,
        student_id: studentId,
        department_id: parseDepartmentId(studentForm.department),
        semester: studentForm.semester,
        year_level: studentForm.year,
        section: studentForm.section,
        program_type: studentForm.programType,
        password: studentForm.password?.trim(),
      };

      await authApi.registerStudent(payload);
      const addedLocally = registerUser({ ...payload, role: 'student', email: null });
      if (!addedLocally) {
        console.warn(`Student ${studentId} already exists in local auth state.`);
      }

      setStudents((current) => [{
        id: Date.now(),
        fullName,
        username: studentId,
        studentId,
        department: studentForm.department,
        programType: studentForm.programType,
        semester: studentForm.semester,
        year: studentForm.year,
        section: studentForm.section,
        status: 'Active',
      }, ...current]);
      setLogs((current) => [
        ...current,
        { id: Date.now(), user: 'SystemAdmin', action: 'Student registered', time: new Date().toLocaleString(), desc: `Registered ${fullName}`, ip: '127.0.0.1', browser: navigator.userAgent },
      ]);
      toast.success('Student registered successfully.');
      resetStudentForm();
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      const message = error?.response?.data?.message?.en || error.message || 'Server registration failed.';
      toast.error(message);
    }
  };

  const resetApiToken = () => {
    const nextToken = `IEPS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setApiToken(nextToken);
    setLogs((current) => [
      ...current,
      { id: Date.now(), user: 'SystemAdmin', action: 'API token rotated', time: new Date().toLocaleString(), desc: 'Rotated system token', ip: '127.0.0.1', browser: navigator.userAgent },
    ]);
    toast.success(strings.systemAdminDashboard.successTokenRotated);
  };

  const [apiToken, setApiToken] = useState('--');

  const handleForceReset = (id) => {
    setLogs((current) => [
      ...current,
      { id: Date.now(), user: 'SystemAdmin', action: 'Force reset issued', time: new Date().toLocaleString(), desc: `Forced password reset for head ${id}`, ip: '127.0.0.1', browser: navigator.userAgent },
    ]);
    setShowForceResetModal(false);
    setSelectedHead(null);
    toast.success(strings.systemAdminDashboard.successForceResetIssued);
  };

  const handleBackupRetentionChange = (event) => {
    setBackupRetentionDays(Number(event.target.value));
  };

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.20),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(135deg,_#e8f0fb_0%,_#dfeaf8_48%,_#edf4ff_100%)] text-slate-900">
      <aside className="w-80 border-r border-slate-200 p-6 flex flex-col">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-3xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20">
            <Activity size={18} /> {t('liveAdmin', 'Live Admin', 'ቀጥታ አስተዳደር')}
          </div>
          <h1 className="mt-6 text-2xl font-bold">{t('systemAdminTitle', 'System Admin', 'የስርዓት አስተዳደር')}</h1>
          <p className="mt-2 text-slate-400">{t('systemAdminSubtitle', 'Enterprise evaluation command center', 'የግምገባ አደረጃጀት ቁጥጥር ማዕከል')}</p>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: 'overview', icon: LayoutDashboard, label: t('overview', 'Overview', 'አጠቃላይ') },
            { id: 'department-course', icon: ClipboardList, label: t('collegeDepartmentRegistration', 'College and Department Registration', 'ኮሌጅ እና ዲፓርትመንት ምዝገባ') },
            { id: 'criteria', icon: ClipboardList, label: 'Evaluation Criteria' },
            { id: 'register-head', icon: UserPlus, label: t('registerHead', 'Register User', 'ምዝገባ') },
            { id: 'manage-roles', icon: ShieldCheck, label: 'Manage Roles' },
            { id: 'view-data', icon: Database, label: t('viewData', 'View Data', 'ውሂብ ይመልከቱ') },
            { id: 'broadcast', icon: Megaphone, label: t('broadcastManager', 'Broadcast Manager', 'የስርጭት አስተዳደር') },
            { id: 'security', icon: ShieldCheck, label: t('securityLogs', 'Security & Logs', 'ደህንነት እና መዝገቦች') },
            { id: 'health', icon: Activity, label: t('systemHealth', 'System Health', 'የስርዓት ጤና') },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${activeTab === item.id ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        {activeTab === 'view-data' && (
          <ViewDataView
            instructors={instructors}
            students={students}
            departments={registeredDepartments}
            onResetPassword={handleResetPassword}
          />
        )}

        {activeTab === 'overview' && (
          <section className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(37,99,235,0.18)] backdrop-blur-xl">
                <p className="text-sm text-slate-500">{t('upcomingEvents', 'Upcoming Events', 'የሚመጡ ክስተቶች')}</p>
                <p className="mt-4 text-4xl font-semibold text-slate-900" aria-live="polite">
                  {dashboardStats?.upcomingEvents === undefined ? <span className="inline-block h-10 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" /> : dashboardStats.upcomingEvents}
                </p>
                <p className="mt-3 text-slate-600">{t('scheduledInWindow', 'Scheduled in the active window', 'በእርምጃው ውስጥ የተያዙ')}</p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(37,99,235,0.18)] backdrop-blur-xl">
                <p className="text-sm text-slate-500">{t('totalBroadcasts', 'Total broadcasts', 'ጠቅላላ ስርጭቶች')}</p>
                <p className="mt-4 text-4xl font-semibold text-slate-900" aria-live="polite">
                  {dashboardStats?.totalBroadcasts === undefined ? <span className="inline-block h-10 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" /> : dashboardStats.totalBroadcasts}
                </p>
                <p className="mt-3 text-slate-600">{t('targetedAudiences', 'Targeted audiences', 'የታለመ ተመልካቾች')}</p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(37,99,235,0.18)] backdrop-blur-xl">
                <p className="text-sm text-slate-500">{t('securityPulse', 'Security pulse', 'የደህንነት ሁኔታ')}</p>
                <p className="mt-4 text-4xl font-semibold text-slate-900" aria-live="polite">
                  {dashboardStats?.securityPulse === undefined ? <span className="inline-block h-10 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" /> : dashboardStats.securityPulse}
                </p>
                <p className="mt-3 text-slate-600">{t('openIncidents', 'Open incidents', 'ክፍት ህጎች')}</p>
              </article>
              <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(37,99,235,0.18)] backdrop-blur-xl">
                <p className="text-sm text-slate-500">{t('registeredHeads', 'Registered Heads', 'የተመዘገቡ ኃላፊዎች')}</p>
                <p className="mt-4 text-4xl font-semibold text-slate-900" aria-live="polite">
                  {dashboardStats?.registeredHeads === undefined ? <span className="inline-block h-10 w-20 animate-pulse rounded bg-slate-200" aria-label="Loading" /> : dashboardStats.registeredHeads}
                </p>
                <p className="mt-3 text-slate-600">{t('activeDepartmentProfiles', 'Active department profiles', 'ንቁ የዲፓርትመንት መገለጫዎች')}</p>
              </article>
            </div>

          </section>
        )}

        {activeTab === 'criteria' && (
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-2xl font-bold text-slate-900">Evaluation Criteria</h3><p className="mt-1 text-slate-600">Manage the questions used by each evaluation form.</p></div>
                <button type="button" onClick={() => { setEditingCriterionId(null); setCriteriaForm({ criterion_text: '', criterion_text_am: '', category: 'General', weight: 5 }); setShowCriterionForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} /> Add New Criterion</button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
                {[['student', 'Student Criteria'], ['peer', 'Peer Criteria'], ['dept_head', 'Dept Head Criteria'], ['dean', 'Dean Criteria']].map(([value, label]) => <button key={value} type="button" onClick={() => { setCriteriaType(value); resetCriterionForm(); }} className={`rounded-xl px-4 py-2 text-sm font-semibold ${criteriaType === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-200'}`}>{label}</button>)}
              </div>
              {showCriterionForm || editingCriterionId ? (
                <form onSubmit={saveCriterion} className="fixed inset-0 z-50 m-auto grid h-fit w-[min(92vw,760px)] gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-2xl md:grid-cols-[1fr_1fr_180px_100px_auto]">
                  <input value={criteriaForm.criterion_text} onChange={(event) => setCriteriaForm({ ...criteriaForm, criterion_text: event.target.value })} placeholder="Criterion Text (English)" maxLength={255} required className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input value={criteriaForm.criterion_text_am} onChange={(event) => setCriteriaForm({ ...criteriaForm, criterion_text_am: event.target.value })} placeholder="Criterion Text (Amharic)" maxLength={255} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input value={criteriaForm.category} onChange={(event) => setCriteriaForm({ ...criteriaForm, category: event.target.value })} placeholder="Category" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input type="number" min="1" value={criteriaForm.weight} onChange={(event) => setCriteriaForm({ ...criteriaForm, weight: event.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <div className="flex gap-2"><button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{editingCriterionId ? 'Save' : 'Add'}</button><button type="button" onClick={resetCriterionForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button></div>
                </form>
              ) : null}
                  <div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3">Criterion</th><th className="px-3 py-3">Amharic</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{criteriaRows.map((criterion) => <tr key={criterion.id} className={!criterion.is_active ? 'bg-slate-50 text-slate-400' : ''}><td className="px-3 py-3">{criterion.criterion_text}</td><td className="px-3 py-3">{criterion.criterion_text_am || '—'}</td><td className="px-3 py-3">{criterion.category}</td><td className="px-3 py-3">{criterion.weight}</td><td className="px-3 py-3">{criterion.is_active ? 'Active' : 'Disabled'}</td><td className="px-3 py-3"><div className="flex gap-3"><button type="button" onClick={() => { setEditingCriterionId(criterion.id); setCriteriaForm({ criterion_text: criterion.criterion_text, criterion_text_am: criterion.criterion_text_am || '', category: criterion.category, weight: criterion.weight }); setShowCriterionForm(true); }} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button><button type="button" onClick={() => toggleCriterion(criterion)} className={criterion.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}><Trash2 size={16} /></button></div></td></tr>)}{!criteriaRows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No criteria for this evaluator type.</td></tr>}</tbody></table></div>
            </div>
          </section>
        )}

        {activeTab === 'department-course' && (
          <section className="space-y-8">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900">College and Department Registration</h3>
                <p className="mt-1 text-slate-600">Create colleges and departments from one place and keep their records updated instantly.</p>
              </div>

              <div className="mb-8 flex flex-wrap gap-3 rounded-2xl bg-slate-100 p-2">
                {[
                  { id: 'college', label: 'College Registration' },
                  { id: 'department', label: 'Department Registration' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDepartmentCourseTab(tab.id)}
                    className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${departmentCourseTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {departmentCourseTab === 'college' ? (
                <form onSubmit={handleCollegeRegistrationSubmit} className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">College Name:</span>
                      <input value={collegeNameInput} onChange={(event) => setCollegeNameInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 outline-none focus:border-blue-500" placeholder="Enter college name" required />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">College Code:</span>
                      <input value={collegeCodeInput} onChange={(event) => setCollegeCodeInput(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 outline-none focus:border-blue-500" placeholder="Enter college code" required />
                    </label>
                  </div>
                  <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">Register College</button>
                </form>
              ) : (
                <DepartmentRegistration onRegistered={(record) => {
                  setRegisteredDepartments((current) => [record, ...current]);
                }} />
              )}
            </div>
          </section>
        )}

        {activeTab === 'register-head' && (
          <section className="space-y-8">
            <div className="w-full border-b border-slate-200 bg-transparent p-0">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-slate-900">{sys.registrationSectionTitle}</h3>
                <p className="mt-1 text-slate-600">{sys.registrationSectionDescription}</p>
              </div>

              <div className="mb-8 flex flex-wrap gap-3 rounded-2xl bg-slate-100 p-2">
                {[
                  { id: 'instructor', label: sys.instructorRegistration },
                  { id: 'student', label: sys.studentRegistration },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRegistrationMode(tab.id)}
                    className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${registrationMode === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {!registrationMode && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-8 text-center">
                  <p className="text-lg font-semibold text-slate-900">{sys.registrationPromptTitle}</p>
                  <p className="mt-2 text-sm text-slate-500">{sys.registrationPromptSubtitle}</p>
                </div>
              )}

              {registrationMode && (
                <div className="space-y-6">
                  <section aria-labelledby="bulk-upload-title" className="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 id="bulk-upload-title" className="text-lg font-semibold text-slate-900">{t('bulkUploadTitle', 'Bulk Upload registration', 'ብዛት አስገባ ምዝገባ')}</h4>
                        <p className="mt-1 text-sm text-slate-600">{t('bulkUploadDesc', 'Upload a CSV with the required fields for the selected registration type.', 'የተመረጡትን ምዝገባ ዓይነት የሚያስፈልጉ መረጃዎችን በCSV ይስቀሉ')}</p>
                      </div>
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.xlsx"
                          className="h-12 min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-semibold file:text-white"
                          onChange={handleFileInputChange}
                          aria-label="Choose CSV file"
                        />
                        <button
                          type="button"
                          onClick={handleBulkUploadSubmit}
                          disabled={isBulkSubmitting || !uploadFile}
                          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
                          aria-busy={isBulkSubmitting}
                        >
                          {isBulkSubmitting && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
                          {isBulkSubmitting ? 'Uploading...' : 'Upload CSV'}
                        </button>
                        <span className="min-w-0 truncate text-sm text-slate-500">{uploadFileName || sys.noFileSelected}</span>
                      </div>
                    </div>
                  </section>

                  <form noValidate onSubmit={handleUserRegistrationSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start [&_input]:h-11 [&_input]:min-h-[44px] [&_input]:min-w-0 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:leading-normal [&_select]:h-11 [&_select]:min-h-[44px] [&_select]:min-w-0 [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_select]:leading-normal [&_input:focus]:border-blue-500 [&_select:focus]:border-blue-500 [&_input:focus]:ring-2 [&_select:focus]:ring-2 [&_input:focus]:ring-blue-500 [&_select:focus]:ring-blue-500">
                    {registrationMode === 'instructor' && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">👤 Personal Information</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">First Name <span className="text-red-600">*</span></span>
                            <input value={instructorForm.firstName} onChange={handleInstructorChange('firstName')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder={sys.firstNamePlaceholder} required />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Last Name <span className="text-red-600">*</span></span>
                            <input value={instructorForm.lastName} onChange={handleInstructorChange('lastName')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder={sys.lastNamePlaceholder} required />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Gender <span className="text-red-600">*</span></span>
                            <select value={instructorForm.gender} onChange={handleInstructorChange('gender')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">🎓 Academic &amp; Employment Information</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Department <span className="text-red-600">*</span></span>
                            <DepartmentCombobox required departments={registeredDepartments} value={instructorForm.department} onChange={handleInstructorChange('department')} disabled={isDepartmentsLoading} />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Email Address <span className="text-red-600">*</span></span>
                            <input type="email" value={instructorForm.email} onChange={handleInstructorChange('email')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder="instructor@domain.com" required />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Employee ID <span className="text-red-600">*</span></span>
                            <input value={instructorForm.employeeId} onChange={handleInstructorChange('employeeId')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder="INS-001" required />
                          </label>
                        </div>
                      </section>
                    </div>
                  )}

                    {registrationMode === 'student' && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">👤 Personal Information</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">First Name <span className="text-red-600">*</span></span>
                            <input value={studentForm.firstName} onChange={handleStudentChange('firstName')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder={sys.firstNamePlaceholder} required />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Last Name <span className="text-red-600">*</span></span>
                            <input value={studentForm.lastName} onChange={handleStudentChange('lastName')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder={sys.lastNamePlaceholder} required />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">Gender <span className="text-red-600">*</span></span>
                            <select value={studentForm.gender} onChange={handleStudentChange('gender')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>
                              <option value="">Select Gender</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </label>
                          <label className="block md:col-span-3">
                            <span className="text-sm font-medium text-slate-700">Student ID <span className="text-red-600">*</span></span>
                            <input value={studentForm.studentId} onChange={handleStudentChange('studentId')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" placeholder={sys.studentIdPlaceholder} required />
                          </label>
                        </div>
                      </section>

                      <section className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-3">
                          <h4 className="text-lg font-semibold text-slate-900">🎓 Academic Information</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">Program Type <span className="text-red-600">*</span></span>
                              <select value={studentForm.programType} onChange={handleStudentChange('programType')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>
                                {programOptions.map((opt) => <option key={opt.value} value={opt.value}>{language === 'en' ? opt.en : opt.am}</option>)}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">Department <span className="text-red-600">*</span></span>
                              <DepartmentCombobox required departments={registeredDepartments} value={studentForm.department} onChange={handleStudentChange('department')} disabled={isDepartmentsLoading} />
                            </label>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">Year <span className="text-red-600">*</span></span>
                              <select value={studentForm.year} onChange={handleStudentChange('year')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>{studentYearOptions.map((yearOption) => <option key={yearOption} value={yearOption}>{yearOption}</option>)}</select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">Semester <span className="text-red-600">*</span></span>
                              <select value={studentForm.semester} onChange={handleStudentChange('semester')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>{semesterOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.en}</option>)}</select>
                            </label>
                            <label className="block">
                              <span className="text-sm font-medium text-slate-700">Section <span className="text-red-600">*</span></span>
                              <select value={studentForm.section} onChange={handleStudentChange('section')} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-500" required>{sectionOptions.map((sectionOption) => <option key={sectionOption} value={sectionOption}>{sectionOption}</option>)}</select>
                            </label>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}

                  <div className="md:col-span-2 lg:col-span-3 pt-4">
                    <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                      {isSubmitting ? t('registering', 'Registering...', 'በማስመዝገብ ላይ...') : uploadFile ? t('bulkRegister', 'Bulk Register', 'ብዛት አስመዝግብ') : registrationMode === 'instructor' ? t('registerInstructor', 'Register Instructor', 'አስተማሪ አስመዝግብ') : t('registerStudent', 'Register Student', 'ተማሪ አስመዝግብ')}
                    </button>
                  </div>

                  </form>
                </div>
              )}
            </div>

          </section>
        )}

        {activeTab === 'manage-roles' && (
          <ManageRoles users={[...deptHeads, ...instructors, ...students]} onRoleAssigned={(userId, assignedRole) => {
            const update = (items) => items.map((item) => (item.id === userId ? { ...item, role: assignedRole } : item));
            setDeptHeads((current) => update(current));
            setInstructors((current) => update(current));
            setStudents((current) => update(current));
          }} />
        )}

        {activeTab === 'calendar' && (
          <EvaluationCalendar
            initialCollegeData={initialCollegeData}
            onCreateEvent={(event) => {
              setLogs((current) => [
                ...current,
                {
                  id: Date.now(),
                  user: 'SystemAdmin',
                  action: 'Evaluation event scheduled',
                  time: new Date().toLocaleString(),
                  desc: `Scheduled ${event.type}: ${event.title}`,
                  ip: '127.0.0.1',
                  browser: navigator.userAgent,
                },
              ]);
              toast.success('Event scheduled successfully.');
            }}
          />
        )}

        {activeTab === 'broadcast' && (
          <section className="space-y-8">
            {isComposing ? (
              <form onSubmit={handleBroadcastSend} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Compose Broadcast</h3>
                  <button type="button" onClick={() => setIsComposing(false)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <History size={16} /> History
                  </button>
                </div>
                <label className="mb-4 block">
                  <span className="text-slate-600">{sys.audienceLabel}</span>
                  <select value={broadcastAudience} onChange={(e) => setBroadcastAudience(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="all">{sys.allUsersOption}</option>
                    <option value="students">{sys.studentsOption}</option>
                    <option value="instructors">{sys.instructorsOption}</option>
                    <option value="deptheads">{sys.deptHeadsOption}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-600">{sys.messageLabel}</span>
                  <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={6} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder={sys.writeBroadcastMessage} required />
                </label>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"><Megaphone size={18} /> {sys.sendBroadcast}</button>
                  <span className="text-sm text-slate-500">{sys.scheduledMessagesBelow}</span>
                </div>
              </form>
            ) : (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{sys.broadcastHistory}</h3>
                    <p className="text-slate-600">{sys.broadcastHistoryDesc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700">{broadcastHistory.length} {sys.itemsLabel}</span>
                    <button type="button" onClick={() => setIsComposing(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <Megaphone size={16} /> + New Broadcast
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {broadcastHistory.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-slate-600">{item.message}</p>
                        <span className="text-xs text-slate-500">{item.sentAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'security' && (
          <section className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{sys.securityPosture}</h3>
                    <p className="text-slate-600">{sys.securityPostureDesc}</p>
                  </div>
                  <ShieldCheck size={20} className="text-emerald-500" />
                </div>
                <p className="mt-6 text-4xl font-semibold">{dbHealthMetrics.securityScore}</p>
                <p className="mt-2 text-slate-400">{sys.securitySummary}</p>
              </article>
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <h3 className="text-lg font-semibold text-slate-900">{sys.apiToken}</h3>
                <p className="mt-3 text-slate-600">{sys.apiTokenDesc}</p>
                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 font-mono text-slate-900">{apiToken}</div>
                <button onClick={resetApiToken} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">{sys.rotateToken}</button>
              </article>
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{sys.mfaLabel}</h3>
                    <p className="text-slate-600">{sys.mfaDescription}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mfaEnabled ? 'bg-emerald-500/20 text-emerald-700' : 'bg-rose-500/20 text-rose-700'}`}>{mfaEnabled ? sys.mfaEnabledLabel : sys.mfaDisabledLabel}</span>
                </div>
                <button type="button" onClick={() => { setMfaEnabled((current) => !current); toast.success(mfaEnabled ? sys.mfaDisabledMessage : sys.mfaEnabledMessage); }} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">{mfaEnabled ? sys.disableMfa : sys.enableMfa}</button>
              </article>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('databaseHealth', 'Database Health', 'የዳታቤዝ ጤና')}</h3>
                    <p className="text-slate-600">{t('databaseHealthDesc', 'Track replication, cache, connections and backup readiness.', 'የርእስ ቀጥታነት፣ ካሽ፣ ግንኙነት እና ባክአፕ ዝግጅት ይከታተሉ')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{dbHealthMetrics.status}</span>
                </div>
                <div className="grid gap-4 mt-6 sm:grid-cols-2">
                  {[
                    { label: t('replicationLag', 'Replication lag', 'የቅድሚያ ጊዜ'), value: dbHealthMetrics.replicationLag },
                    { label: t('connections', 'Active connections', 'ንቁ ግንኙነቶች'), value: dbHealthMetrics.connections },
                    { label: t('cacheHitRate', 'Cache hit rate', 'የካሽ ውጤት'), value: dbHealthMetrics.cacheHitRate === '--' ? '--' : `${dbHealthMetrics.cacheHitRate}%` },
                    { label: t('diskUsage', 'Disk usage', 'የዲስክ እጥረት'), value: dbHealthMetrics.diskUsage },
                    { label: t('lastBackup', 'Last backup', 'የመጨረሻ ባክአፕ'), value: dbHealthMetrics.lastBackup },
                  ].map((item) => (
                    <div key={item.label} className="rounded-3xl bg-slate-50 border border-slate-200 p-4">
                      <p className="text-sm text-slate-500">{item.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">{t('backupRetention', 'Backup retention (days)', 'የባክአፕ መጠበቂያ')}</p>
                    <span className="text-sm text-slate-600">{backupRetentionDays}d</span>
                  </div>
                  <input type="range" min="7" max="90" step="1" value={backupRetentionDays} onChange={handleBackupRetentionChange} className="w-full accent-blue-600" />
                </div>
              </article>
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('auditTimelineTitle', 'Audit Timeline', 'የኦዲት ጊዜሰላም')}</h3>
                    <p className="text-slate-600">{t('auditTimelineDesc', 'Real-time system events and compliance history.', 'የቀጥታ የስርዓት ክስተቶች እና የስርዓት ታሪክ')}</p>
                  </div>
                  <div className="relative w-full lg:w-80">
                    <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder={sys.searchLogsPlaceholder} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="space-y-4">
                  {securityLogsLoading ? (
                    <div className="h-40 animate-pulse rounded-3xl bg-slate-100" aria-label="Loading audit timeline" />
                  ) : logs.filter((entry) => {
                    const query = auditSearch.trim().toLowerCase();
                    if (!query) return true;
                    return [entry.user, entry.action, entry.desc, entry.ip, entry.browser].some((value) => String(value).toLowerCase().includes(query));
                  }).slice(0, 8).map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{entry.action}</p>
                          <p className="text-slate-600 text-sm">{entry.desc}</p>
                        </div>
                        <span className="text-slate-500 text-xs">{entry.time}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-slate-600 text-xs">
                        <span>{t('byLabel', 'By', 'በ')} {entry.user}</span>
                        <span>{t('ipLabel', 'IP', 'IP')}: {entry.ip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        )}

        {activeTab === 'logs' && (
          <section className="space-y-8">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t('auditTimelineTitle', 'Audit Timeline', 'የኦዲት ጊዜሰላም')}</h3>
                  <p className="text-slate-600">{t('auditTimelineDesc', 'Real-time system events and compliance history.', 'የቀጥታ የስርዓት ክስተቶች እና የስርዓት ታሪክ')}</p>
                </div>
                <button type="button" onClick={() => { setLogs((current) => [{ id: Date.now(), user: 'System', action: t('logRefreshAction', 'Noisy log refresh', 'የብረት መዝገብ እድሳት'), time: new Date().toLocaleString(), desc: t('logRefreshDescription', 'Operator refreshed timeline state', 'ኦፕሬተር የጊዜ መረጃ አድሰዋል'), ip: '127.0.0.1', browser: navigator.userAgent }, ...current]); toast.success(strings.systemAdminDashboard.successAuditTimelineRefreshed); }} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
                  <RefreshCw size={18} /> {sys.refreshTimeline}
                </button>
              </div>
              <div className="mt-8 grid gap-4">
                {logs.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{entry.action}</p>
                        <p className="text-slate-600">{entry.desc}</p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700">{entry.user}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4 text-slate-600 text-xs">
                      <span>{entry.time}</span>
                      <span>{entry.ip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'health' && (
          <section className="space-y-8">
            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-600 font-semibold">{t('systemHealthTitle', 'System Health', 'የስርዓት ጤና')}</p>
                <p className="mt-4 text-4xl font-bold text-slate-900">{t('systemHealthStatus', '99.8%', '99.8%')}</p>
                <p className="text-slate-500 text-sm mt-2">{t('uptimeThisWeek', 'uptime this week', 'በዚህ ሳምንት የሚሆን')}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{t('systemHealth', 'System Health', 'የስርዓት ጤና')}</h3>
                  <p className="text-slate-600">{t('systemHealthDesc', 'Monitor system performance, resources, and status.', 'የስርዓት አፈጻጸም፣ ሀብቶች እና ሁኔታ ተከታተል')}</p>
                </div>
                <button type="button" onClick={() => { setDbHealthMetrics((current) => ({ ...current })); toast.success('System health refreshed'); }} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
                  <RefreshCw size={18} /> Refresh
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-slate-900">Storage & Backup</h4>
                    <span className="text-xs font-medium text-blue-600">Last Backup: {dbHealthMetrics.lastBackup}</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Disk Usage</span>
                        <span className="font-semibold text-slate-900">{dbHealthMetrics.diskUsage}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 w-[74%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Backup Retention</span>
                        <span className="font-semibold text-slate-900">{backupRetentionDays} days</span>
                      </div>
                      <input 
                        type="range" 
                        min="7" 
                        max="90" 
                        value={backupRetentionDays}
                        onChange={(e) => setBackupRetentionDays(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">API Performance</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Response Time</span>
                      <span className="font-semibold text-slate-900">145ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Request Rate</span>
                      <span className="font-semibold text-slate-900">2,850/min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Error Rate</span>
                      <span className="font-semibold text-green-600">0.12%</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 p-6">
                  <h4 className="font-semibold text-slate-900 mb-4">System Alerts</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      <span className="text-slate-600">All systems operational</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                      <span className="text-slate-600">Disk usage approaching threshold</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      <span className="text-slate-600">Security protocols active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {showEditModal && selectedHead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{t('editDeptHead', 'Edit Dept Head', 'የዲፓርትመንት ኃላፊ አስተካክል')}</h3>
                  <p className="text-slate-600">{t('editDeptHeadDesc', 'Update department head profile before saving.', 'የዲፓርትመንት ኃላፊ መገለጫ አስተካክል')}</p>
                </div>
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedHead(null); }} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">{common.cancel}</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={selectedHead.fullName} onChange={(e) => setSelectedHead((current) => ({ ...current, fullName: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <input value={selectedHead.username} onChange={(e) => setSelectedHead((current) => ({ ...current, username: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <select value={selectedHead.department || departmentSelectionOptions[0]?.id || departmentHeadDepartmentOptions[0].id} onChange={(e) => setSelectedHead((current) => ({ ...current, department: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none">
                  {departmentSelectionOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                <input type="date" value={selectedHead.academicDate || ''} onChange={(e) => setSelectedHead((current) => ({ ...current, academicDate: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
                <input value={selectedHead.status} onChange={(e) => setSelectedHead((current) => ({ ...current, status: e.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none" />
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={headEditTransferMode} onChange={() => setHeadEditTransferMode((current) => !current)} />
                  <span>Replace / transfer this head assignment to the selected department.</span>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedHead(null); }} className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm text-slate-200 hover:bg-slate-700">{common.cancel}</button>
                <button type="button" onClick={() => handleSaveEdit(selectedHead)} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">{t('saveChanges', 'Save changes', 'ለውጦችን አስቀምጥ')}</button>
              </div>
            </div>
          </div>
        )}

        {showForceResetModal && selectedHead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/10">
              <h3 className="text-xl font-semibold mb-4 text-slate-900">{sys.forceResetTitle}</h3>
              <p className="text-slate-600 mb-6">{sys.forceResetDesc.replace('{username}', selectedHead.username)}</p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setShowForceResetModal(false); setSelectedHead(null); }} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700 hover:bg-slate-100">{common.cancel}</button>
                <button type="button" onClick={() => handleForceReset(selectedHead.id)} className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-500">{common.confirm}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SystemAdminDashboard;
