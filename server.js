require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();

// 1. Setup Express properly
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// DATABASE CONNECTION (PART 1 - MONGODB ATLAS SETUP)
// ----------------------------------------------------
// Use environment variable MONGO_URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster.mongodb.net/tradingDB';

// Use mongoose.connect without deprecated options
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected ✅'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ----------------------------------------------------
// USER SCHEMA & MODEL (PART 3)
// ----------------------------------------------------
const userSchema = new mongoose.Schema({
    username: { type: String },
    email:    { type: String, unique: true },
    password: { type: String }, // hashed
    balance:  { type: Number, default: 100000 },
    portfolioValue: { type: Number, default: 0 },
    holdings: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const User = mongoose.model('User', userSchema);

// ----------------------------------------------------
// ROUTES
// ----------------------------------------------------

// PART 7 — FRONTEND CONNECTION FIX
// IMPORTANT INSTRUCTION FOR FRONTEND:
// Frontend fetch must use full URL like:
// http://localhost:5000/register

// PART 2 — EXPRESS SERVER FIX
// Serve frontend static files (index.html, style.css, etc.)
app.use(express.static(__dirname));

// PART 4 — AUTH ROUTES

// 1. REGISTER
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Handle invalid input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password and save user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Registration successful!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// 2. LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Handle invalid input
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        // Check email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Return user data
        res.json({ message: 'Login successful', token: user._id, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// 3. GET LOGGED IN USER
app.get('/user', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token' });
        
        const token = authHeader.split(' ')[1];
        const user = await User.findById(token);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PART 5 — TRADING ROUTES

// Helper to extract userId from auth
const getUserId = (req) => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    return auth.split(' ')[1];
};

// 1. BUY CRYPTO
app.post('/buy', async (req, res) => {
    try {
        const userId = getUserId(req);
        // Accept coin, amount, price, marketType
        const { coin, amount, price, marketType } = req.body;
        
        // Handle invalid input
        if (!userId || !coin || !amount || !price) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Handle insufficient balance
        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Calculate coinBought
        const coinBought = amount / price;
        
        // Deduct balance
        user.balance -= amount;
        
        // Update holdings dynamically
        if (user.holdings[coin] === undefined) {
             user.holdings[coin] = 0;
        }
        user.holdings[coin] += coinBought;
        user.markModified('holdings');
        
        await user.save();

        res.json({ message: `Bought ${coinBought.toFixed(6)} ${coin}`, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during purchase' });
    }
});

// 2. SELL CRYPTO
app.post('/sell', async (req, res) => {
    try {
        const userId = getUserId(req);
        // Accept coin, amount, price, marketType
        const { coin, amount, price, marketType } = req.body;
        
        // Handle invalid input
        if (!userId || !coin || !amount || !price) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.holdings[coin] === undefined) {
             user.holdings[coin] = 0;
        }

        // Calculate coinToSell
        const coinToSell = amount / price;

        // Handle insufficient holdings
        if (user.holdings[coin] < coinToSell) {
            return res.status(400).json({ error: 'Insufficient holdings' });
        }

        // Update holdings and balance
        user.holdings[coin] -= coinToSell;
        user.balance += amount;
        user.markModified('holdings');
        
        await user.save();

        res.json({ message: `Sold ${coinToSell.toFixed(6)} ${coin}`, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during sale' });
    }
});

// 3. SYNC PORTFOLIO VALUE (Used for Leaderboard calculation efficiently)
app.post('/sync-portfolio', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { totalValue } = req.body;
        
        if (!userId || typeof totalValue !== 'number') return res.status(400).json({ error: 'Invalid input' });
        
        await User.findByIdAndUpdate(userId, { portfolioValue: totalValue });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error syncing portfolio' });
    }
});

// 4. GET LEADERBOARD
app.get('/leaderboard', async (req, res) => {
    try {
        // Find all users and sort by portfolioValue descending, limit to 10
        const users = await User.find({})
            .sort({ portfolioValue: -1 })
            .limit(10)
            .select('username portfolioValue'); // only return safe fields
            
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching leaderboard' });
    }
});

// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
