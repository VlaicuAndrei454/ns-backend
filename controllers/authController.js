const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/email');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Register new user
exports.registerUser = async (req, res) => {
  const { fullName, email, password, profileImageUrl } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    const user = await User.create({ fullName, email, password, profileImageUrl });
    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registering user' });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user._id);
    res.status(200).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error logging in' });
  }
};

// Get current user info
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching user info' });
  }
};

// Handle "forgot password": send email with reset link
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // for security, still respond 200
      return res.json({
        message: 'If that account exists, you’ll receive reset instructions.'
      });
    }

    // generate & save token
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken   = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1h
    await user.save();

    // build link & email text
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${token}`;
    const message  = `You requested a password reset. Click here to reset your password:\n\n${resetUrl}`;

    // attempt to send, but *don't* throw on failure
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset',
        text: message
      });
    } catch (mailErr) {
      console.error('Mail send error in forgotPassword:', mailErr);
    }

    // always respond success
    return res.json({
      message: 'If that account exists, you’ll receive reset instructions.'
    });

  } catch (err) {
    // if something else went wrong (DB, etc.), forward to your error handler
    return next(err);
  }
};

// Handle "reset password": update if token valid
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.json({ message: 'Password has been reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error resetting password' });
  }
};