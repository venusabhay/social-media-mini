import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import axios from "axios";
import { createClient } from "redis";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { createServer } from "http";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Rate limiters
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: 'Too many posts created, please try again later.' }
});

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { message: 'Too many comments posted, please try again later.' }
});

const likeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { message: 'Too many like actions, please try again later.' }
});

// Post Schema
const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  replies: [{
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
});

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  text: { type: String, required: true },
  image: { type: String },
  youtubeUrl: { type: String },
  likes: [{ type: mongoose.Schema.Types.ObjectId }],
  comments: [commentSchema],
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model("Post", postSchema);

// Helper function to extract YouTube video ID
const extractYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Redis client
let redisClient = null;
const connectRedis = async () => {
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    console.log("✅ Post Service - Redis Connected");
  } catch (error) {
    console.log("⚠️ Post Service - Redis connection failed:", error.message);
  }
};

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/post-service');
    console.log("✅ Post Service - MongoDB Connected");
  } catch (error) {
    console.error("❌ Post Service - MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// Only connect to DB and Redis if not in test mode
if (process.env.NODE_ENV !== 'test') {
  connectDB();
  connectRedis();
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Auth middleware
const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const response = await axios.post(`${process.env.AUTH_SERVICE_URL}/verify`, { token });
    req.user = response.data.user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Clear cache helper
const clearCache = async (pattern) => {
  if (redisClient?.isOpen) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(keys);
    } catch (err) {
      console.log('Cache clear error:', err);
    }
  }
};

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "post-service" });
});

// Create post
app.post("/", protect, postLimiter, async (req, res) => {
  try {
    const { text, image, youtubeUrl } = req.body;

    // Validate YouTube URL if provided
    let validatedYoutubeUrl = null;
    if (youtubeUrl && youtubeUrl.trim()) {
      const videoId = extractYouTubeId(youtubeUrl);
      if (videoId) {
        validatedYoutubeUrl = `https://www.youtube.com/embed/${videoId}`;
      }
    }

    const post = await Post.create({
      user: req.user._id,
      text,
      image,
      youtubeUrl: validatedYoutubeUrl,
    });

    await clearCache('posts:*');
    
    // Populate user data for socket emission
    const postWithUser = post.toObject();
    try {
      const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${req.user._id}`);
      postWithUser.user = userResponse.data;
    } catch {
      postWithUser.user = { _id: req.user._id };
    }
    
    // Emit socket event for new post with populated user
    io.emit('post:created', postWithUser);
    
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all posts (Feed)
app.get("/", protect, async (req, res) => {
  try {
    // Check cache
    const cacheKey = `posts:feed:${req.user._id}`;
    if (redisClient?.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const posts = await Post.find().sort({ createdAt: -1 });

    // Fetch user details for each post and comment
    const postsWithUsers = await Promise.all(posts.map(async (post) => {
      try {
        const postObj = post.toObject();
        
        // Fetch post author
        const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${post.user}`);
        postObj.user = userResponse.data;
        
        // Fetch comment authors
        if (postObj.comments && postObj.comments.length > 0) {
          postObj.comments = await Promise.all(postObj.comments.map(async (comment) => {
            try {
              const commentUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${comment.user}`);
              return { ...comment, user: commentUserResponse.data };
            } catch {
              return comment;
            }
          }));
        }
        
        return postObj;
      } catch {
        return { ...post.toObject(), user: null };
      }
    }));

    // Cache result
    if (redisClient?.isOpen) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(postsWithUsers));
    }

    res.json(postsWithUsers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete post
app.delete("/:postId", protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    await Post.findByIdAndDelete(req.params.postId);
    await clearCache('posts:*');

    // Emit Socket.io event
    io.emit('post:deleted', { postId: req.params.postId });

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update post
app.put("/:postId", protect, async (req, res) => {
  try {
    const { text, image, youtubeUrl } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    // Validate YouTube URL if provided
    let validatedYoutubeUrl = null;
    if (youtubeUrl && youtubeUrl.trim()) {
      const videoId = extractYouTubeId(youtubeUrl);
      if (videoId) {
        validatedYoutubeUrl = `https://www.youtube.com/embed/${videoId}`;
      }
    }

    // Update fields
    if (text !== undefined) post.text = text;
    if (image !== undefined) post.image = image;
    if (youtubeUrl !== undefined) post.youtubeUrl = validatedYoutubeUrl;

    await post.save();
    await clearCache('posts:*');

    // Populate user info for post, comments, and replies
    const updatedPost = post.toObject();
    try {
      const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${post.user}`);
      updatedPost.user = userResponse.data;
    } catch {
      updatedPost.user = { _id: post.user };
    }

    // Populate user info for comments and replies
    if (updatedPost.comments && updatedPost.comments.length > 0) {
      for (const comment of updatedPost.comments) {
        try {
          const commentUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${comment.user}`);
          comment.user = commentUserResponse.data;
        } catch {
          comment.user = { _id: comment.user };
        }

        // Populate reply users
        if (comment.replies && comment.replies.length > 0) {
          for (const reply of comment.replies) {
            try {
              const replyUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${reply.user}`);
              reply.user = replyUserResponse.data;
            } catch {
              reply.user = { _id: reply.user };
            }
          }
        }
      }
    }

    // Emit Socket.io event
    io.emit('post:updated', updatedPost);

    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user posts
app.get("/user/:userId", protect, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId }).sort({ createdAt: -1 });
    
    // Populate post user and comment users
    const postsWithUsers = await Promise.all(posts.map(async (post) => {
      const postObj = post.toObject();
      
      // Populate post user
      try {
        const postUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${postObj.user}`);
        postObj.user = postUserResponse.data;
      } catch {
        postObj.user = { _id: postObj.user };
      }
      
      // Populate comment users
      if (postObj.comments && postObj.comments.length > 0) {
        postObj.comments = await Promise.all(postObj.comments.map(async (comment) => {
          try {
            const commentUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${comment.user}`);
            const commentWithUser = { ...comment, user: commentUserResponse.data };
            
            // Populate reply users
            if (comment.replies && comment.replies.length > 0) {
              commentWithUser.replies = await Promise.all(comment.replies.map(async (reply) => {
                try {
                  const replyUserResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${reply.user}`);
                  return { ...reply, user: replyUserResponse.data };
                } catch {
                  return reply;
                }
              }));
            }
            
            return commentWithUser;
          } catch {
            return comment;
          }
        }));
      }
      
      return postObj;
    }));
    
    res.json(postsWithUsers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add comment
app.post("/:postId/comments", protect, commentLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: req.user._id, text });
    await post.save();
    await clearCache('posts:*');

    const newComment = post.comments[post.comments.length - 1].toObject();
    
    // Populate user info for the new comment
    try {
      const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${req.user._id}`);
      newComment.user = userResponse.data;
    } catch {
      newComment.user = { _id: req.user._id };
    }

    // Emit socket event for new comment
    io.emit('comment:added', { postId: post._id, comment: newComment });

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add reply to comment
app.post("/:postId/comments/:commentId/replies", protect, commentLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({ user: req.user._id, text });
    await post.save();
    await clearCache('posts:*');

    const newReply = comment.replies[comment.replies.length - 1].toObject();
    
    // Populate user info for the new reply
    try {
      const userResponse = await axios.get(`${process.env.USER_SERVICE_URL}/${req.user._id}`);
      newReply.user = userResponse.data;
    } catch {
      newReply.user = { _id: req.user._id };
    }

    // Emit socket event for new reply
    io.emit('reply:added', { postId: post._id, commentId: req.params.commentId, reply: newReply });

    res.status(201).json(newReply);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete comment
app.delete("/:postId/comments/:commentId", protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Check if user owns the comment
    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    comment.deleteOne();
    await post.save();
    await clearCache('posts:*');

    // Emit Socket.io event
    io.emit('comment:deleted', { postId: req.params.postId, commentId: req.params.commentId });

    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete reply
app.delete("/:postId/comments/:commentId/replies/:replyId", protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // Check if user owns the reply
    if (reply.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this reply" });
    }

    reply.deleteOne();
    await post.save();
    await clearCache('posts:*');

    // Emit Socket.io event
    io.emit('reply:deleted', { postId: req.params.postId, commentId: req.params.commentId, replyId: req.params.replyId });

    res.json({ message: "Reply deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Like post
app.put("/:postId/like", protect, likeLimiter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({ message: "Post already liked" });
    }

    post.likes.push(req.user._id);
    await post.save();
    await clearCache('posts:*');

    // Emit socket event for like
    io.emit('post:liked', { postId: post._id, likes: post.likes });

    res.json({ message: "Post liked", likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Unlike post
app.put("/:postId/unlike", protect, likeLimiter, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    await post.save();
    await clearCache('posts:*');

    // Emit socket event for unlike
    io.emit('post:unliked', { postId: post._id, likes: post.likes });

    res.json({ message: "Post unliked", likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

const PORT = process.env.PORT || 3003;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => console.log(`📝 Post Service running on port ${PORT}`));
}

export default app;
