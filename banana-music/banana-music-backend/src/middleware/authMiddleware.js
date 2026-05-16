const User = require('../models/User'); 
const verifyLocalAuth = async (req, res, next) => {
    // 1. Check for the signed session cookie
    // 'req.signedCookies' is used because the cookie was set with the 'signed: true' option.
    const sessionId = req.signedCookies.user_session_id;

    if (!sessionId) {
        // No session cookie found, user is not logged in.
        return res.status(401).json({ message: 'Unauthorized: No session found.' });
    }

    try {
        // 2. Look up the user by the ID stored in the cookie
        const user = await User.findById(sessionId).select('_id username');
        
        if (!user) {
            // Session ID is valid but user no longer exists
            res.clearCookie('user_session_id'); // Destroy the bad session
            return res.status(401).json({ message: 'Unauthorized: User not found, session cleared.' });
        }
        
        // 3. Success: Attach the MongoDB user ID to the request
        req.userId = user._id; 
        req.username = user.username; // Optionally attach username
        
        // Proceed to the next middleware or the final route handler
        next();
        
    } catch (error) {
        // Handle database errors or invalid cookie signature errors
        console.error("Authentication middleware error:", error.message);
        // Clearing the cookie ensures the client must log in again
        res.clearCookie('user_session_id'); 
        res.status(401).json({ message: 'Session expired or invalid signature.' });
    }
};

module.exports = {
    verifyLocalAuth
};
