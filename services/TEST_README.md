# Microservices Unit Tests

This directory contains comprehensive unit tests for all microservices in the social media application.

## Test Structure

### Auth Service Tests (`auth-service/auth.test.js`)
- User registration (valid data, duplicate email, missing fields, invalid email)
- User login (correct credentials, wrong password, non-existent user, missing fields)
- Token verification (valid token, missing token, invalid token)

### User Service Tests (`user-service/user.test.js`)
- Get current user profile
- Update user profile
- Get user by ID
- Search users by name
- Authorization checks

### Post Service Tests (`post-service/post.test.js`)
- Create posts (text, image, YouTube URL)
- Get all posts and post by ID
- Update and delete posts
- Like and unlike posts
- Add comments to posts
- Authorization checks

## Running Tests

### Prerequisites
Install test dependencies for each service:

```bash
# Auth Service
cd services/auth-service
npm install

# User Service
cd ../user-service
npm install

# Post Service
cd ../post-service
npm install
```

### Run All Tests

```bash
# Auth Service
cd services/auth-service
npm test

# User Service
cd ../user-service
npm test

# Post Service
cd ../post-service
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Configuration

Each service uses:
- **Jest**: Testing framework
- **Supertest**: HTTP assertion library
- **MongoDB Memory Server**: In-memory MongoDB for isolated testing
- **Test Timeout**: 30 seconds per test

## Test Isolation

- Each test suite uses an in-memory MongoDB instance
- Database is cleared before each test
- Tests don't require running services or external dependencies
- Socket.io events are not tested (integration tests recommended)

## Coverage Goals

Current test coverage focuses on:
- ✅ Authentication flows
- ✅ CRUD operations
- ✅ Authorization checks
- ✅ Input validation
- ✅ Error handling

## Future Enhancements

- Integration tests for Socket.io real-time features
- API Gateway tests
- End-to-end tests for complete user flows
- Performance tests for rate limiting
- Redis caching tests
