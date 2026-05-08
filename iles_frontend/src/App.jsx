import { useState, useEffect } from 'react';
import api from './api/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const parseJwt = (token) => {
  let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(base64));
};

// Extract a readable error message from any DRF error shape
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

const ROLE_LABELS = {
  student: 'Student',
  workplace_supervisor: 'Workplace Supervisor',
  academic_supervisor: 'Academic Supervisor',
  admin: 'Administrator',
};

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  approved: 'Approved',
};

function StatusBadge({ status }) {
  return (
    <span className={`badge badge--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
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
        <span className={`role-pill role-pill--${user.role}`}>
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [user, setUser] = useState(null);

  // Student state
  const [newLog, setNewLog] = useState({ week_number: '', activities: '', placement: '' });
  const [logs, setLogs] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [editingLog, setEditingLog] = useState(null);
  const [newPlacement, setNewPlacement] = useState({ company_name: '', start_date: '', end_date: '', supervisor: '' });
  const [showPlacementForm, setShowPlacementForm] = useState(false);

  // Supervisor state
  const [supervisorLogs, setSupervisorLogs] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [criteria, setCriteria] = useState([]);

  // Shared users list — students use it for supervisor picker;
  // supervisors use it to look up student names
  const [allUsers, setAllUsers] = useState([]);

  // Admin state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);

  // ── Data fetchers ────────────────────────────────────────────────────────

  const fetchStudentData = async () => {
    try {
      const [logsRes, placementsRes, usersRes] = await Promise.all([
        api.get('/logs/'),
        api.get('/placements/'),
        api.get('/users/'),
      ]);
      setLogs(logsRes.data);
      setPlacements(placementsRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch student data', err);
    }
  };

  const fetchSupervisorData = async () => {
    try {
      const [criteriaRes, logsRes, usersRes] = await Promise.all([
        api.get('/criteria/'),
        api.get('/logs/'),
        api.get('/users/'),
      ]);
      setCriteria(criteriaRes.data);
      setSupervisorLogs(logsRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch supervisor data.', err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [usersRes, logsRes] = await Promise.all([
        api.get('/users/'),
        api.get('/logs/'),
      ]);
      setAdminUsers(usersRes.data);
      setAdminLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data.', err);
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreatePlacement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/placements/', {
        company_name: newPlacement.company_name,
        start_date: newPlacement.start_date,
        end_date: newPlacement.end_date,
        // Backend has no perform_create override — must send student ID explicitly
        student: user.id,
        supervisor: newPlacement.supervisor || null,
      });
      toast.success('Placement added!');
      setNewPlacement({ company_name: '', start_date: '', end_date: '', supervisor: '' });
      setShowPlacementForm(false);
      fetchStudentData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    try {
      if (editingLog) {
        await api.patch(`/logs/${editingLog.id}/`, {
          week_number: newLog.week_number,
          activities: newLog.activities,
          placement: newLog.placement,
        });
        toast.success('Log updated! You can now submit for review.');
      } else {
        await api.post('/logs/', {
          week_number: newLog.week_number,
          activities: newLog.activities,
          placement: newLog.placement,
        });
        toast.success('Log created! You can now submit for review.');
      }
      setNewLog({ week_number: '', activities: '', placement: '' });
      setEditingLog(null);
      fetchStudentData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleSubmitLog = async (logId) => {
    try {
      await api.patch(`/logs/${logId}/`, { status: 'submitted' });
      fetchStudentData();
      toast.success('Log submitted for review!');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  // Saves evaluation scores using Promise.allSettled so a duplicate-criteria
  // error on one score doesn't abort the others
  const saveEvaluations = async (logId) => {
    const scores = {};
    criteria.forEach((c) => {
      const key = `score_${logId}_${c.id}`;
      if (feedback[key]) scores[c.id] = feedback[key];
    });

    if (Object.keys(scores).length === 0) {
      toast.error('Please enter at least one score before saving.');
      return;
    }

    const results = await Promise.allSettled(
      Object.entries(scores).map(([criteriaId, score]) =>
        api.post('/evaluations/', {
          log: logId,
          criteria: parseInt(criteriaId),
          score: parseFloat(score),
        })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      toast.success('Scores saved.');
    } else if (failed.length < results.length) {
      toast.warning('Some scores saved; others were already recorded for this log.');
    } else {
      toast.error(apiError(failed[0].reason));
    }
    fetchSupervisorData();
  };

  const handleSupervisorAction = async (logId, newStatus, feedbackText) => {
    // Backend enforces this too, but validate client-side for a better UX
    if (newStatus === 'draft' && !feedbackText.trim()) {
      toast.error('Feedback is required when requesting changes.');
      return;
    }
    try {
      await api.patch(`/logs/${logId}/`, { status: newStatus, feedback: feedbackText });
      fetchSupervisorData();
      toast.success(
        newStatus === 'approved'
          ? 'Log approved!'
          : newStatus === 'draft'
          ? 'Changes requested — log returned to student.'
          : 'Log updated!'
      );
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const logout = (clearState) => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setAllUsers([]);
    clearState();
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const payload = parseJwt(token);
      // user_id is in the JWT payload (set by SimpleJWT by default)
      const userData = { id: payload.user_id, username: payload.username, role: payload.role };
      setUser(userData);
      if (payload.role === 'student') fetchStudentData();
      else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor')
        fetchSupervisorData();
      else if (payload.role === 'admin') fetchAdminData();
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    let response;
    try {
      response = await api.post('/token/', { username, password });
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Invalid username or password.');
      return;
    }
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    const payload = parseJwt(access);
    const userData = { id: payload.user_id, username: payload.username, role: payload.role };
    setUser(userData);
    if (payload.role === 'student') fetchStudentData();
    else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor')
      fetchSupervisorData();
    else if (payload.role === 'admin') fetchAdminData();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="login-page">
        <ToastContainer />
        <div className="login-card">
          <div className="login-card__logo">ILES</div>
          <h1 className="login-card__title">Welcome back</h1>
          <p className="login-card__subtitle">Sign in to your internship logbook</p>

          {loginError && (
            <div className="alert alert--danger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="field">
              <label className="field__label">Username</label>
              <input
                type="text"
                className="field__input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label className="field__label">Password</label>
              <input
                type="password"
                className="field__input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: 8 }}>
              Sign In
            </button>
          </form>
        </div>
        <p className="login-page__footer">Internship Logbook &amp; Evaluation System</p>
      </div>
    );
  }

  // ── Student ────────────────────────────────────────────────────────────────
  if (user.role === 'student') {
    // Build lookup maps from fetched data
    const placementMap = Object.fromEntries(placements.map((p) => [p.id, p.company_name]));
    const supervisors = allUsers.filter(
      (u) => u.role === 'workplace_supervisor' || u.role === 'academic_supervisor'
    );

    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => { setLogs([]); setPlacements([]); })} />

        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">My Logbook</h1>
            <p className="page-subtitle">Track and submit your weekly internship activities</p>
          </div>

          <div className="stats-row">
            <StatCard label="Total Logs" value={logs.length} accent="primary" />
            <StatCard label="Draft" value={logs.filter((l) => l.status === 'draft').length} accent="neutral" />
            <StatCard label="Submitted" value={logs.filter((l) => l.status === 'submitted').length} accent="warning" />
            <StatCard label="Approved" value={logs.filter((l) => l.status === 'approved').length} accent="success" />
          </div>

          {/* ── Placements section ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">My Placements</h2>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => setShowPlacementForm((v) => !v)}
              >
                {showPlacementForm ? 'Cancel' : '+ Add Placement'}
              </button>
            </div>

            {showPlacementForm && (
              <div className="card__body" style={{ borderBottom: '1px solid var(--border)' }}>
                <form onSubmit={handleCreatePlacement}>
                  <div className="two-col-form">
                    <div className="field">
                      <label className="field__label">Company Name</label>
                      <input
                        type="text"
                        className="field__input"
                        placeholder="e.g. Acme Ltd"
                        value={newPlacement.company_name}
                        onChange={(e) => setNewPlacement({ ...newPlacement, company_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Supervisor (optional)</label>
                      <select
                        className="field__input"
                        value={newPlacement.supervisor}
                        onChange={(e) => setNewPlacement({ ...newPlacement, supervisor: e.target.value })}
                      >
                        <option value="">None assigned</option>
                        {supervisors.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.username} ({ROLE_LABELS[s.role]})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label">Start Date</label>
                      <input
                        type="date"
                        className="field__input"
                        value={newPlacement.start_date}
                        onChange={(e) => setNewPlacement({ ...newPlacement, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">End Date</label>
                      <input
                        type="date"
                        className="field__input"
                        value={newPlacement.end_date}
                        onChange={(e) => setNewPlacement({ ...newPlacement, end_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn--primary btn--sm">
                    Save Placement
                  </button>
                </form>
              </div>
            )}

            <div className="card__body--list">
              {placements.length === 0 ? (
                <div className="empty-state">
                  <p>No placements yet. Add your internship placement above to get started.</p>
                </div>
              ) : (
                placements.map((p) => (
                  <div key={p.id} className="placement-item">
                    <div className="placement-item__name">{p.company_name}</div>
                    <div className="placement-item__meta">
                      <span>{p.start_date} → {p.end_date}</span>
                      {p.supervisor ? (
                        <span className="placement-item__sup">
                          Supervisor: {allUsers.find((u) => u.id === p.supervisor)?.username ?? `#${p.supervisor}`}
                        </span>
                      ) : (
                        <span className="placement-item__sup placement-item__sup--none">
                          No supervisor assigned
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Log form + log list ── */}
          <div className="two-col">
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">{editingLog ? 'Edit Log' : 'New Weekly Log'}</h2>
              </div>
              <div className="card__body">
                {placements.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <p>Add a placement first before creating logs.</p>
                  </div>
                ) : (
                  <form onSubmit={handleCreateLog}>
                    <div className="field">
                      <label className="field__label">Week Number</label>
                      <input
                        type="number"
                        className="field__input"
                        placeholder="e.g. 1"
                        min="1"
                        value={newLog.week_number}
                        onChange={(e) => setNewLog({ ...newLog, week_number: e.target.value })}
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label">Placement</label>
                      <select
                        className="field__input"
                        value={newLog.placement}
                        onChange={(e) => setNewLog({ ...newLog, placement: e.target.value })}
                        required
                      >
                        <option value="">Select a placement…</option>
                        {placements.map((p) => (
                          <option key={p.id} value={p.id}>{p.company_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field__label">Activities</label>
                      <textarea
                        className="field__input field__input--textarea"
                        placeholder="Describe your activities this week…"
                        value={newLog.activities}
                        onChange={(e) => setNewLog({ ...newLog, activities: e.target.value })}
                        rows={5}
                        required
                      />
                    </div>
                    <div className="btn-row">
                      <button type="submit" className="btn btn--primary">
                        {editingLog ? 'Update Log' : 'Create Log'}
                      </button>
                      {editingLog && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            setEditingLog(null);
                            setNewLog({ week_number: '', activities: '', placement: '' });
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <h2 className="card__title">My Logs</h2>
                <span className="card__count">{logs.length}</span>
              </div>
              <div className="card__body--list">
                {logs.length === 0 ? (
                  <div className="empty-state">
                    <p>No logs yet. Create your first weekly log.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="log-item">
                      <div className="log-item__head">
                        <span className="log-item__week">Week {log.week_number}</span>
                        <StatusBadge status={log.status} />
                        {log.total_score != null && log.total_score > 0 && (
                          <span className="log-item__score">Score: {log.total_score}</span>
                        )}
                      </div>
                      {placementMap[log.placement] && (
                        <div className="log-item__placement">{placementMap[log.placement]}</div>
                      )}
                      <p className="log-item__activities">{log.activities}</p>
                      {log.feedback && (
                        <p className="log-item__feedback">
                          <strong>Feedback:</strong> {log.feedback}
                        </p>
                      )}
                      {log.status === 'draft' && (
                        <div className="btn-row btn-row--sm">
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => {
                              setEditingLog(log);
                              // log.placement is already an integer ID from the serializer
                              setNewLog({
                                week_number: log.week_number,
                                activities: log.activities,
                                placement: log.placement,
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn--primary btn--sm"
                            onClick={() => handleSubmitLog(log.id)}
                          >
                            Submit for Review
                          </button>
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

  // ── Supervisor ─────────────────────────────────────────────────────────────
  if (user.role === 'workplace_supervisor' || user.role === 'academic_supervisor') {
    // Build id→username map from the fetched users list
    const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u.username]));
    const pendingLogs = supervisorLogs.filter((l) => l.status === 'submitted');
    const reviewedLogs = supervisorLogs.filter((l) => l.status === 'reviewed');
    const avgScore = (() => {
      const evaluated = supervisorLogs.filter((l) => l.total_score != null && l.total_score > 0);
      if (evaluated.length === 0) return 'N/A';
      return (evaluated.reduce((sum, l) => sum + l.total_score, 0) / evaluated.length).toFixed(2);
    })();

    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => { setSupervisorLogs([]); setAllUsers([]); })} />

        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">Supervisor Dashboard</h1>
            <p className="page-subtitle">Review and evaluate student internship logs</p>
          </div>

          <div className="stats-row">
            <StatCard label="Total Logs" value={supervisorLogs.length} accent="primary" />
            <StatCard label="Pending Review" value={pendingLogs.length} accent="warning" />
            <StatCard label="Reviewed" value={reviewedLogs.length} accent="info" />
            <StatCard label="Approved" value={supervisorLogs.filter((l) => l.status === 'approved').length} accent="success" />
            <StatCard label="Avg Score" value={avgScore} accent="secondary" />
          </div>

          {/* ── Pending reviews ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Pending Reviews</h2>
              <span className={`card__count${pendingLogs.length > 0 ? ' card__count--warning' : ''}`}>
                {pendingLogs.length}
              </span>
            </div>
            <div className="card__body--list">
              {pendingLogs.length === 0 ? (
                <div className="empty-state"><p>No logs pending review — all caught up!</p></div>
              ) : (
                pendingLogs.map((log) => (
                  <div key={log.id} className="log-item">
                    <div className="log-item__head">
                      <span className="log-item__week">Week {log.week_number}</span>
                      <StatusBadge status={log.status} />
                      <span className="log-item__student">
                        {userMap[log.student] ?? `Student #${log.student}`}
                      </span>
                    </div>
                    <p className="log-item__activities">{log.activities}</p>
                    <div className="btn-row btn-row--sm">
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={() => handleSupervisorAction(log.id, 'reviewed', '')}
                      >
                        Mark as Reviewed
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Reviewed — awaiting scoring / approval ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Reviewed Logs</h2>
              <span className="card__count">{reviewedLogs.length}</span>
            </div>
            <div className="card__body--list">
              {reviewedLogs.length === 0 ? (
                <div className="empty-state"><p>No reviewed logs awaiting evaluation.</p></div>
              ) : (
                reviewedLogs.map((log) => (
                  <div key={log.id} className="log-item log-item--eval">
                    <div className="log-item__head">
                      <span className="log-item__week">Week {log.week_number}</span>
                      <StatusBadge status={log.status} />
                      <span className="log-item__student">
                        {userMap[log.student] ?? `Student #${log.student}`}
                      </span>
                      {log.total_score != null && log.total_score > 0 && (
                        <span className="log-item__score">Score: {log.total_score}</span>
                      )}
                    </div>
                    <p className="log-item__activities">{log.activities}</p>

                    {criteria.length > 0 && (
                      <div className="eval-grid">
                        {criteria.map((c) => (
                          <div key={c.id} className="eval-row">
                            <label className="eval-row__label">
                              {c.name}
                              <span className="eval-row__weight">({(c.weight * 100).toFixed(0)}%)</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="field__input eval-row__input"
                              placeholder="0–100"
                              onChange={(e) =>
                                setFeedback((prev) => ({
                                  ...prev,
                                  [`score_${log.id}_${c.id}`]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        ))}
                        <div>
                          <button
                            className="btn btn--secondary btn--sm"
                            onClick={() => saveEvaluations(log.id)}
                          >
                            Save Scores
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="field" style={{ marginTop: 14 }}>
                      <label className="field__label">
                        Feedback
                        <span className="field__hint"> — required when requesting changes</span>
                      </label>
                      <textarea
                        className="field__input field__input--textarea"
                        placeholder="Write feedback for the student…"
                        value={feedback[log.id] || ''}
                        onChange={(e) => setFeedback({ ...feedback, [log.id]: e.target.value })}
                        rows={2}
                        style={{ minHeight: 64 }}
                      />
                    </div>

                    <div className="btn-row btn-row--sm">
                      <button
                        className="btn btn--success btn--sm"
                        onClick={() =>
                          handleSupervisorAction(log.id, 'approved', feedback[log.id] || '')
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() =>
                          handleSupervisorAction(log.id, 'draft', feedback[log.id] || '')
                        }
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── All logs summary table ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">All Logs</h2>
              <span className="card__count">{supervisorLogs.length}</span>
            </div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Week</th>
                    <th>Activities</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisorLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{userMap[log.student] ?? `#${log.student}`}</td>
                      <td>{log.week_number}</td>
                      <td className="td--truncate">{log.activities}</td>
                      <td><StatusBadge status={log.status} /></td>
                      <td>{log.total_score != null && log.total_score > 0 ? log.total_score : '—'}</td>
                      <td>{log.feedback || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  if (user.role === 'admin') {
    // Build id→username map for student column in logs table
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
            <div className="card__header">
              <h2 className="card__title">All Users</h2>
              <span className="card__count">{adminUsers.length}</span>
            </div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>
                        <span className={`role-pill role-pill--${u.role}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td>{u.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2 className="card__title">All Logs</h2>
              <span className="card__count">{adminLogs.length}</span>
            </div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              {adminLogs.length === 0 ? (
                <div className="empty-state"><p>No logs yet.</p></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Student</th>
                      <th>Week</th>
                      <th>Activities</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        {/* log.student is an integer ID — look up username from userMap */}
                        <td>{userMap[log.student] ?? `#${log.student}`}</td>
                        <td>{log.week_number}</td>
                        <td className="td--truncate">{log.activities}</td>
                        <td><StatusBadge status={log.status} /></td>
                        <td>{log.total_score != null && log.total_score > 0 ? log.total_score : '—'}</td>
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

  // ── Unknown role ───────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <main className="page-content">
        <div className="card">
          <div className="card__body">
            <div className="alert alert--danger">
              Unknown role: <strong>{user.role}</strong>. Please contact support.
            </div>
            <button className="btn btn--ghost" onClick={() => logout(() => {})}>Sign out</button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
