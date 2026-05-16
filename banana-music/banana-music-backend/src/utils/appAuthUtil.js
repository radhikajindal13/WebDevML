const axios = require('axios');
const querystring = require('querystring');
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let appAccessToken = null;
let tokenExpiry = 0;

const getAppAccessToken = async () => {
    // If token is still valid (expires 5 minutes before actual expiry), return current token
    if (appAccessToken && Date.now() < tokenExpiry - 300000) {
        return appAccessToken;
    }

    console.log("Fetching new Spotify App Access Token...");
    
    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'client_credentials'
            }),
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (Buffer.from(
                    CLIENT_ID + ':' + CLIENT_SECRET
                ).toString('base64'))
            },
        });

        appAccessToken = response.data.access_token;
        // Spotify tokens last 3600 seconds (1 hour). Calculate new expiry time.
        tokenExpiry = Date.now() + (response.data.expires_in * 1000); 

        return appAccessToken;

    } catch (error) {
        console.error("CRITICAL: Failed to get Spotify App Access Token:", error.message);
        throw new Error("Music service unavailable.");
    }
};

module.exports = {
    getAppAccessToken
};
