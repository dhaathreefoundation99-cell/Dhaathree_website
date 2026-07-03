const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure MongoDB connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri || mongoUri.includes('your_mongodb_atlas_connection_string')) {
  console.warn('\n⚠️ WARNING: MONGODB_URI is not set. Database operations will fail.');
  console.warn('Please update the .env file in the project folder with your real connection string.\n');
} else {
  mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB Database successfully'))
    .catch(err => console.error('MongoDB database connection error:', err));
}

// Configure Multer memory storage (we will hold the buffer and send it to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // limit to 5MB
});

// MongoDB Schema for Photo Records
const photoSchema = new mongoose.Schema({
  wingId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  cloudinaryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Photo = mongoose.model('Photo', photoSchema);

// MongoDB Schema for Volunteer Applications
const volunteerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dob: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  occupation: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  message: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const Volunteer = mongoose.model('Volunteer', volunteerSchema);

// ── API ROUTES ──

// 1. GET ALL PHOTOS FOR A WING
app.get('/api/photos/:wingId', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline. Please check your MONGODB_URI in the .env file.' });
    }
    const photos = await Photo.find({ wingId: req.params.wingId }).sort({ timestamp: -1 });
    // Normalize return objects to use 'id' instead of '_id' to align with frontend
    const formatted = photos.map(p => ({
      id: p._id,
      wingId: p.wingId,
      name: p.name,
      data: p.url, // Map secure URL to 'data' field to fit current frontend rendering
      timestamp: p.timestamp
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. UPLOAD A PHOTO
app.post('/api/photos', upload.single('file'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline. Please check your MONGODB_URI in the .env file.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const { wingId } = req.body;
    if (!wingId) {
      return res.status(400).json({ error: 'wingId is required.' });
    }

    // Convert file buffer to base64 Data URL
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Upload to Cloudinary under folder structure
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: `dhaathree_foundation/${wingId}`
    });

    // Save metadata and cloudinary URL in MongoDB
    const newPhoto = new Photo({
      wingId: wingId,
      name: req.file.originalname,
      url: uploadResponse.secure_url,
      cloudinaryId: uploadResponse.public_id
    });
    
    await newPhoto.save();

    res.status(201).json({
      id: newPhoto._id,
      wingId: newPhoto.wingId,
      name: newPhoto.name,
      data: newPhoto.url,
      timestamp: newPhoto.timestamp
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE A PHOTO
app.delete('/api/photos/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline. Please check your MONGODB_URI in the .env file.' });
    }
    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(photo.cloudinaryId);

    // Delete from MongoDB
    await Photo.findByIdAndDelete(req.params.id);

    res.json({ message: 'Photo deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. SUBMIT A VOLUNTEER APPLICATION
app.post('/api/volunteers', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline. Please check your MONGODB_URI in the .env file.' });
    }
    const { name, dob, email, phone, occupation, city, district, state, message } = req.body;
    
    // Server-side validation
    if (!name || !dob || !email || !phone || !occupation || !city || !district || !state) {
      return res.status(400).json({ error: 'All required fields (*) must be completed.' });
    }

    // Age validation (18+)
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: 'Invalid Date of Birth.' });
    }
    
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return res.status(400).json({ error: 'You must be 18 years or older to volunteer with Dhaathree Foundation.' });
    }

    const newVolunteer = new Volunteer({
      name,
      dob,
      email,
      phone,
      occupation,
      city,
      district,
      state,
      message
    });

    await newVolunteer.save();
    res.status(201).json({ message: 'Volunteer application submitted successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET ALL VOLUNTEER APPLICATIONS (Admin only check done in frontend session)
app.get('/api/volunteers', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const volunteers = await Volunteer.find().sort({ timestamp: -1 });
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE A VOLUNTEER APPLICATION
app.delete('/api/volunteers/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const result = await Volunteer.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Application not found.' });
    }
    res.json({ message: 'Volunteer application removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback to serve index.html for undefined frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Dhaathree Server running on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
