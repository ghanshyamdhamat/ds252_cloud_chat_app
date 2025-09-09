import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Authentication
  const [showLogin, setShowLogin] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', email: '' });

  useEffect(() => {
    // Socket event listeners
    socket.on('newMessage', handleNewMessage);
    socket.on('messageDelivered', handleMessageDelivered);
    socket.on('userTyping', handleUserTyping);
    socket.on('userOnline', handleUserOnline);
    socket.on('userOffline', handleUserOffline);
    socket.on('onlineUsers', setOnlineUsers);

    return () => {
      socket.off('newMessage');
      socket.off('messageDelivered');
      socket.off('userTyping');
      socket.off('userOnline');
      socket.off('userOffline');
      socket.off('onlineUsers');
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.user);
        setShowLogin(false);
        socket.emit('join', data.user.username);
        loadConversations(data.user.username);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const loadConversations = async (username) => {
    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${username}`);
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3001/api/users/search?query=${searchQuery}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.users.filter(user => user.username !== currentUser.username));
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const startConversation = async (username) => {
    setSelectedConversation(username);
    setSearchQuery('');
    setSearchResults([]);
    await loadMessages(currentUser.username, username);
  };

  const loadMessages = async (user1, user2) => {
    try {
      const response = await fetch(`http://localhost:3001/api/messages/${user1}/${user2}`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    const messageData = {
      sender: currentUser.username,
      recipient: selectedConversation,
      content: messageInput.trim(),
      messageType: 'text'
    };

    socket.emit('sendMessage', messageData);
    setMessageInput('');
    
    // Stop typing indicator
    socket.emit('typing', { recipient: selectedConversation, isTyping: false });
  };

  const handleNewMessage = (message) => {
    setMessages(prev => [...prev, message]);
    
    // Update conversations
    if (currentUser) {
      loadConversations(currentUser.username);
    }
  };

  const handleMessageDelivered = (message) => {
    setMessages(prev => [...prev, message]);
    
    // Update conversations
    if (currentUser) {
      loadConversations(currentUser.username);
    }
  };

  const handleUserTyping = ({ username, isTyping }) => {
    setTypingUsers(prev => {
      const newSet = new Set(prev);
      if (isTyping) {
        newSet.add(username);
      } else {
        newSet.delete(username);
      }
      return newSet;
    });
  };

  const handleUserOnline = (username) => {
    setOnlineUsers(prev => [...prev.filter(u => u !== username), username]);
  };

  const handleUserOffline = (username) => {
    setOnlineUsers(prev => prev.filter(u => u !== username));
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    
    // Handle typing indicator
    if (selectedConversation) {
      socket.emit('typing', { recipient: selectedConversation, isTyping: true });
      
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { recipient: selectedConversation, isTyping: false });
      }, 1000);
    }
  };

  if (showLogin) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h1>WhatsApp Clone</h1>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
              required
            />
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <h3>{currentUser?.username}</h3>
            <span className="online-indicator">Online</span>
          </div>
        </div>
        
        <div className="search-section">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
          />
          <button onClick={searchUsers}>Search</button>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results</h4>
            {searchResults.map(user => (
              <div
                key={user._id}
                className="user-item"
                onClick={() => startConversation(user.username)}
              >
                <span>{user.username}</span>
                {onlineUsers.includes(user.username) && (
                  <span className="online-dot"></span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="conversations">
          <h4>Conversations</h4>
          {conversations.map(conv => (
            <div
              key={conv.partner}
              className={`conversation-item ${selectedConversation === conv.partner ? 'active' : ''}`}
              onClick={() => startConversation(conv.partner)}
            >
              <div className="conversation-info">
                <span className="partner-name">{conv.partner}</span>
                <span className="last-message">{conv.lastMessage}</span>
              </div>
              {onlineUsers.includes(conv.partner) && (
                <span className="online-dot"></span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="chat-area">
        {selectedConversation ? (
          <>
            <div className="chat-header">
              <h3>{selectedConversation}</h3>
              {onlineUsers.includes(selectedConversation) ? (
                <span className="status online">Online</span>
              ) : (
                <span className="status offline">Offline</span>
              )}
            </div>

            <div className="messages-container">
              {messages.map(message => (
                <div
                  key={message._id || message.id}
                  className={`message ${message.sender === currentUser.username ? 'sent' : 'received'}`}
                >
                  <div className="message-content">
                    {message.content}
                  </div>
                  <div className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              
              {typingUsers.has(selectedConversation) && (
                <div className="typing-indicator">
                  <span>{selectedConversation} is typing...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <form className="message-form" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={handleInputChange}
              />
              <button type="submit" disabled={!messageInput.trim()}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="no-conversation">
            <h3>Select a conversation to start chatting</h3>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
