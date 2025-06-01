"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
exports.default = (db) => {
    const router = (0, express_1.Router)();
    router.post('/login', async (req, res) => {
        const { email, password, role } = req.body;
        try {
            const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
            const user = rows[0];
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (!user.isActive) {
                return res.status(403).json({ error: 'Account is deactivated' });
            }
            const validPassword = await bcrypt_1.default.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
            const { password: _, ...userWithoutPassword } = user; // Rename password to avoid conflict
            res.json({ user: userWithoutPassword, token });
        }
        catch (error) {
            res.status(500).json({ error: 'Login failed' });
        }
    });
    router.post('/register', async (req, res) => {
        const userData = req.body;
        // Validate required fields
        const { email, firstName, lastName, role, password } = userData;
        if (!email || !firstName || !lastName || !role || !password) {
            return res.status(400).json({
                error: 'Missing required fields: email, firstName, lastName, role, password',
            });
        }
        // Validate role
        const validRoles = ['locataire', 'proprietaire', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be one of: locataire, proprietaire, admin' });
        }
        try {
            // Check for existing email
            const [existingUsers] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
            if (existingUsers.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            // Hash password
            const hashedPassword = await bcrypt_1.default.hash(password, 10);
            // Prepare optional fields
            const phone = userData.phone || null;
            const companyName = userData.companyName || null;
            // Insert new user
            const userId = `user_${Date.now()}`;
            const now = new Date();
            const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
            await db.execute('INSERT INTO users (id, email, firstName, lastName, role, password, isActive, createdAt, phone, companyName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [userId, email, firstName, lastName, role, hashedPassword, true, createdAt, phone, companyName]);
            // Generate token for immediate use (optional)
            const token = jsonwebtoken_1.default.sign({ userId, role }, process.env.JWT_SECRET || 'your-secure-secret-key', { expiresIn: '24h' });
            // Fetch the newly created user (excluding password)
            const [newUserRows] = await db.execute('SELECT id, email, firstName, lastName, role, isActive, createdAt, phone, companyName FROM users WHERE id = ?', [userId]);
            const newUser = newUserRows[0];
            res.status(201).json({ success: true, user: newUser, token });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    });
    router.post('/logout', (req, res) => {
        // Client-side token removal is sufficient
        res.json({ success: true });
    });
    router.put('/users/:userId', (0, auth_1.authenticate)(db), async (req, res) => {
        const { userId } = req.params;
        const updateData = req.body;
        try {
            const updates = Object.keys(updateData).map(key => `${key} = ?`);
            const values = Object.values(updateData);
            values.push(userId);
            await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
            // Fetch updated user
            const [rows] = await db.execute('SELECT id, email, firstName, lastName, role, isActive, createdAt, phone, companyName FROM users WHERE id = ?', [userId]);
            const updatedUser = rows[0];
            res.json({ success: true, user: updatedUser });
        }
        catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    });
    // Get current user
    router.get('/me', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }
            res.json(user);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to get user data' });
        }
    });
    return router;
};
