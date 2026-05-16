const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const mongoose = require('mongoose'); 
const bcrypt = require('bcrypt'); // Requires npm install bcrypt
const cors = require('cors'); // ⬅️ NEW: Import CORS middleware

// --- LOCAL AUTH IMPORTS ---
const User = require('./src/models/User'); // Your Custom User Model (with Hashed Password)
const { getAppAccessToken } = require('./src/utils/spotifyClientAuth'); // Utility for getting App Token
// Only import the middleware function required
const { verifyLocalAuth } = require('./src/middleware/authMiddleware'); 

// Load environment variables from .env file
dotenv.config();

// --- Configuration Constants ---
const MONGO_URI = process.env.MONGO_URI; 
const FRONTEND_URI = 'http://localhost:3000'; 
const JWT_SECRET = process.env.JWT_SECRET || 'a_secret_key_for_signing_cookies'; // Must be set in .env

// --- Mongoose/MongoDB Connection ---
if (!MONGO_URI) {
    console.error("CRITICAL: MONGO_URI is not set in environment variables.");
    process.exit(1); 
}

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connection successful.'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); 
    });

const app = express();
const PORT = process.env.PORT || 8888; 

// ⬅️ CORS Setup - Must be before other middleware
const corsOptions = {
    origin: FRONTEND_URI, // Allow requests from React frontend (localhost:3000)
    credentials: true, // Crucial for passing cookies (user_session_id)
};
app.use(cors(corsOptions)); 

// --- Middleware Setup ---
// Use JWT_SECRET for signing cookies
app.use(cookieParser(JWT_SECRET)); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));


// --- LOCAL AUTH ROUTES (CUSTOM LOGIN/SIGNUP) ---

// Route for User Sign Up
app.post('/api/signup', async (req, res) => {
    const { spotifyId, password } = req.body;
    try {
        if (!spotifyId || !password) {
             return res.status(400).json({ message: "Username and password are required." });
        }
        
        // Mongoose pre-save hook in User.js handles password hashing
        const user = new User({ spotifyId, password });
        await user.save();
        
        // Set a secure, signed session cookie
        res.cookie('user_session_id', user._id.toString(), {
            httpOnly: true,
            signed: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({ message: 'Signup successful!', user: { id: user._id, spotifyId: user.spotifyId } });

    } catch (error) {
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(409).json({ message: 'Username already taken.' });
        }
        console.error("Signup error:", error);
        res.status(500).json({ message: 'Internal server error during signup.' });
    }
});

// Route for User Login
app.post('/api/login', async (req, res) => {
    const { spotifyId, password } = req.body;
    try {
        const user = await User.findOne({ spotifyId: spotifyId });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Compare the submitted password with the stored hash
        const isMatch = await user.comparePassword(password); 

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Set a secure, signed session cookie
        res.cookie('user_session_id', user._id.toString(), {
            httpOnly: true,
            signed: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ message: 'Login successful!', user: { id: user._id, spotifyId: user.spotifyId } });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// Route to check status and fetch user data
app.get('/api/me', verifyLocalAuth, async (req, res) => {
    try {
        // Find user by ID attached by the verifyLocalAuth middleware
        const user = await User.findById(req.userId).select('-password'); 
        if (!user) {
            res.clearCookie('user_session_id'); // Clear invalid session
            return res.status(401).json({ message: 'User not found, session cleared.' });
        }
        res.json({ id: user._id, username: user.username });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user profile.' });
    }
});

// Route to log out (clears the session cookie)
app.post('/api/logout', (req, res) => {
    res.clearCookie('user_session_id');
    res.json({ message: 'Logged out successfully.' });
});


// --- SPOTIFY CONTENT ROUTES (Protected by Local Auth) ---

// Route to handle music search using the App Access Token
app.get('/api/search', verifyLocalAuth, async (req, res) => {
    const { query, type = 'track' } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Search query is required." });
    }
    
    try {
        // Get the non-user-specific App Access Token (handles refresh internally)
        const appAccessToken = await getAppAccessToken();
        
        // Call the public Spotify Search API
        const response = await axios.get('https://api.spotify.com/v1/search', {
            params: {
                q: query,
                type: type, 
                limit: 10
            },
            headers: {
                'Authorization': `Bearer ${appAccessToken}`
            }
        });

        // We only care about the tracks array for our player
        res.json(response.data.tracks.items);

    } catch (error) {
        console.error("Spotify search error:", error.message);
        // The App Token might be invalid, or Spotify is down
        res.status(503).json({ message: 'Spotify service currently unavailable. Check credentials in .env.' });
    }
});


// Placeholder for the ML-powered recommendation endpoint
app.get('/api/recommendations', verifyLocalAuth, (req, res) => {
    // This route now uses req.userId to find the user's history in the DB
    res.json({ message: `Recommendations for user ${req.userId}...` });
});


// --- BASIC ROUTE ---

app.get('/', (req, res) => {
    res.send('Banana Music Node.js Backend is running! (Custom Auth Mode)');
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
