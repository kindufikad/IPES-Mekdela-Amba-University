import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const initialAccounts = [
  { username: 'student', password: 'student123', role: 'student', name: 'Student User' },
  { username: 'instructor', password: 'instructor123', role: 'instructor', name: 'Instructor User' },
  { username: 'depthead', password: 'depthead123', role: 'depthead', name: 'Department Head' },
  { username: 'systemadmin', password: 'systemadmin123', role: 'systemadmin', name: 'System Administrator' },
];

const normalizeRole = (value) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (normalizedValue === 'dept_head' || normalizedValue === 'depthead') return 'depthead';
  if (normalizedValue === 'system_admin' || normalizedValue === 'systemadmin' || normalizedValue === 'admin') return 'systemadmin';
  if (normalizedValue === 'college_dean' || normalizedValue === 'dean') return 'college_dean';
  if (normalizedValue === 'academic_directorate' || normalizedValue === 'academic_director' || normalizedValue === 'directorate') return 'academic_directorate';
  if (normalizedValue === 'instructor') return 'instructor';
  return 'student';
};

const AuthContext = createContext({
  user: null,
  role: null,
  isFirstLogin: false,
  isAuthenticated: false,
  isAuthLoading: false,
  accounts: [],
  login: () => null,
  logout: () => {},
  registerUser: () => false,
  updateUser: () => false,
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(() => Boolean(typeof window !== 'undefined' && (window.localStorage.getItem('ipesAuthToken') || window.localStorage.getItem('token'))));

  const [authToken, setAuthToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('ipesAuthToken') || window.localStorage.getItem('token');
  });

  const [role, setRole] = useState(() => {
    if (typeof window === 'undefined') return null;
    return normalizeRole(window.localStorage.getItem('role'));
  });

  const [accounts, setAccounts] = useState(initialAccounts);

  const navigate = useNavigate();
  const user = session?.name ? session : null;
  const userRole = session?.role || role || null;
  const isFirstLogin = Boolean(session?.isFirstLogin ?? session?.is_first_login ?? false);

  useEffect(() => {
    if (!authToken) {
      setSession(null);
      setRole(null);
      setIsAuthLoading(false);
      return;
    }

    const loadUserProfile = async () => {
      try {
        const profile = await authApi.me();
        const normalizedProfileRole = normalizeRole(profile.role);
        setSession({
          ...profile,
          name: profile.full_name || profile.username,
          username: profile.username,
          role: normalizedProfileRole,
          isFirstLogin: Boolean(profile.isFirstLogin ?? profile.is_first_login ?? false),
        });
        setRole(normalizedProfileRole);
      } catch {
        setAuthToken(null);
        setRole(null);
        setSession(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadUserProfile();
  }, [authToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authToken) {
      window.localStorage.setItem('ipesAuthToken', authToken);
      window.localStorage.setItem('token', authToken);
    } else {
      window.localStorage.removeItem('ipesAuthToken');
      window.localStorage.removeItem('token');
    }
  }, [authToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedUser = window.localStorage.getItem('user');
    if (!storedUser) return;

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser && (parsedUser.username || parsedUser.first_name || parsedUser.last_name || parsedUser.full_name)) {
        setSession({
          ...parsedUser,
          role: normalizeRole(parsedUser.role),
          isFirstLogin: Boolean(parsedUser.isFirstLogin ?? parsedUser.is_first_login ?? false),
          name: parsedUser.full_name || `${parsedUser.first_name || ''} ${parsedUser.last_name || ''}`.trim() || parsedUser.username,
        });
        setRole(normalizeRole(parsedUser.role));
      }
    } catch (error) {
      console.warn('Unable to parse stored user profile:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (role) {
      window.localStorage.setItem('role', role);
    } else {
      window.localStorage.removeItem('role');
    }
  }, [role]);

  const login = (username, password) => {
    const normalizedUsername = username.trim().toLowerCase();
    const account = accounts.find(
      (acct) => acct.username.trim().toLowerCase() === normalizedUsername && acct.password === password
    );

    if (!account) {
      return null;
    }

    const normalizedRole = normalizeRole(account.role);
    setSession({
      name: account.name || account.username,
      username: account.username,
      role: normalizedRole,
    });
    setRole(normalizedRole);

    return account;
  };

  const setAuthSession = (token, user) => {
    if (!token || !user) return false;
    const normalizedRole = normalizeRole(user.role);
    const fullUser = {
      ...user,
      id: user.id ?? user.user_id ?? null,
      username: user.username ?? null,
      first_name: user.first_name || user.firstName || null,
      last_name: user.last_name || user.lastName || null,
      full_name: user.full_name || [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ') || user.username || null,
      role: normalizedRole,
      isFirstLogin: Boolean(user.isFirstLogin ?? user.is_first_login ?? false),
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ipesAuthToken', token);
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('role', normalizedRole);
      window.localStorage.setItem('user', JSON.stringify(fullUser));
      window.localStorage.setItem('userData', JSON.stringify(fullUser));
    }
    setAuthToken(token);
    setRole(normalizedRole);
    setSession(fullUser);
    return true;
  };

  const updateUser = (updates) => {
    if (!session || !updates || typeof updates !== 'object') return false;
    const updatedUser = { ...session, ...updates };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user', JSON.stringify(updatedUser));
      window.localStorage.setItem('userData', JSON.stringify(updatedUser));
    }
    setSession(updatedUser);
    return true;
  };

  const registerUser = (newAccount) => {
    const username = (newAccount.username || '').trim().toLowerCase();
    if (!username || !newAccount.password) {
      return false;
    }

    const alreadyExists = accounts.some(
      (acct) => acct.username.trim().toLowerCase() === username
    );

    if (alreadyExists) {
      return false;
    }

    setAccounts((current) => [
      ...current,
      {
        ...newAccount,
        username,
      },
    ]);

    return true;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Logout request failed:', error?.message || error);
    }

    if (typeof window !== 'undefined') {
      const keysToClear = ['isLoggedIn', 'userData', 'user', 'ipesAuthToken', 'role'];
      keysToClear.forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      });
    }

    setSession(null);
    setAuthToken(null);
    setRole(null);
    navigate('/login', { replace: true });
  };

  const value = useMemo(
    () => ({
      user,
      role: userRole,
      accounts,
      authToken,
      isAuthenticated: Boolean(session),
      isAuthLoading,
      isFirstLogin,
      login,
      logout,
      registerUser,
      setAuthSession,
      updateUser,
    }),
    [authToken, userRole, user, accounts, isFirstLogin, isAuthLoading, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
