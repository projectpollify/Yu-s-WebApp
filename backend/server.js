const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const EnhancedEmailAI = require('./services/email-ai-enhanced');

const app = express();
const PORT = process.env.PORT || 5001;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yus-school', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  
  // Start email monitoring if credentials are provided
  if (process.env.GMAIL_CLIENT_ID && process.env.OPENAI_API_KEY) {
    const emailAI = new EnhancedEmailAI();
    emailAI.startMonitoring();
  } else {
    console.log('Email AI monitoring not configured (missing credentials)');
  }
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Mock user for testing (password: admin123)
const mockUser = {
  id: '1',
  email: 'admin@yusmontessori.edu',
  password: '$2a$10$YKgH5.EeQxXjKxAyWqMCbOqVz4Vk0VMZRLPqT3mT7BNKdGm6.vTxG',
  name: 'Admin User',
  role: 'admin'
};

// Login route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (email !== mockUser.email) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const isValid = await bcrypt.compare(password, mockUser.password);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { userId: mockUser.id },
    'your-secret-key',
    { expiresIn: '7d' }
  );
  
  res.json({
    token,
    user: {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role
    }
  });
});

// Protected route example
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    jwt.verify(token, 'your-secret-key');
    res.json(mockUser);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

// Mock endpoints
app.get('/api/students', (req, res) => {
  res.json([]);
});

app.get('/api/payments', (req, res) => {
  res.json([]);
});

app.get('/api/emails', (req, res) => {
  res.json([]);
});

// Waitlist routes
const waitlistRoutes = require('./routes/routes-waitlist');
app.use('/api/waitlist', waitlistRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Login with: admin@yusmontessori.edu / admin123`);
});