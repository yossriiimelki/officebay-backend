"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/offices.ts
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const activityLogger_1 = require("../utils/activityLogger");
exports.default = (db) => {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        const filters = req.query;
        let query = 'SELECT * FROM offices WHERE 1=1';
        const params = [];
        console.log('Fetching offices with filters:', filters);
        if (filters.type && filters.type !== 'all') {
            query += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.location) {
            query += ' AND location LIKE ?';
            params.push(`%${filters.location}%`);
        }
        if (filters.minPrice) {
            query += ' AND price >= ?';
            params.push(filters.minPrice);
        }
        if (filters.maxPrice) {
            query += ' AND price <= ?';
            params.push(filters.maxPrice);
        }
        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters.ownerId) {
            query += ' AND ownerId = ?';
            params.push(filters.ownerId);
        }
        try {
            console.log('Executing query:', query);
            console.log('With params:', params);
            const [rows] = await db.execute(query, params);
            console.log('Query result:', rows);
            res.json(rows);
        }
        catch (error) {
            console.error('Error fetching offices:', error);
            res.status(500).json({ error: 'Failed to fetch offices' });
        }
    });
    router.get('/:id', async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM offices WHERE id = ?', [req.params.id]);
            const office = rows[0];
            if (!office) {
                return res.status(404).json({ error: 'Office not found' });
            }
            res.json(office);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch office' });
        }
    });
    router.post('/', (0, auth_1.authenticate)(db), async (req, res) => {
        const officeData = req.body;
        const officeId = `office_${Date.now()}`;
        console.log('Received office data:', officeData);
        try {
            const now = new Date();
            const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
            await db.execute('INSERT INTO offices (id, title, location, address, price, priceUnit, description, images, surface, capacity, features, type, ownerId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                officeId,
                officeData.title,
                officeData.location,
                officeData.address,
                officeData.price,
                officeData.priceUnit,
                officeData.description,
                JSON.stringify(officeData.images),
                officeData.surface,
                officeData.capacity,
                JSON.stringify(officeData.features),
                officeData.type,
                officeData.ownerId,
                'pending',
                createdAt,
            ]);
            // Log activity
            const user = req.user;
            await (0, activityLogger_1.logActivity)(db, 'new_office', `Nouvelle annonce soumise: ${officeData.title}`, officeData.ownerId, user ? `${user.firstName} ${user.lastName}` : '');
            res.json({ id: officeId });
        }
        catch (error) {
            console.error('Error creating office:', error);
            res.status(500).json({ error: 'Failed to create office' });
        }
    });
    router.put('/:id', (0, auth_1.authenticate)(db), async (req, res) => {
        const officeData = req.body;
        try {
            const updates = Object.entries(officeData)
                .filter(([key]) => key !== 'id')
                .map(([key, value]) => `${key} = ?`);
            const values = Object.values(officeData)
                .filter((_, i) => Object.keys(officeData)[i] !== 'id')
                .map(val => (Array.isArray(val) ? JSON.stringify(val) : val));
            if (updates.length === 0) {
                return res.status(400).json({ error: 'No valid fields to update' });
            }
            values.push(req.params.id);
            await db.execute(`UPDATE offices SET ${updates.join(', ')} WHERE id = ?`, values);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update office' });
        }
    });
    router.delete('/:id', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            const [result] = await db.execute('DELETE FROM offices WHERE id = ?', [req.params.id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Office not found' });
            }
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to delete office' });
        }
    });
    return router;
};
