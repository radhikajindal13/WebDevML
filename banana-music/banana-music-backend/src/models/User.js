const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const UserSchema = new mongoose.Schema({
    spotifyId:{
        type: String,
        required: true,
        unique: true
    },
    password:{
        type: String,
        required: true
    },
    // refreshToken:{
    //     type: String,
    //     required: true
    // },
    displayName: {
        type: String,
        default: 'Anonymous User'
    },
    email:{
        type: String,
        unique: true,
        sparse: true // Allows multiple docs with null email
    },
    lastLogin:{
        type: Date,
        default: Date.now
    },
    createdAt:{
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        // Generate a salt (10 rounds is standard)
        const salt = await bcrypt.genSalt(10);
        // Hash the password
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Instance Method: Compare the input password with the stored hashed password.
 */
UserSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;