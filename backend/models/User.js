const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // The unique @ handle or login name
  displayName: { type: String }, // What shows in chat
  uniqueId: { type: String, unique: true }, // Short ID like Discord
  password: { type: String, required: true },
  profilePicture: { type: String, default: 'https://ui-avatars.com/api/?name=User' },
  bio: { type: String, default: 'Hey there! I am using VibeChat.' },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
