const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for 1-to-1
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // for group chat
  content: { type: String },
  fileUrl: { type: String },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
