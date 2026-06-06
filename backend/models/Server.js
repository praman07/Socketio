const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  iconUrl: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Server', ServerSchema);
