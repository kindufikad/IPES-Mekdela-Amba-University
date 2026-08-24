const express = require('express');
const { getAdminDashboardStats, getDepartmentAnalytics, getSecurityLogs, createCollege, getColleges, getManagementRoleOccupant, assignRoleWithHierarchy, resetManagementRole, resetUserPassword, getRoleCandidates } = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard-stats', authenticateToken, authorizeRoles('admin', 'systemadmin'), getAdminDashboardStats);
router.get('/department-analytics', authenticateToken, authorizeRoles('admin', 'systemadmin'), getDepartmentAnalytics);
router.get('/security-logs', authenticateToken, authorizeRoles('admin', 'systemadmin'), getSecurityLogs);
router.get('/colleges', authenticateToken, authorizeRoles('admin', 'systemadmin'), getColleges);
router.post('/colleges', authenticateToken, authorizeRoles('admin', 'systemadmin'), createCollege);
router.get('/management-role-occupant', authenticateToken, authorizeRoles('admin', 'systemadmin'), getManagementRoleOccupant);
router.put('/users/:id/management-role', authenticateToken, authorizeRoles('admin', 'systemadmin'), assignRoleWithHierarchy);
router.put('/users/:id/management-role/reset', authenticateToken, authorizeRoles('admin', 'systemadmin'), resetManagementRole);
router.put('/users/:id/password/reset', authenticateToken, authorizeRoles('admin', 'systemadmin'), resetUserPassword);
router.get('/role-candidates', authenticateToken, authorizeRoles('admin', 'systemadmin'), getRoleCandidates);

module.exports = router;