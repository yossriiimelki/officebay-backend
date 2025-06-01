"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
exports.default = (db) => {
    const router = (0, express_1.Router)();
    router.get('/', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM activities ORDER BY createdAt DESC LIMIT 20');
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch activities' });
        }
    });
    return router;
};
