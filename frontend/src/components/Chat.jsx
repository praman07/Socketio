import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Profile from './Profile';
import { FiImage, FiSend, FiUser, FiUsers, FiPlus, FiSettings } from 'react-icons/fi';

const Chat = ({ token, user: initialUser, onLogout }) => {
  const [user, setUser] = useState(initialUser);
  const [socket, setSocket] = useState(null);
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineStatus, setOnlineStatus] = useState({});
  const [typingStatus, setTypingStatus] = useState(null);
  
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const ikUploadRef = useRef(null);
  
  const handleImageUploadSuccess = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      sendMessage(null, uploadRes.data.url);
    } catch (err) {
      console.error("Error uploading image", err);
      alert('Failed to upload image.');
    }
  };

  useEffect(() => {
    const newSocket = io('http://localhost:5000', { auth: { token } });
    setSocket(newSocket);

    const fetchData = async () => {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [meRes, usersRes, groupsRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/users/profile/${user.id}`, config),
          axios.get('http://localhost:5000/api/auth/users', config),
          axios.get('http://localhost:5000/api/chat/groups', config)
        ]);
        
        setUser(prev => ({ ...prev, profilePicture: meRes.data.profilePicture, bio: meRes.data.bio }));
        setFriends(meRes.data.friends || []);
        setAllUsers(usersRes.data);
        setGroups(groupsRes.data);
        
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

  useEffect(() => {
    if (!socket) return;
    socket.on('userStatusUpdate', (data) => {
      setOnlineStatus(prev => ({ ...prev, [data.userId]: { status: data.status, lastSeen: data.lastSeen } }));
    });
    socket.on('newMessage', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('newGroupMessage', (msg) => setMessages(prev => [...prev, msg]));
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
      socket.off('userStatusUpdate'); socket.off('newMessage'); socket.off('newGroupMessage'); socket.off('typing');
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

  const sendMessage = (e, fileUrl = null) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !fileUrl) || !activeChat) return;

    if (activeChat.type === 'user') {
      socket.emit('privateMessage', { receiverId: activeChat.id, content: newMessage, fileUrl });
    } else {
      socket.emit('groupMessage', { groupId: activeChat.id, content: newMessage, fileUrl });
    }
    setNewMessage('');
  };

  const handleImageUploadWrapper = (res) => {
    // keeping signature just in case it's called elsewhere, but changed above
  };

  const handleTyping = () => {
    if (!activeChat) return;
    if (activeChat.type === 'user') {
      socket.emit('typing', { receiverId: activeChat.id });
    } else {
      socket.emit('groupTyping', { groupId: activeChat.id });
    }
  };

  const addFriend = async (friendId) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      await axios.post(`http://localhost:5000/api/users/friends/${friendId}`, {}, config);
      const meRes = await axios.get(`http://localhost:5000/api/users/profile/${user.id}`, config);
      setFriends(meRes.data.friends);
      setShowAddFriend(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding friend');
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.length === 0) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.post('http://localhost:5000/api/chat/groups', {
        name: newGroupName, members: selectedGroupMembers
      }, config);
      setGroups([...groups, res.data]);
      socket.emit('joinGroups', [res.data._id]);
      setShowCreateGroup(false); setNewGroupName(''); setSelectedGroupMembers([]);
    } catch (err) { console.error(err); }
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

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 flex flex-col bg-gray-900 shadow-xl z-10">
        <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
            <img src={user.profilePicture || `https://ui-avatars.com/api/?name=${user.username}`} alt="Me" className="w-10 h-10 rounded-full border-2 border-blue-500/50 hover:border-blue-400 transition-colors" />
            <div>
              <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">VibeChat</h2>
              <p className="text-xs text-gray-400 hover:text-gray-300">@{user.username}</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs font-semibold text-gray-500 hover:text-red-400 transition-colors bg-gray-800 hover:bg-gray-800/80 px-3 py-1.5 rounded-full">Logout</button>
        </div>
        
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* Friends Section */}
          <div className="p-4 pt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FiUser /> Friends</h3>
              <button onClick={() => setShowAddFriend(true)} className="text-gray-400 hover:text-white transition-colors"><FiPlus size={16} /></button>
            </div>
            {friends.length === 0 ? (
              <p className="text-sm text-gray-600 italic px-2">No friends yet.</p>
            ) : (
              friends.map(f => (
                <div 
                  key={f._id} 
                  onClick={() => loadChat({ type: 'user', id: f._id, name: f.username, avatar: f.profilePicture })}
                  className={`p-2.5 rounded-xl cursor-pointer mb-1 flex items-center gap-3 transition-all ${activeChat?.id === f._id ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-gray-800 border border-transparent'}`}
                >
                  <div className="relative">
                    <img src={f.profilePicture || `https://ui-avatars.com/api/?name=${f.username}`} alt={f.username} className="w-10 h-10 rounded-full object-cover" />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${onlineStatus[f._id]?.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-200 truncate">{f.username}</h4>
                    <p className="text-xs text-gray-500 truncate">{onlineStatus[f._id]?.status === 'online' ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Groups Section */}
          <div className="p-4 border-t border-gray-800/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FiUsers /> Groups</h3>
              <button onClick={() => setShowCreateGroup(true)} className="text-gray-400 hover:text-white transition-colors"><FiPlus size={16} /></button>
            </div>
            {groups.map(g => (
              <div 
                key={g._id} 
                onClick={() => loadChat({ type: 'group', id: g._id, name: g.name })}
                className={`p-2.5 rounded-xl cursor-pointer mb-1 flex items-center gap-3 transition-all ${activeChat?.id === g._id ? 'bg-blue-600/10 border border-blue-500/20' : 'hover:bg-gray-800 border border-transparent'}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-inner">
                  #
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-200 truncate">{g.name}</h4>
                  <p className="text-xs text-gray-500 truncate">{g.members?.length || 0} members</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0b0f19] relative">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-gray-800 bg-gray-900 shadow-sm flex items-center gap-4 z-10">
               {activeChat.type === 'user' ? (
                 <img src={activeChat.avatar || `https://ui-avatars.com/api/?name=${activeChat.name}`} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
               ) : (
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-inner">#</div>
               )}
              <div>
                <h2 className="text-lg font-bold text-white">{activeChat.name}</h2>
                {activeChat.type === 'user' && onlineStatus[activeChat.id] && (
                  <span className="text-xs text-gray-400">
                    {onlineStatus[activeChat.id].status === 'online' 
                      ? <span className="text-green-400">Online</span> 
                      : `Last seen: ${new Date(onlineStatus[activeChat.id].lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
              {filteredMessages.map((m, idx) => {
                const isMine = m.sender?._id === user.id;
                const showSenderAvatar = !isMine && activeChat.type === 'group';
                return (
                  <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className="flex max-w-[75%] gap-2 items-end">
                      {showSenderAvatar && (
                        <img src={m.sender?.profilePicture || `https://ui-avatars.com/api/?name=${m.sender?.username}`} className="w-6 h-6 rounded-full mb-1" alt="sender"/>
                      )}
                      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {showSenderAvatar && <span className="text-[10px] text-gray-400 ml-1 mb-1">{m.sender?.username}</span>}
                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm border border-gray-700'}`}>
                          {m.fileUrl && (
                            <img src={m.fileUrl} alt="attachment" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" style={{maxHeight: '300px'}} />
                          )}
                          {m.content && <div className="leading-relaxed">{m.content}</div>}
                          <div className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-gray-400'} text-right`}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {typingStatus && (
                <div className="text-xs text-gray-400 italic ml-10 animate-pulse">{typingStatus}</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800">
              <input 
                type="file" 
                accept="image/*" 
                ref={ikUploadRef} 
                style={{ display: 'none' }} 
                onChange={handleImageUploadSuccess} 
              />
              <form onSubmit={sendMessage} className="flex gap-3 items-center">
                <button type="button" onClick={() => ikUploadRef.current?.click()} className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
                  <FiImage size={20} />
                </button>
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                  placeholder="Type a message..." 
                  className="flex-1 bg-gray-800 text-white rounded-full px-5 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700 placeholder-gray-500 transition-all"
                />
                <button type="submit" className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95">
                  <FiSend size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4 opacity-70">
            <div className="w-24 h-24 bg-gray-800/50 rounded-full flex items-center justify-center shadow-inner">
              <FiUsers size={40} className="text-gray-600" />
            </div>
            <p className="text-lg font-medium text-gray-400">Select a friend or group to start chatting</p>
          </div>
        )}

        {/* Add Friend Modal */}
        {showAddFriend && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-2xl w-96 border border-gray-700 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-white">Find Friends</h3>
              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                {allUsers.filter(u => u._id !== user.id && !friends.some(f => f._id === u._id)).map(u => (
                  <div key={u._id} className="flex items-center justify-between p-3 hover:bg-gray-700/50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.username}`} className="w-8 h-8 rounded-full" alt="user" />
                      <span className="text-gray-200 font-medium">{u.username}</span>
                    </div>
                    <button onClick={() => addFriend(u._id)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all">Add</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAddFriend(false)} className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white transition-colors">Close</button>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateGroup && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-2xl w-96 border border-gray-700 shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-white">Create Group</h3>
              <input type="text" placeholder="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 mb-4 text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="mb-4 max-h-48 overflow-y-auto bg-gray-900/50 rounded-xl p-2 border border-gray-700 custom-scrollbar">
                <div className="text-xs font-bold text-gray-500 mb-2 uppercase px-2 tracking-wider">Select Friends</div>
                {friends.map(u => (
                  <div key={u._id} className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors" onClick={() => setSelectedGroupMembers(prev => prev.includes(u._id) ? prev.filter(id => id !== u._id) : [...prev, u._id])}>
                    <input type="checkbox" checked={selectedGroupMembers.includes(u._id)} readOnly className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-500 rounded focus:ring-0 focus:ring-offset-0" />
                    <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.username}`} className="w-6 h-6 rounded-full" alt="user" />
                    <span className="text-sm text-gray-200">{u.username}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateGroup(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={createGroup} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md transition-all font-medium">Create Group</button>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfile && (
          <Profile token={token} user={user} onClose={() => setShowProfile(false)} onUpdate={(updatedUser) => setUser(updatedUser)} />
        )}

      </div>
    </div>
  );
};

export default Chat;
