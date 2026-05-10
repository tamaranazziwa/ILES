import { useState } from 'react';
import '../styles/Login.css';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({ username: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleOptions = [
    { key: 'student', label: 'Student Intern', description: 'Submit logs, view placement details, and see evaluations.' },
    { key: 'supervisor', label: 'Supervisor', description: 'Review logs, manage student placements, and submit evaluations.' },
    { key: 'admin', label: 'Admin', description: 'Manage users, system settings, and internship workflows.' },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleRoleSelect = (role) => {
    setFormData((prev) => ({ ...prev, role }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.errors?.detail || JSON.stringify(data.errors) || 'Login failed.');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('role', data.role);
      onLogin(data.user, data.role);
    } catch (err) {
      setError('Unable to connect to the server.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-panel">
        <div className="login-role-panel">
          <h1>ILES Login</h1>
          <p>Choose your profile and sign in.</p>

          <div className="role-cards">
            {roleOptions.map((role) => (
              <button
                key={role.key}
                type="button"
                className={`role-card ${formData.role === role.key ? 'active' : ''}`}
                onClick={() => handleRoleSelect(role.key)}
              >
                <strong>{role.label}</strong>
                <span>{role.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="login-form-panel">
          <form className="login-form" onSubmit={handleSubmit}>
            <h2>Sign In</h2>
            <p className="login-form-subtitle">Logging in as <strong>{formData.role}</strong></p>

            {error && <div className="form-error">{error}</div>}

            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
