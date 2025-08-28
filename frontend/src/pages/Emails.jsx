import React from 'react';
import { Link } from 'react-router-dom';

function Emails() {
  return (
    <div className="page-container">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Yus Montessori</h2>
        </div>
        <div className="nav-links">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </div>
      </nav>
      <div className="page-content">
        <h1>Email Management</h1>
        <p>AI-powered email monitoring and responses</p>
        <div style={{ marginTop: '20px', padding: '20px', background: '#f0f0f0', borderRadius: '8px' }}>
          <h3>Email AI Status</h3>
          <p>✅ Monitoring inbox for new messages</p>
          <p>✅ Automatically categorizing emails</p>
          <p>✅ Generating smart responses</p>
        </div>
      </div>
    </div>
  );
}

export default Emails;