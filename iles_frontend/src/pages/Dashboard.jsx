import '../styles/Dashboard.css';

const Dashboard = ({ user, role, onLogout }) => {
  const roleNames = {
    student_intern: 'Student Intern',
    workplace_supervisor: 'Workplace Supervisor',
    academic_supervisor: 'Academic Supervisor',
    internship_administrator: 'Administrator',
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>ILES Dashboard</h1>
          <p>{roleNames[role] || 'User'} view</p>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-welcome">
          <h2>Welcome, {user.first_name || user.username}</h2>
          <p>Role: {roleNames[role] || user.role}</p>
        </section>

        <section className="dashboard-cards">
          {role === 'student_intern' && (
            <>
              <div className="card">
                <h3>Submit Weekly Logs</h3>
                <p>Track your internship progress and submit weekly reports.</p>
              </div>
              <div className="card">
                <h3>View Placement</h3>
                <p>See your placement details and supervisor information.</p>
              </div>
            </>
          )}

          {(role === 'workplace_supervisor' || role === 'academic_supervisor') && (
            <>
              <div className="card">
                <h3>Review Student Logs</h3>
                <p>Approve weekly logs and monitor student progress.</p>
              </div>
              <div className="card">
                <h3>Evaluate Internships</h3>
                <p>Submit evaluations and feedback for your assigned interns.</p>
              </div>
            </>
          )}

          {role === 'internship_administrator' && (
            <>
              <div className="card">
                <h3>Manage Users</h3>
                <p>Create and maintain student, supervisor, and admin accounts.</p>
              </div>
              <div className="card">
                <h3>System Reports</h3>
                <p>Review internship statistics and evaluation summaries.</p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
