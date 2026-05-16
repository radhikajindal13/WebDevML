const axios = require('axios');
const querystring = require('querystring');
const User = require('../models/User'); // Import the User model

// Load environment variables (needed to access CLIENT_ID and SECRET)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * Uses a stored Refresh Token to obtain a new, valid Access Token from Spotify.
 * @param {string} spotifyId - The user's unique Spotify ID.
 * @returns {string} The new Access Token.
 */
async function refreshAccessToken(spotifyId) {
    try {
        // 1. Find the user in the database to get their Refresh Token
        const user = await User.findOne({ spotifyId });

        if (!user || !user.refreshToken) {
            throw new Error('User not found or refresh token missing in DB.');
        }

        const refreshToken = user.refreshToken;

        // 2. Request a new Access Token using the Refresh Token
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(
                    CLIENT_ID + ':' + CLIENT_SECRET
                ).toString('base64'))
            },
        });

        const newAccessToken = response.data.access_token;
        
        // Optional: Spotify sometimes issues a new refresh token; if so, update the DB.
        if (response.data.refresh_token) {
            user.refreshToken = response.data.refresh_token;
            await user.save();
        }

        return newAccessToken;

    } catch (error) {
        console.error('Error refreshing token for user:', spotifyId, error.message);
        throw new Error('Failed to refresh Spotify Access Token.');
    }
}

module.exports = {
    refreshAccessToken
};
