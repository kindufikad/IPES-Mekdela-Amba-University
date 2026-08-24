import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUsers,
  FaChalkboardTeacher,
  FaBook,
  FaShieldAlt,
  FaClipboardCheck,
  FaChartBar,
  FaGraduationCap,
  FaBell,
  FaDatabase,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { adminData } from '../data/adminOptions';
import StudentsSection from '../components/admin/StudentsSection';
import InstructorsSection from '../components/admin/InstructorsSection';
import EvaluationWorkflow from '../components/EvaluationWorkflow';
import { LanguageContext } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { departmentApi, registrationApi, evaluationApi, courseAssignmentApi } from '../services/api';
import DispatchEvaluationModal from '../components/DispatchEvaluationModal';
import EvaluationTemplateBuilder from '../components/EvaluationTemplateBuilder';
import InstructorEvaluationCriteriaModal from '../components/InstructorEvaluationCriteriaModal';
import EvaluationBreakdownModal from '../components/EvaluationBreakdownModal';
import CourseAssignmentModal from '../components/CourseAssignmentModal';
import DeptHeadPerformanceDashboard from '../components/DeptHeadPerformanceDashboard';
import PublishEvaluation from './PublishEvaluation';
import { dispatchForm, SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';

const STUDENT_EVAL_TEMPLATE_KEY = 'ipesStudentEvalTemplate';

const initialUsers = [
  { id: 1, fullName: 'Alemu Bekele', email: 'alemu@mu.edu.et', role: 'Student', collegeId: 'college-1', departmentId: 'dept-1', programId: 'program-2', studentId: '2024-001', programType: 'Regular', academicYear: '2024/25', semester: 'Semester I', yearLevel: 'Year 3', section: 'A' },
  { id: 2, fullName: 'Dr. Selamawit Tadesse', email: 'selam@mu.edu.et', role: 'Instructor', collegeId: 'college-1', departmentId: 'dept-1', programId: 'program-2', employeeId: 'INS-001', specialization: 'Software Engineering', departmentName: 'Computer Science', learningLevel: 'Master Degree' },
];

const initialCourses = [
  { id: 1, name: 'Software Engineering', code: 'SE401', collegeId: 'college-1', departmentId: 'dept-1', creditHours: '3' },
  { id: 2, name: 'Database Systems', code: 'CS402', collegeId: 'college-1', departmentId: 'dept-1', creditHours: '3' },
];

const initialEvaluations = [
  { id: 1, instructorId: 2, instructorName: 'Dr. Selamawit Tadesse', courseCode: 'CS401', courseName: 'Software Engineering', averageScore: 4.6, completed: 18, pending: 2, status: 'On track' },
  { id: 2, instructorId: 3, instructorName: 'Prof. Bekele Dadi', courseCode: 'CS402', courseName: 'Database Systems', averageScore: 4.4, completed: 15, pending: 5, status: 'Needs follow-up' },
];

// assignments feature removed for DeptHead view

const DeptHeadDashboard = () => {
  const { strings } = useContext(LanguageContext);
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user || null;
  const departmentId = currentUser?.department_id || currentUser?.departmentId || currentUser?.department || null;
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState('overview');
  const [viewDataTab, setViewDataTab] = useState('instructors');
  const [viewDataRows, setViewDataRows] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentIdForEvaluation, setSelectedAssignmentIdForEvaluation] = useState('');
  const [users, setUsers] = useState([]);
  const [assignmentInstructors, setAssignmentInstructors] = useState([]);
  const [studentFilters, setStudentFilters] = useState({ yearLevel: 'all', section: 'all' });
  const [courses, setCourses] = useState(initialCourses);
  const [overviewStats, setOverviewStats] = useState({ totalInstructors: 0, totalStudents: 0, totalCourses: 0, activeAssignments: 0 });
  const [departmentCoursesLoading, setDepartmentCoursesLoading] = useState(false);
  const [evaluations, setEvaluations] = useState(initialEvaluations);
  const [formNotification, setFormNotification] = useState('');
  const [trackingView, setTrackingView] = useState('student');
  const [trackingFilters, setTrackingFilters] = useState({ year_level: 'All Years', section: 'All Sections', program_type: 'All Programs', instructor_id: '' });
  const [studentTrackingRows, setStudentTrackingRows] = useState([]);
  const [peerTrackingInstructor, setPeerTrackingInstructor] = useState('');
  const [peerTrackingRows, setPeerTrackingRows] = useState([]);
  const [deptTrackingInstructor, setDeptTrackingInstructor] = useState('');
  const [deptTrackingRows, setDeptTrackingRows] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState('');
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderTarget, setReminderTarget] = useState('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showInstructorModal, setShowInstructorModal] = useState(false);
  const [studentEvalForm, setStudentEvalForm] = useState({
    academicYear: adminData.academicYears[4]?.name || '2024/2025',
    semester: adminData.semesters[0]?.name || 'Semester I',
    yearLevel: adminData.yearLevels[2]?.name || 'Year III',
    collegeId: '',
    departmentId: '',
    courseId: '',
    studentGroup: '',
    studentId: '',
  });
  const [studentEvalTemplate, setStudentEvalTemplate] = useState('');
  const [studentEvalTemplateId, setStudentEvalTemplateId] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [instructorEvalForm, setInstructorEvalForm] = useState({ evaluatorId: '', targetInstructorId: '', criteria: '', semester: 'Semester I' });
  const [submissions, setSubmissions] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deptInstructorsList, setDeptInstructorsList] = useState([]);
  const [deptEvalLoading, setDeptEvalLoading] = useState(false);
  const [selectedDeptInstructor, setSelectedDeptInstructor] = useState(null);
  const [showDeptEvalModal, setShowDeptEvalModal] = useState(false);
  const [deptEvalCriteriaScores, setDeptEvalCriteriaScores] = useState({});
  const [deptEvalSubmitting, setDeptEvalSubmitting] = useState(false);
  const [deptEvalError, setDeptEvalError] = useState('');
  const [showEvaluationBreakdown, setShowEvaluationBreakdown] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [courseForm, setCourseForm] = useState({ name: '', code: '', yearLevel: '', semester: '', creditHours: '' });
  const [reportAcademicYear, setReportAcademicYear] = useState('2025/2026');
  const [reportSemester, setReportSemester] = useState('Semester II');
  const [courseCsvFile, setCourseCsvFile] = useState(null);
  const [courseCsvUploading, setCourseCsvUploading] = useState(false);

  useEffect(() => {
    const refreshSubmissions = async () => {
      try {
        const rows = await evaluationApi.getSubmissions();
        setSubmissions(Array.isArray(rows) ? rows : []);
      } catch {
        setSubmissions([]);
      }
    };
    void refreshSubmissions();
    if (typeof window !== 'undefined') {
      window.addEventListener(SUBMISSIONS_UPDATED_EVENT, refreshSubmissions);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, refreshSubmissions);
      }
    };
  }, []);

  const normalizeUserRecord = useCallback((userRecord) => ({
    id: userRecord.id,
    fullName: userRecord.full_name || userRecord.fullName || `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim(),
    email: userRecord.email || '',
    username: userRecord.username,
    password: userRecord.password || '',
    studentId: userRecord.studentId || userRecord.student_id || userRecord.studentid || '',
    employeeId: userRecord.employeeId || userRecord.employee_id || userRecord.employeeid || '',
    departmentId: userRecord.department_id || userRecord.departmentId || userRecord.departmentid || '',
    courseId: userRecord.course_id || userRecord.courseId || userRecord.courseid || '',
    departmentName: userRecord.departmentName || userRecord.department_name || '',
    courseName: userRecord.courseName || userRecord.course_name || '',
    specialization: userRecord.specialization || '',
    learningLevel: userRecord.learningLevel || userRecord.learning_level || '',
    registrationDate: userRecord.registrationDate || userRecord.registration_date || today,
    role: String(userRecord.role).toLowerCase() === 'student' ? 'Student' : String(userRecord.role).toLowerCase() === 'instructor' ? 'Instructor' : userRecord.role,
  }), [today]);

  const loadDashboardData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (!departmentId) {
        setLoadingData(false);
        return;
      }

      const [usersResult, coursesResult, evaluationsResult, assignmentsResult] = await Promise.allSettled([
        registrationApi.getUsers(),
        departmentApi.getDepartmentCourses(departmentId),
        registrationApi.getEvaluations(),
        courseAssignmentApi.getAll(),
      ]);

      if (usersResult.status === 'fulfilled' && Array.isArray(usersResult.value)) {
        setUsers(usersResult.value.map(normalizeUserRecord));
      } else if (usersResult.status === 'rejected' && usersResult.reason?.status !== 403) {
        console.warn('Unable to load department users:', usersResult.reason);
      }
      if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value)) {
        setCourses(coursesResult.value);
      } else if (coursesResult.status === 'fulfilled' && Array.isArray(coursesResult.value?.courses)) {
        setCourses(coursesResult.value.courses.map((course) => ({
          ...course,
          id: course.id,
          code: course.code || course.course_code || '',
          name: course.name || course.course_name || '',
          creditHours: course.credits ?? course.credit_hours ?? course.creditHours ?? '0',
          departmentId: course.department_id || departmentId,
        })));
      } else if (coursesResult.status === 'rejected' && coursesResult.reason?.status !== 403) {
        console.warn('Unable to load department courses:', coursesResult.reason);
      }
      if (evaluationsResult.status === 'fulfilled' && Array.isArray(evaluationsResult.value)) {
        setEvaluations(evaluationsResult.value);
      }
      if (assignmentsResult.status === 'fulfilled' && Array.isArray(assignmentsResult.value)) {
        setAssignments(assignmentsResult.value);
      }
    } catch (error) {
      console.error('Unable to sync dashboard data', error);
    } finally {
      setLoadingData(false);
    }
  }, [departmentId, normalizeUserRecord]);

  const loadStudentTemplate = useCallback(async () => {
    try {
      const response = await evaluationApi.getLatestTemplate();
      let templateContent = '';
      if (response.template_data) {
        const templateData = typeof response.template_data === 'string' ? JSON.parse(response.template_data) : response.template_data;
        templateContent = templateData?.content ? String(templateData.content) : JSON.stringify(templateData, null, 2);
      }
      setStudentEvalTemplate(templateContent || 'Enter evaluation template details here.');
      setStudentEvalTemplateId(response.id);
    } catch (error) {
      console.warn('Unable to load evaluation template from backend:', error.message || error);
      setStudentEvalTemplate('Enter evaluation template details here.');
    }
  }, []);

  const loadDepartmentCourses = useCallback(async () => {
    setDepartmentCoursesLoading(true);
    try {
      const result = await departmentApi.getDepartmentCourses(departmentId);
      setCourses((Array.isArray(result?.courses) ? result.courses : []).map((course) => ({
        ...course,
        code: course.code || course.course_code || '',
        name: course.name || course.course_name || '',
        creditHours: course.credits ?? course.credit_hours ?? course.creditHours ?? '0',
        departmentId: course.department_id || departmentId,
      })));
    } catch (error) {
      console.error('Unable to load department courses:', error);
      setCourses([]);
    } finally {
      setDepartmentCoursesLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    const loadOverviewStats = async () => {
      try {
        const stats = await departmentApi.getOverview(departmentId);
        if (!cancelled) {
          setOverviewStats({
            totalInstructors: Number(stats?.totalInstructors || 0),
            totalStudents: Number(stats?.totalStudents || 0),
            totalCourses: Number(stats?.totalCourses || 0),
            activeAssignments: Number(stats?.activeAssignments || 0),
          });
        }
      } catch (error) {
        if (!cancelled && error?.status !== 403) console.warn('Unable to load overview stats:', error);
      }
    };
    void loadOverviewStats();
    return () => { cancelled = true; };
  }, [departmentId]);

  useEffect(() => {
    void loadDashboardData();
    void loadStudentTemplate();
  }, [loadDashboardData, loadStudentTemplate]);

  useEffect(() => {
    if (activeTab !== 'viewData' || !departmentId) return;
    let cancelled = false;
    const loadViewData = async () => {
      try {
        const result = viewDataTab === 'students'
          ? await departmentApi.getDepartmentStudents(departmentId)
          : await departmentApi.getDepartmentData(viewDataTab, departmentId);
        if (cancelled) return;
        setViewDataRows(Array.isArray(result) ? result : []);
        if (viewDataTab === 'instructors') setAssignmentInstructors(Array.isArray(result) ? result : []);
        if (viewDataTab === 'courses') setCourses(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled && error?.status !== 403) console.warn(`Unable to load ${viewDataTab}:`, error);
        if (!cancelled) setViewDataRows([]);
      }
    };
    void loadViewData();
    return () => { cancelled = true; };
  }, [activeTab, viewDataTab, departmentId]);

  const handleStudentFilterChange = (field) => (value) => {
    setStudentFilters((current) => ({ ...current, [field]: value }));
  };

  const handleStudentFilterReset = () => {
    setStudentFilters({ yearLevel: 'all', section: 'all' });
  };

  const sidebarItems = [
    { key: 'overview', label: '🏠 Overview', icon: FaShieldAlt },
    { key: 'courses', label: '📚 Course Registration', icon: FaBook },
    { key: 'viewData', label: '📊 View Data', icon: FaDatabase },
    { key: 'assignments', label: '📝 Course Assignments', icon: FaClipboardCheck },
    { key: 'publishEvaluation', label: '📣 Publish Evaluation Form', icon: FaBell },
    { key: 'evaluateInstructor', label: '📊 Evaluate Instructor', icon: FaGraduationCap },
    { key: 'tracking', label: '📋 Evaluation Tracking', icon: FaChartBar },
    { key: 'performanceDashboard', label: 'Performance Dashboard', icon: FaChartBar },
    { key: 'reports', label: '📈 View Department Reports', icon: FaChartBar },
  ];

  const tabTitleMap = {
    overview: 'Overview',
    courses: 'Course Registration',
    viewData: 'Department Data Hub',
    assignments: 'Course Assignments',
    evaluateInstructor: 'Evaluate Instructor',
    tracking: 'Evaluation Tracking',
    performanceDashboard: 'Performance Dashboard',
    reports: 'View Department Reports',
  };

  const normalizeCourseRecord = (course) => ({
    id: course.id,
    code: course.code || course.course_code || '',
    name: course.name || course.course_name || '',
    collegeId: course.collegeId || course.college_id || course.college || '',
    departmentId: course.departmentId || course.department_id || course.department || '',
    creditHours: course.creditHours || course.credit_hours || '3',
    semester: course.semester || '',
    registrationDate: course.registrationDate || course.registration_date || '',
    ...course,
  });

  const instructors = useMemo(() => (users || []).filter((user) => String(user.role).toLowerCase() === 'instructor'), [users]);
  const departmentStaff = useMemo(() => (users || []).filter((user) => (
    ['instructor', 'dept_head', 'college_dean', 'academic_directorate'].includes(String(user.role).toLowerCase())
      && String(user.departmentId || departmentId) === String(departmentId)
  )), [users, departmentId]);
  const students = useMemo(() => (users || []).filter((user) => String(user.role).toLowerCase() === 'student'), [users]);

  const handleTrackingFilterChange = (field) => (value) => {
    setTrackingFilters((current) => ({ ...current, [field]: value }));
  };

  const fetchStudentTracking = async () => {
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadStudentTracking({
        year_level: trackingFilters.year_level,
        section: trackingFilters.section,
        program_type: trackingFilters.program_type,
        instructor_id: trackingFilters.instructor_id || undefined,
      });
      setStudentTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage('No student evaluation rows matched the selected filters.');
      }
    } catch (error) {
      console.error('Student tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load student tracking data.');
      setStudentTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchPeerTracking = async () => {
    if (!peerTrackingInstructor) {
      setTrackingMessage('Please select an instructor first.');
      return;
    }
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadPeerTracking({ target_instructor_id: peerTrackingInstructor });
      setPeerTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage('No peer evaluation rows found for this instructor.');
      }
    } catch (error) {
      console.error('Peer tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load peer tracking data.');
      setPeerTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const fetchDeptHeadTracking = async () => {
    if (!deptTrackingInstructor) {
      setTrackingMessage('Please select an instructor first.');
      return;
    }
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const rows = await evaluationApi.getDeptHeadDeptHeadTracking({ instructor_id: deptTrackingInstructor });
      setDeptTrackingRows(Array.isArray(rows) ? rows : []);
      if (!rows || rows.length === 0) {
        setTrackingMessage('No department head evaluation rows found for this instructor.');
      }
    } catch (error) {
      console.error('Dept head tracking fetch failed:', error);
      setTrackingMessage(error.message || 'Unable to load department head tracking data.');
      setDeptTrackingRows([]);
    } finally {
      setTrackingLoading(false);
    }
  };

  const sendEvaluationReminder = async (evaluatorId = null, evaluationType = null, name = null) => {
    setReminderSending(true);
    setReminderTarget(evaluatorId ? String(evaluatorId) : 'all');
    try {
      const result = await evaluationApi.sendReminder(evaluatorId
        ? { target_id: evaluatorId, evaluation_type: evaluationType, department_id: departmentId }
        : { send_to_all_pending: true, department_id: departmentId });
      toast.success(evaluatorId ? `Reminder sent successfully to ${name || 'the pending evaluator'}.` : `Reminders sent to ${result?.sent || 0} pending evaluators.`);
    } catch (error) {
      toast.error(error?.message || 'Unable to send evaluation reminder.');
    } finally {
      setReminderSending(false);
      setReminderTarget('');
    }
  };

  const loadDeptHeadInstructors = useCallback(async () => {
    if (!departmentId) return;
    setDeptEvalLoading(true);
    try {
      const data = await evaluationApi.getDeptHeadInstructors({ department_id: departmentId });
      // API returns an array of instructors
      setDeptInstructorsList(Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : data || []));
    } catch (error) {
      if (error?.status !== 403) console.error('Unable to load dept head instructors:', error);
      setDeptInstructorsList([]);
      if (error?.status !== 403) toast.error(error?.message || 'Unable to load instructors.');
    } finally {
      setDeptEvalLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    if (activeTab === 'evaluateInstructor') {
      void loadDeptHeadInstructors();
    }
  }, [activeTab, loadDeptHeadInstructors]);

  const publishFinalResults = async () => {
    setTrackingLoading(true);
    setTrackingMessage('');
    try {
      const result = await evaluationApi.calculatePublishFinalResults({
        department_id: departmentId,
        academic_year: reportAcademicYear || String(new Date().getFullYear()),
        semester: reportSemester || 'Semester I',
      });
      setTrackingMessage('Final results have been calculated and published successfully.');
      console.log('Publish result', result);
    } catch (error) {
      console.error('Calculate publish failed:', error);
      setTrackingMessage(error.message || 'Unable to calculate and publish final results.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const statusBadge = (status) => {
    const normalized = String(status || '').toLowerCase();
    const isSubmitted = normalized === 'submitted' || normalized === 'completed';
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {isSubmitted ? 'Submitted' : status || 'Pending'}
      </span>
    );
  };

  const handleOpenEvaluationModal = (inst) => {
    setSelectedDeptInstructor(inst);
    setDeptEvalError('');
    // Initialize criteria scores from existing data if available
    const existingScores = inst?.criteria_scores || {};
    setDeptEvalCriteriaScores(existingScores);
    setShowDeptEvalModal(true);
  };

  const handleSubmitDeptEval = async (criteriaScores, totalScore) => {
    if (!selectedDeptInstructor) return;
    
    setDeptEvalSubmitting(true);
    setDeptEvalError('');
    try {
      const payload = {
        evaluator_id: user?.id || user?.user_id,
        instructor_id: selectedDeptInstructor.instructor_id || selectedDeptInstructor.id,
        department_id: departmentId,
        criteria_scores: criteriaScores,
        total_score: totalScore,
      };
      const result = await evaluationApi.submitDeptHeadEvaluation(payload);
      toast.success('Evaluation submitted successfully.');
      // update local list
      setDeptInstructorsList((current) => current.map((item) => (String(item.instructor_id) === String(selectedDeptInstructor.instructor_id) ? { ...item, evaluation_status: 'Submitted', total_score: totalScore, criteria_scores: criteriaScores } : item)));
      setShowDeptEvalModal(false);
      setDeptEvalCriteriaScores({});
    } catch (error) {
      console.error('Submit dept eval failed:', error);
      setDeptEvalError(error?.message || 'Unable to submit evaluation.');
    } finally {
      setDeptEvalSubmitting(false);
    }
  };

  const handleViewEvaluation = (instructor) => {
    // Parse criteria_scores if it's a JSON string
    let criteriaScores = instructor.criteria_scores;
    if (typeof criteriaScores === 'string') {
      try {
        criteriaScores = JSON.parse(criteriaScores);
      } catch (e) {
        criteriaScores = {};
      }
    }
    
    setSelectedEvaluation({
      ...instructor,
      criteria_scores: criteriaScores || {}
    });
    setShowEvaluationBreakdown(true);
  };

  const handleEditEvaluation = () => {
    // Switch to edit mode in the criteria modal
    setShowEvaluationBreakdown(false);
    setSelectedDeptInstructor(selectedEvaluation);
    setDeptEvalCriteriaScores(selectedEvaluation.criteria_scores || {});
    setShowDeptEvalModal(true);
  };

  const evaluationSummary = useMemo(() => {
    const total = evaluations.length;
    const completed = evaluations.reduce((sum, item) => sum + item.completed, 0);
    const pending = evaluations.reduce((sum, item) => sum + item.pending, 0);
    const avgScore = total ? evaluations.reduce((sum, item) => sum + item.averageScore, 0) / total : 0;
    const needsAction = evaluations.filter((item) => item.status === 'Needs follow-up');
    return {
      total,
      completed,
      pending,
      avgScore: avgScore.toFixed(1),
      needsActionCount: needsAction.length,
      topInstructor: evaluations.sort((a, b) => b.averageScore - a.averageScore)[0]?.instructorName ?? '—',
    };
  }, [evaluations]);

  const departmentInstructors = useMemo(
    () => (instructors || []).filter((instructor) => String(instructor.departmentId) === String(departmentId)),
    [instructors, departmentId]
  );

  const departmentCourses = useMemo(
    () => (courses || []).filter((course) => String(course.departmentId || course.department_id) === String(departmentId)),
    [courses, departmentId]
  );

  const departmentAssignments = useMemo(
    () => (assignments || []).filter((assignment) => String(assignment.department_id || assignment.departmentId || departmentId) === String(departmentId)),
    [assignments, departmentId]
  );

  const activeAssignmentsCount = useMemo(
    () => (departmentAssignments || []).filter((assignment) =>
      ['1', 1, true].includes(assignment.is_published) || String(assignment.status).toLowerCase() === 'assigned'
    ).length,
    [departmentAssignments]
  );

  const departmentReportRows = useMemo(() => (departmentInstructors || []).map((instructor) => {
    const matchingEvaluations = evaluations.filter((evaluation) => String(evaluation.instructor_id || evaluation.instructorId || evaluation.target_instructor_id || '') === String(instructor.id));
    const evaluation = matchingEvaluations[0] || {};
    const studentScore = Number(evaluation.student_score ?? evaluation.studentScore ?? evaluation.student_average ?? 0);
    const peerScore = Number(evaluation.peer_score ?? evaluation.peerScore ?? evaluation.peer_average ?? 0);
    const deptHeadScore = Number(evaluation.dept_head_score ?? evaluation.deptHeadScore ?? evaluation.department_score ?? evaluation.score ?? 0);
    const finalScore = Number(evaluation.total_score ?? evaluation.final_score ?? (studentScore + peerScore + deptHeadScore));
    return {
      id: instructor.id,
      instructorName: instructor.fullName || instructor.username || 'Unknown Instructor',
      employeeId: instructor.employeeId || instructor.employee_id || 'N/A',
      studentScore,
      peerScore,
      deptHeadScore,
      finalScore,
      status: evaluation.status === 'Completed' || evaluation.status === 'Submitted' || finalScore > 0 ? 'Completed' : 'Pending',
    };
  }), [departmentInstructors, evaluations]);

  const reportSummary = useMemo(() => {
    const total = departmentReportRows.length;
    const completed = departmentReportRows.filter((row) => row.status === 'Completed').length;
    const scores = departmentReportRows.map((row) => row.finalScore).filter((score) => score > 0);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const highest = departmentReportRows.reduce((best, row) => row.finalScore > (best?.finalScore || 0) ? row : best, null);
    const lowest = departmentReportRows.filter((row) => row.finalScore > 0).reduce((worst, row) => !worst || row.finalScore < worst.finalScore ? row : worst, null);
    return { total, completed, pending: total - completed, average, highest, lowest };
  }, [departmentReportRows]);

  const urgentReminders = useMemo(() => {
    const reminders = [];
    const overdueEvaluations = evaluations.filter((item) => item.pending > 0);
    if (overdueEvaluations.length) {
      reminders.push({ id: 'eval-pending', label: `${overdueEvaluations.length} instructors have pending evaluation follow-up`, severity: 'high' });
    }
    if (Number(evaluationSummary.avgScore) < 4.5) {
      reminders.push({ id: 'low-score', label: 'Average evaluation score is under the target threshold', severity: 'medium' });
    }
    if (!courses.length) {
      reminders.push({ id: 'no-courses', label: 'No courses are currently registered for your department', severity: 'high' });
    }
    return reminders;
  }, [courses.length, evaluations, evaluationSummary.avgScore]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [assignmentStep, setAssignmentStep] = useState(1);
  const programTypeOptions = ['Regular', 'Extension'];
  const yearLevelOptions = ['1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'];
  const [assignmentDraft, setAssignmentDraft] = useState({ courseId: '', instructorId: '', section: '', semester: '', programType: '', yearLevel: '' });
  const [publishTarget, setPublishTarget] = useState('both');
  const MAX_CREDIT_LOAD = 12;

  useEffect(() => {
    const shouldLoad = showAssignModal || (activeTab === 'viewData' && viewDataTab === 'instructors');
    if (!shouldLoad || !departmentId) return;
    let cancelled = false;
    const loadAssignmentInstructors = async () => {
      try {
        const result = await courseAssignmentApi.getDepartmentInstructors(departmentId);
        if (!cancelled) setAssignmentInstructors(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled && error?.status !== 403) console.warn('Unable to load assignment instructors:', error);
        if (!cancelled) setAssignmentInstructors([]);
      }
    };
    void loadAssignmentInstructors();
    return () => { cancelled = true; };
  }, [showAssignModal, activeTab, viewDataTab, departmentId]);

  const displayEvaluations = useMemo(() => {
    const grouped = new Map();
    submissions
      .filter((submission) => submission.submitterRole === 'student')
      .forEach((submission) => {
        const instructorName = submission.formResponse?.instructor || 'Unassigned Instructor';
        const courseCode = submission.formResponse?.course || 'N/A';
        const score = Number(submission.formResponse?.score);

        if (!grouped.has(instructorName)) {
          grouped.set(instructorName, {
            id: instructorName,
            instructorName,
            courseCode,
            courseName: courseCode,
            completed: 0,
            pending: 0,
            averageScore: 0,
            status: 'New submission',
          });
        }

        const entry = grouped.get(instructorName);
        entry.completed += 1;
        entry.courseCode = courseCode;
        entry.courseName = courseCode;
        if (Number.isFinite(score)) {
          entry.averageScore += score;
        }
      });

    if (grouped.size === 0) {
      return evaluations;
    }

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        averageScore: entry.completed ? Number((entry.averageScore / entry.completed).toFixed(1)) : 0,
        pending: 0,
        status: entry.completed ? 'New submission' : 'Awaiting',
      }))
      .sort((a, b) => b.completed - a.completed);
  }, [evaluations, submissions]);


  const handleSendStudentEvaluation = async () => {
    const selectedCourseData = courses.find((course) => String(course.id) === String(studentEvalForm.courseId));
    const studentIdentifierText = studentEvalForm.studentId || studentEvalForm.studentGroup || '';

    if (!studentEvalForm.academicYear || !studentEvalForm.semester || !studentEvalForm.yearLevel || !studentEvalForm.courseId) {
      toast.error('Please fill all required student evaluation dispatch fields.');
      return;
    }

    const payload = {
      template_id: studentEvalTemplateId,
      student_id: null,
      student_identifier: studentEvalForm.studentId || null,
      student_group: studentEvalForm.studentGroup || null,
      course_code: selectedCourseData?.code || '',
      course_name: selectedCourseData?.name || '',
      academic_year: studentEvalForm.academicYear,
      semester: studentEvalForm.semester,
      year_level: studentEvalForm.yearLevel,
      student_identifier_text: studentIdentifierText,
      payload: studentEvalForm,
    };

    try {
      const dispatchResponse = await evaluationApi.dispatchStudentEvaluation(payload);
      setFormNotification(`Student evaluation dispatched (${dispatchResponse.id})`);
      setShowStudentModal(false);
      setTimeout(() => setFormNotification(''), 5000);
    } catch (error) {
      console.error('Unable to dispatch student evaluation:', error);
      toast.error(error.message || 'Unable to send student evaluation.');
    }
  };

  const handleSendInstructorEvaluation = async () => {
    try {
      const payload = {
        template_id: null,
        student_id: null,
        student_identifier: null,
        course_id: null,
        course_name: '',
        academic_year: instructorEvalForm.academicYear || '',
        semester: instructorEvalForm.semester || '',
        year_level: '',
        student_group: 'instructor',
        created_by: currentUser?.id || null,
        payload: instructorEvalForm,
      };
      const dispatchResponse = await evaluationApi.dispatchStudentEvaluation(payload);
      setFormNotification(`Peer review dispatched (${dispatchResponse.id})`);
      setShowInstructorModal(false);
      setTimeout(() => setFormNotification(''), 5000);
    } catch (error) {
      console.error('Unable to dispatch peer review:', error);
      toast.error(error.message || 'Unable to dispatch peer review.');
    }
  };

  // Assignment helper functions
  const getInstructorAssignedCredits = (instructorId) => {
    return assignments.reduce((sum, a) => (String(a.instructor_id) === String(instructorId) ? sum + Number(a.creditHours || 0) : sum), 0);
  };

  const checkQualification = (instructorId, courseId) => {
    const ins = users.find((u) => String(u.id) === String(instructorId));
    const c = courses.find((x) => String(x.id) === String(courseId));
    if (!ins || !c) return false;
    const spec = (ins.specialization || '').toLowerCase();
    const courseName = (c.name || '').toLowerCase();
    const deptMatch = String(ins.departmentId || '') === String(c.departmentId || '');
    const specMatch = spec && courseName ? spec.includes(courseName.split(' ')[0]) : false;
    return deptMatch || specMatch;
  };

  const canSubmitAssignment = () => {
    const { courseId, instructorId, section, semester, programType, yearLevel } = assignmentDraft;
    return Boolean(courseId && instructorId && programType && yearLevel && semester && section);
  };

  const handleConfirmAssignment = () => {
    if (!canSubmitAssignment()) {
      toast.error('Please complete all assignment fields before confirming.');
      return;
    }

    setShowPublishModal(true);
  };

  const handleFinalPublishSubmit = async () => {
    const { courseId, instructorId, section, semester, programType, yearLevel } = assignmentDraft;
    if (!courseId || !instructorId || !semester || !section) {
      toast.error('Please select course, instructor, semester, and section.');
      return;
    }

    const course = courses.find((c) => String(c.id) === String(courseId));
    const creditHours = Number(course?.creditHours || 0);
    const currentLoad = getInstructorAssignedCredits(instructorId);
    const willExceed = currentLoad + creditHours > MAX_CREDIT_LOAD;

    if (willExceed) {
      toast.error('Assignment failed validation. Fix the warning before publishing.');
      return;
    }

    try {
      const created = await courseAssignmentApi.createDeptHeadAssignment({
        department_id: Number(departmentId) || undefined,
        course_id: Number(courseId),
        instructor_id: Number(instructorId),
        program_type: programType,
        year_level: yearLevel,
        semester,
        section,
        publish_target: publishTarget,
        is_published: true,
        academic_year: '2026',
      });

      const newAssignment = {
        id: created.id,
        course_id: courseId,
        course_name: course?.name || '',
        instructor_id: instructorId,
        instructor_name: users.find((u) => String(u.id) === String(instructorId))?.fullName || '',
        section,
        semester,
        creditHours,
        program_type: programType,
        year_level: yearLevel,
        publish_target: publishTarget,
        status: 'Assigned',
      };

      setAssignments((s) => [newAssignment, ...s]);
      setShowAssignModal(false);
      setShowPublishModal(false);
      setAssignmentDraft({ courseId: '', instructorId: '', section: '', semester: '', programType: '', yearLevel: '' });
      setPublishTarget('both');
      toast.success('Course assignment published successfully.');
    } catch (error) {
      console.error('Unable to submit assignment:', error);
      toast.error(error.message || 'Unable to persist course assignment.');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Delete this course assignment?')) return;
    try {
      await courseAssignmentApi.deleteAssignment(assignmentId);
      setAssignments((current) => current.filter((assignment) => String(assignment.id) !== String(assignmentId)));
      toast.success('Course assignment deleted successfully.');
    } catch (error) {
      toast.error(error?.message || 'Unable to delete course assignment.');
    }
  };



  const handleEditUser = (user) => {
    if (user.role === 'Instructor') {
      toast('Instructor editing is not available in this dashboard.');
      setActiveTab('viewData');
      setViewDataTab('instructors');
    } else {
      toast('Student editing is not available in this dashboard.');
      setActiveTab('viewData');
      setViewDataTab('students');
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await registrationApi.deleteUser(userId);
      setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));
      toast.success('User deleted successfully.');
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Unable to delete the user.');
    }
  };

  const handleCourseSubmit = async (event) => {
    event.preventDefault();
    const name = courseForm.name.trim();
    const code = courseForm.code.trim();
    if (!name || !code) {
      toast.error('Please enter the course name and course code.');
      return;
    }
    const duplicate = courses.some((course) => String(course.code || course.course_code || '').toLowerCase() === code.toLowerCase());
    if (duplicate) {
      toast.error('This course code is already registered.');
      return;
    }
    const payload = {
      course_code: code,
      course_name: name,
      department_id: departmentId,
      year_level: courseForm.yearLevel,
      semester: courseForm.semester,
      credit_hours: Number(courseForm.creditHours),
    };
    try {
      const result = await registrationApi.createCourse(payload);
      setCourses((current) => [normalizeCourseRecord({ ...payload, ...result, id: result.id }), ...current]);
      setCourseForm({ name: '', code: '', yearLevel: '', semester: '', creditHours: '' });
      toast.success('Course registered successfully.');
    } catch (error) {
      console.error('Unable to save course:', error);
      toast.error(error?.message || 'Unable to register course.');
    }
  };

  const handleCourseCsvUpload = async () => {
    if (!courseCsvFile) {
      toast.error('Please choose a CSV file before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('file', courseCsvFile);
    formData.append('department_id', departmentId);
    setCourseCsvUploading(true);
    try {
      const result = await registrationApi.bulkUploadCourses(formData);
      const createdCourses = Array.isArray(result?.courses) ? result.courses : [];
      setCourses((current) => [...createdCourses.map(normalizeCourseRecord), ...current]);
      setCourseCsvFile(null);
      toast.success(`Course upload complete. Created ${result?.created || createdCourses.length} course(s).`);
    } catch (error) {
      toast.error(error?.message || 'Unable to upload courses.');
    } finally {
      setCourseCsvUploading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'performanceDashboard':
        return <DeptHeadPerformanceDashboard />;
      case 'courses':
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:flex-row">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Bulk Upload Courses (CSV)</h4>
                <p className="text-xs text-gray-500">Upload CSV with headers: course_name, course_code, credit_hours, year_level, semester</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" accept=".csv" onChange={(event) => setCourseCsvFile(event.target.files?.[0] || null)} className="text-xs text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-blue-700" />
                <button type="button" onClick={handleCourseCsvUpload} disabled={courseCsvUploading || !courseCsvFile} className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60">
                  {courseCsvUploading ? 'Uploading...' : 'Upload CSV'}
                </button>
              </div>
            </div>
            <form onSubmit={handleCourseSubmit} className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900">Course Registration</h3>
                <p className="mt-1 text-sm text-slate-500">Register and maintain courses for {currentUser?.department_name || currentUser?.department || 'your department'}.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Course Name <span className="text-red-600">*</span></span>
                  <input value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter course name" required />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Course Code <span className="text-red-600">*</span></span>
                  <input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter course code" required />
                </label>
                <label className="block"><span className="text-sm font-medium text-slate-700">Credit Hours / ECTS <span className="text-red-600">*</span></span><input type="number" min="1" step="1" value={courseForm.creditHours} onChange={(event) => setCourseForm({ ...courseForm, creditHours: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" placeholder="3" required /></label>
              </div>
              <div className="mt-0 grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block"><span className="text-sm font-medium text-slate-700">Year Level <span className="text-red-600">*</span></span><select value={courseForm.yearLevel} onChange={(event) => setCourseForm({ ...courseForm, yearLevel: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" required><option value="">Select year level</option>{[1, 2, 3, 4, 5].map((year) => <option key={year} value={`Year ${year}`}>Year {year}</option>)}</select></label>
                <label className="block"><span className="text-sm font-medium text-slate-700">Semester <span className="text-red-600">*</span></span><select value={courseForm.semester} onChange={(event) => setCourseForm({ ...courseForm, semester: event.target.value })} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" required><option value="">Select semester</option><option value="Semester I">Semester I</option><option value="Semester II">Semester II</option></select></label>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">Register Course</button>
              </div>
            </form>
          </div>
        );
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Total Instructors</p>
                  <FaUsers className="text-blue-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800">{overviewStats.totalInstructors}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Total Students</p>
                  <FaGraduationCap className="text-green-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800">{overviewStats.totalStudents}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Total Courses</p>
                  <FaBook className="text-indigo-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800">{overviewStats.totalCourses}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Active Assignments</p>
                  <FaClipboardCheck className="text-purple-500" />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800">{overviewStats.activeAssignments}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Open evaluations</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{displayEvaluations.length}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Average score</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{displayEvaluations.length ? (displayEvaluations.reduce((sum, item) => sum + item.averageScore, 0) / displayEvaluations.length).toFixed(1) : '0.0'}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Pending review items</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{displayEvaluations.reduce((sum, item) => sum + item.pending, 0)}</p>
              </div>
            </div>
          </div>
        );
      case 'viewData':
        return (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setViewDataTab('instructors')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'instructors'
                    ? 'border border-ieps-blue-200 bg-white text-ieps-blue-600 shadow-md'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaChalkboardTeacher />
                Instructors
              </button>
              <button
                type="button"
                onClick={() => setViewDataTab('students')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'students'
                    ? 'border border-ieps-blue-200 bg-white text-ieps-blue-600 shadow-md'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaUsers />
                Students
              </button>
              <button
                type="button"
                onClick={() => setViewDataTab('courses')}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  viewDataTab === 'courses'
                    ? 'border border-ieps-blue-200 bg-white text-ieps-blue-600 shadow-md'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                }`}
              >
                <FaBook />
                Courses
              </button>
            </div>

            {/* Tab Content */}
            {viewDataTab === 'instructors' && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">Department Instructors</h3>
                  <p className="text-sm text-gray-500">Instructors loaded from the department database.</p>
                </div>
                {viewDataRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">No instructors registered for your department yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600"><tr><th className="px-4 py-3 font-semibold">ID</th><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Employee ID</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewDataRows.map((instructor) => (
                          <tr key={instructor.id || instructor.instructor_id} className="hover:bg-gray-50"><td className="px-4 py-3">{instructor.id || instructor.instructor_id}</td><td className="px-4 py-3 font-medium text-gray-800">{instructor.instructor_name || instructor.name || instructor.fullName || instructor.username || instructor.email}</td><td className="px-4 py-3">{instructor.email || instructor.username || '-'}</td><td className="px-4 py-3">{instructor.employee_id || instructor.employeeId || '-'}</td><td className="px-4 py-3">Active</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {viewDataTab === 'students' && (
              <div>
                <StudentsSection departmentId={departmentId} initialStudents={viewDataRows} />
              </div>
            )}

            {viewDataTab === 'courses' && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Department Courses</h3>
                    <p className="text-sm text-gray-500">All courses assigned to your department.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadDepartmentCourses()}
                    className="inline-flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Refresh courses
                  </button>
                </div>

                {departmentCoursesLoading ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
                    Loading department courses…
                  </div>
                ) : departmentCourses.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
                    No courses registered for your department yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">Course Code</th>
                          <th className="px-4 py-3 font-semibold">Course Name</th>
                          <th className="px-4 py-3 font-semibold">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {departmentCourses.map((course, index) => {
                          const normalized = normalizeCourseRecord(course);
                          return (
                            <tr key={course.id || `${course.course_code}-${index}`} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-700">{index + 1}</td>
                              <td className="px-4 py-3 text-gray-700">{normalized.code}</td>
                              <td className="px-4 py-3 text-gray-700">{normalized.name}</td>
                              <td className="px-4 py-3 text-gray-700">{normalized.departmentName || course.department_name || 'Unknown'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'assignments':
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Course assignment center</h2>
                <p className="text-sm text-gray-500">Assign instructors to courses and track conflicts from one place.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Assign a course
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Assigned courses</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{assignments.length}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Available instructors</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{instructors.length}</p>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Available courses</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{courses.length}</p>
              </div>
            </div>
            {assignments.length ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">Assigned course log</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-2">Course</th>
                        <th className="py-2">Instructor</th>
                        <th className="py-2">Section</th>
                        <th className="py-2">Semester</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((assignment) => {
                        const course = courses.find((c) => String(c.id) === String(assignment.course_id));
                        const user = users.find((u) => String(u.id) === String(assignment.instructor_id));
                        return (
                          <tr key={assignment.id} className="border-b border-gray-50">
                            <td className="py-2">{course ? `${course.code || course.name} · ${course.name}` : assignment.course_id}</td>
                            <td className="py-2">{user?.fullName || assignment.instructor_name || assignment.instructor_id}</td>
                            <td className="py-2">{assignment.section}</td>
                            <td className="py-2">{assignment.semester}</td>
                            <td className="py-2"><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{assignment.status}</span></td>
                            <td className="py-2"><button type="button" onClick={() => handleDeleteAssignment(assignment.id)} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">No course assignments have been created for this department yet.</div>
            )}
          </div>
        );
      case 'publishEvaluation':
        return <PublishEvaluation departmentId={departmentId} />;
      case 'evaluateInstructor':
        return (
          <div className="space-y-6">
            <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">INSTRUCTOR</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DEADLINE</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {deptEvalLoading ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">Loading instructors…</td>
                    </tr>
                  ) : deptInstructorsList.length ? (
                    deptInstructorsList.map((inst) => (
                      <tr key={inst.instructor_id}>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{inst.instructor_name || inst.fullName || inst.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">{inst.deadline || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {String((inst.evaluation_status || '').toLowerCase()) === 'submitted' ? (
                            <div className="flex items-center gap-3">
                              <span className="text-green-600 font-medium">✓ Evaluated ({inst.total_score}/100)</span>
                              <button
                                type="button"
                                onClick={() => handleViewEvaluation(inst)}
                                className="text-ieps-blue-600 hover:text-ieps-blue-900 font-semibold text-sm underline"
                              >
                                View Details
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluationModal(inst)}
                              className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 font-semibold"
                            >
                              ★ Evaluate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">No instructors found for your department.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {showDeptEvalModal && selectedDeptInstructor ? (
              <InstructorEvaluationCriteriaModal
                open={showDeptEvalModal}
                onClose={() => {
                  setShowDeptEvalModal(false);
                  setDeptEvalCriteriaScores({});
                }}
                instructorName={selectedDeptInstructor.instructor_name}
                criteriaScores={deptEvalCriteriaScores}
                setCriteriaScores={setDeptEvalCriteriaScores}
                onSubmit={handleSubmitDeptEval}
                isSubmitting={deptEvalSubmitting}
                mode="edit"
              />
            ) : null}

            {showEvaluationBreakdown && selectedEvaluation ? (
              <EvaluationBreakdownModal
                open={showEvaluationBreakdown}
                onClose={() => {
                  setShowEvaluationBreakdown(false);
                  setSelectedEvaluation(null);
                }}
                instructorName={selectedEvaluation.instructor_name}
                criteriaScores={selectedEvaluation.criteria_scores || {}}
                totalScore={selectedEvaluation.total_score || 0}
                onEdit={handleEditEvaluation}
                submittedDate={selectedEvaluation.created_at || selectedEvaluation.updated_at}
              />
            ) : null}
          </div>
        );
      case 'tracking':
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Evaluation Tracking</h2>
                <p className="mt-1 text-sm text-gray-500">Monitor pending and completed evaluation forms.</p>
              </div>
              <button type="button" onClick={() => sendEvaluationReminder()} disabled={reminderSending} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {reminderSending && reminderTarget === 'all' ? 'Sending…' : '🔔 Send Reminder to All Pending'}
              </button>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-3">
                {['student', 'peer', 'dept_head'].map((view) => {
                  const label = view === 'student' ? 'Student' : view === 'peer' ? 'Peer' : 'Dept Head';
                  const isSelected = trackingView === view;
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() => { setTrackingView(view); setTrackingMessage(''); }}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${isSelected ? 'bg-ieps-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                {trackingView === 'student' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">Year Level</span>
                      <select value={trackingFilters.year_level} onChange={(e) => handleTrackingFilterChange('year_level')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Years', '1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'].map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">Section</span>
                      <select value={trackingFilters.section} onChange={(e) => handleTrackingFilterChange('section')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Sections', 'Section A', 'Section B', 'Section C', 'Section D', 'Section E', 'Section F', 'Section G', 'Section H', 'Section I', 'Section J', 'Section K', 'Section L'].map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">Program Type</span>
                      <select value={trackingFilters.program_type} onChange={(e) => handleTrackingFilterChange('program_type')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        {['All Programs', 'Regular', 'Extension', 'Summer'].map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">Target Instructor</span>
                      <select value={trackingFilters.instructor_id} onChange={(e) => handleTrackingFilterChange('instructor_id')(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">Select Instructor</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                  </>
                )}

                {trackingView === 'peer' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">Target Instructor</span>
                      <select value={peerTrackingInstructor} onChange={(e) => setPeerTrackingInstructor(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">Select Instructor</option>
                        {departmentStaff.filter((staff) => String(staff.role).toLowerCase() === 'instructor').map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName || staff.username}</option>)}
                      </select>
                    </label>
                    <div className="md:col-span-1" />
                  </>
                )}

                {trackingView === 'dept_head' && (
                  <>
                    <label className="space-y-2 text-sm text-gray-700 md:col-span-2">
                      <span className="font-semibold">Instructor</span>
                      <select value={deptTrackingInstructor} onChange={(e) => setDeptTrackingInstructor(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-ieps-blue-500 focus:ring-2 focus:ring-ieps-blue-100">
                        <option value="">Select Instructor</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <div className="md:col-span-1" />
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">{trackingMessage || 'Use filters and click Fetch Data to display evaluation tracking rows.'}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (trackingView === 'student') fetchStudentTracking();
                    if (trackingView === 'peer') fetchPeerTracking();
                    if (trackingView === 'dept_head') fetchDeptHeadTracking();
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-ieps-blue-700"
                >
                  {trackingLoading ? 'Fetching…' : 'Fetch Data'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm overflow-x-auto">
              {trackingView === 'student' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {studentTrackingRows.length ? studentTrackingRows.map((row, index) => (
                      <tr key={`${row.student_db_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{index + 1}</td>
                        <td className="px-4 py-4 text-gray-700">{row.student_name}</td>
                        <td className="px-4 py-4 font-medium">
                          <span className={['submitted', 'completed', 'evaluated'].includes(String(row.status).toLowerCase()) ? 'text-green-600' : 'text-red-600'}>
                            {['submitted', 'completed', 'evaluated'].includes(String(row.status).toLowerCase()) ? '🟢 Completed' : '🔴 Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4">{['submitted', 'completed', 'evaluated'].includes(String(row.status).toLowerCase()) ? <span className="text-xs font-semibold text-gray-400">Done</span> : <button type="button" onClick={() => sendEvaluationReminder(row.evaluator_id, 'student', row.student_name)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending && reminderTarget === String(row.evaluator_id) ? 'Sending…' : '🔔 Remind'}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">No student evaluation tracking results available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {trackingView === 'peer' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Peer Instructor</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {peerTrackingRows.length ? peerTrackingRows.map((row, index) => (
                      <tr key={`${row.evaluator_name}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{index + 1}</td>
                        <td className="px-4 py-4 text-gray-700">{row.peer_instructor}</td>
                        <td className="px-4 py-4 font-medium">
                          <span className={row.status === 'Submitted' ? 'text-green-600' : 'text-red-600'}>
                            {row.status === 'Submitted' ? '🟢 Submitted' : '🔴 Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4">{row.status === 'Submitted' ? <span className="text-xs font-semibold text-gray-400">Done</span> : <button type="button" onClick={() => sendEvaluationReminder(row.evaluator_id, 'peer', row.peer_instructor)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending && reminderTarget === String(row.evaluator_id) ? 'Sending…' : '🔔 Remind'}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">No peer evaluation tracking results available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {trackingView === 'dept_head' && (
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Instructor Name</th>
                      <th className="px-4 py-3 font-semibold">Department Head Score</th>
                      <th className="px-4 py-3 font-semibold">Evaluation Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptTrackingRows.length ? deptTrackingRows.map((row, index) => (
                      <tr key={`${row.instructor_id}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-gray-700">{row.instructor_name}</td>
                        <td className="px-4 py-4 text-gray-700">{row.score ?? 0} / 100</td>
                        <td className="px-4 py-4">{statusBadge(row.status)}</td>
                        <td className="px-4 py-4">{String(row.status).toLowerCase() === 'submitted' ? <span className="text-xs font-semibold text-gray-400">Done</span> : <button type="button" onClick={() => sendEvaluationReminder(currentUser.id, 'dept_head', row.instructor_name)} disabled={reminderSending} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{reminderSending ? 'Sending…' : '🔔 Remind'}</button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-500">No department head evaluation tracking results available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="sticky bottom-0 left-0 right-0 z-20 rounded-t-3xl border-t border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-500">Calculate weights and publish final final results for all department instructors.</p>
                <button type="button" onClick={publishFinalResults} className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                  {trackingLoading ? 'Publishing…' : 'Calculate & Publish Final Results'}
                </button>
              </div>
            </div>
          </div>
        );
      case 'reports':
        return (
          <div id="department-reports" className="space-y-6 print:space-y-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start print:hidden">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Department Reports</h2>
                <p className="mt-1 text-sm text-gray-500">Overview of instructor evaluation results and performance in your department.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🖨️ Print Report</button>
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">📥 Export to PDF</button>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-end">
              <label className="flex-1 text-sm font-medium text-gray-700">Department
                <input value={currentUser?.department_name || currentUser?.department || departmentId || ''} readOnly className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none" />
              </label>
              <label className="flex-1 text-sm font-medium text-gray-700">Academic Year
                <select value={reportAcademicYear} onChange={(event) => setReportAcademicYear(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"><option>2025/2026</option><option>2024/2025</option><option>2026/2027</option></select>
              </label>
              <label className="flex-1 text-sm font-medium text-gray-700">Semester
                <select value={reportSemester} onChange={(event) => setReportSemester(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"><option>Semester I</option><option>Semester II</option></select>
              </label>
              <button type="button" onClick={() => void loadDashboardData()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">👁️ View Report</button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              {[
                ['Total Instructors', reportSummary.total, 'In this Department', 'text-blue-600'],
                ['Evaluations Completed', reportSummary.completed, `${reportSummary.total ? Math.round((reportSummary.completed / reportSummary.total) * 100) : 0}% Completed`, 'text-emerald-600'],
                ['Pending Evaluations', reportSummary.pending, `${reportSummary.total ? Math.round((reportSummary.pending / reportSummary.total) * 100) : 0}% Pending`, 'text-orange-600'],
                ['Department Average Score', reportSummary.average.toFixed(2), 'Out of 100', 'text-blue-600'],
                ['Highest Score', reportSummary.highest?.finalScore?.toFixed(2) || '0.00', reportSummary.highest?.instructorName || 'No completed evaluations', 'text-emerald-600'],
                ['Lowest Score', reportSummary.lowest?.finalScore?.toFixed(2) || '0.00', reportSummary.lowest?.instructorName || 'No completed evaluations', 'text-orange-600'],
              ].map(([label, value, subtext, color]) => (
                <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
                  <p className="mt-1 text-xs text-gray-500">{subtext}</p>
                </div>
              ))}
            </div>

            <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-5 md:flex-row md:items-center">
                <div><h3 className="text-lg font-semibold text-gray-900">📘 Instructor Evaluation Summary</h3><p className="mt-1 text-sm text-gray-500">Final calculated results for all instructors in this department.</p></div>
                <button type="button" onClick={() => void loadDashboardData()} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">🔄 Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Instructor Name</th><th className="px-4 py-3">Employee ID</th><th className="px-4 py-3">Student (50%)</th><th className="px-4 py-3">Peer (20%)</th><th className="px-4 py-3">Dept Head (30%)</th><th className="px-4 py-3">Final Score (100%)</th><th className="px-4 py-3">Performance Level</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {departmentReportRows.length ? departmentReportRows.map((row, index) => {
                      const level = row.finalScore >= 90 ? ['Excellent', 'bg-emerald-100 text-emerald-700'] : row.finalScore >= 80 ? ['Very Good', 'bg-blue-100 text-blue-700'] : row.finalScore >= 75 ? ['Good', 'bg-yellow-100 text-yellow-700'] : ['Average', 'bg-orange-100 text-orange-700'];
                      return <tr key={row.id} className="hover:bg-gray-50"><td className="px-4 py-4">{index + 1}</td><td className="px-4 py-4 font-medium text-gray-900">{row.instructorName}</td><td className="px-4 py-4 text-gray-600">{row.employeeId}</td><td className="px-4 py-4">{row.studentScore.toFixed(2)}</td><td className="px-4 py-4">{row.peerScore.toFixed(2)}</td><td className="px-4 py-4">{row.deptHeadScore.toFixed(2)}</td><td className="px-4 py-4 font-bold text-blue-700">{row.finalScore.toFixed(2)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${level[1]}`}>{level[0]}</span></td><td className="px-4 py-4"><span className={`text-xs font-semibold ${row.status === 'Completed' ? 'text-emerald-600' : 'text-orange-600'}`}>{row.status === 'Completed' ? '✓ Completed' : '◷ Pending'}</span></td><td className="px-4 py-4"><button type="button" title="Download individual slip" onClick={() => window.print()} className="rounded-lg px-2 py-1 text-lg text-gray-500 hover:bg-gray-100">⋮</button></td></tr>;
                    }) : <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-500">No instructor evaluation results available.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-gray-100 p-4 text-xs text-gray-500 md:flex-row md:items-center md:justify-between"><span>Showing {departmentReportRows.length ? 1 : 0} to {departmentReportRows.length} of {departmentReportRows.length} instructors</span><span>Department Average: {reportSummary.average.toFixed(2)} | Completed: {reportSummary.completed} ({reportSummary.total ? Math.round((reportSummary.completed / reportSummary.total) * 100) : 0}%) | Pending: {reportSummary.pending} ({reportSummary.total ? Math.round((reportSummary.pending / reportSummary.total) * 100) : 0}%)</span><span>‹ 1 ›</span></div>
            </section>
          </div>
        );
      default:
        return <InstructorsSection users={instructors} handleEditUser={handleEditUser} handleDeleteUser={handleDeleteUser} />;
    }
  };

  if (!currentUser || !currentUser.username) {
    return <div className="p-8 text-center text-gray-500">Loading department head profile...</div>;
  }

  return (
    <div className="container-custom py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-ieps-blue-600">{strings.deptHeadDashboard.title || 'Department Head Dashboard'}</h1>
          <p className="mt-1 text-gray-500">{strings.deptHeadDashboard.subtitle || 'Coordinate users, courses, evaluations, and assignments from one operational hub.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
            <FaBell />
            <span>{urgentReminders.length} alerts</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-ieps-blue-50 px-3 py-2">
            <FaShieldAlt className="text-ieps-blue-600" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ieps-blue-700">Department Head</h3>
          </div>
          <div className="space-y-2">
            {sidebarItems.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${isActive ? 'border-ieps-blue-200 bg-ieps-blue-50 text-ieps-blue-600 shadow-sm' : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50'}`}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-6">
          {activeTab === 'overview' && (
            <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-6 shadow-sm dark:border-sky-900/50 dark:bg-sky-950/40">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                MEKDELA AMBA UNIVERSITY
              </p>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Welcome, {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser?.name || currentUser?.username || 'Department Head'}
              </h1>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Department: <span className="ml-1 font-semibold">{currentUser?.department_name || currentUser?.department || 'N/A'}</span>
              </div>
            </div>
          )}

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-ieps-blue-600">{tabTitleMap[activeTab] || 'Overview'}</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">{tabTitleMap[activeTab] || 'Department operations center'}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">Monitor registrations, dispatch feedback forms, and keep assignments moving without losing visibility.</p>
              </div>
            </div>

            {formNotification ? <div className="mt-4 rounded-3xl border border-green-100 bg-green-50 p-4 text-sm text-green-700">{formNotification}</div> : null}

            <DispatchEvaluationModal
              open={showStudentModal}
              onClose={() => setShowStudentModal(false)}
              form={studentEvalForm}
              setForm={setStudentEvalForm}
              colleges={adminData.colleges}
              departments={adminData.departments}
              courses={courses}
              onSaveTemplate={() => { setShowTemplateEditor(true); }}
              onEditTemplate={() => { setShowTemplateEditor(true); }}
              onSend={handleSendStudentEvaluation}
            />

            {showTemplateEditor && (
              <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
                <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowTemplateEditor(false)} />
                <div className="relative w-full max-w-3xl">
                  <EvaluationTemplateBuilder
                    templateId={studentEvalTemplateId}
                    initial={(() => {
                      try {
                        return studentEvalTemplate && studentEvalTemplate.trim() && studentEvalTemplate.trim().startsWith('{') ? JSON.parse(studentEvalTemplate) : null;
                      } catch {
                        return null;
                      }
                    })()}
                    onClose={() => setShowTemplateEditor(false)}
                    onSaved={(newState) => {
                      try {
                        const text = typeof newState === 'string' ? newState : JSON.stringify(newState, null, 2);
                        setStudentEvalTemplate(text);
                      } catch {
                        console.warn('Unable to save template state');
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {showInstructorModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Dispatch Peer-to-Peer Evaluation</h3>
                    <button type="button" onClick={() => setShowInstructorModal(false)} className="text-gray-500">✕</button>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">Evaluating Instructor</span>
                      <select value={instructorEvalForm.evaluatorId} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, evaluatorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option value="">Select evaluator</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">Target Instructor</span>
                      <select value={instructorEvalForm.targetInstructorId} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, targetInstructorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option value="">Select target</option>
                        {instructors.map((ins) => <option key={ins.id} value={ins.id}>{ins.fullName}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-600 md:col-span-2"><span className="mb-1 block font-medium">Evaluation criteria / notes</span>
                      <input value={instructorEvalForm.criteria} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, criteria: e.target.value })} placeholder="e.g., teaching quality, feedback, etc." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm text-gray-600"><span className="mb-1 block font-medium">Semester</span>
                      <select value={instructorEvalForm.semester} onChange={(e) => setInstructorEvalForm({ ...instructorEvalForm, semester: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                        <option>Semester I</option>
                        <option>Semester II</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowInstructorModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
                    <button type="button" onClick={handleSendInstructorEvaluation} className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white">Send Evaluation</button>
                  </div>
                </div>
              </div>
            )}

            {showAssignModal && (
              <CourseAssignmentModal
                courses={courses}
                instructors={assignmentInstructors}
                departmentId={departmentId}
                onClose={() => setShowAssignModal(false)}
                onAssigned={() => {
                  setShowAssignModal(false);
                  void loadDashboardData();
                }}
              />
            )}

            {false && showAssignModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Course Assignment</h3>
                      <p className="text-sm text-gray-500">Step {assignmentStep} of 2</p>
                    </div>
                    <button type="button" onClick={() => { setShowAssignModal(false); setAssignmentStep(1); }} className="text-gray-500">✕</button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {assignmentStep === 1 ? (
                      <>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Course</span>
                          <select value={assignmentDraft.courseId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, courseId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select course</option>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} · {c.creditHours}cr</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Instructor</span>
                          <select value={assignmentDraft.instructorId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, instructorId: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select instructor</option>
                            {assignmentInstructors.map((ins) => <option key={ins.id || ins.instructor_id} value={ins.id || ins.instructor_id}>{ins.instructor_name || ins.fullName || ins.name || ins.username || ins.email}</option>)}
                          </select>
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Program type</span>
                          <select value={assignmentDraft.programType} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, programType: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select Program Type</option>
                            {programTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Year level</span>
                          <select value={assignmentDraft.yearLevel} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, yearLevel: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select Year Level</option>
                            {yearLevelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Semester</span>
                          <select value={assignmentDraft.semester} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, semester: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select semester</option>
                            <option value="I">I</option>
                            <option value="II">II</option>
                          </select>
                        </label>
                        <label className="text-sm text-gray-600">
                          <span className="mb-1 block font-medium">Section</span>
                          <select value={assignmentDraft.section} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, section: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                            <option value="">Select Section</option>
                            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((sec) => (
                              <option key={sec} value={sec}>{sec}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>

                  <div className="mt-5 flex justify-between gap-3">
                    {assignmentStep === 2 ? (
                      <button type="button" onClick={() => setAssignmentStep(1)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Back</button>
                    ) : <div />}
                    {assignmentStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setAssignmentStep(2)}
                        disabled={!assignmentDraft.courseId || !assignmentDraft.instructorId}
                        className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmAssignment}
                        disabled={!canSubmitAssignment()}
                        className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Confirm Assignment
                      </button>
                    )}
                  </div>

                  <div className="mt-5 text-sm">
                    <p className="font-semibold">Checks</p>
                    <div className="mt-2 space-y-1">
                      <div>
                        {assignmentDraft.instructorId && assignmentDraft.courseId ? (
                          (() => {
                            const course = courses.find((c) => String(c.id) === String(assignmentDraft.courseId));
                            const credit = Number(course?.creditHours || 0);
                            const load = getInstructorAssignedCredits(assignmentDraft.instructorId);
                            const ok = load + credit <= MAX_CREDIT_LOAD;
                            return (<div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{ok ? '✅ Load available' : '❌ Exceeds Max Credit Load Limit'}</div>);
                          })()
                        ) : <div className="text-gray-500">Select course & instructor to run checks</div>}
                      </div>
                      <div>
                        {assignmentDraft.instructorId && assignmentDraft.courseId ? (
                          (() => checkQualification(assignmentDraft.instructorId, assignmentDraft.courseId) ? <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm bg-amber-50 text-amber-700">⚠️ Qualification warning only</div> : <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm bg-red-50 text-red-700">❌ Qualification / Field mismatch</div>)()
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAssignModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {showPublishModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                  <h3 className="border-b border-gray-200 pb-2 text-lg font-bold text-gray-900">Confirm & Publish</h3>
                  <p className="mt-3 text-xs text-gray-500">Select who should receive notification and visibility for this course assignment.</p>
                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="both" checked={publishTarget === 'both'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">Publish to Both (Student & Instructor)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="student" checked={publishTarget === 'student'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">Publish to Student Only</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:bg-sky-50/50">
                      <input type="radio" name="publishTarget" value="instructor" checked={publishTarget === 'instructor'} onChange={(e) => setPublishTarget(e.target.value)} className="text-sky-600 focus:ring-sky-500" />
                      <span className="text-sm font-semibold text-gray-800">Publish to Instructor Only</span>
                    </label>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3 pt-2">
                    <button type="button" onClick={() => setShowPublishModal(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Back</button>
                    <button type="button" onClick={handleFinalPublishSubmit} className="rounded-xl bg-sky-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-sky-950">Confirm</button>
                  </div>
                </div>
              </div>
            )}

          </section>

          {loadingData ? <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">Syncing dashboard data from the API…</div> : renderContent()}
        </main>
      </div>
    </div>
  );
};

export default DeptHeadDashboard;
