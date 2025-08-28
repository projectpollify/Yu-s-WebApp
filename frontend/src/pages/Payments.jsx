import React from 'react';
import { Link } from 'react-router-dom';

function Payments() {
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
        <h1>Payment Management</h1>
        <p>Payment tracking features coming soon...</p>
      </div>
    </div>
  );
}

export default Payments;