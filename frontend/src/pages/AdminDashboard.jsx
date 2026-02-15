import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI, adminAPI } from '../services/api';
import { format } from 'date-fns';
import Chat from '../components/Chat';
import ConnectionStatus from '../components/ConnectionStatus';
import Clock from '../components/Clock';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const [dailySummary, setDailySummary] = useState(null);
  const [machineSummary, setMachineSummary] = useState([]);
  const [workerSummary, setWorkerSummary] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [jobTypeSummary, setJobTypeSummary] = useState([]);
  const [detailedJobs, setDetailedJobs] = useState([]);

  useEffect(() => {
    loadData();
    loadActiveUsers();
    const interval = setInterval(loadActiveUsers, 2000); // Update every 2 seconds

    // Heartbeat to keep admin active while dashboard is open
    const heartbeat = setInterval(async () => {
      try {
        await authAPI.heartbeat();
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    }, 15000); // Every 15 seconds

    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    };
  }, [selectedDate, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'summary') {
        const [daily, machine, worker, jobType] = await Promise.all([
          adminAPI.getDailySummary(selectedDate),
          adminAPI.getMachineSummary(selectedDate),
          adminAPI.getWorkerSummary(selectedDate),
          adminAPI.getJobTypeSummary(selectedDate)
        ]);

        setDailySummary(daily.data.data);
        setMachineSummary(machine.data.data);
        setWorkerSummary(worker.data.data);
        setJobTypeSummary(jobType.data.data);
      } else if (activeTab === 'jobs') {
        const response = await adminAPI.getDetailedJobs(selectedDate);
        setDetailedJobs(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers();
      const users = response.data.data || [];
      // Filter and sort by last_active
      const usersWithActivity = users.map(u => ({
        ...u,
        secondsAgo: u.last_active ? Math.floor((new Date() - new Date(u.last_active)) / 1000) : null,
        isActive: u.last_active ? Math.floor((new Date() - new Date(u.last_active)) / 1000) < 300 : false // 5 minutes
      })).sort((a, b) => (a.secondsAgo || 999999) - (b.secondsAgo || 999999));
      setActiveUsers(usersWithActivity);
    } catch (err) {
      console.error('Failed to load active users:', err);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await adminAPI.downloadPDFReport(selectedDate);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${selectedDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download PDF report');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await adminAPI.downloadExcelReport(selectedDate);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download Excel report');
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

  return (
    <div className="dashboard">
      <ConnectionStatus />
      
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <Clock />
        <div className="user-info">
          <span>Welcome, {user.name}</span>
          <button onClick={() => setChatOpen(true)} className="btn-chat">
            <img src="/messages-ios-seeklogo.png" alt="Messages" className="chat-icon" />
          </button>
          <button onClick={() => setPasswordModalOpen(true)} className="btn-secondary">Change Password</button>
          <button onClick={handleLogout} className="btn-logout">Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Active Users Section */}
        <div className="active-users-section">
          <h3>🟢 Active Users: {activeUsers.filter(u => u.isActive).length}</h3>
          <div className="active-users-list">
            {activeUsers.filter(u => u.isActive).map(u => (
              <span key={u.id} className="active-user-tag">
                {u.name}
              </span>
            ))}
            {activeUsers.filter(u => u.isActive).length === 0 && (
              <span className="no-active-users">No users currently active</span>
            )}
          </div>
        </div>

        <div className="controls-section">
          <div className="date-picker">
            <label>Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="download-buttons">
            <button onClick={handleDownloadPDF} className="btn-secondary">
              Download PDF
            </button>
            <button onClick={handleDownloadExcel} className="btn-secondary">
              Download Excel
            </button>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`tab ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Detailed Jobs
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'summary' ? (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Jobs</h3>
                <div className="stat-value">{dailySummary?.total_jobs || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Total Revenue</h3>
                <div className="stat-value">UGX {parseFloat(dailySummary?.total_revenue || 0).toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Active Workers</h3>
                <div className="stat-value">{dailySummary?.active_workers || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Active Machines</h3>
                <div className="stat-value">{dailySummary?.active_machines || 0}</div>
              </div>
            </div>

            <div className="summary-section">
              <h2>Machine Summary</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Type</th>
                      <th>Jobs</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineSummary.map(machine => (
                      <tr key={machine.machine_id}>
                        <td>{machine.machine_name}</td>
                        <td>{machine.machine_type}</td>
                        <td>{machine.job_count}</td>
                        <td>UGX {parseFloat(machine.total_revenue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="summary-section">
              <h2>Worker Summary</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Machine</th>
                      <th>Jobs</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerSummary.map(worker => (
                      <tr key={worker.worker_id}>
                        <td>{worker.worker_name}</td>
                        <td>{worker.machine_name || 'N/A'}</td>
                        <td>{worker.job_count}</td>
                        <td>UGX {parseFloat(worker.total_revenue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="summary-section">
              <h2>Job Type Summary</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Job Type</th>
                      <th>Machine Type</th>
                      <th>Unit</th>
                      <th>Jobs</th>
                      <th>Total Revenue</th>
                      <th>Avg Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobTypeSummary.map(jobType => (
                      <tr key={jobType.job_type_id}>
                        <td>{jobType.job_type_name}</td>
                        <td>{jobType.machine_type}</td>
                        <td>{jobType.unit}</td>
                        <td>{jobType.job_count}</td>
                        <td>UGX {parseFloat(jobType.total_revenue).toLocaleString()}</td>
                        <td>UGX {parseFloat(jobType.average_amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="summary-section">
            <h2>Detailed Jobs</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Time</th>
                    <th>Worker</th>
                    <th>Machine</th>
                    <th>Job Type</th>
                    <th>Description</th>
                    <th>Details</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedJobs.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center' }}>No jobs for this date</td>
                    </tr>
                  ) : (
                    detailedJobs.map(job => (
                      <tr key={job.id}>
                        <td>{job.id}</td>
                        <td>{format(new Date(job.created_at), 'HH:mm:ss')}</td>
                        <td>{job.worker_name}</td>
                        <td>{job.machine_name}</td>
                        <td>{job.job_type_name}</td>
                        <td>{job.description}</td>
                        <td>
                          {job.width_cm && job.height_cm
                            ? `${job.width_cm}×${job.height_cm} cm`
                            : `${job.quantity} pieces`
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
        )}
      </main>

      <Chat isOpen={chatOpen} onClose={() => setChatOpen(false)} />

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

export default AdminDashboard;
