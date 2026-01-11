const express = require('express');
const multer = require('multer');
const path = require('path');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

router.post('/', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  return res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
});

module.exports = router;
