const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Group = require('../models/Group');
const auth = require('../middleware/auth');

// Get messages between two users
router.get('/messages/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    }).populate('sender', 'username').sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get group messages
router.get('/groups/:groupId/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'username')
      .sort('createdAt');
    res.json(messages);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Create a group
router.post('/groups', auth, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    // include the creator in the members
    const allMembers = [...new Set([...members, req.user.id])];
    const group = new Group({
      name,
      description,
      members: allMembers,
      admin: req.user.id
    });
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get user's groups
router.get('/groups', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id }).populate('members', 'username');
    res.json(groups);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
