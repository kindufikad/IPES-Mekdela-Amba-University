const pool = require('../config/db');

const getSystemStats = async (req, res) => {
  try {
    const [evaluationRows, instructorRows, departmentRows, participationRows] = await Promise.all([
      pool.query("SELECT COUNT(*) AS evaluationsCompleted FROM student_evaluation_submissions WHERE status = 'submitted'"),
      pool.query('SELECT COUNT(*) AS activeInstructors FROM instructors'),
      pool.query('SELECT COUNT(*) AS totalDepartments FROM departments'),
      pool.query(`
        SELECT
          COUNT(DISTINCT ses.student_id) AS participatingStudents,
          (SELECT COUNT(*) FROM students) AS totalStudents
        FROM student_evaluation_submissions ses
        WHERE ses.status = 'submitted' AND ses.student_id IS NOT NULL
      `),
    ]);

    const evaluationCount = Number(evaluationRows[0][0]?.evaluationsCompleted || 0);
    const activeInstructorCount = Number(instructorRows[0][0]?.activeInstructors || 0);
    const departmentCount = Number(departmentRows[0][0]?.totalDepartments || 0);
    const participatingStudents = Number(participationRows[0][0]?.participatingStudents || 0);
    const totalStudents = Number(participationRows[0][0]?.totalStudents || 0);
    const studentParticipation = totalStudents > 0
      ? Number(((participatingStudents / totalStudents) * 100).toFixed(2))
      : 0;

    return res.json({
      success: true,
      message: { en: 'System statistics retrieved successfully.', am: 'የሥርዓቱ ስታቲስቲክስ በተሳካ ሁኔታ ተገኝቷል።' },
      data: {
        evaluationsCompleted: evaluationCount,
        activeInstructors: activeInstructorCount,
        totalDepartments: departmentCount,
        studentParticipation,
      },
    });
  } catch (error) {
    console.error('Unable to retrieve public system statistics:', error);
    return res.status(500).json({
      success: false,
      message: { en: 'Unable to retrieve system statistics.', am: 'የሥርዓቱን ስታቲስቲክስ ማግኘት አልተቻለም።' },
      data: null,
    });
  }
};

module.exports = { getSystemStats };