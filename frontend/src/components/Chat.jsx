import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Profile from './Profile';
import { FiHash, FiSettings, FiUserPlus, FiMessageSquare, FiPlus, FiImage, FiSend, FiLogOut } from 'react-icons/fi';
import { RiDiscordFill } from 'react-icons/ri';

const Chat = ({ token, user: initialUser, onLogout }) => {
  const [user, setUser] = useState(initialUser);
  const [socket, setSocket] = useState(null);
  
  // Data State
  const [friends, setFriends] = useState([]);
  const [servers, setServers] = useState([]);
  const [serverChannels, setServerChannels] = useState([]);
  const [serverMembers, setServerMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [allUsers, setAllUsers] = useState([]); // For search
  
  // Navigation State
  const [activeServer, setActiveServer] = useState(null); // null = Home
  const [activeChannel, setActiveChannel] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  
  // UI State
  const [newMessage, setNewMessage] = useState('');
  const [typingStatus, setTypingStatus] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  
  const [newServerName, setNewServerName] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize socket and data
  useEffect(() => {
    const newSocket = io('http://localhost:5000', { auth: { token } });
    setSocket(newSocket);

    const fetchData = async () => {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      try {
        const [meRes, serversRes, usersRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/users/profile/${user.id}`, config),
          axios.get('http://localhost:5000/api/servers', config),
          axios.get('http://localhost:5000/api/auth/users', config)
        ]);
        
        setUser(prev => ({ ...prev, profilePicture: meRes.data.profilePicture, bio: meRes.data.bio, displayName: meRes.data.displayName, uniqueId: meRes.data.uniqueId }));
        setFriends(meRes.data.friends || []);
        setServers(serversRes.data);
        setAllUsers(usersRes.data);
        
        const initialStatus = {};
        usersRes.data.forEach(u => {
          initialStatus[u._id] = { status: u.status, lastSeen: u.lastSeen };
        });
        setOnlineStatus(initialStatus);

      } catch (err) {
        console.error("Fetch initial data error:", err);
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
      if (!activeServer && activeDM && (msg.sender._id === activeDM._id || msg.receiver === activeDM._id)) {
        setMessages(prev => [...prev, msg]);
      }
    });
    
    socket.on('newChannelMessage', (msg) => {
      if (activeServer && activeChannel && msg.channel === activeChannel._id) {
        setMessages(prev => [...prev, msg]);
      }
    });
    
    socket.on('typing', (data) => {
      if (!activeServer && activeDM && data.senderId === activeDM._id && !data.isChannel) {
        setTypingStatus('typing...');
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingStatus(null), 2000);
      } else if (activeServer && activeChannel && data.isChannel && data.channelId === activeChannel._id) {
        setTypingStatus('someone is typing...');
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingStatus(null), 2000);
      }
    });

    return () => {
      socket.off('userStatusUpdate');
      socket.off('newMessage');
      socket.off('newChannelMessage');
      socket.off('typing');
    };
  }, [socket, activeServer, activeChannel, activeDM]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load channels when a server is clicked
  useEffect(() => {
    if (!activeServer) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios.get(`http://localhost:5000/api/servers/${activeServer._id}/channels`, config).then(res => {
      setServerChannels(res.data);
      if (res.data.length > 0) {
        loadChannel(res.data[0]);
      } else {
        setActiveChannel(null);
        setMessages([]);
      }
    });
    axios.get(`http://localhost:5000/api/servers/${activeServer._id}/members`, config).then(res => {
      setServerMembers(res.data);
    });
  }, [activeServer]);

  const loadChannel = async (channel) => {
    setActiveChannel(channel);
    setMessages([]);
    socket.emit('joinChannels', [channel._id]);
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.get(`http://localhost:5000/api/chat/channels/${channel._id}/messages`, config);
      setMessages(res.data);
    } catch (err) { console.error(err); }
  };

  const loadDM = async (friend) => {
    setActiveDM(friend);
    setActiveServer(null); // Go Home
    setMessages([]);
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.get(`http://localhost:5000/api/chat/messages/${friend._id}`, config);
      setMessages(res.data);
    } catch (err) { console.error(err); }
  };

  const sendMessage = (e, fileUrl = null) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !fileUrl)) return;

    if (!activeServer && activeDM) {
      socket.emit('privateMessage', { receiverId: activeDM._id, content: newMessage, fileUrl });
    } else if (activeServer && activeChannel) {
      socket.emit('channelMessage', { channelId: activeChannel._id, content: newMessage, fileUrl });
    }
    setNewMessage('');
  };

  const handleImageUpload = async (e) => {
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
      alert('Upload failed.');
    }
  };

  const handleTyping = () => {
    if (!activeServer && activeDM) {
      socket.emit('typing', { receiverId: activeDM._id });
    } else if (activeServer && activeChannel) {
      socket.emit('channelTyping', { channelId: activeChannel._id });
    }
  };

  const createServer = async () => {
    if (!newServerName.trim()) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.post('http://localhost:5000/api/servers', { name: newServerName }, config);
      setServers([...servers, res.data]);
      setShowAddServer(false);
      setNewServerName('');
      setActiveServer(res.data);
    } catch (err) { console.error(err); }
  };

  const createChannel = async () => {
    if (!newChannelName.trim() || !activeServer) return;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const res = await axios.post(`http://localhost:5000/api/servers/${activeServer._id}/channels`, { name: newChannelName }, config);
      setServerChannels([...serverChannels, res.data]);
      setShowCreateChannel(false);
      setNewChannelName('');
    } catch (err) { alert(err.response?.data?.message || 'Error creating channel'); }
  };

  const addFriend = async (friendId) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
      await axios.post(`http://localhost:5000/api/users/friends/${friendId}`, {}, config);
      const meRes = await axios.get(`http://localhost:5000/api/users/profile/${user.id}`, config);
      setFriends(meRes.data.friends);
    } catch (err) { alert(err.response?.data?.message || 'Error adding friend'); }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#1e1f22] text-[#dbdee1] font-sans overflow-hidden">
      
      {/* 1. Server List Sidebar */}
      <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 space-y-2 border-r border-black/20 shrink-0 z-20">
        <div 
          onClick={() => { setActiveServer(null); setActiveDM(null); }}
          className={`w-12 h-12 rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 ${!activeServer ? 'bg-[#5865F2] text-white rounded-[16px]' : 'bg-[#313338] text-[#dbdee1] hover:bg-[#5865F2] hover:text-white'}`}
        >
          <RiDiscordFill size={28} />
        </div>
        <div className="w-8 h-[2px] bg-[#35363c] rounded-full mx-auto my-2"></div>
        
        {servers.map(s => (
          <div 
            key={s._id} 
            onClick={() => setActiveServer(s)}
            className="relative group"
          >
            {activeServer?._id === s._id && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-10 bg-white rounded-r-full"></div>}
            <div className={`w-12 h-12 flex items-center justify-center font-bold text-lg cursor-pointer transition-all duration-200 ${activeServer?._id === s._id ? 'rounded-[16px] bg-[#5865F2] text-white' : 'rounded-[24px] bg-[#313338] hover:rounded-[16px] hover:bg-[#5865F2] hover:text-white'}`}>
              {s.iconUrl ? <img src={s.iconUrl} className="w-full h-full object-cover rounded-[inherit]" alt="icon"/> : s.name.charAt(0).toUpperCase()}
            </div>
          </div>
        ))}

        <div 
          onClick={() => setShowAddServer(true)}
          className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-[#313338] text-[#23a559] hover:bg-[#23a559] hover:text-white flex items-center justify-center cursor-pointer transition-all duration-200"
        >
          <FiPlus size={24} />
        </div>
      </div>

      {/* 2. Secondary Sidebar (Channels or DMs) */}
      <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0 border-r border-black/10">
        <div className="h-12 border-b border-[#1e1f22] flex items-center px-4 font-bold shadow-sm shrink-0">
          {activeServer ? activeServer.name : 'Home'}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {!activeServer ? (
            // HOME VIEW: Friends & DMs
            <div>
              <button onClick={() => {setActiveDM(null); setShowAddFriend(true)}} className={`w-full flex items-center gap-3 px-3 py-2 rounded mb-4 ${!activeDM ? 'bg-[#404249] text-white' : 'hover:bg-[#35373c] text-[#949ba4]'}`}>
                <FiUserPlus size={20}/>
                <span className="font-medium">Friends</span>
              </button>
              
              <div className="text-xs font-bold text-[#949ba4] uppercase px-2 mb-2 hover:text-[#dbdee1] flex justify-between">
                DIRECT MESSAGES
              </div>
              {friends.map(f => (
                <div 
                  key={f._id} onClick={() => loadDM(f)}
                  className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer group ${activeDM?._id === f._id ? 'bg-[#404249] text-white' : 'hover:bg-[#35373c] text-[#949ba4]'}`}
                >
                  <div className="relative">
                    <img src={f.profilePicture || `https://ui-avatars.com/api/?name=${f.username}`} className="w-8 h-8 rounded-full" alt="avatar" />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${onlineStatus[f._id]?.status === 'online' ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{f.displayName || f.username}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // SERVER VIEW: Channels
            <div>
              <div className="text-xs font-bold text-[#949ba4] uppercase px-2 mb-2 flex justify-between items-center group cursor-pointer">
                TEXT CHANNELS
                {activeServer.owner === user.id && (
                  <FiPlus className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setShowCreateChannel(true); }}/>
                )}
              </div>
              {serverChannels.map(c => (
                <div 
                  key={c._id} onClick={() => loadChannel(c)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${activeChannel?._id === c._id ? 'bg-[#404249] text-white' : 'hover:bg-[#35373c] text-[#949ba4]'}`}
                >
                  <FiHash size={20} className="text-[#80848e] shrink-0" />
                  <div className="truncate font-medium">{c.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Status Bar at bottom of sidebar */}
        <div className="h-[52px] bg-[#232428] shrink-0 flex items-center px-2 justify-between">
          <div className="flex items-center gap-2 hover:bg-[#313338] p-1 rounded cursor-pointer min-w-0" onClick={() => setShowProfile(true)}>
            <div className="relative shrink-0">
              <img src={user.profilePicture || `https://ui-avatars.com/api/?name=${user.username}`} className="w-8 h-8 rounded-full" alt="Me" />
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#232428] bg-[#23a559]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate leading-tight">{user.displayName || user.username}</div>
              <div className="text-[11px] text-[#b5bac1] truncate leading-tight">@{user.username}</div>
            </div>
          </div>
          <button onClick={onLogout} className="w-8 h-8 flex items-center justify-center hover:bg-[#313338] rounded text-[#b5bac1] hover:text-red-400 shrink-0">
            <FiLogOut size={18} />
          </button>
        </div>
      </div>

      {/* 3. Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
        {(!activeServer && !activeDM) ? (
          // Friends View (Home)
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
             <div className="w-48 h-48 mb-6 opacity-30 flex items-center justify-center">
               <RiDiscordFill size={150} />
             </div>
             <h2 className="text-2xl font-bold mb-2">Find your friends</h2>
             <p className="text-[#949ba4] max-w-md">Wumpus is waiting. Search for a user using their unique @username to add them as a friend!</p>
             <button onClick={() => setShowAddFriend(true)} className="mt-6 bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 py-2.5 rounded font-medium transition-colors">
               Add Friend
             </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-12 border-b border-[#1e1f22] flex items-center px-4 shrink-0 shadow-sm gap-3">
              {activeServer && activeChannel ? (
                <><FiHash className="text-[#80848e]" size={24} /> <span className="font-bold">{activeChannel.name}</span></>
              ) : activeDM ? (
                <>
                  <img src={activeDM.profilePicture || `https://ui-avatars.com/api/?name=${activeDM.username}`} className="w-6 h-6 rounded-full" alt="Avatar"/>
                  <span className="font-bold">{activeDM.displayName || activeDM.username}</span>
                  <div className={`w-2 h-2 rounded-full ${onlineStatus[activeDM._id]?.status === 'online' ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}></div>
                </>
              ) : null}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 custom-scrollbar">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {activeServer ? `Welcome to #${activeChannel?.name}!` : activeDM ? activeDM.displayName : ''}
                </h1>
                <p className="text-[#949ba4]">This is the start of the conversation.</p>
              </div>

              <div className="space-y-4">
                {messages.map((m, idx) => {
                  const showHeader = idx === 0 || messages[idx-1].sender._id !== m.sender._id || new Date(m.createdAt) - new Date(messages[idx-1].createdAt) > 300000;
                  return (
                    <div key={idx} className={`flex gap-4 hover:bg-[#2e3035] px-2 py-1 -mx-2 rounded ${showHeader ? 'mt-4' : 'mt-0'}`}>
                      {showHeader ? (
                        <img src={m.sender?.profilePicture || `https://ui-avatars.com/api/?name=${m.sender?.username}`} className="w-10 h-10 rounded-full mt-0.5 cursor-pointer hover:opacity-80 shrink-0" alt="avatar" />
                      ) : (
                        <div className="w-10 shrink-0 text-center flex items-center justify-center opacity-0 hover:opacity-100 text-[10px] text-[#949ba4]">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                      
                      <div className="flex flex-col flex-1 min-w-0">
                        {showHeader && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-medium text-[#f2f3f5] hover:underline cursor-pointer">{m.sender?.displayName || m.sender?.username}</span>
                            <span className="text-xs text-[#949ba4]">{new Date(m.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        )}
                        {m.content && <div className="text-[#dbdee1] leading-relaxed break-words">{m.content}</div>}
                        {m.fileUrl && (
                          <div className="mt-2 max-w-sm">
                            <img src={m.fileUrl} alt="attachment" className="rounded-lg object-contain bg-[#1e1f22] max-h-80" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="px-4 pb-6 pt-2 shrink-0 relative">
              {typingStatus && (
                <div className="absolute -top-4 left-4 text-xs text-[#b5bac1] font-bold italic animate-pulse">{typingStatus}</div>
              )}
              <div className="bg-[#383a40] rounded-lg flex items-center pr-2">
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-[#b5bac1] hover:text-[#dbdee1] transition-colors">
                  <div className="w-6 h-6 rounded-full bg-[#4e5058] flex items-center justify-center hover:bg-[#5865F2] text-white">
                    <FiPlus size={16} />
                  </div>
                </button>
                <form onSubmit={sendMessage} className="flex-1 flex">
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                    placeholder={`Message ${activeChannel ? '#' + activeChannel.name : activeDM ? '@' + activeDM.displayName : ''}`}
                    className="flex-1 bg-transparent text-[#dbdee1] py-3 focus:outline-none placeholder-[#80848e]"
                  />
                  <button type="submit" className="p-3 text-[#b5bac1] hover:text-[#dbdee1] transition-colors hidden">
                    <FiSend size={20} />
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Members Sidebar (Only in Servers) */}
      {activeServer && (
        <div className="w-60 bg-[#2b2d31] flex flex-col shrink-0 border-l border-[#1e1f22] overflow-y-auto custom-scrollbar p-4 hidden lg:flex">
          <h3 className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2">Members — {serverMembers.length}</h3>
          {serverMembers.map(m => (
            <div key={m._id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-[#35373c] rounded cursor-pointer group">
              <div className="relative">
                <img src={m.profilePicture || `https://ui-avatars.com/api/?name=${m.username}`} className="w-8 h-8 rounded-full opacity-100 group-hover:opacity-80" alt="avatar"/>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#2b2d31] ${onlineStatus[m._id]?.status === 'online' ? 'bg-[#23a559]' : 'bg-[#80848e]'}`}></div>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-[#dbdee1] truncate">{m.displayName || m.username}</span>
                {m.status === 'offline' && <span className="text-[10px] text-[#949ba4]">Offline</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddServer && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#313338] rounded-xl w-[440px] shadow-2xl">
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Create a server</h2>
              <p className="text-[#b5bac1] mb-6">Your server is where you and your friends hang out. Make yours and start talking.</p>
              <div className="text-left">
                <label className="text-xs font-bold text-[#b5bac1] uppercase mb-2 block">Server Name</label>
                <input 
                  type="text" value={newServerName} onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                />
              </div>
            </div>
            <div className="bg-[#2b2d31] p-4 flex justify-between items-center rounded-b-xl">
              <button onClick={() => setShowAddServer(false)} className="text-[#dbdee1] hover:underline px-4 py-2">Back</button>
              <button onClick={createServer} className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 py-2.5 rounded font-medium transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {showCreateChannel && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#313338] rounded-xl w-[440px] shadow-2xl">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Create Text Channel</h2>
              <label className="text-xs font-bold text-[#b5bac1] uppercase mb-2 block">Channel Name</label>
              <div className="relative">
                <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-[#949ba4]" />
                <input 
                  type="text" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full bg-[#1e1f22] text-[#dbdee1] pl-10 pr-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-[#5865F2]"
                  placeholder="new-channel"
                />
              </div>
            </div>
            <div className="bg-[#2b2d31] p-4 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowCreateChannel(false)} className="text-[#dbdee1] hover:underline px-4 py-2">Cancel</button>
              <button onClick={createChannel} className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-6 py-2 rounded font-medium transition-colors">Create Channel</button>
            </div>
          </div>
        </div>
      )}

      {showAddFriend && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#313338] p-6 rounded-xl w-[480px] shadow-2xl relative">
            <h3 className="text-xl font-bold mb-2 text-white uppercase tracking-wide">Add Friend</h3>
            <p className="text-[#949ba4] text-sm mb-4">You can add friends with their unique Discord tag (e.g. @username).</p>
            
            <div className="bg-[#1e1f22] rounded-lg p-2 mb-6 border border-[#1e1f22] focus-within:border-[#5865F2] flex items-center">
              <input type="text" placeholder="You can search by @username" className="bg-transparent flex-1 outline-none text-[#dbdee1] px-2" />
            </div>

            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              <div className="text-xs font-bold text-[#949ba4] uppercase mb-2">Suggested Users</div>
              {allUsers.filter(u => u._id !== user.id && !friends.some(f => f._id === u._id)).map(u => (
                <div key={u._id} className="flex items-center justify-between p-2 hover:bg-[#35373c] rounded-lg cursor-pointer group border-t border-[#1e1f22]">
                  <div className="flex items-center gap-3">
                    <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full" alt="avatar" />
                    <div>
                      <div className="text-[#dbdee1] font-medium">{u.displayName || u.username}</div>
                      <div className="text-xs text-[#949ba4]">@{u.username}</div>
                    </div>
                  </div>
                  <button onClick={() => addFriend(u._id)} className="bg-[#23a559] hover:bg-[#1a7f44] text-white px-4 py-1.5 rounded font-medium transition-colors opacity-0 group-hover:opacity-100">Send Request</button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAddFriend(false)} className="mt-6 w-full py-2 text-[#dbdee1] hover:underline">Close</button>
          </div>
        </div>
      )}

      {showProfile && (
         <Profile token={token} user={user} onClose={() => setShowProfile(false)} onUpdate={(u) => setUser(u)} />
      )}
    </div>
  );
};

export default Chat;
