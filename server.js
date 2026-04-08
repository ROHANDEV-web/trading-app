console.log('SERVER STARTED');

require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster.mongodb.net/tradingDB';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch((err) => console.error('MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({
    username: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    balance: { type: Number, default: 100000 },
    portfolioValue: { type: Number, default: 0 },
    holdings: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const User = mongoose.model('User', userSchema);

app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'Registration successful!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email or password' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        res.json({ message: 'Login successful', token: user._id, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

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

const getUserId = (req) => {
    const auth = req.headers.authorization;
    if (!auth) return null;
    return auth.split(' ')[1];
};

app.post('/buy', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { coin, amount, price } = req.body;

        if (!userId || !coin || !amount || !price) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const coinBought = amount / price;

        user.balance -= amount;

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

app.post('/sell', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { coin, amount, price } = req.body;

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

        const coinToSell = amount / price;

        if (user.holdings[coin] < coinToSell) {
            return res.status(400).json({ error: 'Insufficient holdings' });
        }

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

app.post('/sync-portfolio', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { totalValue } = req.body;

        if (!userId || typeof totalValue !== 'number') {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await User.findByIdAndUpdate(userId, { portfolioValue: totalValue });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error syncing portfolio' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const users = await User.find({})
            .sort({ portfolioValue: -1 })
            .limit(10)
            .select('username portfolioValue');

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching leaderboard' });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('Server running on port ' + PORT);
});
