const express = require('express');
const router = express.Router();
const Server = require('../models/Server');
const Channel = require('../models/Channel');
const auth = require('../middleware/auth');

// Create Server
router.post('/', auth, async (req, res) => {
  try {
    const { name, iconUrl } = req.body;
    const server = new Server({
      name,
      iconUrl,
      owner: req.user.id,
      members: [req.user.id]
    });
    await server.save();

    // Create default 'general' channel
    const channel = new Channel({
      server: server._id,
      name: 'general'
    });
    await channel.save();

    res.json(server);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get User's Servers
router.get('/', auth, async (req, res) => {
  try {
    const servers = await Server.find({ members: req.user.id });
    res.json(servers);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Join Server
router.post('/:serverId/join', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId);
    if (!server) return res.status(404).json({ message: 'Server not found' });
    
    if (!server.members.includes(req.user.id)) {
      server.members.push(req.user.id);
      await server.save();
    }
    res.json(server);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get Server Channels
router.get('/:serverId/channels', auth, async (req, res) => {
  try {
    const channels = await Channel.find({ server: req.params.serverId });
    res.json(channels);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Create Channel
router.post('/:serverId/channels', auth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const server = await Server.findById(req.params.serverId);
    if (server.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only owner can create channels' });
    }

    const channel = new Channel({
      server: req.params.serverId,
      name,
      type
    });
    await channel.save();
    res.json(channel);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get Server Members
router.get('/:serverId/members', auth, async (req, res) => {
  try {
    const server = await Server.findById(req.params.serverId).populate('members', 'username displayName profilePicture uniqueId status lastSeen');
    res.json(server.members);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
