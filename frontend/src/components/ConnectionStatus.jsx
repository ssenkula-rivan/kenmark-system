import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
  const { isOnline, networkOnline, serverReachable } = useOnlineStatus();

  // Don't show anything when fully online
  if (isOnline) return null;

  return (
    <div className="connection-status-banner offline">
      <div className="banner-content">
        <span className="status-icon">⚠️</span>
        <div className="status-message">
          {!networkOnline ? (
            <>
              <strong>No Internet Connection</strong>
              <span className="status-detail">You are offline. Data will be saved locally and synced when connection is restored.</span>
            </>
          ) : !serverReachable ? (
            <>
              <strong>Server Unreachable</strong>
              <span className="status-detail">Cannot connect to server. Data will be saved locally and synced when connection is restored.</span>
            </>
          ) : (
            <>
              <strong>Connection Issue</strong>
              <span className="status-detail">Experiencing connectivity problems. Your data is safe.</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
