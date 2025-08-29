const express = require('express');
const {
  registerUser,
  loginUser,
  getUserInfo,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const upload = require("../middleware/uploadMiddleware");
const router = express.Router();

// Existing routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me',       protect, getUserInfo);
router.get('/getUser',  protect, getUserInfo);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.post("/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.status(200).json({ imageUrl });
});

module.exports = router;
