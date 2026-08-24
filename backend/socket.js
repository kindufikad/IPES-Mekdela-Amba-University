const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace('department_head', 'dept_head');

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });
  const jwtSecret = process.env.JWT_SECRET || 'change-this-secret';

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));

    jwt.verify(token, jwtSecret, (error, user) => {
      if (error || !user?.id) return next(new Error('Invalid access token.'));
      socket.user = user;
      next();
    });
  });

  io.on('connection', (socket) => {
    socket.on('join_rooms', ({ userId, role } = {}) => {
      const authenticatedUserId = Number(socket.user.id);
      const requestedUserId = Number(userId);
      const normalizedRole = normalizeRole(role || socket.user.role || socket.user.user_role);

      if (requestedUserId === authenticatedUserId) {
        socket.join(`user_${authenticatedUserId}`);
      }
      if (normalizedRole) {
        socket.join(`role_${normalizedRole}`);
      }
      socket.join('all_users');
    });
  });

  return io;
};

module.exports = { initSocket };
