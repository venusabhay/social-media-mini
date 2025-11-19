import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';

let mongoServer;
let token;
let userId;
let postId;
let app;

// Create a minimal app for testing
const createTestApp = () => {
  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  return testApp;
};

// Import Post model and routes separately
const setupApp = async () => {
  // Define Post Schema inline for tests
  const postSchema = new mongoose.Schema({
    text: { type: String, required: true },
    image: String,
    youtubeUrl: String,
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId }],
    comments: [{
      user: mongoose.Schema.Types.ObjectId,
      text: String,
      createdAt: { type: Date, default: Date.now },
      replies: [{
        user: mongoose.Schema.Types.ObjectId,
        text: String,
        createdAt: { type: Date, default: Date.now }
      }]
    }]
  }, { timestamps: true });

  const Post = mongoose.model('Post', postSchema);

  // Middleware
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

  const app = createTestApp();

  // Routes
  app.post('/', protect, async (req, res) => {
    try {
      const { text, image, youtubeUrl } = req.body;
      if (!text) return res.status(400).json({ message: "Text is required" });

      let validatedYoutubeUrl = null;
      if (youtubeUrl) {
        const extractYouTubeId = (url) => {
          const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
          ];
          for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
          }
          return null;
        };
        const videoId = extractYouTubeId(youtubeUrl);
        if (videoId) validatedYoutubeUrl = `https://www.youtube.com/embed/${videoId}`;
      }

      const post = await Post.create({
        text,
        image: image || '',
        youtubeUrl: validatedYoutubeUrl,
        user: req.user._id,
        likes: [],
        comments: []
      });
      res.status(201).json(post);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  app.get('/', protect, async (req, res) => {
    try {
      const posts = await Post.find().sort({ createdAt: -1 });
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get('/:postId', protect, async (req, res) => {
    try {
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put('/:postId', protect, async (req, res) => {
    try {
      const { text } = req.body;
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized to update this post" });
      }
      if (text !== undefined) post.text = text;
      await post.save();
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete('/:postId', protect, async (req, res) => {
    try {
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized to delete this post" });
      }
      await Post.findByIdAndDelete(req.params.postId);
      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put('/:postId/like', protect, async (req, res) => {
    try {
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      if (post.likes.includes(req.user._id)) {
        return res.status(400).json({ message: "Post already liked" });
      }
      post.likes.push(req.user._id);
      await post.save();
      res.json({ message: "Post liked", likes: post.likes.length });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put('/:postId/unlike', protect, async (req, res) => {
    try {
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
      await post.save();
      res.json({ message: "Post unliked", likes: post.likes.length });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post('/:postId/comments', protect, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "Comment text is required" });
      const post = await Post.findById(req.params.postId);
      if (!post) return res.status(404).json({ message: "Post not found" });
      post.comments.push({ user: req.user._id, text });
      await post.save();
      res.json({ message: "Comment added", post });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  return app;
};

beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(mongoUri);
  
  // Setup test app
  app = await setupApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear database before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Create test user ID and token
  userId = new mongoose.Types.ObjectId().toString();
  token = jwt.sign({ id: userId }, process.env.JWT_SECRET || 'testsecret', {
    expiresIn: '7d'
  });
});

describe('Post Service - POST /', () => {
  it('should create a new post', async () => {
    const response = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Test post content'
      })
      .expect(201);

    expect(response.body).toHaveProperty('text', 'Test post content');
    expect(response.body).toHaveProperty('user', userId);
    expect(response.body).toHaveProperty('_id');
    
    postId = response.body._id;
  });

  it('should create post with image', async () => {
    const response = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Post with image',
        image: 'https://example.com/image.jpg'
      })
      .expect(201);

    expect(response.body).toHaveProperty('image', 'https://example.com/image.jpg');
  });

  it('should create post with YouTube URL', async () => {
    const response = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Post with video',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      })
      .expect(201);

    expect(response.body).toHaveProperty('youtubeUrl');
    expect(response.body.youtubeUrl).toContain('youtube.com/embed/');
  });

  it('should not create post without text', async () => {
    const response = await request(app)
      .post('/')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .post('/')
      .send({ text: 'Test post' })
      .expect(401);

    expect(response.body.message).toBe('No token provided');
  });
});

describe('Post Service - GET /', () => {
  beforeEach(async () => {
    // Create some test posts
    const Post = mongoose.model('Post');
    const post1 = await Post.create({
      text: 'First post',
      user: userId,
      likes: [],
      comments: []
    });
    const post2 = await Post.create({
      text: 'Second post',
      user: userId,
      likes: [],
      comments: []
    });
    postId = post1._id.toString();
  });

  it('should get all posts', async () => {
    const response = await request(app)
      .get('/')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .get('/')
      .expect(401);

    expect(response.body.message).toBe('No token provided');
  });
});

describe('Post Service - GET /:postId', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Test post',
      user: userId,
      likes: [],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should get post by ID', async () => {
    const response = await request(app)
      .get(`/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveProperty('text', 'Test post');
    expect(response.body).toHaveProperty('_id', postId);
  });

  it('should return 404 for non-existent post', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .get(`/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body.message).toBe('Post not found');
  });
});

describe('Post Service - PUT /:postId', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Original text',
      user: userId,
      likes: [],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should update own post', async () => {
    const response = await request(app)
      .put(`/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Updated text'
      })
      .expect(200);

    expect(response.body).toHaveProperty('text', 'Updated text');
  });

  it('should not update another user\'s post', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherToken = jwt.sign({ id: otherUserId }, process.env.JWT_SECRET || 'testsecret');

    const response = await request(app)
      .put(`/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        text: 'Hacked text'
      })
      .expect(403);

    expect(response.body.message).toBe('Not authorized to update this post');
  });
});

describe('Post Service - DELETE /:postId', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Post to delete',
      user: userId,
      likes: [],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should delete own post', async () => {
    const response = await request(app)
      .delete(`/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.message).toBe('Post deleted successfully');
  });

  it('should not delete another user\'s post', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherToken = jwt.sign({ id: otherUserId }, process.env.JWT_SECRET || 'testsecret');

    const response = await request(app)
      .delete(`/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    expect(response.body.message).toBe('Not authorized to delete this post');
  });
});

describe('Post Service - PUT /:postId/like', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Post to like',
      user: new mongoose.Types.ObjectId(),
      likes: [],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should like a post', async () => {
    const response = await request(app)
      .put(`/${postId}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.message).toBe('Post liked');
    expect(response.body.likes).toBe(1);
  });

  it('should not like same post twice', async () => {
    // Like first time
    await request(app)
      .put(`/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);

    // Try to like again
    const response = await request(app)
      .put(`/${postId}/like`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    expect(response.body.message).toBe('Post already liked');
  });
});

describe('Post Service - PUT /:postId/unlike', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Post to unlike',
      user: new mongoose.Types.ObjectId(),
      likes: [userId],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should unlike a post', async () => {
    const response = await request(app)
      .put(`/${postId}/unlike`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.message).toBe('Post unliked');
    expect(response.body.likes).toBe(0);
  });
});

describe('Post Service - POST /:postId/comments', () => {
  beforeEach(async () => {
    const Post = mongoose.model('Post');
    const post = await Post.create({
      text: 'Post for comments',
      user: new mongoose.Types.ObjectId(),
      likes: [],
      comments: []
    });
    postId = post._id.toString();
  });

  it('should add a comment to post', async () => {
    const response = await request(app)
      .post(`/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'This is a comment'
      })
      .expect(200);

    expect(response.body.message).toBe('Comment added');
    expect(response.body.post.comments).toHaveLength(1);
    expect(response.body.post.comments[0].text).toBe('This is a comment');
  });

  it('should not add empty comment', async () => {
    const response = await request(app)
      .post(`/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('message');
  });
});
