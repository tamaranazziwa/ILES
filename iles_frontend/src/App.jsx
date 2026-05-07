import {useState, useEffect } from 'react';
import axios from 'axios';
// This line imports the React library and the useState hook.
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  // memory boxes for username, and other stuff
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');//error message
  const [user, setUser] = useState(null); //no user logged in
  const [newLog, setNewLog] = useState({ week_number: '', activities: '', placement: '' });
  const [logs, setLogs] = useState([]); //logs of all the students
  const [placements, setPlacements] = useState([]); //placements for dropdown
  const [supervisorLogs, setSupervisorLogs] = useState([]); //logs for supervisor view 
  const [feedback, setFeedback] = useState({}); //stores feedback by log id.
  const [editingLog, setEditingLog] = useState(null); //log beng edited after review
  const [criteria, setCriteria] = useState([]);  // all evaluation criteria      
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);

  const get_token = () => {
    return localStorage.getItem('access_token');
  };
  // This function runs when the form is submitted.
  const fetchStudentData = async () => {
  const token = get_token();
  if (!token) return; //not logged in, do nothing.
  try {
    const config = { headers: { Authorization: `Bearer ${token}` }};//attach token
      //get the student's logs
    const logsRes = await axios.get('${import.meta.env.VITE_API_URL}/api/logs/', config);//get placement options on dropdown
    const placementsRes = await axios.get('${import.meta.env.VITE_API_URL}/api/placements/', config);
    setLogs(logsRes.data);
    setPlacements(placementsRes.data);
  } catch (err) {
    console.error('Failed to fetch student data');
  }
};

  const fetchSupervisorLogs = async () => {
    const token = get_token();
      if (!token) return; //not logged in, do nothing
      try {
        const config = { headers: {Authorization: `Bearer ${token}`}};//attach token
        const criteriaRes = await axios.get('${import.meta.env.VITE_API_URL}/api/criteria/', config);
        setCriteria(criteriaRes.data);
        const response = await axios.get('${import.meta.env.VITE_API_URL}/api/logs/', config);
        setSupervisorLogs(response.data);//set logs for supervisor view
      } catch(err) {
        console.error('Failed to fetch Supervisor logs.');
      }
  };

const fetchAdminData = async () => {
  const token = get_token();
  if(!token) return;
  try{
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const usersRes = await axios.get('${import.meta.env.VITE_API_URL}/api/users/', config);
    const logsRes = await axios.get('${import.meta.env.VITE_API_URL}/api/logs/', config);
    setAdminUsers(usersRes.data);
    setAdminLogs(logsRes.data);
  }catch(err) {
    console.error('Failed to fetch admin data.');
  }
};
  const saveEvaluations = async (logId) => {
  const token = get_token();
  const config = { headers: { Authorization: `Bearer ${token}` } };
  
  
  const scores = {};
  criteria.forEach(c => {
    const key = `score_${logId}_${c.id}`;
    if (feedback[key]) scores[c.id] = feedback[key];
  });

  try  {
  const promises = Object.entries(scores).map(([criteriaId, score]) =>
    axios.post ('${import.meta.env.VITE_API_URL}/api/evaluations/', {
      log: logId,
      criteria: criteriaId,
      score: parseFloat(score),
    }, config)
  );
  await Promise.all(promises);
  toast.success('Evaluations saved.');
  fetchSupervisorLogs();
  } catch (err) {
    toast.error(err.response?.data?.detail ||'Error saving evaluations.');
  }
};
  const handleCreateLog = async (e) => {
    e.preventDefault();
    const token = get_token();
    try {
      const config = {headers: { Authorization: `Bearer ${token}` }};

      if (editingLog) {//update existing log
        await axios.patch(`${import.meta.env.VITE_API_URL}/api/logs/${editingLog.id}/`, newLog, config);
        toast.success('Log updated successfully! You can now resubmit.');
      } else {//create new log
        await axios.post('${import.meta.env.VITE_API_URL}/api/logs/', newLog, config);
        toast.success('Log created successfully! You can now submit for review.');
      }
      setNewLog({ week_number: '', activities: '', placement: ''});
      setEditingLog(null);
      fetchStudentData();//refresh logs to add new log
 } catch (err) {
  toast.error(err.response?.data?.detail || 'Error creating log.');
}
  };

  const handleSubmitLog = async(logId) => {
    const token = get_token();
    try {
      const config = {headers: {Authorization: `Bearer ${token}`}};
      await axios.patch(`${import.meta.env.VITE_API_URL}/api/logs/${logId}/`, {status: 'submitted'}, config);
      fetchStudentData();//refresh list to see updated status
      toast.success('Log submitted for review!');
    } catch (err) {
      toast.error('Error submitting log.');
    }
  };
  const handleSupervisorAction = async (logId, newStatus, feedbackText) => {
    const token = get_token();
    try{
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.patch(`${import.meta.env.VITE_API_URL}/api/logs/${logId}/`, { 
        status:newStatus,
        feedback: feedbackText,
      }, config);
      fetchSupervisorLogs();
      toast.success(`Log ${newStatus ==='approved' ? 'approved' : newStatus ==='draft' ? 'returned for revision' : 'updated'}!`);
    } catch (err) {
      toast.error('Error updating log.');
    }
  };
  useEffect(() => {
    const token = get_token();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));//get usernme from token
        const userData = { username: payload.username, role: payload.role }; //get user role from token
        setUser(userData);//fetch the data of the student
        if (payload.role ==='student') {
          fetchStudentData();
        } else if (payload.role === 'workplace_supervisor' || payload.role ==='academic_supervisor') {
          fetchSupervisorLogs();
        } else if (payload.role === 'admin') {
          fetchAdminData();
        }
      } catch (err) {
        localStorage.removeItem('access_token');
      }
    }
  }, []);
//event handlers
  const handleSubmit = async (e) => {
    e.preventDefault(); // Stops the page from refreshing.
    setError('');//clear previous errors
    try {
      const response = await axios.post('${import.meta.env.VITE_API_URL}/api/token/', {
        username: username,
        password: password,
      });

      const accessToken = response.data.access;//get token
      localStorage.setItem('access_token', accessToken);//store in browser storage
      const payload = JSON.parse(atob(accessToken.split('.')[1]));//get usernme from token
      const userData = { username: payload.username, role: payload.role };//set user
      setUser(userData);
      if (payload.role === 'student') {
        fetchStudentData();
      } else if (payload.role === 'workplace_supervisor' || payload.role ==='academic_supervisor') {
          fetchSupervisorLogs();
      } else if (payload.role === 'admin') {
        fetchAdminData();
      }
    } catch (err) {
      setError('Invalid username or password.');
    }
  };
  
  //seen on the screen if logged in.
  if(user){
  //Student Dashboard
  if (user.role === 'student') {
    //student dashboard
      return (
        <div style= {{ padding: '20px' }}>
          <ToastContainer/>
          <h1>Student Dashboard</h1>
          <p>Welcome, {user.username}!</p>
          <button onClick={() => {
            localStorage.removeItem('access_token');
            setUser(null);
            setLogs([]);
            setPlacements([]);
          }}>
              Logout
          </button>
          <h2>Create New Weekly Log</h2>
          <form onSubmit={handleCreateLog}>
            <div>
              <input
                type = "number"
                placeholder = "Week No."
                value = {newLog.week_number}
                onChange = {(e) => setNewLog({ ...newLog, week_number: e.target.value })}
                required
                />
            </div>
            <br></br>
            <div>
              <textarea
                placeholder = "Activities this week"
                value = {newLog.activities}
                onChange = {(e) => setNewLog({ ...newLog, activities: e.target.value})}
                required
                />
            </div>
            <div>
              <select
                value = {newLog.placement}
                onChange = {(e) => setNewLog({ ...newLog, placement: e.target.value})}
                required>
                  <option value = "">Select Placement</option>
                  {placements.map((p) => (
                    <option key = {p.id} value = {p.id}>{p.company_name}</option>
                  ))}
                </select>
            </div>
            <br></br>
            <button type = "submit">{editingLog ? 'Update Log' : 'Submit Log'}</button>
          </form>

        {/*My Logs*/}
        <h2>My Weekly Logs</h2>
        {logs.length === 0 ? (
          <p>No Logs Submitted yet.</p>
        ) : (
          <ul>
          {logs.map((log) => (
            <li key = {log.id}>
            Week {log.week_number}: {log.activities} - <strong>{log.status}</strong>
            {log.total_score != null && <span> | Score: {log.total_score}</span>}
            {log.status === 'draft' && (
              <div>
                <button onClick = {() => {
                  setEditingLog(log);
                  setNewLog({
                    week_number: log.week_number,
                    activities: log.activities,
                    placement: log.placement?.id || log.placement,
                  });
                }} style = {{marginLeft: '10px'}}>
                  Edit
                </button>
                <button onClick = {() => handleSubmitLog(log.id)} style = {{marginLeft: '10px'}}>
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
  //Supervisor Dashboard//
  if (user.role === 'workplace_supervisor' || user.role === 'academic_supervisor') {
    const pendingLogs = supervisorLogs.filter(log => log.status ==='submitted');
    const reviewedLogs = supervisorLogs.filter(log => log.status === 'reviewed');
    
    return (
      <div style = {{ padding: '20px'}}>
        <ToastContainer/>
        <h1>Supervisor Dashboard</h1>
        <p>Welcome, {user.username} ({user.role})!</p>
        <button onClick = {() => {
          localStorage.removeItem('access_token');
          setUser(null);
          setSupervisorLogs([]); //clear logs on logout
        }}>
          Logout
        </button>
        {supervisorLogs.length >0 && (
          <div style = {{
            background : 'lightblue',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '15px'
          }}>
            <div><strong>Total Logs:</strong>{supervisorLogs.length}</div>
            <div><strong>Draft:</strong>{supervisorLogs.filter(l => l.status === 'draft').length}</div>
            <div><strong>Submitted:</strong>{supervisorLogs.filter(l => l.status === 'submitted').length}</div>
            <div><strong>Reviewed:</strong>{supervisorLogs.filter(l => l.status === 'reviewed').length}</div>
            <div><strong>Approved:</strong>{supervisorLogs.filter(l => l.status === 'approved').length}</div>
            <div><strong>Average Score:</strong> {
              (() => {
                const evaluated = supervisorLogs.filter(l => l.total_score != null);
                if (evaluated.length === 0) return 'N/A';
                const avg = evaluated.reduce((sum, l) => sum + l.total_score, 0) / evaluated.length;
                return avg.toFixed(2);
              })()
            }</div>
          </div>
        )
        }
        <h2>Pending Reviews ({pendingLogs.length})</h2>
        {pendingLogs.length === 0 ? (
          <p>No logs to review.</p>
        ) : (
          <ul>
            {pendingLogs.map((log) => (
              <li key = {log.id}>
                Week {log.week_number}: {log.activities}
                <button onClick = {() => handleSupervisorAction(log.id, 'reviewed', '')} style = {{marginLeft: '10px'}}>
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

                {/* Evaluation inputs – one per criteria */}
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

                {/* Existing feedback and action buttons */}
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    placeholder="Feedback (optional for approved, required for request changes)"
                    value={feedback[log.id] || ''}
                    onChange={(e) => setFeedback({ ...feedback, [log.id]: e.target.value })}
                    rows="2"
                    style={{ width: '100%', marginTop: '5px' }}
                  />
                  <button onClick={() => handleSupervisorAction(log.id, 'approved', feedback[log.id] || '')} style={{ marginTop: '5px', marginRight: '5px' }}>
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
          <li key = {log.id}>
            Week {log.week_number}: {log.activities} - <strong>{log.status}</strong>
            {log.total_score != null && <span> | Score: {log.total_score}</span>}
            {log.feedback && <p><em>Feedback: {log.feedback}</em></p>}
          </li>
        ))}
        </ul>
      </div>
    );
  }

  //Admin Fallback//
    if (user.role === 'admin') {
      return (
        <div style =  {{ padding: '20px'}}>
          <ToastContainer/>
          <h1>Administrator Dashboard</h1>
          <p>Welcome, {user.username}!</p>
          <button onClick = {() => {
            localStorage.removeItem('access_token');
            setUser(null);
            setAdminUsers([]);
            setAdminLogs([]);
        }}>
          Logout
        </button>

        <h2>All Users</h2>
        <table border = '1' cellPadding = '8' style = {{ borderCollapse: 'collapse', width: '100%'}}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {adminUsers.map(u => (
              <tr key = {u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style = {{marginTop: '30px' }}>All Logs</h2>
        {adminLogs.length === 0 ? (
          <p>No logs available.</p>
        ) : (
          <table border = '1' cellPadding = '8' style = {{ borderCollapse: 'collapse', width: '100%'}}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Student</th>
                <th>Week</th>
                <th>Activities</th>
                <th>Status</th>
                <th>Total Score</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {adminLogs.map(log => (
                <tr key = {log.id}>
                  <td>{log.id}</td>
                  <td>{log.student}</td>
                  <td>{log.week_number}</td>
                  <td>{log.activities}</td>
                  <td>{log.status}</td>
                  <td>{log.total_score != null? log.total_score : '-'}</td>
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
    //show below if not logged in.
  return (
     <div style={{ padding: '20px' }}>
      <ToastContainer/>
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
         <br></br>
         <div>
         <input
           type="password"
           placeholder="Password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
         />
         </div>
         <br></br>
         <button type="submit">Login</button>
       </form>
     </div>
   );
  }
  

  export default App;