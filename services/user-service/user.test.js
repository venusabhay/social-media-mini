import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';

let mongoServer;
let app;
let token;
let userId;

// Create test app
const setupApp = async () => {
  const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: String
  }, { timestamps: true });

  const User = mongoose.model('User', userSchema);

  const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { _id: decoded.id };
      next();
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  };

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());

  // Get current user
  testApp.get('/me', protect, async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select('-password');
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update current user
  testApp.put('/me', protect, async (req, res) => {
    try {
      const { firstName, lastName, bio } = req.body;
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (bio !== undefined) user.bio = bio;

      await user.save();
      
      const userResponse = await User.findById(user._id).select('-password');
      res.json(userResponse);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Search users (must be before /:userId to avoid route conflict)
  testApp.get('/search', protect, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Search query required" });
      }

      const users = await User.find({
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      }).select('-password').limit(20);

      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get user by ID
  testApp.get('/:userId', protect, async (req, res) => {
    try {
      const user = await User.findById(req.params.userId).select('-password');
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  return testApp;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  app = await setupApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Create a test user
  const User = mongoose.model('User');
  const user = await User.create({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    password: 'hashedpassword'
  });

  userId = user._id.toString();
  token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
});

describe('User Service - GET /me', () => {
  it('should get current user profile', async () => {
    const response = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('email', 'john@example.com');
    expect(response.body).toHaveProperty('firstName', 'John');
    expect(response.body).not.toHaveProperty('password');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .get('/me')
      .expect(401);

    expect(response.body.message).toBe('No token provided');
  });
});

describe('User Service - PUT /me', () => {
  it('should update user profile', async () => {
    const response = await request(app)
      .put('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Jane',
        lastName: 'Smith',
        bio: 'Updated bio'
      })
      .expect(200);

    expect(response.body).toHaveProperty('firstName', 'Jane');
    expect(response.body).toHaveProperty('lastName', 'Smith');
    expect(response.body).toHaveProperty('bio', 'Updated bio');
    expect(response.body).not.toHaveProperty('password');
  });

  it('should not update email', async () => {
    const response = await request(app)
      .put('/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newemail@example.com'
      })
      .expect(200);

    expect(response.body.email).toBe('john@example.com');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .put('/me')
      .send({ firstName: 'Jane' })
      .expect(401);

    expect(response.body.message).toBe('No token provided');
  });
});

describe('User Service - GET /:userId', () => {
  it('should get user by ID', async () => {
    const response = await request(app)
      .get(`/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('email', 'john@example.com');
    expect(response.body).toHaveProperty('firstName', 'John');
    expect(response.body).not.toHaveProperty('password');
  });

  it('should return 404 for non-existent user', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .get(`/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body.message).toBe('User not found');
  });
});

describe('User Service - GET /search', () => {
  beforeEach(async () => {
    const User = mongoose.model('User');
    await User.create([
      { firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', password: 'hash' },
      { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', password: 'hash' },
      { firstName: 'Charlie', lastName: 'Brown', email: 'charlie@example.com', password: 'hash' }
    ]);
  });

  it('should search users by name', async () => {
    const response = await request(app)
      .get('/search?q=alice')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].firstName).toBe('Alice');
  });

  it('should return empty array for no matches', async () => {
    const response = await request(app)
      .get('/search?q=nonexistent')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });

  it('should require query parameter', async () => {
    const response = await request(app)
      .get('/search')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.message).toBe('Search query required');
  });
});
