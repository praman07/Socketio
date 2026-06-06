import React, { useRef, useState } from 'react';
import axios from 'axios';
import { FiCamera, FiEdit2, FiX } from 'react-icons/fi';

const Profile = ({ token, user, onClose, onUpdate }) => {
  const [bio, setBio] = useState(user.bio || '');
  const [displayName, setDisplayName] = useState(user.displayName || user.username);
  const [profilePic, setProfilePic] = useState(user.profilePicture || `https://ui-avatars.com/api/?name=${user.username}`);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await axios.post('http://localhost:5000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = uploadRes.data.url;
      setProfilePic(imageUrl);
      
      await axios.put('http://localhost:5000/api/users/profile', { profilePicture: imageUrl }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate({ ...user, profilePicture: imageUrl });
    } catch (err) {
      console.error("Error uploading image", err);
      alert('Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await axios.put('http://localhost:5000/api/users/profile', { bio, displayName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate({ ...user, bio, displayName });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-[#313338] rounded-xl w-[440px] shadow-2xl relative overflow-hidden">
        
        {/* Discord Profile Banner */}
        <div className="h-24 bg-[#5865F2] w-full"></div>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-1.5 transition-colors z-10">
          <FiX size={20} />
        </button>

        <div className="px-6 pb-6 relative">
          <div className="relative -mt-12 mb-4 w-24 h-24 rounded-full border-[6px] border-[#313338] bg-[#313338]">
            <img src={profilePic} alt="Profile" className="w-full h-full rounded-full object-cover" />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute top-0 left-0 w-full h-full bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            >
              <FiCamera size={24} className="text-white" />
            </button>
          </div>

          <div className="bg-[#111214] rounded-lg p-4 mb-4 shadow-inner">
            <h4 className="text-xl font-bold text-[#f2f3f5]">{displayName}</h4>
            <p className="text-sm text-[#dbdee1]">@{user.username}</p>
            <div className="w-full h-[1px] bg-[#2b2d31] my-3"></div>
            
            <h5 className="text-xs font-bold text-[#b5bac1] uppercase mb-2">Display Name</h5>
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#1e1f22] text-[#dbdee1] border border-transparent focus:border-[#5865F2] rounded px-3 py-2 text-sm focus:outline-none transition-colors mb-4"
              placeholder="Display Name"
            />

            <h5 className="text-xs font-bold text-[#b5bac1] uppercase mb-2">About Me</h5>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#1e1f22] text-[#dbdee1] border border-transparent focus:border-[#5865F2] rounded px-3 py-2 text-sm focus:outline-none transition-colors resize-none h-20"
              placeholder="Tell us about yourself"
            />
          </div>

          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />

          <button 
            onClick={handleSave}
            disabled={isUploading}
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium py-2.5 rounded transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
