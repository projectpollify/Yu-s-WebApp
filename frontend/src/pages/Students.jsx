import React from 'react';
import { Link } from 'react-router-dom';

function Students() {
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
        <h1>Students Management</h1>
        <p>Student management features coming soon...</p>
      </div>
    </div>
  );
}

export default Students;