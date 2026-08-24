import axios from 'axios';

const API_BASE_URL = '/api';

axios.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = window.localStorage.getItem('ipesAuthToken') || window.localStorage.getItem('token');
  if (!token) return config;

  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || '';
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (typeof window !== 'undefined' && !isLoginRequest && status === 401) {
      window.localStorage.removeItem('token');
      window.localStorage.removeItem('ipesAuthToken');
      window.localStorage.removeItem('role');
      window.localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

const getMessageText = (message) => {
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message.map((entry) => getMessageText(entry)).filter(Boolean).join(' ');
  }
  if (message && typeof message === 'object') {
    if (typeof message.en === 'string') return message.en;
    if (typeof message.am === 'string') return message.am;
    if (typeof message.message === 'string') return message.message;
    return Object.values(message)
      .map((entry) => getMessageText(entry))
      .filter(Boolean)
      .join(' ');
  }
  return '';
};

const request = async (path, options = {}) => {
  const { ...axiosOptions } = options;
  const containsFormData = axiosOptions.data instanceof FormData;
  const headers = {
    ...(containsFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(axiosOptions.headers || {}),
  };

  try {
    const response = await axios({
      url: `${API_BASE_URL}${path}`,
      headers,
      withCredentials: true,
      ...axiosOptions,
    });

    const responseData = response.data;
    if (responseData && typeof responseData === 'object' && responseData.hasOwnProperty('success') && responseData.hasOwnProperty('data')) {
      return responseData.data;
    }

    return responseData;
  } catch (error) {
    const errorPayload = error?.response?.data;
    const errorMessage = getMessageText(errorPayload?.message || errorPayload?.error || error.message || 'Request failed.');
    const errorDetail = getMessageText(errorPayload?.error);
    const message = errorDetail && errorDetail !== errorMessage ? `${errorMessage} ${errorDetail}` : errorMessage;
    const normalizedError = new Error(message || 'Request failed.');
    normalizedError.status = error?.response?.status || 500;
    normalizedError.response = error?.response;
    throw normalizedError;
  }
};

export const authApi = {
  registerInstructor: (payload) => request('/auth/register-instructor', { method: 'POST', data: payload }),
  registerStudent: (payload) => request('/students/register', { method: 'POST', data: payload }),
  bulkRegister: (payload) => request('/auth/bulk-register', { method: 'POST', data: payload }),
  createDepartment: (payload) => request('/auth/departments', { method: 'POST', data: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', data: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  changePassword: (payload) => request('/auth/change-password', { method: 'POST', data: payload }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', data: { email } }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', data: payload }),
};

export const publicApi = {
  getSystemStats: () => request('/public/system-stats'),
};

export const adminApi = {
  getDashboardStats: () => request('/admin/dashboard-stats'),
  getDepartmentAnalytics: () => request('/admin/department-analytics'),
  getSecurityLogs: () => request('/admin/security-logs'),
  createCollege: (payload) => request('/admin/colleges', { method: 'POST', data: payload }),
  getColleges: () => request('/colleges'),
  getRoleCandidates: () => request('/admin/role-candidates'),
  getManagementRoleOccupant: (params) => request('/admin/management-role-occupant', { params }),
  assignManagementRole: (id, role, hierarchy = {}) => request(`/admin/users/${id}/management-role`, { method: 'PUT', data: { role, ...hierarchy } }),
  resetManagementRole: (id) => request(`/admin/users/${id}/management-role/reset`, { method: 'PUT' }),
  resetUserPassword: (id) => request(`/admin/users/${id}/password/reset`, { method: 'PUT' }),
};

export const deanApi = {
  getOverviewStats: () => request('/dean/overview-stats'),
  getDepartmentAnalytics: () => request('/dean/department-analytics'),
  getDepartmentHeads: () => request('/dean/dept-heads'),
  submitDepartmentHeadEvaluation: (payload) => request('/dean/submit-evaluation', { method: 'POST', data: payload }),
  getFacultyPerformance: () => request('/dean/faculty-performance'),
  getMyPerformance: () => request('/dean/my-performance'),
};

export const directorateApi = {
  getOverviewStats: () => request('/directorate/overview-stats'),
  getDeans: () => request('/directorate/deans'),
  getAnalytics: () => request('/directorate/analytics'),
  evaluateDean: (payload) => request('/directorate/evaluate-dean', { method: 'POST', data: payload }),
};

export const departmentApi = {
  createDepartment: (payload) => request('/departments', { method: 'POST', data: payload }),
  getDepartmentData: (type, department) => request(`/department-data/${type}`, { method: 'GET', params: { department } }),
  getOverview: (department) => request('/department/overview', { params: { department } }),
  getAssignments: () => request('/department/assignments'),
  createAssignment: (payload) => request('/department/assignments', { method: 'POST', data: payload }),
  updateAssignment: (id, payload) => request(`/department/assignments/${id}`, { method: 'PUT', data: payload }),
  deleteAssignment: (id) => request(`/department/assignments/${id}`, { method: 'DELETE' }),
  getAll: () => request('/departments'),
  getDepartmentCourses: (department) => request('/dept-head/courses', { method: 'GET', params: { department } }),
  getDepartmentInstructors: (department) => request('/dept-head/instructors', { method: 'GET', params: { department } }),
  getDepartmentStudents: (department) => request('/dept-head/students', { method: 'GET', params: { department } }),
  getAnalytics: () => request('/dept-head/analytics'),
};

export const registrationApi = {
  getUsers: (filters = {}) => request('/secure/users', { method: 'GET', params: filters }),
  getStudents: (filters = {}) => request('/secure/users', { method: 'GET', params: { role: 'student', ...filters } }),
  getCourses: (filters = {}) => request('/secure/courses', { method: 'GET', params: filters }),
  getEvaluations: () => request('/secure/evaluations'),
  createUser: (payload) => request('/secure/users', { method: 'POST', data: payload }),
  updateUser: (id, payload) => request(`/secure/users/${id}`, { method: 'PUT', data: payload }),
  deleteUser: (id) => request(`/secure/users/${id}`, { method: 'DELETE' }),
  createCourse: (payload) => request('/secure/courses', { method: 'POST', data: payload }),
  bulkUploadCourses: (payload) => request('/secure/courses/bulk-upload', { method: 'POST', data: payload }),
  updateCourse: (id, payload) => request(`/secure/courses/${id}`, { method: 'PUT', data: payload }),
  deleteCourse: (id) => request(`/secure/courses/${id}`, { method: 'DELETE' }),
};

export const studentApi = {
  // hits /api/students
  bulkUpload: (payload) => request('/students/bulk-upload', { method: 'POST', data: payload }),
  getFiltered: (filters = {}) => request('/students', { method: 'GET', params: filters }),
  getProfile: () => request('/student/profile', { method: 'GET' }),
  getPendingEvaluations: () => request('/student/pending-evaluations', { method: 'GET' }),
  getAvailableEvaluations: () => request('/student/evaluations/available', { method: 'GET' }),
};

export const userApi = {
  getUsers: (filters = {}) => request('/secure/users', { method: 'GET', params: filters }),
  getStudents: (filters = {}) => request('/secure/users', { method: 'GET', params: { role: 'student', ...filters } }),
  createUser: (payload) => request('/secure/users', { method: 'POST', data: payload }),
  updateUser: (id, payload) => request(`/secure/users/${id}`, { method: 'PUT', data: payload }),
  deleteUser: (id) => request(`/secure/users/${id}`, { method: 'DELETE' }),
};

export const courseApi = {
  getCourses: () => request('/secure/courses'),
  createCourse: (payload) => request('/secure/courses', { method: 'POST', data: payload }),
  updateCourse: (id, payload) => request(`/secure/courses/${id}`, { method: 'PUT', data: payload }),
  deleteCourse: (id) => request(`/secure/courses/${id}`, { method: 'DELETE' }),
};

export const evaluationApi = {
  getPublishAssignments: (params = {}) => request('/evaluations/publish-assignments', { method: 'GET', params }),
  togglePeerPublish: (payload = {}) => request('/evaluations/toggle-peer-publish', { method: 'POST', data: payload }),
  getPublishStatuses: (departmentId) => request(`/evaluations/publish-statuses/${departmentId}`, { method: 'GET' }),
  publishStudent: (payload) => request('/evaluations/publish-student', { method: 'POST', data: payload }),
  unpublishStudent: (payload) => request('/evaluations/student/unpublish', { method: 'POST', data: payload }),
  publishInstructor: (payload) => request('/evaluations/publish-instructor', { method: 'POST', data: payload }),
  publishDispatch: (payload) => request('/evaluations/publish-dispatch', { method: 'POST', data: payload }),
  getOverview: () => request('/evaluations/template'),
  getLatestTemplate: () => request('/evaluations/template'),
  saveTemplate: (payload) => request('/evaluations/template', { method: 'POST', data: payload }),
  updateTemplate: (id, payload) => request(`/evaluations/template/${id}`, { method: 'PUT', data: payload }),
  dispatchStudentEvaluation: (payload) => request('/evaluations/dispatch', { method: 'POST', data: payload }),
  getDispatches: (filters = {}) => request('/evaluations/dispatches', { method: 'GET', params: filters }),
  getSubmissions: (filters = {}) => request('/evaluations/submissions', { method: 'GET', params: filters }),
  getPendingStudentEvaluations: () => request('/student/evaluations/pending', { method: 'GET' }),
  getStudentEvaluations: () => request('/student/evaluations', { method: 'GET' }),
  submitStudentEvaluation: (payload) => request('/student/evaluations/submit', { method: 'POST', data: payload }),
  submitStudentEvaluationForm: (payload) => request('/evaluations/submit-student', { method: 'POST', data: payload }),
  submitPeerEvaluationForm: (payload) => request('/evaluations/submit-peer', { method: 'POST', data: payload }),
  getDeptHeadStudentTracking: (params = {}) => request('/dept-head/tracking/students', { method: 'GET', params }),
  getDeptHeadPeerTracking: (params = {}) => request('/dept-head/tracking/peers', { method: 'GET', params }),
  publishDepartmentPeerEvaluations: (payload = {}) => request('/evaluations/peer/publish-department', { method: 'POST', data: payload }),
  unpublishDepartmentPeerEvaluations: (payload = {}) => request('/evaluations/peer/unpublish-department', { method: 'POST', data: payload }),
  getDeptHeadDeptHeadTracking: (params = {}) => request('/dept-head/tracking/dept-head', { method: 'GET', params }),
  sendReminder: (payload = {}) => request('/evaluations/send-reminder', { method: 'POST', data: payload }),
  calculatePublishFinalResults: (payload = {}) => request('/dept-head/calculate-publish', { method: 'POST', data: payload }),
  publishInstructorScores: (payload = {}) => request('/evaluations/publish-instructor-scores', { method: 'POST', data: payload }),
  getDeptHeadInstructors: (params = {}) => request('/dept-head/instructors', { method: 'GET', params }),
  submitDeptHeadEvaluation: (payload) => request('/dept-head/evaluations', { method: 'POST', data: payload }),
  getDeptHeadEvaluations: (params = {}) => request('/dept-head/evaluations', { method: 'GET', params }),
  getDeptHeadEvaluation: (id) => request(`/dept-head/evaluations/${id}`, { method: 'GET' }),
  getPerformanceDashboard: () => request('/instructor/performance-summary', { method: 'GET' }),
  getDeptHeadPerformance: () => request('/dept-head/performance', { method: 'GET' }),
  getAll: () => request('/evaluations'),
  submitEvaluation: (payload) => request('/evaluations', { method: 'POST', data: payload }),
};

export const notificationApi = {
  getAll: () => request('/notifications'),
  getUnread: () => request('/notifications'),
  markAllRead: (userId) => request(`/notifications/mark-all-read/${userId}`, { method: 'PUT' }),
  clearAll: (userId) => request(`/notifications/clear-all/${userId}`, { method: 'DELETE' }),
  send: (payload) => request('/notifications/send', { method: 'POST', data: payload }),
};

export const criteriaApi = {
  get: (type) => request('/criteria', { method: 'GET', params: { type } }),
  getAll: (type) => request('/admin/criteria', { method: 'GET', params: type ? { type } : {} }),
  create: (payload) => request('/admin/criteria', { method: 'POST', data: payload }),
  update: (id, payload) => request(`/admin/criteria/${id}`, { method: 'PUT', data: payload }),
  remove: (id) => request(`/admin/criteria/${id}`, { method: 'DELETE' }),
};

export const courseAssignmentApi = {
  assign: (payload) => request('/assignments/assign', { method: 'POST', data: payload }),
  batchAssign: (payload) => request('/courses/batch-assign', { method: 'POST', data: payload }),
  batchAssignMatrix: (payload) => request('/courses/batch-assign-matrix', { method: 'POST', data: payload }),
  getFilteredCourses: (params) => request('/courses/by-filters', { method: 'GET', params }),
  getDepartmentInstructors: (departmentId) => request(`/courses/department-instructors/${departmentId}`, { method: 'GET' }),
  getAll: () => request('/course-assignments'),
  create: (payload) => request('/course-assignments', { method: 'POST', data: payload }),
  createDeptHeadAssignment: (payload) => request('/dept-head/assign-course', { method: 'POST', data: payload }),
  deleteAssignment: (id) => request(`/courses/assign/${id}`, { method: 'DELETE' }),
  getStudentAssignments: () => request('/student/assigned-courses'),
  getInstructorAssignments: () => request('/instructor/assigned-courses'),
  getPeerEvaluations: () => request('/instructor/peer-evaluations'),
};
