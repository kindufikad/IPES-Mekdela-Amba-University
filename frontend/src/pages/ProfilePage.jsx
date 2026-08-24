import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import BackButton from '../components/BackButton';

const roleLabels = {
  admin: 'System Administrator',
  systemadmin: 'System Administrator',
  dept_head: 'Department Head',
  depthead: 'Department Head',
  college_dean: 'College Dean',
  dean: 'College Dean',
  academic_directorate: 'Academic Directorate',
  academic_director: 'Academic Directorate',
  directorate: 'Academic Directorate',
  instructor: 'Instructor',
  student: 'Student',
};

const ProfilePage = () => {
  const { user, role, updateUser } = useAuth();
  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const profile = { ...storedUser, ...user };
  const normalizedRole = String(profile.role || role || '').trim().toLowerCase();
  const displayName = profile.name || profile.full_name || profile.fullName || profile.username || 'User';
  const email = profile.email || profile.username || 'Not available';
  const department = profile.department_name || profile.departmentName || profile.department || 'Not assigned';
  const [phone, setPhone] = useState(profile.phone || profile.phone_number || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile.profile_picture || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!photoFile) return undefined;
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('phone', phone.trim());
    if (photoFile) formData.append('photo', photoFile);

    setSaving(true);
    try {
      const response = await axios.put('/api/user/profile', formData, { withCredentials: true });
      const updatedUser = { ...profile, phone: phone.trim(), phone_number: phone.trim(), profile_picture: response.data?.user?.profile_picture || photoPreview };
      updateUser(updatedUser);
      setPhotoPreview(updatedUser.profile_picture);
      setPhotoFile(null);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const avatarSource = photoPreview || profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=dbeafe&color=1e3a8a`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-24 text-slate-900 sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-2xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm" aria-labelledby="profile-title">
        <BackButton />
        <div className="border-b border-slate-100 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Account</p>
          <h1 id="profile-title" className="mt-2 text-3xl font-bold">Profile</h1>
          <p className="mt-2 text-slate-600">Your authenticated IPES account details.</p>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:items-end">
          <img src={avatarSource} alt={`${displayName} profile`} className="h-24 w-24 rounded-full border-4 border-blue-50 object-cover" />
          <label className="inline-flex cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100">
            Change Profile Photo
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
          </label>
        </div>

        <div className="mt-8 space-y-5">
          <label className="block text-sm font-medium text-slate-700">Full Name<input value={displayName} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label>
          <label className="block text-sm font-medium text-slate-700">Email Address<input value={email} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label>
          <label className="block text-sm font-medium text-slate-700">Role / Title<input value={roleLabels[normalizedRole] || normalizedRole || 'User'} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label>
          <label className="block text-sm font-medium text-slate-700">Department<input value={department} disabled className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label>
          <label className="block text-sm font-medium text-slate-700">Phone Number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Enter phone number" /></label>
        </div>
        <button type="submit" disabled={saving} className="mt-8 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? 'Saving...' : 'Save Profile Changes'}</button>
      </form>
    </main>
  );
};

export default ProfilePage;