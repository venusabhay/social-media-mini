import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy
app.use(cors());

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', globalLimiter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "api-gateway" });
});

// Service health aggregator
app.get("/api/health/all", async (req, res) => {
  const services = {
    gateway: "healthy",
    auth: "unknown",
    user: "unknown",
    post: "unknown"
  };

  try {
    const authHealth = await fetch(`${process.env.AUTH_SERVICE_URL}/health`);
    services.auth = authHealth.ok ? "healthy" : "unhealthy";
  } catch { services.auth = "down"; }

  try {
    const userHealth = await fetch(`${process.env.USER_SERVICE_URL}/health`);
    services.user = userHealth.ok ? "healthy" : "unhealthy";
  } catch { services.user = "down"; }

  try {
    const postHealth = await fetch(`${process.env.POST_SERVICE_URL}/health`);
    services.post = postHealth.ok ? "healthy" : "unhealthy";
  } catch { services.post = "down"; }

  const allHealthy = Object.values(services).every(s => s === "healthy");
  res.status(allHealthy ? 200 : 503).json({ services, overall: allHealthy ? "healthy" : "degraded" });
});

// Proxy routes
const proxyOptions = {
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Remove /api/<service> prefix when forwarding
    // e.g., /api/auth/register -> /register
    return path.replace(/^\/api\/[^\/]+/, '');
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward authorization header
    if (req.headers.authorization) {
      proxyReq.setHeader('authorization', req.headers.authorization);
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err.message);
    res.status(503).json({ 
      message: 'Service temporarily unavailable',
      error: err.message 
    });
  },
  timeout: 30000
};

// Auth service routes
app.use('/api/auth', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.AUTH_SERVICE_URL,
  logLevel: 'debug'
}));

// User service routes
app.use('/api/users', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.USER_SERVICE_URL,
  logLevel: 'debug'
}));

// Post service routes
app.use('/api/posts', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.POST_SERVICE_URL,
  logLevel: 'debug'
}));

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
  console.log(`📍 Routes:`);
  console.log(`   - /api/auth/* → ${process.env.AUTH_SERVICE_URL}`);
  console.log(`   - /api/users/* → ${process.env.USER_SERVICE_URL}`);
  console.log(`   - /api/posts/* → ${process.env.POST_SERVICE_URL}`);
});
