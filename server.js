const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

const nodemailer = require('nodemailer');

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'dhaathreefoundation99@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

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
  status: { type: String, default: 'Pending' },
  timestamp: { type: Date, default: Date.now }
});

const Volunteer = mongoose.model('Volunteer', volunteerSchema);

const connectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Connection = mongoose.model('Connection', connectionSchema);

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

// Helper to send approval email
async function sendApprovalEmail(volunteerEmail, volunteerName, volunteerPhone) {
  if (!process.env.EMAIL_PASS) {
    console.warn('⚠️ WARNING: EMAIL_PASS is not configured in your .env file. Email approval notification was skipped.');
    return false;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:8000';
  const downloadLink = `${baseUrl}/download-id-card.html?name=${encodeURIComponent(volunteerName)}&phone=${encodeURIComponent(volunteerPhone)}`;

  const mailOptions = {
    from: process.env.EMAIL_USER || 'dhaathreefoundation99@gmail.com',
    to: volunteerEmail,
    subject: '🎉 Congratulations! You are selected as a Dhaathree Volunteer!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #056b32; margin-top: 10px; font-family: Georgia, serif;">Dhaathree Foundation</h2>
          <p style="font-size: 0.9rem; color: #777; margin-top: -5px; font-style: italic;">మీ సాధికారత కొరకై... (For Your Empowerment)</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-bottom: 20px;" />
        <p style="font-size: 1.05rem; color: #333333; line-height: 1.5;">Dear <strong>${volunteerName}</strong>,</p>
        <p style="font-size: 1rem; color: #444444; line-height: 1.6;">
          Congratulations! We are thrilled to inform you that your application has been approved, and you are officially selected as a volunteer with <strong>Dhaathree Foundation</strong>.
        </p>
        <p style="font-size: 1rem; color: #444444; line-height: 1.6;">
          Please download your Volunteer ID Card using the link below:
        </p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${downloadLink}" target="_blank" style="background-color: #056b32; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-weight: bold; text-decoration: none; font-size: 1rem; display: inline-block; box-shadow: 0 4px 10px rgba(5, 107, 50, 0.2);">Download Volunteer ID Card</a>
        </div>
        <p style="font-size: 0.85rem; color: #888888; text-align: center; line-height: 1.4;">
          If the button doesn't work, copy and paste this link in your browser:<br/>
          <a href="${downloadLink}" style="color: #056b32; word-break: break-all;">${downloadLink}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 0.95rem; color: #333333; line-height: 1.5; margin-bottom: 5px;">Best Regards,</p>
        <p style="font-size: 0.95rem; color: #056b32; font-weight: bold; margin-top: 0;">Dr. Swathi Chakrapani</p>
        <p style="font-size: 0.85rem; color: #777777; margin-top: -10px;">Founder, Dhaathree Foundation</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Approval email successfully sent to: ${volunteerEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send volunteer approval email:', err.message);
    return false;
  }
}

// 6.5. APPROVE A VOLUNTEER APPLICATION
app.post('/api/volunteers/:id/approve', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer application not found.' });
    }

    volunteer.status = 'Approved';
    await volunteer.save();

    // Trigger the email approval process
    const emailSent = await sendApprovalEmail(volunteer.email, volunteer.name, volunteer.phone);

    res.json({ 
      message: 'Volunteer application approved successfully!', 
      emailSent: emailSent 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. SUBMIT A CONNECTION SUBSCRIPTION
app.post('/api/connections', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const newConnection = new Connection({ name, email, phone });
    await newConnection.save();
    res.status(201).json({ message: 'Subscribed successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET ALL CONNECTIONS (Admin only check done in frontend session)
app.get('/api/connections', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const connections = await Connection.find().sort({ timestamp: -1 });
    res.json(connections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. DELETE A CONNECTION
app.delete('/api/connections/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const result = await Connection.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Connection record not found.' });
    }
    res.json({ message: 'Connection removed successfully.' });
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
