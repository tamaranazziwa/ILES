import { useState, useEffect } from 'react';
import api from './api/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// ── Utilities ──────────────────────────────────────────────────────────────

const parseJwt = (token) => {
  let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(base64));
};

const apiError = (err) => {
  const data = err.response?.data;
  if (!data) return 'An unexpected error occurred.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const msgs = [];
  Object.entries(data).forEach(([field, errs]) => {
    const text = Array.isArray(errs) ? errs.join(', ') : String(errs);
    msgs.push(field === 'non_field_errors' ? text : `${field}: ${text}`);
  });
  return msgs.join(' | ') || 'An error occurred.';
};

const weightedScore = (evals, criteria) => {
  if (!evals || evals.length === 0) return null;
  let total = 0;
  evals.forEach((ev) => {
    const c = criteria.find((x) => x.id === ev.criteria);
    if (c) total += ev.score * c.weight;
  });
  return Math.round(total * 100) / 100;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  student: 'Student',
  workplace_supervisor: 'Workplace Supervisor',
  academic_supervisor: 'Academic Supervisor',
  admin: 'Administrator',
};

const STATUS_LABELS = {
  draft: 'Draft', submitted: 'Submitted', reviewed: 'Reviewed', approved: 'Approved',
};

const SIGNUP_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'workplace_supervisor', label: 'Workplace Supervisor' },
  { value: 'academic_supervisor', label: 'Academic Supervisor' },
];

const BLANK_PLACEMENT = {
  company_name: '', start_date: '', end_date: '',
  supervisor: '', academic_supervisor: '',
  school_name: '', course: '', registration_number: '', placement_letter_url: '',
};

// ── Shared components ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <p className="stat-card__value">{value}</p>
      <p className="stat-card__label">{label}</p>
    </div>
  );
}

function NavBar({ user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <span className="navbar__logo">ILES</span>
        <span className="navbar__name">Internship Logbook &amp; Evaluation System</span>
      </div>
      <div className="navbar__actions">
        <span className="navbar__username">{user.username}</span>
        <span className={`role-pill role-pill--${user.role}`}>{ROLE_LABELS[user.role] ?? user.role}</span>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  );
}

function ScoreDisplay({ score }) {
  if (score == null) return <span className="score-na">Not scored</span>;
  const pct = Math.min(100, Math.round(score));
  const cls = score >= 70 ? 'good' : score >= 50 ? 'avg' : 'low';
  return (
    <div className="score-display">
      <span className={`score-display__num score-display__num--${cls}`}>{score}</span>
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${pct}%`, background: score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)' }} />
      </div>
    </div>
  );
}

function EvalSheet({ criteria, prefix, values, onChange, existingMap, onSave, saveLabel = 'Save Scores' }) {
  return (
    <div className="eval-sheet">
      <div className="eval-sheet__rows">
        {criteria.map((c) => {
          const key = `${prefix}_${c.id}`;
          const existing = existingMap?.[`${prefix}_${c.id}`];
          return (
            <div key={c.id} className="eval-sheet__row">
              <div className="eval-sheet__label">
                <span>{c.name}</span>
                <span className="eval-sheet__weight">{(c.weight * 100).toFixed(0)}%</span>
              </div>
              {existing != null ? (
                <div className="eval-sheet__scored">
                  <span className="eval-sheet__existing">{existing} / 100</span>
                  <span className="eval-sheet__locked">Scored</span>
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="field__input eval-sheet__input"
                  placeholder="0–100"
                  value={values[key] || ''}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
      {criteria.some((c) => existingMap?.[`${prefix}_${c.id}`] == null) && (
        <button className="btn btn--secondary btn--sm" onClick={onSave}>{saveLabel}</button>
      )}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────

function App() {
  // Auth
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regForm, setRegForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '', password2: '', role: 'student' });
  const [regError, setRegError] = useState('');
  const [user, setUser] = useState(null);

  // Student state
  const [logs, setLogs] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [newLog, setNewLog] = useState({ week_number: '', activities: '', placement: '' });
  const [editingLog, setEditingLog] = useState(null);
  const [newPlacement, setNewPlacement] = useState(BLANK_PLACEMENT);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [showPlacementForm, setShowPlacementForm] = useState(false);

  // Supervisor state
  const [supervisorPlacements, setSupervisorPlacements] = useState([]);
  const [supervisorLogs, setSupervisorLogs] = useState([]);
  const [placementEvals, setPlacementEvals] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [criteria, setCriteria] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [evalInputs, setEvalInputs] = useState({});   // for per-log scoring
  const [placementEvalInputs, setPlacementEvalInputs] = useState({}); // for overall scoring

  // Shared
  const [allUsers, setAllUsers] = useState([]);

  // Admin state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);

  // ── Data fetchers ──────────────────────────────────────────────────────

  const fetchStudentData = async () => {
    try {
      const [logsRes, placementsRes, usersRes] = await Promise.all([
        api.get('/logs/'), api.get('/placements/'), api.get('/users/'),
      ]);
      setLogs(logsRes.data);
      setPlacements(placementsRes.data);
      setAllUsers(usersRes.data);
    } catch (err) { console.error(err); }
  };

  const fetchSupervisorData = async () => {
    try {
      const [criteriaRes, logsRes, placementsRes, usersRes, pvRes] = await Promise.all([
        api.get('/criteria/'), api.get('/logs/'), api.get('/placements/'),
        api.get('/users/'), api.get('/placement-evaluations/'),
      ]);
      setCriteria(criteriaRes.data);
      setSupervisorLogs(logsRes.data);
      setSupervisorPlacements(placementsRes.data);
      setAllUsers(usersRes.data);
      setPlacementEvals(pvRes.data);
    } catch (err) { console.error(err); }
  };

  const fetchAdminData = async () => {
    try {
      const [usersRes, logsRes] = await Promise.all([api.get('/users/'), api.get('/logs/')]);
      setAdminUsers(usersRes.data);
      setAdminLogs(logsRes.data);
    } catch (err) { console.error(err); }
  };

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleCreatePlacement = async (e) => {
    e.preventDefault();
    const payload = {
      ...newPlacement,
      supervisor: newPlacement.supervisor || null,
      academic_supervisor: newPlacement.academic_supervisor || null,
    };
    try {
      if (editingPlacement) {
        await api.patch(`/placements/${editingPlacement.id}/`, payload);
        toast.success('Placement updated!');
      } else {
        await api.post('/placements/', { ...payload, student: user.id });
        toast.success('Placement added!');
      }
      setNewPlacement(BLANK_PLACEMENT);
      setEditingPlacement(null);
      setShowPlacementForm(false);
      fetchStudentData();
    } catch (err) { toast.error(apiError(err)); }
  };

  const startEditPlacement = (p) => {
    setEditingPlacement(p);
    setNewPlacement({
      company_name: p.company_name || '',
      start_date: p.start_date || '',
      end_date: p.end_date || '',
      supervisor: p.supervisor || '',
      academic_supervisor: p.academic_supervisor || '',
      school_name: p.school_name || '',
      course: p.course || '',
      registration_number: p.registration_number || '',
      placement_letter_url: p.placement_letter_url || '',
    });
    setShowPlacementForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    try {
      if (editingLog) {
        await api.patch(`/logs/${editingLog.id}/`, { week_number: newLog.week_number, activities: newLog.activities, placement: newLog.placement });
        toast.success('Log updated!');
      } else {
        await api.post('/logs/', newLog);
        toast.success('Log created!');
      }
      setNewLog({ week_number: '', activities: '', placement: '' });
      setEditingLog(null);
      fetchStudentData();
    } catch (err) { toast.error(apiError(err)); }
  };

  const handleSubmitLog = async (logId) => {
    try {
      await api.patch(`/logs/${logId}/`, { status: 'submitted' });
      fetchStudentData();
      toast.success('Log submitted for review!');
    } catch (err) { toast.error(apiError(err)); }
  };

  const handleSupervisorAction = async (logId, newStatus, feedbackText) => {
    if (newStatus === 'draft' && !feedbackText.trim()) {
      toast.error('Feedback is required when requesting changes.');
      return;
    }
    try {
      await api.patch(`/logs/${logId}/`, { status: newStatus, feedback: feedbackText });
      fetchSupervisorData();
      toast.success(newStatus === 'approved' ? 'Log approved!' : newStatus === 'draft' ? 'Changes requested.' : 'Log updated!');
    } catch (err) { toast.error(apiError(err)); }
  };

  const saveLogEvaluations = async (logId) => {
    const scores = {};
    criteria.forEach((c) => {
      const key = `${logId}_${c.id}`;
      if (evalInputs[key]) scores[c.id] = evalInputs[key];
    });
    if (!Object.keys(scores).length) { toast.error('Enter at least one score.'); return; }
    const results = await Promise.allSettled(
      Object.entries(scores).map(([cId, score]) =>
        api.post('/evaluations/', { log: logId, criteria: parseInt(cId), score: parseFloat(score) })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) toast.success('Scores saved.');
    else if (failed.length < results.length) toast.warning('Some scores saved; others already recorded.');
    else toast.error(apiError(failed[0].reason));
    fetchSupervisorData();
  };

  const savePlacementEvaluations = async (placementId) => {
    const scores = {};
    criteria.forEach((c) => {
      const key = `${placementId}_${c.id}`;
      if (placementEvalInputs[key]) scores[c.id] = placementEvalInputs[key];
    });
    if (!Object.keys(scores).length) { toast.error('Enter at least one score.'); return; }
    const results = await Promise.allSettled(
      Object.entries(scores).map(([cId, score]) =>
        api.post('/placement-evaluations/', { placement: placementId, criteria: parseInt(cId), score: parseFloat(score) })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) toast.success('Overall assessment saved!');
    else if (failed.length < results.length) toast.warning('Some scores saved; others already recorded.');
    else toast.error(apiError(failed[0].reason));
    fetchSupervisorData();
  };

  const logout = (clearState) => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setAllUsers([]);
    clearState();
  };

  const storeTokensAndLogin = ({ access, refresh }) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    const payload = parseJwt(access);
    const userData = { id: payload.user_id, username: payload.username, role: payload.role };
    setUser(userData);
    if (payload.role === 'student') fetchStudentData();
    else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor') fetchSupervisorData();
    else if (payload.role === 'admin') fetchAdminData();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.post('/token/', { username, password });
      storeTokensAndLogin(res.data);
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Invalid username or password.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regForm.password !== regForm.password2) { setRegError('Passwords do not match.'); return; }
    try {
      const res = await api.post('/register/', regForm);
      toast.success('Account created! Welcome to ILES.');
      storeTokensAndLogin(res.data);
    } catch (err) { setRegError(apiError(err)); }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const payload = parseJwt(token);
      const userData = { id: payload.user_id, username: payload.username, role: payload.role };
      setUser(userData);
      if (payload.role === 'student') fetchStudentData();
      else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor') fetchSupervisorData();
      else if (payload.role === 'admin') fetchAdminData();
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }, []);

  // ── Auth page ──────────────────────────────────────────────────────────

  if (!user) {
    const isLogin = authMode === 'login';
    const errIcon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    );
    return (
      <div className="login-page">
        <ToastContainer />
        <div className="login-card">
          <div className="login-card__logo">ILES</div>
          {isLogin ? (
            <>
              <h1 className="login-card__title">Welcome back</h1>
              <p className="login-card__subtitle">Sign in to your internship logbook</p>
              {loginError && <div className="alert alert--danger">{errIcon}{loginError}</div>}
              <form onSubmit={handleLogin} className="login-form">
                <div className="field">
                  <label className="field__label">Username</label>
                  <input type="text" className="field__input" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
                </div>
                <div className="field">
                  <label className="field__label">Password</label>
                  <input type="password" className="field__input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: 8 }}>Sign In</button>
              </form>
              <p className="auth-switch">Don&apos;t have an account? <button className="auth-switch__link" onClick={() => { setAuthMode('register'); setLoginError(''); }}>Create one</button></p>
            </>
          ) : (
            <>
              <h1 className="login-card__title">Create account</h1>
              <p className="login-card__subtitle">Join ILES to log your internship</p>
              {regError && <div className="alert alert--danger">{errIcon}{regError}</div>}
              <form onSubmit={handleRegister} className="login-form">
                <div className="field">
                  <label className="field__label">I am a…</label>
                  <div className="role-selector">
                    {SIGNUP_ROLES.map((r) => (
                      <button key={r.value} type="button" className={`role-option${regForm.role === r.value ? ' role-option--active' : ''}`} onClick={() => setRegForm({ ...regForm, role: r.value })}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div className="two-col-form">
                  <div className="field"><label className="field__label">First Name</label><input type="text" className="field__input" placeholder="First name" value={regForm.first_name} onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })} /></div>
                  <div className="field"><label className="field__label">Last Name</label><input type="text" className="field__input" placeholder="Last name" value={regForm.last_name} onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })} /></div>
                </div>
                <div className="field"><label className="field__label">Username</label><input type="text" className="field__input" placeholder="Choose a username" value={regForm.username} onChange={(e) => setRegForm({ ...regForm, username: e.target.value })} required autoComplete="username" /></div>
                <div className="field"><label className="field__label">Email</label><input type="email" className="field__input" placeholder="your@email.com" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} required autoComplete="email" /></div>
                <div className="two-col-form">
                  <div className="field"><label className="field__label">Password</label><input type="password" className="field__input" placeholder="Min. 8 characters" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} required autoComplete="new-password" /></div>
                  <div className="field"><label className="field__label">Confirm Password</label><input type="password" className="field__input" placeholder="Repeat password" value={regForm.password2} onChange={(e) => setRegForm({ ...regForm, password2: e.target.value })} required autoComplete="new-password" /></div>
                </div>
                <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: 8 }}>Create Account</button>
              </form>
              <p className="auth-switch">Already have an account? <button className="auth-switch__link" onClick={() => { setAuthMode('login'); setRegError(''); }}>Sign in</button></p>
            </>
          )}
        </div>
        <p className="login-page__footer">Internship Logbook &amp; Evaluation System</p>
      </div>
    );
  }

  // ── Student dashboard ──────────────────────────────────────────────────

  if (user.role === 'student') {
    const placementMap = Object.fromEntries(placements.map((p) => [p.id, p.company_name]));
    const workplaceSupervisors = allUsers.filter((u) => u.role === 'workplace_supervisor');
    const academicSupervisors = allUsers.filter((u) => u.role === 'academic_supervisor');

    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => { setLogs([]); setPlacements([]); })} />
        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">My Logbook</h1>
            <p className="page-subtitle">Manage your internship placement and weekly logs</p>
          </div>

          <div className="stats-row">
            <StatCard label="Total Logs" value={logs.length} accent="primary" />
            <StatCard label="Draft" value={logs.filter((l) => l.status === 'draft').length} accent="neutral" />
            <StatCard label="Submitted" value={logs.filter((l) => l.status === 'submitted').length} accent="warning" />
            <StatCard label="Approved" value={logs.filter((l) => l.status === 'approved').length} accent="success" />
          </div>

          {/* Placements */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">My Placement</h2>
              <button className="btn btn--secondary btn--sm" onClick={() => { setShowPlacementForm((v) => !v); if (showPlacementForm) { setEditingPlacement(null); setNewPlacement(BLANK_PLACEMENT); } }}>
                {showPlacementForm ? 'Cancel' : '+ Add Placement'}
              </button>
            </div>

            {showPlacementForm && (
              <div className="card__body placement-form-body">
                <h3 className="form-section-title">{editingPlacement ? 'Edit Placement' : 'New Placement'}</h3>

                <form onSubmit={handleCreatePlacement}>
                  <div className="form-section">
                    <p className="form-section-label">Company Details</p>
                    <div className="three-col-form">
                      <div className="field field--span2"><label className="field__label">Company Name</label><input type="text" className="field__input" placeholder="e.g. Acme Ltd" value={newPlacement.company_name} onChange={(e) => setNewPlacement({ ...newPlacement, company_name: e.target.value })} required /></div>
                      <div className="field" />
                      <div className="field"><label className="field__label">Start Date</label><input type="date" className="field__input" value={newPlacement.start_date} onChange={(e) => setNewPlacement({ ...newPlacement, start_date: e.target.value })} required /></div>
                      <div className="field"><label className="field__label">End Date</label><input type="date" className="field__input" value={newPlacement.end_date} onChange={(e) => setNewPlacement({ ...newPlacement, end_date: e.target.value })} required /></div>
                    </div>
                  </div>

                  <div className="form-section">
                    <p className="form-section-label">School Details</p>
                    <div className="three-col-form">
                      <div className="field field--span2"><label className="field__label">School / University</label><input type="text" className="field__input" placeholder="e.g. Makerere University" value={newPlacement.school_name} onChange={(e) => setNewPlacement({ ...newPlacement, school_name: e.target.value })} /></div>
                      <div className="field"><label className="field__label">Registration Number</label><input type="text" className="field__input" placeholder="e.g. 20/U/1234" value={newPlacement.registration_number} onChange={(e) => setNewPlacement({ ...newPlacement, registration_number: e.target.value })} /></div>
                      <div className="field field--span2"><label className="field__label">Course / Programme</label><input type="text" className="field__input" placeholder="e.g. BSc Computer Science" value={newPlacement.course} onChange={(e) => setNewPlacement({ ...newPlacement, course: e.target.value })} /></div>
                      <div className="field field--span3"><label className="field__label">Placement Letter URL <span className="field__hint">— paste a shareable link (Google Drive, OneDrive, etc.)</span></label><input type="text" className="field__input" placeholder="https://drive.google.com/..." value={newPlacement.placement_letter_url} onChange={(e) => setNewPlacement({ ...newPlacement, placement_letter_url: e.target.value })} /></div>
                    </div>
                  </div>

                  <div className="form-section">
                    <p className="form-section-label">Supervisors</p>
                    <div className="two-col-form">
                      <div className="field"><label className="field__label">Workplace Supervisor</label>
                        <select className="field__input" value={newPlacement.supervisor} onChange={(e) => setNewPlacement({ ...newPlacement, supervisor: e.target.value })}>
                          <option value="">None assigned</option>
                          {workplaceSupervisors.map((s) => <option key={s.id} value={s.id}>{s.first_name ? `${s.first_name} ${s.last_name}` : s.username}</option>)}
                        </select>
                      </div>
                      <div className="field"><label className="field__label">Academic Supervisor</label>
                        <select className="field__input" value={newPlacement.academic_supervisor} onChange={(e) => setNewPlacement({ ...newPlacement, academic_supervisor: e.target.value })}>
                          <option value="">None assigned</option>
                          {academicSupervisors.map((s) => <option key={s.id} value={s.id}>{s.first_name ? `${s.first_name} ${s.last_name}` : s.username}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="btn-row">
                    <button type="submit" className="btn btn--primary">{editingPlacement ? 'Save Changes' : 'Add Placement'}</button>
                    <button type="button" className="btn btn--ghost" onClick={() => { setShowPlacementForm(false); setEditingPlacement(null); setNewPlacement(BLANK_PLACEMENT); }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="card__body--list">
              {placements.length === 0 ? (
                <div className="empty-state"><p>No placement yet. Add your internship details above to get started.</p></div>
              ) : (
                placements.map((p) => {
                  const workSup = allUsers.find((u) => u.id === p.supervisor);
                  const acadSup = allUsers.find((u) => u.id === p.academic_supervisor);
                  return (
                    <div key={p.id} className="placement-card">
                      <div className="placement-card__top">
                        <div>
                          <h3 className="placement-card__company">{p.company_name}</h3>
                          <p className="placement-card__dates">{p.start_date} → {p.end_date}</p>
                        </div>
                        <button className="btn btn--ghost btn--sm" onClick={() => startEditPlacement(p)}>Edit</button>
                      </div>
                      <div className="info-grid">
                        {p.school_name && <div className="info-item"><span className="info-item__label">School</span><span className="info-item__value">{p.school_name}</span></div>}
                        {p.course && <div className="info-item"><span className="info-item__label">Course</span><span className="info-item__value">{p.course}</span></div>}
                        {p.registration_number && <div className="info-item"><span className="info-item__label">Reg No.</span><span className="info-item__value">{p.registration_number}</span></div>}
                        <div className="info-item"><span className="info-item__label">Work Supervisor</span><span className="info-item__value">{workSup ? (workSup.first_name ? `${workSup.first_name} ${workSup.last_name}` : workSup.username) : <em>Not assigned</em>}</span></div>
                        <div className="info-item"><span className="info-item__label">Academic Supervisor</span><span className="info-item__value">{acadSup ? (acadSup.first_name ? `${acadSup.first_name} ${acadSup.last_name}` : acadSup.username) : <em>Not assigned</em>}</span></div>
                        {p.placement_letter_url && <div className="info-item"><span className="info-item__label">Placement Letter</span><a className="info-item__link" href={p.placement_letter_url} target="_blank" rel="noreferrer">View Document ↗</a></div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Log form + list */}
          <div className="two-col">
            <div className="card">
              <div className="card__header"><h2 className="card__title">{editingLog ? 'Edit Log' : 'New Weekly Log'}</h2></div>
              <div className="card__body">
                {placements.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}><p>Add a placement before creating logs.</p></div>
                ) : (
                  <form onSubmit={handleCreateLog}>
                    <div className="field"><label className="field__label">Week Number</label><input type="number" className="field__input" placeholder="e.g. 1" min="1" value={newLog.week_number} onChange={(e) => setNewLog({ ...newLog, week_number: e.target.value })} required /></div>
                    <div className="field"><label className="field__label">Placement</label>
                      <select className="field__input" value={newLog.placement} onChange={(e) => setNewLog({ ...newLog, placement: e.target.value })} required>
                        <option value="">Select a placement…</option>
                        {placements.map((p) => <option key={p.id} value={p.id}>{p.company_name}</option>)}
                      </select>
                    </div>
                    <div className="field"><label className="field__label">Activities</label><textarea className="field__input field__input--textarea" placeholder="Describe your activities this week…" value={newLog.activities} onChange={(e) => setNewLog({ ...newLog, activities: e.target.value })} rows={5} required /></div>
                    <div className="btn-row">
                      <button type="submit" className="btn btn--primary">{editingLog ? 'Update Log' : 'Create Log'}</button>
                      {editingLog && <button type="button" className="btn btn--ghost" onClick={() => { setEditingLog(null); setNewLog({ week_number: '', activities: '', placement: '' }); }}>Cancel</button>}
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__header"><h2 className="card__title">My Logs</h2><span className="card__count">{logs.length}</span></div>
              <div className="card__body--list">
                {logs.length === 0 ? (
                  <div className="empty-state"><p>No logs yet. Create your first weekly log.</p></div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="log-item">
                      <div className="log-item__head">
                        <span className="log-item__week">Week {log.week_number}</span>
                        <StatusBadge status={log.status} />
                        {log.total_score != null && log.total_score > 0 && <span className="log-item__score">Score: {log.total_score}</span>}
                      </div>
                      {placementMap[log.placement] && <div className="log-item__placement">{placementMap[log.placement]}</div>}
                      <p className="log-item__activities">{log.activities}</p>
                      {log.feedback && <p className="log-item__feedback"><strong>Feedback:</strong> {log.feedback}</p>}
                      {log.status === 'draft' && (
                        <div className="btn-row btn-row--sm">
                          <button className="btn btn--secondary btn--sm" onClick={() => { setEditingLog(log); setNewLog({ week_number: log.week_number, activities: log.activities, placement: log.placement }); }}>Edit</button>
                          <button className="btn btn--primary btn--sm" onClick={() => handleSubmitLog(log.id)}>Submit for Review</button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Supervisor dashboards (workplace + academic) ────────────────────────

  if (user.role === 'workplace_supervisor' || user.role === 'academic_supervisor') {
    const isWorkplace = user.role === 'workplace_supervisor';
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));

    // Group logs by placement
    const logsByPlacement = {};
    supervisorLogs.forEach((log) => {
      if (!logsByPlacement[log.placement]) logsByPlacement[log.placement] = [];
      logsByPlacement[log.placement].push(log);
    });

    // Build existing placement eval map: `${placementId}_${criteriaId}` → score
    const existingPlacementEvalMap = {};
    placementEvals.forEach((ev) => {
      existingPlacementEvalMap[`${ev.placement}_${ev.criteria}`] = ev.score;
    });

    const totalApproved = supervisorLogs.filter((l) => l.status === 'approved').length;
    const totalPending = supervisorLogs.filter((l) => l.status === 'submitted').length;

    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => { setSupervisorLogs([]); setSupervisorPlacements([]); setAllUsers([]); })} />
        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">{isWorkplace ? 'Workplace Supervisor' : 'Academic Supervisor'} Dashboard</h1>
            <p className="page-subtitle">
              {isWorkplace ? 'Review logs and assess student performance' : 'Monitor students and provide academic assessments'}
            </p>
          </div>

          <div className="stats-row">
            <StatCard label="My Students" value={supervisorPlacements.length} accent="primary" />
            <StatCard label="Total Logs" value={supervisorLogs.length} accent="secondary" />
            <StatCard label="Pending Review" value={totalPending} accent="warning" />
            <StatCard label="Approved" value={totalApproved} accent="success" />
          </div>

          {supervisorPlacements.length === 0 ? (
            <div className="card"><div className="card__body"><div className="empty-state"><p>No students assigned to you yet.</p></div></div></div>
          ) : (
            supervisorPlacements.map((placement) => {
              const student = userMap[placement.student];
              const logs = logsByPlacement[placement.id] || [];
              const pendingLogs = logs.filter((l) => l.status === 'submitted');
              const reviewedLogs = logs.filter((l) => l.status === 'reviewed');
              const isExpanded = expandedCards[placement.id];

              return (
                <div key={placement.id} className="student-card">
                  {/* Card header */}
                  <div className="student-card__header" onClick={() => setExpandedCards((prev) => ({ ...prev, [placement.id]: !prev[placement.id] }))}>
                    <div className="student-card__identity">
                      <div className="student-avatar">{student ? (student.first_name || student.username)[0].toUpperCase() : '?'}</div>
                      <div>
                        <h3 className="student-card__name">
                          {student ? (student.first_name ? `${student.first_name} ${student.last_name}` : student.username) : `Student #${placement.student}`}
                        </h3>
                        <p className="student-card__sub">{placement.company_name} · {placement.start_date} → {placement.end_date}</p>
                      </div>
                    </div>
                    <div className="student-card__meta">
                      {pendingLogs.length > 0 && <span className="card__count card__count--warning">{pendingLogs.length} pending</span>}
                      <span className="card__count">{logs.length} logs</span>
                      <span className="student-card__chevron">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="student-card__body">
                      {/* Student info grid */}
                      <div className="info-grid info-grid--compact">
                        {placement.school_name && <div className="info-item"><span className="info-item__label">School</span><span className="info-item__value">{placement.school_name}</span></div>}
                        {placement.course && <div className="info-item"><span className="info-item__label">Course</span><span className="info-item__value">{placement.course}</span></div>}
                        {placement.registration_number && <div className="info-item"><span className="info-item__label">Reg No.</span><span className="info-item__value">{placement.registration_number}</span></div>}
                        {student?.email && <div className="info-item"><span className="info-item__label">Email</span><span className="info-item__value">{student.email}</span></div>}
                        {placement.placement_letter_url && (
                          <div className="info-item"><span className="info-item__label">Placement Letter</span><a className="info-item__link" href={placement.placement_letter_url} target="_blank" rel="noreferrer">View ↗</a></div>
                        )}
                      </div>

                      {/* WORKPLACE SUPERVISOR: Pending logs to review */}
                      {isWorkplace && pendingLogs.length > 0 && (
                        <div className="sub-section">
                          <h4 className="sub-section__title">Pending Review ({pendingLogs.length})</h4>
                          {pendingLogs.map((log) => (
                            <div key={log.id} className="log-item log-item--compact">
                              <div className="log-item__head">
                                <span className="log-item__week">Week {log.week_number}</span>
                                <StatusBadge status={log.status} />
                              </div>
                              <p className="log-item__activities">{log.activities}</p>
                              <button className="btn btn--secondary btn--sm" onClick={() => handleSupervisorAction(log.id, 'reviewed', '')}>Mark Reviewed</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* WORKPLACE SUPERVISOR: Reviewed logs — score + approve */}
                      {isWorkplace && reviewedLogs.length > 0 && (
                        <div className="sub-section">
                          <h4 className="sub-section__title">Reviewed — Awaiting Scores / Decision ({reviewedLogs.length})</h4>
                          {reviewedLogs.map((log) => (
                            <div key={log.id} className="log-item log-item--eval">
                              <div className="log-item__head">
                                <span className="log-item__week">Week {log.week_number}</span>
                                <StatusBadge status={log.status} />
                                {log.total_score != null && log.total_score > 0 && <span className="log-item__score">Score: {log.total_score}</span>}
                              </div>
                              <p className="log-item__activities">{log.activities}</p>

                              {criteria.length > 0 && (
                                <EvalSheet
                                  criteria={criteria}
                                  prefix={String(log.id)}
                                  values={evalInputs}
                                  onChange={(key, val) => setEvalInputs((prev) => ({ ...prev, [key]: val }))}
                                  existingMap={Object.fromEntries(Object.entries(existingPlacementEvalMap).filter(([k]) => k.startsWith(`${log.id}_`)))}
                                  onSave={() => saveLogEvaluations(log.id)}
                                  saveLabel="Save Weekly Scores"
                                />
                              )}

                              <div className="field" style={{ marginTop: 14 }}>
                                <label className="field__label">Feedback <span className="field__hint">— required for request-changes</span></label>
                                <textarea className="field__input field__input--textarea" placeholder="Write feedback…" value={feedback[log.id] || ''} onChange={(e) => setFeedback({ ...feedback, [log.id]: e.target.value })} rows={2} style={{ minHeight: 60 }} />
                              </div>
                              <div className="btn-row btn-row--sm">
                                <button className="btn btn--success btn--sm" onClick={() => handleSupervisorAction(log.id, 'approved', feedback[log.id] || '')}>Approve</button>
                                <button className="btn btn--danger btn--sm" onClick={() => handleSupervisorAction(log.id, 'draft', feedback[log.id] || '')}>Request Changes</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ACADEMIC SUPERVISOR: All logs (read-only with scores) */}
                      {!isWorkplace && logs.length > 0 && (
                        <div className="sub-section">
                          <h4 className="sub-section__title">Weekly Logs &amp; Workplace Scores</h4>
                          <table className="data-table">
                            <thead><tr><th>Week</th><th>Status</th><th>Work Score</th><th>Activities</th></tr></thead>
                            <tbody>
                              {logs.map((log) => (
                                <tr key={log.id}>
                                  <td>Week {log.week_number}</td>
                                  <td><StatusBadge status={log.status} /></td>
                                  <td><ScoreDisplay score={log.total_score > 0 ? log.total_score : null} /></td>
                                  <td className="td--truncate">{log.activities}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* BOTH: Overall placement assessment */}
                      {criteria.length > 0 && (
                        <div className="sub-section">
                          <h4 className="sub-section__title">
                            {isWorkplace ? 'Overall Performance Assessment' : 'Academic Assessment'}
                          </h4>
                          <p className="sub-section__desc">
                            {isWorkplace
                              ? 'Score the student\'s overall performance during this placement.'
                              : 'Provide your academic assessment of this student\'s internship.'}
                          </p>
                          <EvalSheet
                            criteria={criteria}
                            prefix={String(placement.id)}
                            values={placementEvalInputs}
                            onChange={(key, val) => setPlacementEvalInputs((prev) => ({ ...prev, [key]: val }))}
                            existingMap={existingPlacementEvalMap}
                            onSave={() => savePlacementEvaluations(placement.id)}
                            saveLabel={isWorkplace ? 'Submit Performance Assessment' : 'Submit Academic Assessment'}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>
      </div>
    );
  }

  // ── Admin dashboard ────────────────────────────────────────────────────

  if (user.role === 'admin') {
    const userMap = Object.fromEntries(adminUsers.map((u) => [u.id, u.username]));
    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => { setAdminUsers([]); setAdminLogs([]); })} />
        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">System-wide overview of users and logs</p>
          </div>
          <div className="stats-row">
            <StatCard label="Total Users" value={adminUsers.length} accent="primary" />
            <StatCard label="Total Logs" value={adminLogs.length} accent="secondary" />
            <StatCard label="Approved" value={adminLogs.filter((l) => l.status === 'approved').length} accent="success" />
            <StatCard label="Pending" value={adminLogs.filter((l) => l.status === 'submitted').length} accent="warning" />
          </div>

          <div className="card">
            <div className="card__header"><h2 className="card__title">All Users</h2><span className="card__count">{adminUsers.length}</span></div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Email</th></tr></thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td><td>{u.username}</td>
                      <td><span className={`role-pill role-pill--${u.role}`}>{ROLE_LABELS[u.role] ?? u.role}</span></td>
                      <td>{u.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card__header"><h2 className="card__title">All Logs</h2><span className="card__count">{adminLogs.length}</span></div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              {adminLogs.length === 0 ? <div className="empty-state"><p>No logs yet.</p></div> : (
                <table className="data-table">
                  <thead><tr><th>ID</th><th>Student</th><th>Week</th><th>Activities</th><th>Status</th><th>Score</th><th>Feedback</th></tr></thead>
                  <tbody>
                    {adminLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>{userMap[log.student] ?? `#${log.student}`}</td>
                        <td>{log.week_number}</td>
                        <td className="td--truncate">{log.activities}</td>
                        <td><StatusBadge status={log.status} /></td>
                        <td>{log.total_score > 0 ? log.total_score : '—'}</td>
                        <td>{log.feedback || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Unknown role ───────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <main className="page-content">
        <div className="card"><div className="card__body">
          <div className="alert alert--danger">Unknown role: <strong>{user.role}</strong>. Please contact support.</div>
          <button className="btn btn--ghost" onClick={() => logout(() => {})}>Sign out</button>
        </div></div>
      </main>
    </div>
  );
}

export default App;
