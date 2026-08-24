import { useContext, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaClipboardCheck, FaUsers, FaChartBar, FaStar, FaBookOpen } from 'react-icons/fa';
import { LanguageContext } from '../context/LanguageContext';
import PeerEvaluationModal from '../components/PeerEvaluationModal';
import PerformanceDashboard from '../components/PerformanceDashboard';
import { authApi, courseAssignmentApi, evaluationApi } from '../services/api';
import { SUBMISSIONS_UPDATED_EVENT } from '../services/formSubmissions';

const peerEvaluationSections = [
  {
    title: 'Core Competency: Subject matter',
    items: [
      { id: 'p1', label: 'Contribution in preparing and searching for teaching materials.' },
      { id: 'p2', label: 'Continuous update of the subject matter.' },
      { id: 'p3', label: 'Delivering seminars that are relevant to his/her teaching subject.' },
      { id: 'p4', label: 'Level of subject matter knowledge and skill.' },
    ],
  },
  {
    title: 'Core Competency: Research and Community Services',
    items: [
      { id: 'p5', label: 'Willingness and level of engagement in community service and volunteer activities.' },
      { id: 'p6', label: 'Participation in seminars/workshops at department, faculty or institution level during the year.' },
      { id: 'p7', label: 'Identifying priority areas in one’s discipline and pursuing research in that area and willingness to help colleagues in identifying areas of research and proposal development.' },
    ],
  },
  {
    title: 'Professional Competency',
    items: [
      { id: 'p8', label: 'Guidance and counseling role to students.' },
      { id: 'p9', label: 'Contributing constructive ideas and activities that improve the teaching-learning process.' },
      { id: 'p10', label: 'Participation in problem identification and solving at department, college, or institution level.' },
      { id: 'p11', label: 'Participation in Comprehensive Continuous Professional Development (CCPD, HDP, ELIP).' },
      { id: 'p12', label: 'Willingness to actively participate in cooperative learning and team teaching activities.' },
    ],
  },
  {
    title: 'Ethical Competency',
    items: [
      { id: 'p13', label: 'Willingness to participate and level of commitment in committee work.' },
      { id: 'p14', label: 'Willingness to share university resources with other colleagues.' },
      { id: 'p15', label: 'Showing cordiality to others and respecting ideas of others.' },
      { id: 'p16', label: 'Having a positive attitude to work with others (team spirit).' },
      { id: 'p17', label: 'Level of respect to rules, regulations and guidelines of the institution.' },
      { id: 'p18', label: 'His/her discipline (dressing, addictions, personality, etc.).' },
    ],
  },
  {
    title: 'Time Management',
    items: [
      { id: 'p19', label: 'Time management in department affairs and teaching-learning activities.' },
      { id: 'p20', label: 'Time utilization for consultation hours.' },
    ],
  },
];

const InstructorDashboard = () => {
  const { strings } = useContext(LanguageContext);
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(() => {
    if (typeof window === 'undefined') return authUser || null;
    try {
      const storedUser = JSON.parse(window.localStorage.getItem('user') || '{}');
      return storedUser && Object.keys(storedUser).length ? storedUser : authUser || null;
    } catch {
      return authUser || null;
    }
  });
  const [activeView, setActiveView] = useState('overview');
  const [peerEvaluations, setPeerEvaluations] = useState([]);
  const [peerPendingCount, setPeerPendingCount] = useState(0);
  const [peerLoading, setPeerLoading] = useState(false);
  const [peerError, setPeerError] = useState('');
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [selectedPeerEvaluation, setSelectedPeerEvaluation] = useState(null);
  const [peerModalMode, setPeerModalMode] = useState('create');
  const [peerModalRecord, setPeerModalRecord] = useState(null);
  const [peerModalLoading, setPeerModalLoading] = useState(false);
  const [peerModalError, setPeerModalError] = useState('');
  const [peerModalSuccess, setPeerModalSuccess] = useState('');

  const loadPeerEvaluations = async () => {
    setPeerLoading(true);
    setPeerError('');
    try {
      const data = await courseAssignmentApi.getPeerEvaluations();
      if (data && typeof data === 'object' && Array.isArray(data.evaluations)) {
        setPeerEvaluations(data.evaluations);
        setPeerPendingCount(Number(data.pendingCount) || data.evaluations.filter((item) => item.status === 'pending').length);
      } else if (Array.isArray(data)) {
        setPeerEvaluations(data);
        setPeerPendingCount(data.filter((item) => item.status === 'pending').length);
      } else {
        setPeerEvaluations([]);
        setPeerPendingCount(0);
      }
    } catch (error) {
      console.error('Peer evaluations load failed:', error);
      setPeerError(error?.message || 'Unable to load peer evaluations.');
      setPeerEvaluations([]);
      setPeerPendingCount(0);
    } finally {
      setPeerLoading(false);
    }
  };

  const getInstructorFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.user?.first_name && profile?.user?.last_name) {
      return `${profile.user.first_name} ${profile.user.last_name}`;
    }
    if (profile?.full_name && profile.full_name.trim() !== '') {
      return profile.full_name;
    }
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser?.first_name && storedUser?.last_name) {
      return `${storedUser.first_name} ${storedUser.last_name}`;
    }
    return profile?.username || storedUser?.username || 'Instructor';
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const profileData = await authApi.me().catch(() => null);
        if (isMounted) {
          setProfile(profileData || authUser || null);
        }
      } catch {
        if (isMounted) {
          setProfile(authUser || null);
        }
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    const handleDispatchUpdate = () => {
      // refresh peer assignments when new submissions happen
      if (activeView === 'peerEvaluation') {
        void loadPeerEvaluations();
      }
    };

    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, handleDispatchUpdate);
    return () => {
      window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, handleDispatchUpdate);
    };
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'peerEvaluation') return;
    void loadPeerEvaluations();
  }, [activeView]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ipes-pending-evaluations-updated', { detail: { count: peerPendingCount } }));
    return () => window.dispatchEvent(new CustomEvent('ipes-pending-evaluations-updated', { detail: { count: 0 } }));
  }, [peerPendingCount]);

  const sidebarItems = [
    { key: 'overview', label: strings.instructorDashboard.reviewEvaluations, icon: FaClipboardCheck, active: activeView === 'overview' },
    { key: 'peerEvaluation', label: strings.instructorDashboard.peerEvaluation, icon: FaUsers, active: activeView === 'peerEvaluation' },
    { key: 'performanceDashboard', label: 'Performance Dashboard', icon: FaChartBar, active: activeView === 'performanceDashboard' },
  ];


  const openPeerModal = (evaluation, mode = 'create', record = null) => {
    setSelectedPeerEvaluation(evaluation);
    setPeerModalMode(mode);
    setPeerModalRecord(record);
    setPeerModalError('');
    setPeerModalSuccess('');
    setShowPeerModal(true);
  };

  const handlePeerEvaluationSubmit = async (payload) => {
    setPeerModalLoading(true);
    setPeerModalError('');
    setPeerModalSuccess('');
    try {
      await evaluationApi.submitPeerEvaluationForm(payload);
      setPeerModalSuccess('Peer evaluation submitted successfully.');
      setShowPeerModal(false);
      setPeerEvaluations((current) => current.map((item) => (item.id === payload.peer_evaluation_id ? { ...item, status: 'completed' } : item)));
      setPeerPendingCount((count) => Math.max(0, count - 1));
      setPeerModalLoading(false);
      window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT, { detail: { type: 'peer-submission' } }));
    } catch (submitError) {
      console.error(submitError);
      setPeerModalError(submitError?.message || 'Unable to submit peer evaluation.');
      setPeerModalLoading(false);
      throw submitError;
    }
  };

  const renderContent = () => {
    if (activeView === 'peerEvaluation') {
      return (
        <section className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{strings.instructorDashboard.peerEvaluationTitle}</h2>
                <p className="text-sm text-gray-500">{strings.instructorDashboard.peerEvaluationDesc}</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 font-medium text-sm rounded-full">
                {peerPendingCount} pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Deadline</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {peerLoading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-gray-500">Loading peer evaluations...</td>
                    </tr>
                  ) : peerError ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-red-600">{peerError}</td>
                    </tr>
                  ) : peerEvaluations.length ? (
                    peerEvaluations.map((row, index) => {
                      const isComplete = row.status === 'completed' || row.status === 'submitted' || row.is_evaluated || row.evaluation_status === 'submitted';
                      const scoreValue = Number(row?.total_score ?? row?.score ?? row?.totalScore ?? row?.overall_score ?? 0) || 0;

                      return (
                        <tr key={`peer-${row.id}-${index}`} className="border-b border-gray-100">
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">{row.instructor_name || 'Instructor'}</td>
                          <td className="px-4 py-4 text-sm text-gray-600">{row.deadline || '-'}</td>
                          <td className="px-4 py-4 text-sm">
                            {isComplete ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-emerald-600">✓ Evaluated ({scoreValue}/100)</span>
                                <button
                                  type="button"
                                  onClick={() => openPeerModal(row, 'view', row)}
                                  className="text-sm font-semibold text-blue-600 underline transition-colors hover:text-blue-800"
                                >
                                  View Details
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => openPeerModal(row, 'create', null)} className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700">
                                <FaStar className="mr-1" /> Evaluate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-sm text-gray-500">No peer evaluations assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      );
    }

    if (activeView === 'performanceDashboard') {
      return <PerformanceDashboard />;
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{strings.instructorDashboard.assignedCourses || 'My Courses'}</p>
                <p className="mt-2 text-4xl font-bold text-ieps-blue-700">2</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ieps-blue-50 text-xl text-ieps-blue-600">
                <FaBookOpen />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-amber-700">Peer Evaluations</p>
                <p className="mt-2 text-4xl font-bold text-amber-600">19</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
                <FaUsers />
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="container-custom py-8">
      <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-sky-100 via-blue-100 to-sky-50 p-6 text-slate-900 shadow-lg md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">Mekdela Amba University</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl text-slate-900">Welcome, {getInstructorFullName()}</h1>
            <div className="mt-3 inline-flex rounded-full bg-white/70 px-3 py-1 text-sm font-medium text-slate-800 shadow-sm">
              Department: {profile?.department_name || profile?.department || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{strings.instructorDashboard.menu}</h3>
          <div className="space-y-2">
            {sidebarItems.map(({ label, icon: Icon, active, key }) => (
              <button key={label} type="button" onClick={() => setActiveView(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-ieps-blue-50 text-ieps-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </aside>

        <main>{renderContent()}</main>
      </div>
      <PeerEvaluationModal
        open={showPeerModal}
        onClose={() => {
          setShowPeerModal(false);
          setPeerModalMode('create');
          setPeerModalRecord(null);
        }}
        evaluation={selectedPeerEvaluation || {}}
        sections={peerEvaluationSections}
        onSubmit={handlePeerEvaluationSubmit}
        isSubmitting={peerModalLoading}
        successMessage={peerModalSuccess}
        errorMessage={peerModalError}
        mode={peerModalMode}
        evaluationRecord={peerModalRecord}
      />
    </div>
  );
};

export default InstructorDashboard;