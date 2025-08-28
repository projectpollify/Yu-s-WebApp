import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Waitlist.css';

function Waitlist() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    fetchWaitlist();
    fetchStats();
  }, [filter]);

  const fetchWaitlist = async () => {
    try {
      const token = localStorage.getItem('token');
      const query = filter === 'all' ? '' : `?status=${filter}`;
      
      const response = await fetch(`http://localhost:5001/api/waitlist${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/waitlist/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/waitlist/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        fetchWaitlist();
        fetchStats();
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="waitlist-container">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Yus Montessori</h2>
        </div>
        <div className="nav-links">
          <Link to="/dashboard">← Back to Dashboard</Link>
        </div>
      </nav>

      <div className="waitlist-content">
        <h1>Waitlist Management</h1>
        
        {stats && (
          <div className="stats-row">
            <div className="stat-box">
              <h3>Total Applications</h3>
              <p className="stat-value">{stats.total}</p>
            </div>
            <div className="stat-box">
              <h3>Pending Review</h3>
              <p className="stat-value pending">{stats.pending}</p>
            </div>
            <div className="stat-box">
              <h3>Contacted</h3>
              <p className="stat-value contacted">{stats.contacted}</p>
            </div>
            <div className="stat-box">
              <h3>Enrolled</h3>
              <p className="stat-value enrolled">{stats.enrolled}</p>
            </div>
          </div>
        )}

        <div className="filter-bar">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'pending' ? 'active' : ''} 
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button 
            className={filter === 'contacted' ? 'active' : ''} 
            onClick={() => setFilter('contacted')}
          >
            Contacted
          </button>
          <button 
            className={filter === 'enrolled' ? 'active' : ''} 
            onClick={() => setFilter('enrolled')}
          >
            Enrolled
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading waitlist...</div>
        ) : (
          <div className="waitlist-table">
            <table>
              <thead>
                <tr>
                  <th>Child Name</th>
                  <th>Parent Name</th>
                  <th>Contact</th>
                  <th>Program</th>
                  <th>Start Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry._id}>
                    <td>{entry.childName}</td>
                    <td>{entry.parentName}</td>
                    <td>
                      <div className="contact-info">
                        <div>{entry.parentEmail}</div>
                        <div className="phone">{entry.parentPhone}</div>
                      </div>
                    </td>
                    <td>{entry.programType || 'Full Day'}</td>
                    <td>{entry.preferredStartDate}</td>
                    <td>
                      <span className={`status-badge ${entry.status}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn"
                        onClick={() => setSelectedEntry(entry)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {entries.length === 0 && (
              <div className="no-data">No waitlist entries found</div>
            )}
          </div>
        )}

        {selectedEntry && (
          <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h2>Update Status - {selectedEntry.childName}</h2>
              <div className="status-options">
                <button 
                  className="status-btn pending"
                  onClick={() => updateStatus(selectedEntry._id, 'pending')}
                >
                  Mark as Pending
                </button>
                <button 
                  className="status-btn contacted"
                  onClick={() => updateStatus(selectedEntry._id, 'contacted')}
                >
                  Mark as Contacted
                </button>
                <button 
                  className="status-btn enrolled"
                  onClick={() => updateStatus(selectedEntry._id, 'enrolled')}
                >
                  Mark as Enrolled
                </button>
                <button 
                  className="status-btn withdrawn"
                  onClick={() => updateStatus(selectedEntry._id, 'withdrawn')}
                >
                  Mark as Withdrawn
                </button>
              </div>
              <button className="close-btn" onClick={() => setSelectedEntry(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Waitlist;