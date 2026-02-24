const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// 📁 Config du dossier de destination
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // crée un dossier 'uploads' si pas encore fait
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// 📌 Route POST pour uploader une image
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier reçu.' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.status(200).json({ imageUrl });
});

module.exports = router;
