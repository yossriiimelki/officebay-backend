"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/users.ts
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
exports.default = (db) => {
    const router = (0, express_1.Router)();
    router.get('/', (0, auth_1.authenticate)(db), async (req, res) => {
        const { role } = req.query;
        let query = 'SELECT * FROM users';
        const params = [];
        if (role) {
            query += ' WHERE role = ?';
            params.push(role);
        }
        try {
            const [rows] = await db.execute(query, params);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });
    router.put('/:userId/status', (0, auth_1.authenticate)(db), async (req, res) => {
        const { isActive } = req.body;
        try {
            await db.execute('UPDATE users SET isActive = ? WHERE id = ?', [isActive, req.params.userId]);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update user status' });
        }
    });
    router.put('/profile', (0, auth_1.authenticate)(db), async (req, res) => {
        const user = req.user;
        const updateData = req.body;
        try {
            const updates = Object.keys(updateData).map(key => `${key} = ?`);
            const values = Object.values(updateData);
            values.push(user.id);
            await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update profile' });
        }
    });
    return router;
};
