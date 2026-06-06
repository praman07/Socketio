import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const Chat = ({ token, user, onLogout }) => {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { type: 'user' | 'group', id, name }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineStatus, setOnlineStatus] = useState({}); // userId -> { status, lastSeen }
  const [typingStatus, setTypingStatus] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Initialize Socket and fetch initial data
  useEffect(() => {
    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });
    setSocket(newSocket);

    const fetchData = async () => {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [usersRes, groupsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/auth/users', config),
          axios.get('http://localhost:5000/api/chat/groups', config)
        ]);
        setUsers(usersRes.data);
        setGroups(groupsRes.data);
        
        // initialize online status
        const initialStatus = {};
        usersRes.data.forEach(u => {
          initialStatus[u._id] = { status: u.status, lastSeen: u.lastSeen };
        });
        setOnlineStatus(initialStatus);

        newSocket.emit('joinGroups', groupsRes.data.map(g => g._id));
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();

    return () => newSocket.close();
  }, [token]);

  // Handle Socket Events
  useEffect(() => {
    if (!socket) return;

    socket.on('userStatusUpdate', (data) => {
      setOnlineStatus(prev => ({ ...prev, [data.userId]: { status: data.status, lastSeen: data.lastSeen } }));
    });

    socket.on('newMessage', (msg) => {
      // If message belongs to active chat, append it
      setMessages(prev => [...prev, msg]);
    });

    socket.on('newGroupMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('typing', (data) => {
      if (activeChat) {
        if (!data.isGroup && activeChat.type === 'user' && activeChat.id === data.senderId) {
          setTypingStatus('typing...');
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingStatus(null), 2000);
        } else if (data.isGroup && activeChat.type === 'group' && activeChat.id === data.groupId) {
          setTypingStatus('someone is typing...');
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingStatus(null), 2000);
        }
      }
    });

    return () => {
      socket.off('userStatusUpdate');
      socket.off('newMessage');
      socket.off('newGroupMessage');
      socket.off('typing');
    };
  }, [socket, activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChat = async (chat) => {
    setActiveChat(chat);
    setMessages([]);
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const endpoint = chat.type === 'user' 
        ? `http://localhost:5000/api/chat/messages/${chat.id}` 
        : `http://localhost:5000/api/chat/groups/${chat.id}/messages`;
      const res = await axios.get(endpoint, config);
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    if (activeChat.type === 'user') {
      socket.emit('privateMessage', { receiverId: activeChat.id, content: newMessage });
    } else {
      socket.emit('groupMessage', { groupId: activeChat.id, content: newMessage });
    }
    setNewMessage('');
  };

  const handleTyping = () => {
    if (!activeChat) return;
    if (activeChat.type === 'user') {
      socket.emit('typing', { receiverId: activeChat.id });
    } else {
      socket.emit('groupTyping', { groupId: activeChat.id });
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.length === 0) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.post('http://localhost:5000/api/chat/groups', {
        name: newGroupName,
        members: selectedGroupMembers
      }, config);
      setGroups([...groups, res.data]);
      socket.emit('joinGroups', [res.data._id]);
      setShowCreateGroup(false);
      setNewGroupName('');
      setSelectedGroupMembers([]);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleGroupMember = (userId) => {
    if (selectedGroupMembers.includes(userId)) {
      setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== userId));
    } else {
      setSelectedGroupMembers([...selectedGroupMembers, userId]);
    }
  };

  const filteredMessages = messages.filter(m => {
    if (activeChat?.type === 'user') {
      return (m.sender?._id === user.id && m.receiver === activeChat.id) || 
             (m.sender?._id === activeChat.id && m.receiver === user.id);
    } else if (activeChat?.type === 'group') {
      return m.group === activeChat.id;
    }
    return false;
  });

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <div className="w-1/4 border-r border-gray-700 flex flex-col bg-gray-800">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">VibeChat</h2>
          <button onClick={onLogout} className="text-sm text-red-400 hover:text-red-300 transition-colors">Logout</button>
        </div>
        
        <div className="overflow-y-auto flex-1">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Groups</h3>
              <button onClick={() => setShowCreateGroup(true)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors">+</button>
            </div>
            {groups.map(g => (
              <div 
                key={g._id} 
                onClick={() => loadChat({ type: 'group', id: g._id, name: g.name })}
                className={`p-3 rounded-lg cursor-pointer mb-1 transition-all ${activeChat?.id === g._id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-gray-700 border border-transparent'}`}
              >
                <div className="font-medium text-blue-300"># {g.name}</div>
              </div>
            ))}
          </div>

          <div className="p-4 pt-0">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Direct Messages</h3>
            {users.map(u => (
              <div 
                key={u._id} 
                onClick={() => loadChat({ type: 'user', id: u._id, name: u.username })}
                className={`p-3 rounded-lg cursor-pointer mb-1 flex items-center justify-between transition-all ${activeChat?.id === u._id ? 'bg-gray-700/80 border border-gray-600' : 'hover:bg-gray-700/50 border border-transparent'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${onlineStatus[u._id]?.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span className="font-medium text-gray-200">{u.username}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900 relative">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800 shadow-sm flex flex-col">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {activeChat.type === 'group' && <span className="text-blue-400">#</span>}
                {activeChat.name}
              </h2>
              {activeChat.type === 'user' && onlineStatus[activeChat.id] && (
                <span className="text-xs text-gray-400">
                  {onlineStatus[activeChat.id].status === 'online' 
                    ? 'Online' 
                    : `Last seen: ${new Date(onlineStatus[activeChat.id].lastSeen).toLocaleString()}`}
                </span>
              )}
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {filteredMessages.map((m, idx) => {
                const isMine = m.sender?._id === user.id;
                return (
                  <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-700 text-gray-100 rounded-bl-sm border border-gray-600'}`}>
                      {!isMine && activeChat.type === 'group' && (
                        <div className="text-xs text-blue-300 mb-1 font-medium">{m.sender?.username}</div>
                      )}
                      <div>{m.content}</div>
                      <div className="text-[10px] text-gray-300 mt-1 opacity-70 text-right">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingStatus && (
                <div className="text-xs text-gray-400 italic ml-2">{typingStatus}</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-gray-800 border-t border-gray-700">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..." 
                  className="flex-1 bg-gray-700 text-white rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-6 py-3 font-semibold transition-all shadow-lg hover:shadow-blue-500/20">Send</button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center shadow-inner">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            </div>
            <p className="text-lg font-medium">Select a chat to start messaging</p>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateGroup && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-2xl w-96 border border-gray-700 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-white">Create New Group</h3>
              <input 
                type="text" 
                placeholder="Group Name" 
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mb-4 max-h-48 overflow-y-auto bg-gray-700/50 rounded-lg p-2 border border-gray-600">
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase px-2">Select Members</div>
                {users.map(u => (
                  <div key={u._id} className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors" onClick={() => toggleGroupMember(u._id)}>
                    <input 
                      type="checkbox" 
                      checked={selectedGroupMembers.includes(u._id)} 
                      onChange={() => {}}
                      className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-500 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-200">{u.username}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={createGroup} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/20 transition-all font-medium">Create Group</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
