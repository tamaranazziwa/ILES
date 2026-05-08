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
        <button className="btn btn--ghost btn--sm" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [newLog, setNewLog] = useState({ week_number: '', activities: '', placement: '' });
  const [logs, setLogs] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [supervisorLogs, setSupervisorLogs] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [editingLog, setEditingLog] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);

  const fetchStudentData = async () => {
    try {
      const [logsRes, placementsRes] = await Promise.all([
        api.get('/logs/'),
        api.get('/placements/'),
      ]);
      setLogs(logsRes.data);
      setPlacements(placementsRes.data);
    } catch (err) {
      console.error('Failed to fetch student data', err);
    }
  };

  const fetchSupervisorLogs = async () => {
    try {
      const [criteriaRes, logsRes] = await Promise.all([
        api.get('/criteria/'),
        api.get('/logs/'),
      ]);
      setCriteria(criteriaRes.data);
      setSupervisorLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to fetch supervisor logs.', err);
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

  const saveEvaluations = async (logId) => {
    const scores = {};
    criteria.forEach((c) => {
      const key = `score_${logId}_${c.id}`;
      if (feedback[key]) scores[c.id] = feedback[key];
    });

    try {
      await Promise.all(
        Object.entries(scores).map(([criteriaId, score]) =>
          api.post('/evaluations/', {
            log: logId,
            criteria: criteriaId,
            score: parseFloat(score),
          })
        )
      );
      toast.success('Evaluations saved.');
      fetchSupervisorLogs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving evaluations.');
    }
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    try {
      if (editingLog) {
        await api.patch(`/logs/${editingLog.id}/`, newLog);
        toast.success('Log updated! You can now submit for review.');
      } else {
        await api.post('/logs/', newLog);
        toast.success('Log created! You can now submit for review.');
      }
      setNewLog({ week_number: '', activities: '', placement: '' });
      setEditingLog(null);
      fetchStudentData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving log.');
    }
  };

  const handleSubmitLog = async (logId) => {
    try {
      await api.patch(`/logs/${logId}/`, { status: 'submitted' });
      fetchStudentData();
      toast.success('Log submitted for review!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error submitting log.');
    }
  };

  const handleSupervisorAction = async (logId, newStatus, feedbackText) => {
    try {
      await api.patch(`/logs/${logId}/`, { status: newStatus, feedback: feedbackText });
      fetchSupervisorLogs();
      toast.success(
        newStatus === 'approved'
          ? 'Log approved!'
          : newStatus === 'draft'
          ? 'Changes requested — log returned to student.'
          : 'Log updated!'
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error updating log.');
    }
  };

  const logout = (clearState) => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    clearState();
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const payload = parseJwt(token);
      const userData = { username: payload.username, role: payload.role };
      setUser(userData);
      if (payload.role === 'student') fetchStudentData();
      else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor')
        fetchSupervisorLogs();
      else if (payload.role === 'admin') fetchAdminData();
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    let response;
    try {
      response = await api.post('/token/', { username, password });
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
      return;
    }
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    const payload = parseJwt(access);
    const userData = { username: payload.username, role: payload.role };
    setUser(userData);
    if (payload.role === 'student') fetchStudentData();
    else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor')
      fetchSupervisorLogs();
    else if (payload.role === 'admin') fetchAdminData();
  };

  /* ── Login ─────────────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="login-page">
        <ToastContainer />
        <div className="login-card">
          <div className="login-card__logo">ILES</div>
          <h1 className="login-card__title">Welcome back</h1>
          <p className="login-card__subtitle">Sign in to your internship logbook</p>

          {error && (
            <div className="alert alert--danger">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
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

  /* ── Student ───────────────────────────────────────────────────────────── */
  if (user.role === 'student') {
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

          <div className="two-col">
            {/* ── Log form ── */}
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">{editingLog ? 'Edit Log' : 'New Weekly Log'}</h2>
              </div>
              <div className="card__body">
                <form onSubmit={handleCreateLog}>
                  <div className="field">
                    <label className="field__label">Week Number</label>
                    <input
                      type="number"
                      className="field__input"
                      placeholder="e.g. 1"
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
                        <option key={p.id} value={p.id}>
                          {p.company_name}
                        </option>
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
              </div>
            </div>

            {/* ── Logs list ── */}
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
                        {log.total_score != null && (
                          <span className="log-item__score">Score: {log.total_score}</span>
                        )}
                      </div>
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
                              setNewLog({
                                week_number: log.week_number,
                                activities: log.activities,
                                placement: log.placement?.id ?? log.placement,
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

  /* ── Supervisor ────────────────────────────────────────────────────────── */
  if (user.role === 'workplace_supervisor' || user.role === 'academic_supervisor') {
    const pendingLogs = supervisorLogs.filter((l) => l.status === 'submitted');
    const reviewedLogs = supervisorLogs.filter((l) => l.status === 'reviewed');
    const avgScore = (() => {
      const evaluated = supervisorLogs.filter((l) => l.total_score != null);
      if (evaluated.length === 0) return 'N/A';
      return (evaluated.reduce((sum, l) => sum + l.total_score, 0) / evaluated.length).toFixed(2);
    })();

    return (
      <div className="app-layout">
        <ToastContainer />
        <NavBar user={user} onLogout={() => logout(() => setSupervisorLogs([]))} />

        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">Supervisor Dashboard</h1>
            <p className="page-subtitle">Review and evaluate student internship logs</p>
          </div>

          <div className="stats-row">
            <StatCard label="Total Logs" value={supervisorLogs.length} accent="primary" />
            <StatCard label="Pending Review" value={pendingLogs.length} accent="warning" />
            <StatCard label="Reviewed" value={reviewedLogs.length} accent="info" />
            <StatCard
              label="Approved"
              value={supervisorLogs.filter((l) => l.status === 'approved').length}
              accent="success"
            />
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
                <div className="empty-state">
                  <p>No logs pending review — all caught up!</p>
                </div>
              ) : (
                pendingLogs.map((log) => (
                  <div key={log.id} className="log-item">
                    <div className="log-item__head">
                      <span className="log-item__week">Week {log.week_number}</span>
                      <StatusBadge status={log.status} />
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

          {/* ── Reviewed — awaiting evaluation / approval ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Reviewed Logs</h2>
              <span className="card__count">{reviewedLogs.length}</span>
            </div>
            <div className="card__body--list">
              {reviewedLogs.length === 0 ? (
                <div className="empty-state">
                  <p>No reviewed logs awaiting evaluation.</p>
                </div>
              ) : (
                reviewedLogs.map((log) => (
                  <div key={log.id} className="log-item log-item--eval">
                    <div className="log-item__head">
                      <span className="log-item__week">Week {log.week_number}</span>
                      <StatusBadge status={log.status} />
                      {log.total_score != null && (
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
                              <span className="eval-row__weight">
                                ({(c.weight * 100).toFixed(0)}%)
                              </span>
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
                      <label className="field__label">Feedback</label>
                      <textarea
                        className="field__input field__input--textarea"
                        placeholder="Optional for approval — required when requesting changes"
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

          {/* ── All logs table ── */}
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">All Logs</h2>
              <span className="card__count">{supervisorLogs.length}</span>
            </div>
            <div className="card__body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
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
                      <td>{log.week_number}</td>
                      <td className="td--truncate">{log.activities}</td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td>{log.total_score != null ? log.total_score : '—'}</td>
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

  /* ── Admin ─────────────────────────────────────────────────────────────── */
  if (user.role === 'admin') {
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
            <StatCard
              label="Approved"
              value={adminLogs.filter((l) => l.status === 'approved').length}
              accent="success"
            />
            <StatCard
              label="Pending"
              value={adminLogs.filter((l) => l.status === 'submitted').length}
              accent="warning"
            />
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
                <div className="empty-state">
                  <p>No logs yet.</p>
                </div>
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
                        <td>{log.student}</td>
                        <td>{log.week_number}</td>
                        <td className="td--truncate">{log.activities}</td>
                        <td>
                          <StatusBadge status={log.status} />
                        </td>
                        <td>{log.total_score != null ? log.total_score : '—'}</td>
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

  /* ── Unknown role ──────────────────────────────────────────────────────── */
  return (
    <div className="app-layout">
      <main className="page-content">
        <div className="card">
          <div className="card__body">
            <div className="alert alert--danger">
              Unknown role: <strong>{user.role}</strong>. Please contact support.
            </div>
            <button className="btn btn--ghost" onClick={() => logout(() => {})}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
