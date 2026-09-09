const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

const BOOK_SERVICE_URL = process.env.BOOK_SERVICE_URL || 'http://book-service:8001';
const MEMBER_SERVICE_URL = process.env.MEMBER_SERVICE_URL || 'http://member-borrow-service:8002';

console.log('====================================================');
console.log('Library Management API Gateway Initializing...');
console.log(`[Target] Book Catalog Service: ${BOOK_SERVICE_URL}`);
console.log(`[Target] Member & Borrowing Service: ${MEMBER_SERVICE_URL}`);
console.log('====================================================');

// Global Middlewares
app.use(cors());
app.use(morgan('combined'));

// Gateway Info / Root Endpoint
app.get('/', (req, res) => {
  res.json({
    gateway: 'Library Management System API Gateway',
    version: '1.0.0',
    status: 'online',
    description: 'Unified entry point routing to backend microservices across VMs',
    routes: {
      books: '/api/books',
      members: '/api/members',
      borrowings: '/api/borrowings',
      health: '/health'
    },
    upstreams: {
      book_service: BOOK_SERVICE_URL,
      member_service: MEMBER_SERVICE_URL
    }
  });
});

// Aggregated Health Check across all microservices
app.get('/health', async (req, res) => {
  const healthReport = {
    gateway: { status: 'healthy', timestamp: new Date().toISOString() },
    book_service: { status: 'unknown', url: BOOK_SERVICE_URL },
    member_service: { status: 'unknown', url: MEMBER_SERVICE_URL }
  };

  try {
    const bookRes = await axios.get(`${BOOK_SERVICE_URL}/health`, { timeout: 3000 });
    healthReport.book_service = { ...bookRes.data, reachable: true };
  } catch (err) {
    healthReport.book_service = { status: 'unreachable', error: err.message, reachable: false };
  }

  try {
    const memberRes = await axios.get(`${MEMBER_SERVICE_URL}/health`, { timeout: 3000 });
    healthReport.member_service = { ...memberRes.data, reachable: true };
  } catch (err) {
    healthReport.member_service = { status: 'unreachable', error: err.message, reachable: false };
  }

  const allHealthy = healthReport.book_service.reachable && healthReport.member_service.reachable;
  res.status(allHealthy ? 200 : 207).json(healthReport);
});

// Proxy error handler helper
const handleProxyError = (serviceName) => (err, req, res) => {
  console.error(`[Gateway Proxy Error] ${serviceName}:`, err.message);
  if (!res.headersSent) {
    res.status(502).json({
      error: 'Bad Gateway',
      message: `Could not connect to ${serviceName} at configured upstream URL.`,
      details: err.message
    });
  }
};

// Route: /api/books -> Book Catalog Microservice (Python FastAPI)
app.use(
  '/api/books',
  createProxyMiddleware({
    target: BOOK_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => '/books' + (path === '/' ? '' : path),
    onError: handleProxyError('Book Catalog Service'),
    logLevel: 'info'
  })
);

// Route: /api/members -> Member Microservice (Node.js Express)
app.use(
  '/api/members',
  createProxyMiddleware({
    target: MEMBER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => '/members' + (path === '/' ? '' : path),
    onError: handleProxyError('Member Service'),
    logLevel: 'info'
  })
);

// Route: /api/borrowings -> Borrowing Microservice (Node.js Express)
app.use(
  '/api/borrowings',
  createProxyMiddleware({
    target: MEMBER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => '/borrowings' + (path === '/' ? '' : path),
    onError: handleProxyError('Borrowing Service'),
    logLevel: 'info'
  })
);

// 404 handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API Gateway cannot find path '${req.originalUrl}'. Valid routes are /api/books, /api/members, /api/borrowings, and /health.`
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
