import { useState, useEffect } from 'react';
import './App.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import authService from './services/authService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    const storedRole = authService.getStoredRole();
    if (storedUser && storedRole) {
      setCurrentUser(storedUser);
      setRole(storedRole);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user, selectedRole) => {
    setCurrentUser(user);
    setRole(selectedRole);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setRole(null);
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        <Dashboard user={currentUser} role={role} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
