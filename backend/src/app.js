const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');
const xssSanitize = require('./middleware/xssSanitize');
const hppProtect = require('./middleware/hppProtect');

const app = express();

// ─── 1. Security Headers ─────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // allow images/media from any origin in dev
  })
);

// ─── Serve locally uploaded files (dev mode / no Cloudinary) ─────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// ─── 2. CORS Configuration ───────────────────────────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://fannex.vercel.app",
    "https://fannex.in",
    "https://www.fannex.in",
    "https://fannex.onrender.com"
  ],
  credentials: true
}));


// ─── 3. Rate Limiter ─────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

app.use(globalLimiter);


// ─── 4. Auth Rate Limit ──────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 login attempts per 15 minutes (brute-force protection)
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.'
  }
});


// ─── 5. Body Parser (with Cashfree webhook support) ──────────────────────────
app.use((req, res, next) => {

  if (req.originalUrl === '/api/v1/payment/webhook') {

    express.raw({ type: 'application/json' })(req, res, err => {
      if (err) return next(err);

      req.rawBody = req.body;
      next();
    });

  } else {

    express.json({ limit: '10mb' })(req, res, next);

  }

});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── 6a. NoSQL Injection Guard (body + params only — req.query is read-only in Express 5)
// xss-clean and hpp are NOT compatible with Express 5 (they try to reassign
// req.query which is a getter-only property → 500 on every request).
app.use((req, res, next) => {
  mongoSanitize.sanitize(req.body);
  mongoSanitize.sanitize(req.params);
  next();
});

// ─── 6b. XSS Sanitisation (Express 5 compatible) ────────────────────────────
app.use(xssSanitize);

// ─── 6c. HTTP Parameter Pollution protection (Express 5 compatible) ──────────
app.use(hppProtect);


// ─── 6. Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/creator', creatorRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/notifications', notificationRoutes);


// ─── 7. Health Check ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {

  res.status(200).json({
    status: 'OK',
    message: 'Fannex API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });

});


// ─── 8. 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {

  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });

});


// ─── 9. Global Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);


module.exports = app;