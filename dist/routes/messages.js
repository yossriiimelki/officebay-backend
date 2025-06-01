"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/messages.ts
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const activityLogger_1 = require("../utils/activityLogger");
exports.default = (db) => {
    const router = express_1.default.Router();
    router.get('/', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            console.log('Fetching messages for user:', userId);
            // Fetch messages where user is either sender or receiver
            const [messages] = await db.execute(`SELECT m.*, 
          s.firstName as senderFirstName, s.lastName as senderLastName,
          r.firstName as receiverFirstName, r.lastName as receiverLastName
        FROM messages m
        LEFT JOIN users s ON m.senderId = s.id
        LEFT JOIN users r ON m.receiverId = r.id
        WHERE (m.senderId = ? OR m.receiverId = ?)
        ORDER BY m.createdAt DESC`, [userId, userId]);
            console.log('Found messages:', messages);
            res.json(messages);
        }
        catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({
                error: 'Failed to fetch messages',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/', (0, auth_1.authenticate)(db), async (req, res) => {
        const messageData = req.body;
        const messageId = `message_${Date.now()}`;
        // Validate required fields
        if (!messageData.senderId || !messageData.receiverId || !messageData.subject || !messageData.content) {
            return res.status(400).json({
                error: 'Missing required fields: senderId, receiverId, subject, and content are required'
            });
        }
        try {
            // Check if sender exists
            const [senderRows] = await db.execute('SELECT id FROM users WHERE id = ?', [messageData.senderId]);
            if (senderRows.length === 0) {
                return res.status(404).json({ error: 'Sender not found' });
            }
            // Check if receiver exists
            const [receiverRows] = await db.execute('SELECT id FROM users WHERE id = ?', [messageData.receiverId]);
            if (receiverRows.length === 0) {
                return res.status(404).json({ error: 'Receiver not found' });
            }
            // Check if office exists if provided
            if (messageData.officeId) {
                const [officeRows] = await db.execute('SELECT id FROM offices WHERE id = ?', [messageData.officeId]);
                if (officeRows.length === 0) {
                    return res.status(404).json({ error: 'Office not found' });
                }
            }
            // Check if reservation exists if provided
            if (messageData.reservationId) {
                const [reservationRows] = await db.execute('SELECT id FROM reservations WHERE id = ?', [messageData.reservationId]);
                if (reservationRows.length === 0) {
                    return res.status(404).json({ error: 'Reservation not found' });
                }
            }
            const now = new Date();
            const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
            console.log('Inserting message with data:', {
                id: messageId,
                senderId: messageData.senderId,
                receiverId: messageData.receiverId,
                subject: messageData.subject,
                content: messageData.content,
                createdAt,
                officeId: messageData.officeId,
                reservationId: messageData.reservationId
            });
            await db.execute('INSERT INTO messages (id, senderId, receiverId, subject, content, `read`, createdAt, officeId, reservationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                messageId,
                messageData.senderId,
                messageData.receiverId,
                messageData.subject,
                messageData.content,
                false,
                createdAt,
                messageData.officeId || null,
                messageData.reservationId || null,
            ]);
            // Log activity
            const user = req.user;
            await (0, activityLogger_1.logActivity)(db, 'support_message', `Nouveau message d'assistance: ${messageData.subject}`, messageData.senderId, user ? `${user.firstName} ${user.lastName}` : '');
            res.json({ id: messageId });
        }
        catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                error: 'Failed to send message',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.put('/:id/read', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            await db.execute('UPDATE messages SET `read` = 1 WHERE id = ?', [req.params.id]);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to mark message as read' });
        }
    });
    router.get('/conversation/:otherUserId', (0, auth_1.authenticate)(db), async (req, res) => {
        const user = req.user;
        const otherUserId = req.params.otherUserId;
        try {
            const [rows] = await db.execute('SELECT * FROM messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC', [user.id, otherUserId, otherUserId, user.id]);
            res.json(rows);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch conversation' });
        }
    });
    // Get all conversations (latest message per user)
    router.get('/conversations', (0, auth_1.authenticate)(db), async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            // Get the latest message for each conversation (between the user and another user)
            const [rows] = await db.execute(`SELECT m1.*,
                s.firstName as senderFirstName, s.lastName as senderLastName,
                r.firstName as receiverFirstName, r.lastName as receiverLastName
         FROM messages m1
         LEFT JOIN users s ON m1.senderId = s.id
         LEFT JOIN users r ON m1.receiverId = r.id
         INNER JOIN (
           SELECT 
             CASE 
               WHEN senderId = ? THEN receiverId 
               ELSE senderId 
             END as otherUserId,
             MAX(createdAt) as maxCreatedAt
           FROM messages
           WHERE senderId = ? OR receiverId = ?
           GROUP BY otherUserId
         ) m2 ON (
           ((m1.senderId = ? AND m1.receiverId = m2.otherUserId) OR (m1.receiverId = ? AND m1.senderId = m2.otherUserId))
           AND m1.createdAt = m2.maxCreatedAt
         )
         WHERE m1.senderId = ? OR m1.receiverId = ?
         ORDER BY m1.createdAt DESC`, [userId, userId, userId, userId, userId, userId, userId]);
            res.json(rows);
        }
        catch (error) {
            console.error('Error fetching conversations:', error);
            res.status(500).json({ error: 'Failed to fetch conversations' });
        }
    });
    return router;
};
