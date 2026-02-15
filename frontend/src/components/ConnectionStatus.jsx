import { useOnlineStatus } from '../hooks/useOnlineStatus';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null; // Don't show anything when online

  return (
    <div className="connection-status offline">
      <div className="status-icon">⚠️</div>
    </div>
  );
};

export default ConnectionStatus;
