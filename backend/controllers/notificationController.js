const pool = require('../config/db');
let realtimeServer = null;

const setRealtimeServer = (io) => {
  realtimeServer = io;
};

const createNotifications = async ({ userIds, title, message, type = 'reminder' }) => {
  const recipients = [...new Set((userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!recipients.length) return [];

  const notificationTime = new Date();
  if (realtimeServer) {
    recipients.forEach((userId) => {
      realtimeServer.to(`user_${userId}`).emit('new_notification', {
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
        created_at: notificationTime.toISOString(),
      });
    });
  }

  const values = recipients.flatMap((userId) => [userId, title, message, 0, notificationTime]);
  const placeholders = recipients.map(() => '(?, ?, ?, ?, ?)').join(', ');
  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, is_read, created_at)
       VALUES ${placeholders}`,
      values
    );
  } catch (error) {
    console.error('Bulk notification insert failed:', error);
    throw new Error(`Unable to save notifications: ${error.message}`);
  }

  const notifications = recipients.map((userId, index) => ({
    id: result.insertId + index,
    user_id: userId,
    title,
    message,
    type,
    is_read: 0,
    created_at: notificationTime.toISOString(),
  }));
  return notifications;
};

const getUserNotifications = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: 'Authenticated user is required.' });
    }

    const [notifications] = await pool.query(
      `SELECT id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );
    const [[count]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    return res.json({
      success: true,
      data: {
        notifications: notifications.map((notification) => ({
          ...notification,
          is_read: Boolean(notification.is_read),
        })),
        unreadCount: Number(count?.unread_count || 0),
      },
    });
  } catch (error) {
    console.error('Fetch user notifications failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load notifications.', error: error.message });
  }
};

const getNotifications = getUserNotifications;

const markAllRead = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId || req.user.id);
    if (requestedUserId !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'You can only update your own notifications.' });
    const [result] = await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [requestedUserId]);
    return res.json({ success: true, updated: result.affectedRows });
  } catch (error) {
    console.error('Mark all notifications read failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to mark notifications as read.', error: error.message });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    const requestedUserId = Number(req.params.userId || req.user.id);
    if (requestedUserId !== Number(req.user.id)) return res.status(403).json({ success: false, message: 'You can only clear your own notifications.' });
    const [result] = await pool.query('DELETE FROM notifications WHERE user_id = ?', [requestedUserId]);
    return res.json({ success: true, deleted: result.affectedRows });
  } catch (error) {
    console.error('Clear all notifications failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to clear notifications.', error: error.message });
  }
};

const sendNotification = async (req, res) => {
  try {
    const { userIds, title, message, department_id, year_level, section, program_type } = req.body || {};
    let recipients = Array.isArray(userIds) ? userIds : [req.body?.userId];
    if (!userIds && (department_id || year_level || section || program_type)) {
      const [studentUsers] = await pool.query(
      `SELECT s.user_id
       FROM students s
       INNER JOIN users u ON u.id = s.user_id
       WHERE (? IS NULL OR s.department_id = ?)
         AND (? IS NULL OR LOWER(TRIM(s.year_level)) = LOWER(TRIM(?)))
         AND (? IS NULL OR LOWER(TRIM(REPLACE(s.section, 'Section ', ''))) = LOWER(TRIM(REPLACE(?, 'Section ', ''))))
         AND (? IS NULL OR LOWER(TRIM(s.program_type)) = LOWER(TRIM(?)))`,
      [department_id ?? null, department_id ?? null, year_level ?? null, year_level ?? null, section ?? null, section ?? null, program_type ?? null, program_type ?? null]
    );
      recipients = studentUsers.map((student) => student.user_id);
    }
    const normalizedUserIds = [...new Set(recipients.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const normalizedTitle = String(title || '').trim();
    const normalizedMessage = String(message || '').trim();

    if (!normalizedUserIds.length || !normalizedTitle || !normalizedMessage) {
      return res.status(400).json({ success: false, message: 'userIds, title, and message are required.' });
    }

    await createNotifications({
      userIds: normalizedUserIds,
      title: normalizedTitle,
      message: normalizedMessage,
      type: 'manual',
    });
    return res.status(201).json({ success: true, sent: normalizedUserIds.length });
  } catch (error) {
    console.error('Send notification failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send notification.', error: error.message });
  }
};

module.exports = { getUserNotifications, getNotifications, markAllRead, clearAllNotifications, sendNotification, createNotifications, setRealtimeServer };