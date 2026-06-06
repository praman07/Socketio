const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get User Profile
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').populate('friends', 'username profilePicture status');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update Profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { bio, profilePicture } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (bio) user.bio = bio;
    if (profilePicture) user.profilePicture = profilePicture;

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Add Friend
router.post('/friends/:friendId', auth, async (req, res) => {
  try {
    if (req.user.id === req.params.friendId) return res.status(400).json({ message: 'Cannot add yourself' });
    
    const user = await User.findById(req.user.id);
    const friend = await User.findById(req.params.friendId);
    
    if (!friend) return res.status(404).json({ message: 'Friend not found' });
    if (user.friends.includes(req.params.friendId)) return res.status(400).json({ message: 'Already friends' });

    user.friends.push(req.params.friendId);
    friend.friends.push(req.user.id); // Mutual friendship for simplicity
    
    await user.save();
    await friend.save();
    
    res.json(user.friends);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
