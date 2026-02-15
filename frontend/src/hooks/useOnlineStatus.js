import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check server reachability every 10 seconds
    const checkServer = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache'
        });
        setServerReachable(response.ok);
      } catch (error) {
        setServerReachable(false);
      }
    };

    checkServer();
    const interval = setInterval(checkServer, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return {
    isOnline: isOnline && serverReachable,
    networkOnline: isOnline,
    serverReachable
  };
};

export default useOnlineStatus;
