import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Network: ONLINE');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('Network: OFFLINE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check server reachability every 30 seconds
    const checkServer = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch('/health', {
          method: 'GET',
          cache: 'no-cache',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          setServerReachable(true);
        } else {
          setServerReachable(false);
          console.warn('Server returned non-OK status:', response.status);
        }
      } catch (error) {
        // Only set as unreachable if we're actually online but can't reach server
        if (navigator.onLine) {
          setServerReachable(false);
          console.warn('Server unreachable:', error.message);
        }
      }
    };

    // Initial check
    checkServer();
    
    // Check every 30 seconds
    const interval = setInterval(checkServer, 30000);

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
