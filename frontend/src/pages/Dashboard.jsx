import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    students: 0,
    pendingPayments: 0,
    unreadEmails: 0,
    waitlistCount: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    // In a real app, fetch stats from API
    setStats({
      students: 24,
      pendingPayments: 3,
      unreadEmails: 5,
      waitlistCount: 12
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Yus Montessori</h2>
        </div>
        <div className="nav-user">
          <span>Welcome, {user?.name || 'User'}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <h1>Dashboard</h1>
        
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Students</h3>
            <p className="stat-number">{stats.students}</p>
            <Link to="/students" className="stat-link">View Students →</Link>
          </div>
          
          <div className="stat-card">
            <h3>Pending Payments</h3>
            <p className="stat-number">{stats.pendingPayments}</p>
            <Link to="/payments" className="stat-link">View Payments →</Link>
          </div>
          
          <div className="stat-card">
            <h3>Unread Emails</h3>
            <p className="stat-number">{stats.unreadEmails}</p>
            <Link to="/emails" className="stat-link">View Emails →</Link>
          </div>
          
          <div className="stat-card">
            <h3>Waitlist Applications</h3>
            <p className="stat-number">{stats.waitlistCount}</p>
            <Link to="/waitlist" className="stat-link">Manage Waitlist →</Link>
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <Link to="/students" className="action-btn">
              <span className="action-icon">👥</span>
              Manage Students
            </Link>
            <Link to="/payments" className="action-btn">
              <span className="action-icon">💳</span>
              Process Payments
            </Link>
            <Link to="/emails" className="action-btn">
              <span className="action-icon">📧</span>
              Check Emails
            </Link>
            <Link to="/waitlist" className="action-btn">
              <span className="action-icon">📋</span>
              Manage Waitlist
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;