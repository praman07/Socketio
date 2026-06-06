const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['text', 'voice'], default: 'text' }
}, { timestamps: true });

module.exports = mongoose.model('Channel', ChannelSchema);
