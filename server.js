'use strict';

const express   = require('express');
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const path      = require('path');
require('dotenv').config();

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tonni-blast-dev-secret';
const MONGO_URI  = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tonniblast';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Schema ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  coins:        { type: Number, default: 0 },
  highScore:    { type: Number, default: 0 },
  ownedItems:   { type: [String], default: ['default'] },
  equipped: {
    _id: false,
    type: {
      theme:  { type: String, default: 'default' },
      skin:   { type: String, default: 'default' },
      effect: { type: String, default: 'none' },
    },
    default: () => ({ theme: 'default', skin: 'default', effect: 'none' }),
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid — please log in again' });
  }
}

function makeToken(user) {
  return jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

function userPayload(user) {
  return {
    username:      user.username,
    coins:         user.coins,
    highScore:     user.highScore,
    ownedItems:    user.ownedItems,
    equippedItems: user.equipped,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });
  const u = username.trim().toLowerCase();
  if (u.length < 2 || u.length > 30)
    return res.status(400).json({ error: 'Username must be 2–30 characters' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Password must be at least 4 characters' });

  try {
    if (await User.exists({ username: u }))
      return res.status(409).json({ error: 'That username is already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: u, passwordHash });
    res.json({ token: makeToken(user), ...userPayload(user) });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Server error — try again' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user)
      return res.status(401).json({ error: 'No account with that username' });
    if (!await bcrypt.compare(password, user.passwordHash))
      return res.status(401).json({ error: 'Wrong password' });

    res.json({ token: makeToken(user), ...userPayload(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error — try again' });
  }
});

app.get('/api/load', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'Account not found' });
    res.json({
      username:      user.username,
      coins:         user.coins,
      highScore:     user.highScore,
      ownedItems:    user.ownedItems,
      equippedItems: user.equipped,
    });
  } catch (err) {
    console.error('load error:', err);
    res.status(500).json({ error: 'Server error — try again' });
  }
});

app.post('/api/save', requireAuth, async (req, res) => {
  const { coins, highScore, ownedItems, equippedItems } = req.body || {};
  const $set = {};
  if (typeof coins     === 'number') $set.coins     = Math.max(0, Math.floor(coins));
  if (typeof highScore === 'number') $set.highScore = Math.max(0, Math.floor(highScore));
  if (Array.isArray(ownedItems))     $set.ownedItems = ownedItems;
  if (equippedItems && typeof equippedItems === 'object') {
    if (equippedItems.theme  !== undefined) $set['equipped.theme']  = equippedItems.theme;
    if (equippedItems.skin   !== undefined) $set['equipped.skin']   = equippedItems.skin;
    if (equippedItems.effect !== undefined) $set['equipped.effect'] = equippedItems.effect;
  }
  try {
    await User.findByIdAndUpdate(req.user.id, { $set });
    res.json({ ok: true });
  } catch (err) {
    console.error('save error:', err);
    res.status(500).json({ error: 'Server error — try again' });
  }
});

// Serve index.html for all non-API routes (SPA fallback)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
