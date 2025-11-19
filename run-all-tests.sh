#!/bin/bash

echo "🧪 Running Unit Tests for All Microservices"
echo "==========================================="
echo ""

FAILED=0

# Auth Service
echo "📝 Testing Auth Service..."
cd services/auth-service
npm test
if [ $? -ne 0 ]; then
  FAILED=$((FAILED+1))
  echo "❌ Auth Service tests failed"
else
  echo "✅ Auth Service tests passed"
fi
echo ""

# User Service
echo "👤 Testing User Service..."
cd ../user-service
npm test
if [ $? -ne 0 ]; then
  FAILED=$((FAILED+1))
  echo "❌ User Service tests failed"
else
  echo "✅ User Service tests passed"
fi
echo ""

# Post Service
echo "📮 Testing Post Service..."
cd ../post-service
npm test
if [ $? -ne 0 ]; then
  FAILED=$((FAILED+1))
  echo "❌ Post Service tests failed"
else
  echo "✅ Post Service tests passed"
fi
echo ""

# Summary
echo "==========================================="
if [ $FAILED -eq 0 ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ $FAILED service(s) failed tests"
  exit 1
fi
