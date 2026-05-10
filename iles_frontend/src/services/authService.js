const API_BASE = 'http://localhost:8000/api/auth';

const authService = {
  login: async (username, password, role) => {
    const response = await fetch(`${API_BASE}/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.errors?.detail || JSON.stringify(data.errors) || 'Login failed');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('role', data.role);
    return data;
  },

  logout: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    await fetch(`${API_BASE}/logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
    });

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
  },

  getStoredUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getStoredRole: () => localStorage.getItem('role'),
};

export default authService;
