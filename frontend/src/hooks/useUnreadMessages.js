import { useState, useEffect } from 'react';
import api from '../services/api';

export const useUnreadMessages = (userId) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const checkUnread = async () => {
      try {
        const response = await api.get('/messages');
        const messages = response.data.data;
        
        // Count unread messages where current user is receiver
        const unread = messages.filter(msg => 
          msg.receiver_id === userId && 
          !msg.is_read
        ).length;
        
        setUnreadCount(unread);
      } catch (error) {
        console.error('Failed to check unread messages:', error);
      }
    };

    // Check immediately
    checkUnread();

    // Check every 5 seconds
    const interval = setInterval(checkUnread, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  return unreadCount;
};

export default useUnreadMessages;
