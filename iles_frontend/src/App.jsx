import { useState, useEffect } from 'react';
import api from './api/axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
    criteria.forEach(c => {
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
        toast.success('Log updated successfully! You can now submit for review.');
      } else {
        await api.post('/logs/', newLog);
        toast.success('Log created successfully! You can now submit for review.');
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
        `Log ${newStatus === 'approved' ? 'approved' : newStatus === 'draft' ? 'returned for revision' : 'updated'}!`
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
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userData = { username: payload.username, role: payload.role };
      setUser(userData);
      if (payload.role === 'student') fetchStudentData();
      else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor') fetchSupervisorLogs();
      else if (payload.role === 'admin') fetchAdminData();
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await api.post('/token/', { username, password });
      const { access, refresh } = response.data;
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      const payload = JSON.parse(atob(access.split('.')[1]));
      const userData = { username: payload.username, role: payload.role };
      setUser(userData);
      if (payload.role === 'student') fetchStudentData();
      else if (payload.role === 'workplace_supervisor' || payload.role === 'academic_supervisor') fetchSupervisorLogs();
      else if (payload.role === 'admin') fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
    }
  };

  if (user) {
    if (user.role === 'student') {
      return (
        <div style={{ padding: '20px' }}>
          <ToastContainer />
          <h1>Student Dashboard</h1>
          <p>Welcome, {user.username}!</p>
          <button onClick={() => logout(() => { setLogs([]); setPlacements([]); })}>Logout</button>

          <h2>{editingLog ? 'Edit Log' : 'Create New Weekly Log'}</h2>
          <form onSubmit={handleCreateLog}>
            <div>
              <input
                type="number"
                placeholder="Week No."
                value={newLog.week_number}
                onChange={(e) => setNewLog({ ...newLog, week_number: e.target.value })}
                required
              />
            </div>
            <br />
            <div>
              <textarea
                placeholder="Activities this week"
                value={newLog.activities}
                onChange={(e) => setNewLog({ ...newLog, activities: e.target.value })}
                required
              />
            </div>
            <div>
              <select
                value={newLog.placement}
                onChange={(e) => setNewLog({ ...newLog, placement: e.target.value })}
                required
              >
                <option value="">Select Placement</option>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
                ))}
              </select>
            </div>
            <br />
            <button type="submit">{editingLog ? 'Update Log' : 'Create Log'}</button>
            {editingLog && (
              <button
                type="button"
                onClick={() => { setEditingLog(null); setNewLog({ week_number: '', activities: '', placement: '' }); }}
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            )}
          </form>

          <h2>My Weekly Logs</h2>
          {logs.length === 0 ? (
            <p>No logs submitted yet.</p>
          ) : (
            <ul>
              {logs.map((log) => (
                <li key={log.id}>
                  Week {log.week_number}: {log.activities} - <strong>{log.status}</strong>
                  {log.total_score != null && <span> | Score: {log.total_score}</span>}
                  {log.status === 'draft' && (
                    <div>
                      <button
                        onClick={() => {
                          setEditingLog(log);
                          setNewLog({
                            week_number: log.week_number,
                            activities: log.activities,
                            placement: log.placement?.id || log.placement,
                          });
                        }}
                        style={{ marginLeft: '10px' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleSubmitLog(log.id)} style={{ marginLeft: '10px' }}>
                        Submit for Review
                      </button>
                    </div>
                  )}
                  {log.feedback && <p><em>Feedback: {log.feedback}</em></p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (user.role === 'workplace_supervisor' || user.role === 'academic_supervisor') {
      const pendingLogs = supervisorLogs.filter(log => log.status === 'submitted');
      const reviewedLogs = supervisorLogs.filter(log => log.status === 'reviewed');

      return (
        <div style={{ padding: '20px' }}>
          <ToastContainer />
          <h1>Supervisor Dashboard</h1>
          <p>Welcome, {user.username} ({user.role})!</p>
          <button onClick={() => logout(() => setSupervisorLogs([]))}>Logout</button>

          {supervisorLogs.length > 0 && (
            <div style={{ background: 'lightblue', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
              <div><strong>Total Logs:</strong> {supervisorLogs.length}</div>
              <div><strong>Draft:</strong> {supervisorLogs.filter(l => l.status === 'draft').length}</div>
              <div><strong>Submitted:</strong> {supervisorLogs.filter(l => l.status === 'submitted').length}</div>
              <div><strong>Reviewed:</strong> {supervisorLogs.filter(l => l.status === 'reviewed').length}</div>
              <div><strong>Approved:</strong> {supervisorLogs.filter(l => l.status === 'approved').length}</div>
              <div><strong>Average Score:</strong> {(() => {
                const evaluated = supervisorLogs.filter(l => l.total_score != null);
                if (evaluated.length === 0) return 'N/A';
                return (evaluated.reduce((sum, l) => sum + l.total_score, 0) / evaluated.length).toFixed(2);
              })()}</div>
            </div>
          )}

          <h2>Pending Reviews ({pendingLogs.length})</h2>
          {pendingLogs.length === 0 ? (
            <p>No logs to review.</p>
          ) : (
            <ul>
              {pendingLogs.map((log) => (
                <li key={log.id}>
                  Week {log.week_number}: {log.activities}
                  <button onClick={() => handleSupervisorAction(log.id, 'reviewed', '')} style={{ marginLeft: '10px' }}>
                    Mark as Reviewed
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2>Reviewed Logs ({reviewedLogs.length})</h2>
          {reviewedLogs.length === 0 ? (
            <p>No logs reviewed yet.</p>
          ) : (
            <ul>
              {reviewedLogs.map(log => (
                <li key={log.id}>
                  Week {log.week_number}: {log.activities} - status: <strong>{log.status}</strong>
                  {log.total_score != null && <span> | Score: {log.total_score}</span>}
                  {criteria.map(c => (
                    <div key={c.id} style={{ marginTop: '4px' }}>
                      <label>{c.name} ({(c.weight * 100).toFixed(0)}%): </label>
                      <input
                        type="number"
                        placeholder="0-100"
                        style={{ width: '60px', marginLeft: '5px' }}
                        onChange={(e) => setFeedback(prev => ({
                          ...prev,
                          [`score_${log.id}_${c.id}`]: e.target.value,
                        }))}
                      />
                    </div>
                  ))}
                  <button onClick={() => saveEvaluations(log.id)} style={{ marginTop: '5px' }}>
                    Save Evaluations
                  </button>
                  <div style={{ marginTop: '8px' }}>
                    <textarea
                      placeholder="Feedback (optional for approved, required for request changes)"
                      value={feedback[log.id] || ''}
                      onChange={(e) => setFeedback({ ...feedback, [log.id]: e.target.value })}
                      rows="2"
                      style={{ width: '100%', marginTop: '5px' }}
                    />
                    <button
                      onClick={() => handleSupervisorAction(log.id, 'approved', feedback[log.id] || '')}
                      style={{ marginTop: '5px', marginRight: '5px' }}
                    >
                      Approve
                    </button>
                    <button onClick={() => handleSupervisorAction(log.id, 'draft', feedback[log.id] || '')}>
                      Request Changes
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2>All Logs</h2>
          <ul>
            {supervisorLogs.map(log => (
              <li key={log.id}>
                Week {log.week_number}: {log.activities} - <strong>{log.status}</strong>
                {log.total_score != null && <span> | Score: {log.total_score}</span>}
                {log.feedback && <p><em>Feedback: {log.feedback}</em></p>}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (user.role === 'admin') {
      return (
        <div style={{ padding: '20px' }}>
          <ToastContainer />
          <h1>Administrator Dashboard</h1>
          <p>Welcome, {user.username}!</p>
          <button onClick={() => logout(() => { setAdminUsers([]); setAdminLogs([]); })}>Logout</button>

          <h2>All Users</h2>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr><th>ID</th><th>Username</th><th>Role</th><th>Email</th></tr>
            </thead>
            <tbody>
              {adminUsers.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: '30px' }}>All Logs</h2>
          {adminLogs.length === 0 ? (
            <p>No logs available.</p>
          ) : (
            <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr><th>ID</th><th>Student</th><th>Week</th><th>Activities</th><th>Status</th><th>Total Score</th><th>Feedback</th></tr>
              </thead>
              <tbody>
                {adminLogs.map(log => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{log.student}</td>
                    <td>{log.week_number}</td>
                    <td>{log.activities}</td>
                    <td>{log.status}</td>
                    <td>{log.total_score != null ? log.total_score : '-'}</td>
                    <td>{log.feedback || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <ToastContainer />
      <h1>Internship Login</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <br />
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <br />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default App;
