const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

// Nodemailer and SMTP setups are removed. Using Brevo HTTP API instead.

const app = express();
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'info@dhaathreefoundation.org';

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
    .then(async () => {
      console.log('Connected to MongoDB Database successfully');
      // Drop the old unique index on type if it exists to allow multiple certificates
      mongoose.connection.db.collection('resources').dropIndex('type_1').catch(() => {});
      
      // Initialize default donation_amount setting
      try {
        const existing = await Setting.findOne({ key: 'donation_amount' });
        if (!existing) {
          const defaultAmt = new Setting({ key: 'donation_amount', value: '1' });
          await defaultAmt.save();
          console.log('Initialized default donation_amount to 1 INR');
        }
      } catch (err) {
        console.error('Failed to initialize settings:', err);
      }
    })
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

// MongoDB Schema for Featured Homepage Photos
const featuredPhotoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  cloudinaryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const FeaturedPhoto = mongoose.model('FeaturedPhoto', featuredPhotoSchema);

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
  photoUrl: { type: String }, // Store profile picture url
  photoCloudinaryId: { type: String }, // Store profile picture Cloudinary ID
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

const resourceSchema = new mongoose.Schema({
  type: { type: String, required: true }, // "registration" or "annual_report"
  title: { type: String, required: true },
  description: { type: String },
  name: { type: String, required: true },
  url: { type: String, required: true },
  cloudinaryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Resource = mongoose.model('Resource', resourceSchema);
Resource.collection.dropIndexes().catch(() => {});

const sponsorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  logoUrl: { type: String, required: true },
  logoCloudinaryId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Sponsor = mongoose.model('Sponsor', sponsorSchema);

const donorSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  address: { type: String, required: true },
  donationCause: { type: String, required: true }, // "akshara" or "ananda" or "general"
  occasionDate: { type: String },
  occasionName: { type: String },
  occasionType: { type: String },
  occasionPhone: { type: String },
  paymentId: { type: String },
  orderId: { type: String },
  paymentStatus: { type: String, default: 'Pending' },
  amount: { type: Number, required: true },
  request80G: { type: Boolean, default: false },
  status80G: { type: String, default: 'none' }, // 'none', 'pending', 'approved', 'rejected'
  receiptNo80G: { type: Number },
  timestamp: { type: Date, default: Date.now }
});
const Donor = mongoose.model('Donor', donorSchema);

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});
const Setting = mongoose.model('Setting', settingSchema);

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

// --- FEATURED HOME PAGE PHOTOS API ---

// 1. GET ALL FEATURED PHOTOS (Returns a random selection of photos from the website gallery)
app.get('/api/featured-photos', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    // Pull up to 15 random photos from the general website gallery
    const photos = await Photo.aggregate([{ $sample: { size: 15 } }]);
    const formattedPhotos = photos.map(p => ({
      _id: p._id,
      name: p.name,
      url: p.url,
      timestamp: p.timestamp
    }));
    res.json(formattedPhotos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. UPLOAD A FEATURED PHOTO
app.post('/api/featured-photos', upload.single('file'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Convert file buffer to base64 Data URL
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    // Upload to Cloudinary under 'featured' folder
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'dhaathree_foundation/featured'
    });

    // Save in MongoDB
    const newPhoto = new FeaturedPhoto({
      name: req.file.originalname,
      url: uploadResponse.secure_url,
      cloudinaryId: uploadResponse.public_id
    });
    
    await newPhoto.save();

    res.status(201).json(newPhoto);
  } catch (err) {
    console.error('Featured photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE A FEATURED PHOTO
app.delete('/api/featured-photos/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const photo = await FeaturedPhoto.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Featured photo not found.' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(photo.cloudinaryId);

    // Delete from MongoDB
    await FeaturedPhoto.findByIdAndDelete(req.params.id);

    res.json({ message: 'Featured photo deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. SUBMIT A VOLUNTEER APPLICATION (with profile photo upload)
app.post('/api/volunteers', upload.single('photo'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline. Please check your MONGODB_URI in the .env file.' });
    }
    const { name, dob, email, phone, occupation, city, district, state, message } = req.body;
    
    // Server-side validation
    if (!name || !dob || !email || !phone || !occupation || !city || !district || !state) {
      return res.status(400).json({ error: 'All required fields (*) must be completed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Profile photo is required.' });
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

    // Upload photo to Cloudinary
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'dhaathree_foundation/volunteers',
      resource_type: 'image'
    });

    const newVolunteer = new Volunteer({
      name,
      dob,
      email,
      phone,
      occupation,
      city,
      district,
      state,
      message,
      photoUrl: uploadResponse.secure_url,
      photoCloudinaryId: uploadResponse.public_id
    });

    await newVolunteer.save();
    res.status(201).json({ message: 'Volunteer application submitted successfully!' });
  } catch (err) {
    console.error('Error submitting volunteer application:', err);
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

// Helper to send approval email via Brevo HTTP API (Port 443 HTTPS - Works on Render Free Tier!)
async function sendApprovalEmail(volunteerEmail, volunteerName, volunteerPhone, volunteerPhotoUrl) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ WARNING: BREVO_API_KEY is not configured in your environment. Email approval notification was skipped.');
    return false;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:8000';
  const downloadLink = `${baseUrl}/download-id-card.html?name=${encodeURIComponent(volunteerName)}&phone=${encodeURIComponent(volunteerPhone)}&photo=${encodeURIComponent(volunteerPhotoUrl || '')}`;

  const emailData = {
    sender: {
      name: "Dr. Swathi Chakrapani (Dhaathree Foundation)",
      email: SENDER_EMAIL
    },
    to: [
      {
        email: volunteerEmail,
        name: volunteerName
      }
    ],
    subject: "🎉 Congratulations! You are selected as a Dhaathree Volunteer!",
    htmlContent: `
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
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    console.log(`✉️ Approval email successfully sent via Brevo to: ${volunteerEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send volunteer approval email via Brevo:', err.message);
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
    const emailSent = await sendApprovalEmail(volunteer.email, volunteer.name, volunteer.phone, volunteer.photoUrl);

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

// 9.5. GET ALL SPONSORS
app.get('/api/sponsors', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const sponsors = await Sponsor.find().sort({ timestamp: 1 });
    res.json(sponsors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9.6. ADD A SPONSOR (with logo image upload)
app.post('/api/sponsors', upload.single('logo'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Sponsor name is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Sponsor logo photo is required.' });
    }

    // Upload logo to Cloudinary
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'dhaathree_foundation/sponsors',
      resource_type: 'image'
    });

    const newSponsor = new Sponsor({
      name,
      description,
      logoUrl: uploadResponse.secure_url,
      logoCloudinaryId: uploadResponse.public_id
    });
    await newSponsor.save();
    res.status(201).json({ message: 'Sponsor added successfully!', sponsor: newSponsor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9.7. DELETE A SPONSOR (with Cloudinary cleanup)
app.delete('/api/sponsors/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }

    const sponsor = await Sponsor.findById(req.params.id);
    if (!sponsor) {
      return res.status(404).json({ error: 'Sponsor not found.' });
    }

    // Delete image from Cloudinary
    if (sponsor.logoCloudinaryId) {
      await cloudinary.uploader.destroy(sponsor.logoCloudinaryId).catch(err => {
        console.warn('Failed to delete sponsor logo from Cloudinary:', err.message);
      });
    }

    // Delete record from database
    await Sponsor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sponsor removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. GET ALL RESOURCES
app.get('/api/resources', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const resources = await Resource.find();
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. UPLOAD A RESOURCE (allows multiple, takes title and description)
app.post('/api/resources/:type', upload.single('file'), async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { type } = req.params;
    if (type !== 'registration' && type !== 'annual_report') {
      return res.status(400).json({ error: 'Invalid resource type. Must be registration or annual_report.' });
    }
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // 1. Convert and upload new file to Cloudinary
    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const uploadResponse = await cloudinary.uploader.upload(fileStr, {
      folder: 'dhaathree_foundation/resources',
      resource_type: 'raw'
    });

    // 2. Save new record in MongoDB
    const newResource = new Resource({
      type,
      title: title.trim(),
      description: (description || '').trim(),
      name: req.file.originalname,
      url: uploadResponse.secure_url,
      cloudinaryId: uploadResponse.public_id
    });

    await newResource.save();
    res.status(200).json(newResource);
  } catch (err) {
    console.error('Resource upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 13. DELETE A RESOURCE BY ID
app.delete('/api/resources/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { id } = req.params;
    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(resource.cloudinaryId, { resource_type: 'raw' });

    // Delete from MongoDB
    await Resource.findByIdAndDelete(id);
    res.json({ message: 'Resource deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET PUBLIC CONFIGURATION
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    hasRazorpayKeys: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  });
});

// 11. SUBMIT A DONATION RECORD
app.post('/api/donors', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { donorName, email, phone, city, district, state, address, donationCause, occasionDate, occasionName, occasionType, occasionPhone, amount, request80G } = req.body;
    if (!donorName || !email || !phone || !city || !district || !state || !address || !donationCause || !amount) {
      return res.status(400).json({ error: 'Donor details, cause, and amount are required fields.' });
    }
    const newDonor = new Donor({
      donorName,
      email,
      phone,
      city,
      district,
      state,
      address,
      donationCause,
      occasionDate,
      occasionName,
      occasionType,
      occasionPhone,
      amount,
      request80G: request80G || false,
      status80G: request80G ? 'pending' : 'none'
    });
    await newDonor.save();
    res.status(201).json({ message: 'Donation record submitted successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. GET ALL DONOR RECORDS
app.get('/api/donors', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const donors = await Donor.find().sort({ timestamp: -1 });
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. DELETE A DONOR RECORD
app.delete('/api/donors/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const result = await Donor.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Donation record not found.' });
    }
    res.json({ message: 'Donation record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. GET SETTING BY KEY
app.get('/api/settings/:key', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const setting = await Setting.findOne({ key: req.params.key });
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found.' });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 15. SAVE OR UPDATE SETTING
app.post('/api/settings', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).json({ error: 'Key and value are required.' });
    }
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );
    res.json({ message: 'Setting saved successfully!', setting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. CREATE RAZORPAY PAYMENT ORDER
app.post('/api/payment/order', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required.' });
    }

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      // Real Razorpay order creation using native fetch call to Razorpay REST API
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: 'receipt_' + Date.now()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Razorpay API Error: ' + errorText);
      }

      const order = await response.json();
      res.json({
        mode: 'live',
        keyId: keyId,
        orderId: order.id,
        amount: amountInPaise
      });
    } else {
      // Mock Sandbox Checkout Mode
      res.json({
        mode: 'mock',
        orderId: 'order_mock_' + Math.random().toString(36).substring(2, 9),
        amount: amountInPaise
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17. VERIFY PAYMENT AND REGISTER DONOR
app.post('/api/payment/verify', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, donorDetails } = req.body;
    if (!donorDetails) {
      return res.status(400).json({ error: 'Donor details are required.' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (keyId && keySecret) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing signature verification parameters.' });
      }

      // Real signature verification using crypto
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Razorpay signature verification failed.' });
      }
    }

    // Save paid donor record to DB
    const newDonor = new Donor({
      ...donorDetails,
      orderId: razorpay_order_id || 'order_mock_' + Date.now(),
      paymentId: razorpay_payment_id || 'pay_mock_' + Date.now(),
      paymentStatus: (keyId && keySecret) ? 'Paid' : 'Mock Paid',
      status80G: donorDetails.request80G ? 'pending' : 'none'
    });

    await newDonor.save();
    res.json({ success: true, message: 'Donation registered successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to send 80G Approval email via Brevo HTTP API
async function send80GReceiptEmail(donorEmail, donorName, donorId) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ WARNING: BREVO_API_KEY is not configured in your environment. Email approval notification was skipped.');
    return false;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:8000';
  const downloadLink = `${baseUrl}/download-receipt.html?id=${donorId}`;

  const emailData = {
    sender: {
      name: "Dr. Swathi Chakrapani (Dhaathree Foundation)",
      email: SENDER_EMAIL
    },
    to: [
      {
        email: donorEmail,
        name: donorName
      }
    ],
    subject: "💖 Thank you! Your Dhaathree Foundation 80G Receipt is Ready",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #5B2D8E; margin-top: 10px; font-family: Georgia, serif;">Dhaathree Foundation</h2>
          <p style="font-size: 0.9rem; color: #777; margin-top: -5px; font-style: italic;">మీ సాధికారత కొరకై... (For Your Empowerment)</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-bottom: 20px;" />
        <p style="font-size: 1.05rem; color: #333333; line-height: 1.5;">Dear <strong>${donorName}</strong>,</p>
        <p style="font-size: 1rem; color: #444444; line-height: 1.6;">
          Thank you for your generous contribution to <strong>Dhaathree Foundation</strong>. Your application for tax exemption under section 80G has been approved.
        </p>
        <p style="font-size: 1rem; color: #444444; line-height: 1.6;">
          You can download your official 80G Donation Receipt by clicking the link below:
        </p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${downloadLink}" target="_blank" style="background-color: #5B2D8E; color: #ffffff; padding: 14px 28px; border-radius: 30px; font-weight: bold; text-decoration: none; font-size: 1rem; display: inline-block; box-shadow: 0 4px 10px rgba(91, 45, 142, 0.2);">Download 80G Receipt</a>
        </div>
        <p style="font-size: 0.85rem; color: #888888; text-align: center; line-height: 1.4;">
          If the button doesn't work, copy and paste this link in your browser:<br/>
          <a href="${downloadLink}" style="color: #5B2D8E; word-break: break-all;">${downloadLink}</a>
        </p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin-top: 30px; margin-bottom: 20px;" />
        <p style="font-size: 0.95rem; color: #333333; line-height: 1.5; margin-bottom: 5px;">Best Regards,</p>
        <p style="font-size: 0.95rem; color: #5B2D8E; font-weight: bold; margin-top: 0;">Dr. Swathi Chakrapani</p>
        <p style="font-size: 0.85rem; color: #777777; margin-top: -10px;">Founder, Dhaathree Foundation</p>
      </div>
    `
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    console.log(`✉️ 80G Receipt email successfully sent via Brevo to: ${donorEmail}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send 80G Receipt approval email via Brevo:', err.message);
    return false;
  }
}

// 17.1. GET ALL 80G RECEIPT REQUESTS
app.get('/api/donors/requests-80g', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const requests = await Donor.find({ request80G: true }).sort({ timestamp: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17.2. APPROVE AN 80G RECEIPT REQUEST
app.post('/api/donors/:id/approve-80g', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return res.status(404).json({ error: 'Donor record not found.' });
    }

    if (donor.status80G === 'approved') {
      return res.status(400).json({ error: 'Receipt already approved.' });
    }

    // Find highest receiptNo80G
    const lastApproved = await Donor.findOne({ status80G: 'approved' }).sort({ receiptNo80G: -1 });
    let nextNo = 1;
    if (lastApproved && lastApproved.receiptNo80G) {
      nextNo = lastApproved.receiptNo80G + 1;
    }

    donor.status80G = 'approved';
    donor.receiptNo80G = nextNo;
    await donor.save();

    // Trigger email send
    const emailSent = await send80GReceiptEmail(donor.email, donor.donorName, donor._id);

    res.json({ success: true, message: '80G Receipt approved and numbered as ' + nextNo, receiptNo80G: nextNo, emailSent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17.3. REJECT AN 80G RECEIPT REQUEST
app.post('/api/donors/:id/reject-80g', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return res.status(404).json({ error: 'Donor record not found.' });
    }

    donor.status80G = 'rejected';
    await donor.save();
    res.json({ success: true, message: '80G Receipt request rejected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17.4. GET PUBLIC APPROVED RECEIPT DETAIL
app.get('/api/public/donors/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return res.status(404).json({ error: 'Receipt record not found.' });
    }

    if (donor.status80G !== 'approved') {
      return res.status(403).json({ error: 'This receipt has not been approved by the administrator.' });
    }

    res.json({
      donorName: donor.donorName,
      email: donor.email,
      phone: donor.phone,
      amount: donor.amount,
      donationCause: donor.donationCause,
      receiptNo80G: donor.receiptNo80G,
      timestamp: donor.timestamp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17.5. RESET ALL 80G RECEIPT NUMBERS
app.post('/api/donors/reset-receipt-numbers', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database connection offline.' });
    }
    // Set status80G back to pending and clear receipt numbers
    await Donor.updateMany(
      { request80G: true },
      { $set: { status80G: 'pending' }, $unset: { receiptNo80G: 1 } }
    );
    res.json({ success: true, message: 'Receipt numbers reset successfully! All requests are now pending.' });
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

// Self-ping to keep Render free tier server awake
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
  const https = require('https');
  const selfUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/api/config`;
  
  // Ping every 10 minutes to prevent Render's 15-minute inactivity spin-down
  setInterval(() => {
    https.get(selfUrl, (res) => {
      console.log(`[Keep-Alive] Self-ping status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`[Keep-Alive] Self-ping failed: ${err.message}`);
    });
  }, 10 * 60 * 1000);
}
