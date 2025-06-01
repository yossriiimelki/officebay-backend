"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/payments.ts
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const activityLogger_1 = require("../utils/activityLogger");
exports.default = (db) => {
    const router = (0, express_1.Router)();
    router.get('/reservation/:reservationId', async (req, res) => {
        try {
            const [rows] = await db.execute('SELECT * FROM payments WHERE reservationId = ?', [req.params.reservationId]);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch payments' });
        }
    });
    function formatToMySQLDateTime(date) {
        const d = new Date(date);
        return d.toISOString().slice(0, 19).replace('T', ' ');
    }
    router.post('/', (0, auth_1.authenticate)(db), async (req, res) => {
        const paymentData = req.body;
        const paymentId = `payment_${Date.now()}`;
        // Simulate credit card validation
        if (paymentData.method === 'credit_card') {
            if (!paymentData.cardNumber || !paymentData.cardExpiry || !paymentData.cardCVC) {
                return res.status(400).json({ error: 'Missing credit card information.' });
            }
            // Here you could add more validation or mock a payment gateway
        }
        try {
            await db.execute('INSERT INTO payments (id, reservationId, amount, status, method, createdAt, receiptUrl) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                paymentId,
                paymentData.reservationId,
                paymentData.amount,
                'completed',
                paymentData.method,
                formatToMySQLDateTime(new Date()),
                paymentData.receiptUrl || `https://mock-receipts.com/receipt/${paymentId}`,
            ]);
            await db.execute('UPDATE reservations SET paymentStatus = ?, status = ? WHERE id = ?', ['completed', 'completed', paymentData.reservationId]);
            // Log payment activity
            // Try to get tenantId from reservation
            let userId = null;
            let userName = '';
            try {
                const [reservationRows] = await db.execute('SELECT tenantId FROM reservations WHERE id = ?', [paymentData.reservationId]);
                if (reservationRows[0]) {
                    userId = reservationRows[0].tenantId;
                }
            }
            catch (e) { }
            await (0, activityLogger_1.logActivity)(db, 'payment', `Paiement reçu pour la réservation ${paymentData.reservationId} (montant: ${paymentData.amount} €)`, userId, userName);
            res.json({ id: paymentId, receiptUrl: paymentData.receiptUrl || `https://mock-receipts.com/receipt/${paymentId}` });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to create payment' });
        }
    });
    return router;
};
