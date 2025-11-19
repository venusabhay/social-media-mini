import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';

let mongoServer;
let app;

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

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());

  // Register
  testApp.post('/register', async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        firstName,
        lastName,
        email,
        password: hashedPassword
      });

      const userResponse = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      };

      res.status(201).json({ message: "User registered successfully", user: userResponse });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  // Login
  testApp.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      const userResponse = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      };

      res.json({ token, user: userResponse });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Verify
  testApp.post('/verify', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: "Invalid token" });
      }

      res.json({ user });
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
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
});

describe('Auth Service - POST /register', () => {
  it('should register a new user successfully', async () => {
    const newUser = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/register')
      .send(newUser)
      .expect(201);

    expect(response.body.message).toBe('User registered successfully');
    expect(response.body.user).toHaveProperty('email', 'john@example.com');
    expect(response.body.user).toHaveProperty('firstName', 'John');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should not register user with existing email', async () => {
    const user = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    };

    // Register first time
    await request(app).post('/register').send(user);

    // Try to register again with same email
    const response = await request(app)
      .post('/register')
      .send(user)
      .expect(400);

    expect(response.body.message).toBe('User already exists');
  });

  it('should not register user without required fields', async () => {
    const response = await request(app)
      .post('/register')
      .send({ email: 'test@example.com' })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should validate email format', async () => {
    const response = await request(app)
      .post('/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'password123'
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});

describe('Auth Service - POST /login', () => {
  beforeEach(async () => {
    // Create a test user
    await request(app).post('/register').send({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    });
  });

  it('should login user with correct credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'john@example.com',
        password: 'password123'
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe('john@example.com');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should not login with incorrect password', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'john@example.com',
        password: 'wrongpassword'
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should not login with non-existent email', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('should not login without email', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        password: 'password123'
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should not login without password', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        email: 'john@example.com'
      })
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});

describe('Auth Service - POST /verify', () => {
  let token;

  beforeEach(async () => {
    // Register and login to get a token
    await request(app).post('/register').send({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    });

    const loginRes = await request(app).post('/login').send({
      email: 'john@example.com',
      password: 'password123'
    });

    token = loginRes.body.token;
  });

  it('should verify valid token', async () => {
    const response = await request(app)
      .post('/verify')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.user).toHaveProperty('email', 'john@example.com');
    expect(response.body.user).not.toHaveProperty('password');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .post('/verify')
      .expect(401);

    expect(response.body.message).toBe('No token provided');
  });

  it('should reject invalid token', async () => {
    const response = await request(app)
      .post('/verify')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.body.message).toBe('Invalid token');
  });
});
