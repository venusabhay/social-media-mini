# Microservices Architecture

## Overview
The application has been refactored from a monolithic architecture to microservices, providing better scalability, fault isolation, and independent deployment capabilities.

## Architecture Diagram

```
┌─────────────────┐
│    Frontend     │
│   (React App)   │
└────────┬────────┘
         │
         ├─────► HTTP Requests
         ↓
┌─────────────────┐
│  API Gateway    │  ← Single entry point (Port 5000)
│   (Port 5000)   │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    ↓         ↓            ↓            ↓
┌─────────┐ ┌────────┐ ┌─────────┐ ┌────────┐
│  Auth   │ │  User  │ │  Post   │ │ Redis  │
│ Service │ │Service │ │ Service │ │ Cache  │
│ (3001)  │ │ (3002) │ │ (3003)  │ │ (6379) │
└────┬────┘ └───┬────┘ └────┬────┘ └────────┘
     │          │           │
     └──────────┴───────────┘
                │
         ┌──────┴──────┐
         │   MongoDB   │
         │   (27017)   │
         └─────────────┘
```

## Services

### 1. **API Gateway** (Port 5000)
- **Purpose**: Single entry point for all client requests
- **Features**:
  - Request routing to appropriate microservices
  - Global rate limiting (100 req/15min)
  - Service health monitoring
  - Error handling and fallback responses
- **Routes**:
  - `/api/auth/*` → Auth Service
  - `/api/users/*` → User Service
  - `/api/posts/*` → Post Service
  - `/api/health/all` → Aggregated health check

### 2. **Auth Service** (Port 3001)
- **Purpose**: Authentication and authorization
- **Database**: `auth-service` MongoDB database
- **Features**:
  - User registration
  - User login with JWT tokens
  - Token verification for other services
  - Rate limiting (5 req/15min)
- **Endpoints**:
  - `POST /register` - Register new user
  - `POST /login` - Login and get JWT token
  - `POST /verify` - Verify JWT token (internal)
  - `GET /health` - Health check

### 3. **User Service** (Port 3002)
- **Purpose**: User profile management
- **Database**: `user-service` MongoDB database
- **Features**:
  - Get user profile
  - Update user profile
  - Search users
  - Redis caching (10min for profiles)
  - Rate limiting (30 searches/min)
- **Endpoints**:
  - `GET /me` - Get current user profile
  - `PUT /me` - Update profile
  - `GET /search?q=query` - Search users
  - `GET /:userId` - Get user by ID (internal)
  - `GET /health` - Health check

### 4. **Post Service** (Port 3003)
- **Purpose**: Posts, comments, and likes management
- **Database**: `post-service` MongoDB database
- **Features**:
  - Create/read posts
  - Add comments and replies
  - Like/unlike posts
  - Redis caching (5min for feed)
  - Rate limiting (20 posts/hour, 50 comments/hour, 100 likes/hour)
- **Endpoints**:
  - `POST /` - Create post
  - `GET /` - Get feed
  - `GET /user/:userId` - Get user posts
  - `POST /:postId/comments` - Add comment
  - `POST /:postId/like` - Like post
  - `POST /:postId/unlike` - Unlike post
  - `GET /health` - Health check

### 5. **Shared Infrastructure**

#### MongoDB (Port 27017)
- Separate databases for each service:
  - `auth-service` - User credentials
  - `user-service` - User profiles
  - `post-service` - Posts and interactions
- Benefits: Data isolation, independent scaling

#### Redis (Port 6379)
- Shared cache for all services
- Used for:
  - Feed caching
  - User profile caching
  - Session management

## Benefits of Microservices

### 1. **Scalability**
- Scale individual services independently
- Example: Scale post-service during high traffic without affecting auth-service

### 2. **Fault Isolation**
- If one service fails, others continue working
- Example: Auth-service down doesn't affect viewing existing posts

### 3. **Technology Flexibility**
- Each service can use different tech stack
- Easy to add new services (e.g., notification-service, media-service)

### 4. **Independent Deployment**
- Deploy services independently
- No need to redeploy entire application for small changes

### 5. **Team Autonomy**
- Different teams can own different services
- Parallel development

### 6. **Data Isolation**
- Each service has its own database
- No shared database bottlenecks

## Running the Application

### Start Microservices Architecture
```bash
docker-compose -f docker-compose.microservices.yml up -d --build
```

### Stop Services
```bash
docker-compose -f docker-compose.microservices.yml down
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.microservices.yml logs -f

# Specific service
docker-compose -f docker-compose.microservices.yml logs -f auth-service
```

### Scale Individual Services
```bash
# Scale post service to 3 instances
docker-compose -f docker-compose.microservices.yml up -d --scale post-service=3
```

## Health Monitoring

### Check All Services Health
```bash
curl http://localhost:5000/api/health/all
```

Response:
```json
{
  "services": {
    "gateway": "healthy",
    "auth": "healthy",
    "user": "healthy",
    "post": "healthy"
  },
  "overall": "healthy"
}
```

### Individual Service Health
```bash
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # User
curl http://localhost:3003/health  # Post
curl http://localhost:5000/health  # Gateway
```

## Service Communication

### Inter-Service Communication
Services communicate via HTTP REST APIs:
- Auth Service provides token verification endpoint
- User Service fetches user details for Post Service
- All services verify tokens through Auth Service

### Authentication Flow
```
1. Client → API Gateway → Auth Service (login)
2. Auth Service → JWT Token → Client
3. Client → API Gateway + Token → Any Service
4. Service → Auth Service (verify token)
5. Service → Response → Client
```

## Performance Optimizations

### 1. **Caching Strategy**
- Redis cache for frequently accessed data
- Feed: 5 minutes
- User profiles: 10 minutes
- Cache invalidation on data changes

### 2. **Rate Limiting**
- Prevents abuse and ensures fair usage
- Different limits for different operations
- Per-service rate limiting

### 3. **Database Per Service**
- No database contention
- Optimized queries per service
- Independent scaling

## Development vs Production

### Development (Monolithic)
```bash
# Use original docker-compose.yml
docker-compose up -d
```

### Production (Microservices)
```bash
# Use microservices version
docker-compose -f docker-compose.microservices.yml up -d
```

## Migration Path

### Phase 1: Monolithic (Current)
- Single backend service
- Single database
- Easier development

### Phase 2: Microservices (New)
- Separate services
- Independent databases
- Production-ready scaling

## Future Enhancements

1. **Service Mesh** (Istio, Linkerd)
   - Advanced traffic management
   - Circuit breakers
   - Observability

2. **Message Queue** (RabbitMQ, Kafka)
   - Async communication
   - Event-driven architecture
   - Better decoupling

3. **API Gateway Features**
   - JWT validation at gateway
   - Request transformation
   - Response aggregation

4. **Monitoring**
   - Prometheus + Grafana
   - Distributed tracing (Jaeger)
   - Centralized logging (ELK Stack)

5. **Additional Services**
   - Notification Service
   - Media Service (image uploads)
   - Analytics Service
   - Search Service (Elasticsearch)

## Troubleshooting

### Service Not Starting
```bash
# Check service logs
docker-compose -f docker-compose.microservices.yml logs auth-service

# Check service health
docker-compose -f docker-compose.microservices.yml ps
```

### Service Communication Issues
- Ensure services are on the same network
- Check environment variables for service URLs
- Verify MongoDB and Redis are healthy

### Port Conflicts
- Gateway: 5000
- Auth: 3001
- User: 3002
- Post: 3003
- MongoDB: 27017
- Redis: 6379

Change ports in docker-compose if needed.

## Cost Considerations

### Development
- Run all services on single machine
- Resource usage: ~2GB RAM

### Production
- Deploy services on separate instances
- Use managed services (AWS RDS, ElastiCache)
- Kubernetes for orchestration
- Auto-scaling based on load

## Comparison: Monolithic vs Microservices

| Feature | Monolithic | Microservices |
|---------|-----------|---------------|
| Development | Simpler | More complex |
| Deployment | All-or-nothing | Independent |
| Scaling | Scale entire app | Scale individual services |
| Fault Tolerance | Single point of failure | Isolated failures |
| Data Management | Single database | Database per service |
| Team Structure | Single team | Multiple teams |
| Technology Stack | Uniform | Flexible |
| Initial Cost | Lower | Higher |
| Long-term Maintenance | Higher | Lower |

## Conclusion

The microservices architecture provides:
- ✅ **Better scalability** - Scale what you need
- ✅ **Improved reliability** - Fault isolation
- ✅ **Faster development** - Team autonomy
- ✅ **Technology flexibility** - Choose best tools
- ✅ **Production-ready** - Enterprise-grade architecture

Start with monolithic for development, migrate to microservices for production scaling.
