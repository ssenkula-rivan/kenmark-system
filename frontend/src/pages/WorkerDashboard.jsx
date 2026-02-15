import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, jobsAPI } from '../services/api';
import { format } from 'date-fns';
import Chat from '../components/Chat';
import ConnectionStatus from '../components/ConnectionStatus';
import Clock from '../components/Clock';
import './WorkerDashboard.css';

const WorkerDashboard = () => {
  const { user, logout } = useAuth();
  const [jobTypes, setJobTypes] = useState([]);
  const [dailyTotal, setDailyTotal] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  
  // Password change state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Spreadsheet rows
  const [rows, setRows] = useState([createEmptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadJobTypes();
    loadDailyTotal();
    loadRecentJobs();

    // Heartbeat to keep user active while dashboard is open
    const heartbeat = setInterval(async () => {
      try {
        await authAPI.heartbeat();
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    }, 15000); // Every 15 seconds

    return () => clearInterval(heartbeat);
  }, []);

  function createEmptyRow() {
    return {
      id: Date.now() + Math.random(),
      job_type_id: '',
      description: '',
      width_cm: '',
      height_cm: '',
      quantity: '',
      rate: '',
      amount: '',
      unit: ''
    };
  }

  const loadJobTypes = async () => {
    try {
      const response = await jobsAPI.getJobTypes();
      setJobTypes(response.data.data);
    } catch (err) {
      console.error('Failed to load job types:', err);
    }
  };

  const loadDailyTotal = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await jobsAPI.getMyDailyTotal(today);
      setDailyTotal(response.data.data);
    } catch (err) {
      console.error('Failed to load daily total:', err);
    }
  };

  const loadRecentJobs = async () => {
    try {
      const response = await jobsAPI.getMyJobs({ limit: 20, offset: 0 });
      setRecentJobs(response.data.data.jobs);
    } catch (err) {
      console.error('Failed to load recent jobs:', err);
    }
  };

  const handleCellChange = (rowId, field, value) => {
    setRows(prevRows => {
      const newRows = prevRows.map(row => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };
          
          // If job type changed, update unit only
          if (field === 'job_type_id') {
            const selectedJobType = jobTypes.find(jt => jt.id === parseInt(value));
            if (selectedJobType) {
              updatedRow.unit = selectedJobType.unit;
              updatedRow.width_cm = '';
              updatedRow.height_cm = '';
              updatedRow.quantity = '';
              updatedRow.amount = '';
            }
          }
          
          // Auto-calculate amount: Quantity × Rate
          if (updatedRow.quantity && updatedRow.rate) {
            updatedRow.amount = (parseFloat(updatedRow.quantity) * parseFloat(updatedRow.rate)).toFixed(2);
          } else if (updatedRow.unit === 'sqm' && updatedRow.width_cm && updatedRow.height_cm && updatedRow.rate) {
            const sqm = (updatedRow.width_cm * updatedRow.height_cm) / 10000;
            updatedRow.amount = (sqm * parseFloat(updatedRow.rate)).toFixed(2);
          }
          
          return updatedRow;
        }
        return row;
      });
      
      // Auto-add new row if last row has data
      const lastRow = newRows[newRows.length - 1];
      if (lastRow.job_type_id && lastRow.description) {
        newRows.push(createEmptyRow());
      }
      
      return newRows;
    });
  };

  const handleDeleteRow = (rowId) => {
    setRows(prevRows => {
      const filtered = prevRows.filter(row => row.id !== rowId);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const handleSubmitAll = async () => {
    setError('');
    setSuccess('');
    
    // Filter out empty rows
    const validRows = rows.filter(row => 
      row.job_type_id && 
      row.description && 
      row.rate &&
      row.amount &&
      (row.unit === 'sqm' ? (row.width_cm && row.height_cm) : row.quantity)
    );
    
    if (validRows.length === 0) {
      setError('Please fill in at least one complete job');
      return;
    }
    
    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const row of validRows) {
      try {
        const jobData = {
          job_type_id: parseInt(row.job_type_id),
          description: row.description,
          rate: parseFloat(row.rate)
        };
        
        if (row.unit === 'sqm') {
          jobData.width_cm = parseFloat(row.width_cm);
          jobData.height_cm = parseFloat(row.height_cm);
        } else {
          jobData.quantity = parseInt(row.quantity);
        }
        
        await jobsAPI.create(jobData);
        successCount++;
      } catch (err) {
        failCount++;
        console.error('Failed to create job:', err);
      }
    }
    
    setSubmitting(false);
    
    if (successCount > 0) {
      setSuccess(`Successfully submitted ${successCount} job(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setRows([createEmptyRow()]);
      loadDailyTotal();
      loadRecentJobs();
    } else {
      setError('Failed to submit jobs. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    try {
      await authAPI.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    }
  };

  const getTotalAmount = () => {
    return rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0).toFixed(2);
  };

  return (
    <div className="dashboard">
      <ConnectionStatus />
      
      <header className="dashboard-header">
        <h1>Worker Dashboard</h1>
        <Clock />
        <div className="user-info">
          <span>Welcome, {user.name}</span>
          {user.department && <span className="department-badge">{user.department}</span>}
          <button onClick={() => setChatOpen(true)} className="btn-chat">
            <img src="/messages-ios-seeklogo.png" alt="Messages" className="chat-icon" />
          </button>
          <button onClick={() => setPasswordModalOpen(true)} className="btn-secondary">Change Password</button>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Today's Jobs Submitted</h3>
            <div className="stat-value">{dailyTotal?.jobCount || 0}</div>
          </div>
        </div>

        <div className="spreadsheet-section">
          <div className="spreadsheet-header">
            <h2>Quick Entry - Add Multiple Jobs</h2>
            <div className="spreadsheet-actions">
              <button onClick={() => setRows([...rows, createEmptyRow()])} className="btn-secondary">
                + Add Row
              </button>
              <button 
                onClick={handleSubmitAll} 
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Submitting...' : 'Submit All Jobs'}
              </button>
            </div>
          </div>

          <div className="spreadsheet-container">
            <table className="spreadsheet-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ width: '200px' }}>Job Type *</th>
                  <th style={{ width: '250px' }}>Description *</th>
                  <th style={{ width: '100px' }}>Width (cm)</th>
                  <th style={{ width: '100px' }}>Height (cm)</th>
                  <th style={{ width: '100px' }}>Quantity *</th>
                  <th style={{ width: '100px' }}>Rate *</th>
                  <th style={{ width: '120px' }}>Amount</th>
                  <th style={{ width: '60px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const selectedJobType = jobTypes.find(jt => jt.id === parseInt(row.job_type_id));
                  return (
                    <tr key={row.id} className={row.job_type_id ? 'row-filled' : ''}>
                      <td className="row-number">{index + 1}</td>
                      <td>
                        <select
                          value={row.job_type_id}
                          onChange={(e) => handleCellChange(row.id, 'job_type_id', e.target.value)}
                          className="cell-input"
                        >
                          <option value="">Select...</option>
                          {jobTypes.map(jt => (
                            <option key={jt.id} value={jt.id}>
                              {jt.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleCellChange(row.id, 'description', e.target.value)}
                          placeholder="Enter description..."
                          className="cell-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.width_cm}
                          onChange={(e) => handleCellChange(row.id, 'width_cm', e.target.value)}
                          placeholder="0.0"
                          step="0.1"
                          min="0"
                          className="cell-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.height_cm}
                          onChange={(e) => handleCellChange(row.id, 'height_cm', e.target.value)}
                          placeholder="0.0"
                          step="0.1"
                          min="0"
                          className="cell-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => handleCellChange(row.id, 'quantity', e.target.value)}
                          placeholder="0"
                          min="1"
                          className="cell-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={row.rate}
                          onChange={(e) => handleCellChange(row.id, 'rate', e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="cell-input"
                        />
                      </td>
                      <td className="cell-amount">
                        {row.amount ? `UGX ${parseFloat(row.amount).toLocaleString()}` : 'UGX 0'}
                      </td>
                      <td>
                        {rows.length > 1 && (
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="btn-delete"
                            title="Delete row"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    Total:
                  </td>
                  <td className="cell-amount" style={{ fontWeight: 'bold', fontSize: '16px' }}>
                    UGX {parseFloat(getTotalAmount()).toLocaleString()}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="recent-jobs-section">
          <h2>Recently Submitted Jobs</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Job Type</th>
                  <th>Description</th>
                  <th>Details</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No jobs submitted yet
                    </td>
                  </tr>
                ) : (
                  recentJobs.map(job => (
                    <tr key={job.id}>
                      <td>{format(new Date(job.created_at), 'MMM dd, HH:mm')}</td>
                      <td>{job.job_type_name}</td>
                      <td>{job.description}</td>
                      <td>
                        {job.unit === 'sqm' 
                          ? `${job.width_cm}×${job.height_cm} cm`
                          : `${job.quantity} pcs`
                        }
                      </td>
                      <td>UGX {parseFloat(job.amount).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Chat isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <ConnectionStatus />

      {passwordModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Change Password</h2>
            {passwordError && <div className="alert alert-error">{passwordError}</div>}
            {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setPasswordModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
