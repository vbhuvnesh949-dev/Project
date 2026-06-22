require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scamshield', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// --- Models ---
const User = mongoose.model('User', new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

const ScanHistory = mongoose.model('ScanHistory', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: String,
    content: String,
    riskScore: Number,
    status: String,
    date: { type: Date, default: Date.now }
}));

// --- Middleware ---
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword });
        await user.save();
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secretkey');
        res.status(201).json({ token, user: { email: user.email } });
    } catch (error) {
        res.status(400).json({ message: 'Registration failed', error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secretkey');
        res.json({ token, user: { email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Login failed' });
    }
});

// --- Scan Routes ---
app.post('/api/scan', authMiddleware, async (req, res) => {
    const { type, content } = req.body;
    
    // Simulated AI Logic (Backend)
    let riskScore = 0;
    const lowerContent = content.toLowerCase();
    
    const scamKeywords = ['urgent', 'verify account', 'password expired', 'click here', 'wire transfer', 'lottery', 'winner', 'bitcoin', 'free gift'];
    scamKeywords.forEach(kw => {
        if (lowerContent.includes(kw)) riskScore += 20;
    });
    
    if (type === 'url') {
        if (content.includes('http://')) riskScore += 30; // Unsecured
        if (content.match(/\d+\.\d+\.\d+\.\d+/)) riskScore += 40; // IP instead of domain
        if (content.length > 50) riskScore += 15;
    }
    
    riskScore = Math.min(riskScore, 100);
    const status = riskScore > 70 ? 'High Risk' : riskScore > 40 ? 'Suspicious' : 'Safe';

    const scan = new ScanHistory({ userId: req.user.userId, type, content, riskScore, status });
    await scan.save();

    res.json({ riskScore, status, details: "Analysis complete." });
});

app.get('/api/history', authMiddleware, async (req, res) => {
    const history = await ScanHistory.find({ userId: req.user.userId }).sort({ date: -1 }).limit(20);
    res.json(history);
});

// Serve static frontend
app.use(express.static('public'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
