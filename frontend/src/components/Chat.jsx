import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Chat.css';

const Chat = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [lastGlobalCheck, setLastGlobalCheck] = useState(0);
  const audioRef = useRef(null);
  const sendAudioRef = useRef(null);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [rateLimitError, setRateLimitError] = useState(false);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Global message checker (runs even when chat is closed)
  useEffect(() => {
    const checkNewMessages = async () => {
      if (rateLimitError) {
        // Skip checking if we're rate limited
        return;
      }
      
      try {
        const response = await api.get('/messages');
        const allMessages = response.data.data;
        const newMessagesCount = allMessages.length;
        
        if (newMessagesCount > lastGlobalCheck && lastGlobalCheck > 0) {
          const latestMessage = allMessages[0]; // Most recent message
          
          // Only notify if message is for current user and not from current user
          if (latestMessage.receiver_id === user.id && latestMessage.sender_id !== user.id) {
            // Play sound
            if (audioRef.current) {
              audioRef.current.play().catch(err => console.log('Audio play failed:', err));
            }
            
            // Show browser notification
            if (notificationPermission === 'granted' && !isOpen) {
              new Notification('New Message', {
                body: `${latestMessage.sender_name}: ${latestMessage.message || 'Sent a file'}`,
                icon: '/messages-ios-seeklogo.png',
                tag: `message-${latestMessage.id}`,
                requireInteraction: false
              });
            }
          }
        }
        
        setLastGlobalCheck(newMessagesCount);
        setRateLimitError(false);
      } catch (error) {
        if (error.response?.status === 429) {
          console.warn('Rate limited - pausing message checks');
          setRateLimitError(true);
          // Resume after 30 seconds
          setTimeout(() => setRateLimitError(false), 30000);
        } else {
          console.error('Failed to check messages:', error);
        }
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkNewMessages, 3000);
    checkNewMessages(); // Initial check

    return () => clearInterval(interval);
  }, [user.id, lastGlobalCheck, notificationPermission, isOpen, rateLimitError]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      const userInterval = setInterval(loadUsers, 2000);
      return () => clearInterval(userInterval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedUser) {
      loadMessages();
      const interval = setInterval(loadMessages, 1000); // Refresh every 1 second for real-time
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLastSeenText = (secondsAgo) => {
    if (secondsAgo === null) return 'Never';
    if (secondsAgo < 300) return 'Active now'; // 5 minutes
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutes = Math.floor(secondsAgo / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/messages/users');
      setUsers(response.data.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedUser) return;
    try {
      const response = await api.get(`/messages?with_user_id=${selectedUser.id}`);
      const newMessages = response.data.data;
      
      // Play notification sound if new message received
      if (newMessages.length > lastMessageCount && lastMessageCount > 0) {
        const latestMessage = newMessages[newMessages.length - 1];
        if (latestMessage.sender_id !== user.id && audioRef.current) {
          audioRef.current.play().catch(err => console.log('Audio play failed:', err));
        }
      }
      
      setMessages(newMessages);
      setLastMessageCount(newMessages.length);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedUser) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('receiver_id', selectedUser.id);
      if (newMessage.trim()) {
        formData.append('message', newMessage);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api.post('/messages/send', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Play send sound with user interaction
      if (sendAudioRef.current) {
        sendAudioRef.current.currentTime = 0; // Reset to start
        sendAudioRef.current.play()
          .then(() => console.log('Send sound played'))
          .catch(err => console.log('Send audio failed:', err));
      }

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Reload messages immediately
      setTimeout(() => loadMessages(), 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDownload = async (messageId, fileName) => {
    try {
      const response = await api.get(`/messages/${messageId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('Failed to download file');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <audio ref={audioRef} src="/c.mp3" preload="auto" />
      <audio ref={sendAudioRef} src="/send.mp3" preload="auto" />
      <div className="chat-overlay">
        <div className="chat-container">
          <div className="chat-header">
            <h2>Messages</h2>
            <button onClick={onClose} className="chat-close">×</button>
          </div>

          <div className="chat-body">
            <div className="chat-users">
              <h3>Users</h3>
              <div className="users-list">
                {users.map(u => (
                  <div
                    key={u.id}
                    className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                    onClick={() => setSelectedUser(u)}
                  >
                    <div className="user-avatar">
                      {u.name.charAt(0)}
                      {u.isActive && <span className="active-indicator"></span>}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{u.name}</div>
                      <div className="user-role">
                        {u.role} {u.department && `- ${u.department}`}
                        <span className={`last-seen ${u.isActive ? 'active' : ''}`}>
                          • {getLastSeenText(u.secondsAgo)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="chat-messages">
              {selectedUser ? (
                <>
                  <div className="chat-messages-header">
                    <h3>Chat with {selectedUser.name}</h3>
                  </div>
                  <div className="messages-list">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`message ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          {msg.message && <p>{msg.message}</p>}
                          {msg.file_name && (
                            <div className="message-file">
                              <span className="file-icon">📎</span>
                              <span className="file-name">{msg.file_name}</span>
                              <button
                                onClick={() => handleDownload(msg.id, msg.file_name)}
                                className="file-download"
                              >
                                Download
                              </button>
                            </div>
                          )}
                          <div className="message-time">
                            {new Date(msg.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <form onSubmit={handleSendMessage} className="message-input-form">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="attach-btn"
                      title="Attach file"
                    >
                      📎
                    </button>
                    {selectedFile && (
                      <div className="selected-file">
                        {selectedFile.name}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="remove-file"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="message-input"
                    />
                    <button type="submit" disabled={sending} className="send-btn">
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="no-chat-selected">
                  <p>Select a user to start chatting</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
