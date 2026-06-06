import React, { useRef, useState } from 'react';
import { IKContext, IKUpload } from 'imagekitio-react';
import axios from 'axios';
import { FiCamera, FiEdit2, FiX } from 'react-icons/fi';

const publicKey = "your_public_key_here"; // Will fail gracefully if unchanged
const urlEndpoint = "https://ik.imagekit.io/your_endpoint_here";

const Profile = ({ token, user, onClose, onUpdate }) => {
  const [bio, setBio] = useState(user.bio || '');
  const [profilePic, setProfilePic] = useState(user.profilePicture || `https://ui-avatars.com/api/?name=${user.username}`);
  const [isUploading, setIsUploading] = useState(false);
  const ikUploadRef = useRef(null);

  const authenticator = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/upload/auth');
      const { signature, expire, token } = response.data;
      return { signature, expire, token };
    } catch (error) {
      throw new Error(`Authentication request failed: ${error.message}`);
    }
  };

  const onError = err => {
    console.error("Error uploading image", err);
    setIsUploading(false);
    alert('Failed to upload image. Ensure your ImageKit credentials are set in the backend .env.');
  };

  const onSuccess = async (res) => {
    setIsUploading(false);
    setProfilePic(res.url);
    try {
      await axios.put('http://localhost:5000/api/users/profile', { profilePicture: res.url }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate({ ...user, profilePicture: res.url });
    } catch (err) {
      console.error("Failed to save profile pic", err);
    }
  };

  const saveBio = async () => {
    try {
      await axios.put('http://localhost:5000/api/users/profile', { bio }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onUpdate({ ...user, bio });
      alert('Profile updated!');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-2xl w-[400px] border border-gray-700 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <FiX size={24} />
        </button>
        
        <h3 className="text-2xl font-bold mb-6 text-white text-center">Your Profile</h3>
        
        <div className="flex flex-col items-center mb-6 relative">
          <div className="relative group">
            <img 
              src={profilePic} 
              alt="Profile" 
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-700 group-hover:opacity-50 transition-all"
            />
            <button 
              onClick={() => ikUploadRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <FiCamera size={32} className="text-white" />
            </button>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          <h4 className="mt-4 text-xl font-semibold text-white">@{user.username}</h4>
        </div>

        <IKContext publicKey={publicKey} urlEndpoint={urlEndpoint} authenticator={authenticator}>
          <div style={{ display: 'none' }}>
            <IKUpload 
              fileName="avatar.png" 
              onError={onError} 
              onSuccess={onSuccess} 
              onUploadStart={() => setIsUploading(true)}
              ref={ikUploadRef} 
            />
          </div>
        </IKContext>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
            <FiEdit2 /> Bio
          </label>
          <textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 resize-none h-24"
            placeholder="Tell us about yourself..."
          />
        </div>

        <button 
          onClick={saveBio}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Profile;
