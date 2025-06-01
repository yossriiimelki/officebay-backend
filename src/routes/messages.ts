// src/routes/messages.ts
import express, { Request } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { Message } from '../types';
import { logActivity } from '../utils/activityLogger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export default (db: Connection) => {
  const router = express.Router();

  // Get all messages for current user (regular messages)
  router.get('/', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log('Fetching messages for user:', userId);

      // Fetch messages where user is either sender or receiver (excluding support messages)
      const [messages] = await db.execute(
        `SELECT m.*, 
          s.firstName as senderFirstName, s.lastName as senderLastName,
          r.firstName as receiverFirstName, r.lastName as receiverLastName
        FROM messages m
        LEFT JOIN users s ON m.senderId = s.id
        LEFT JOIN users r ON m.receiverId = r.id
        WHERE (m.senderId = ? OR m.receiverId = ?) AND m.type != 'support'
        ORDER BY m.createdAt DESC`,
        [userId, userId]
      );

      console.log('Found messages:', messages);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ 
        error: 'Failed to fetch messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Send regular message between users
  router.post('/', authenticate(db), async (req, res) => {
    const messageData: Omit<Message, 'id' | 'read' | 'createdAt'> = req.body;
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
      if ((senderRows as any[]).length === 0) {
        return res.status(404).json({ error: 'Sender not found' });
      }

      // Check if receiver exists
      const [receiverRows] = await db.execute('SELECT id FROM users WHERE id = ?', [messageData.receiverId]);
      if ((receiverRows as any[]).length === 0) {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      // Check if office exists if provided
      if (messageData.officeId) {
        const [officeRows] = await db.execute('SELECT id FROM offices WHERE id = ?', [messageData.officeId]);
        if ((officeRows as any[]).length === 0) {
          return res.status(404).json({ error: 'Office not found' });
        }
      }

      // Check if reservation exists if provided
      if (messageData.reservationId) {
        const [reservationRows] = await db.execute('SELECT id FROM reservations WHERE id = ?', [messageData.reservationId]);
        if ((reservationRows as any[]).length === 0) {
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

      await db.execute(
        'INSERT INTO messages (id, senderId, receiverId, subject, content, `read`, createdAt, officeId, reservationId, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          messageId,
          messageData.senderId,
          messageData.receiverId,
          messageData.subject,
          messageData.content,
          false,
          createdAt,
          messageData.officeId || null,
          messageData.reservationId || null,
          'regular'
        ]
      );

      // Log activity
      const user = (req as any).user;
      await logActivity(
        db,
        'report',
        `Message envoyé: ${messageData.subject}`,
        messageData.senderId,
        user ? `${user.firstName} ${user.lastName}` : ''
      );
      
      res.json({ id: messageId });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Send support message to admin
  router.post('/support', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { subject, content, officeId, reservationId, receiverId } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Validate required fields
      if (!subject || !content) {
        return res.status(400).json({ 
          error: 'Subject and content are required for support messages' 
        });
      }

      const now = new Date();
      const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');

      // Validate office and reservation if provided
      if (officeId) {
        const [officeRows] = await db.execute('SELECT id FROM offices WHERE id = ?', [officeId]);
        if ((officeRows as any[]).length === 0) {
          return res.status(404).json({ error: 'Office not found' });
        }
      }

      if (reservationId) {
        const [reservationRows] = await db.execute('SELECT id FROM reservations WHERE id = ?', [reservationId]);
        if ((reservationRows as any[]).length === 0) {
          return res.status(404).json({ error: 'Reservation not found' });
        }
      }

      if (userRole === 'admin') {
        // Admin replying to a specific user
        if (!receiverId) {
          return res.status(400).json({ error: 'receiverId is required for admin replies' });
        }

        // Validate that the receiver exists
        const [userRows] = await db.execute('SELECT id FROM users WHERE id = ?', [receiverId]);
        if ((userRows as any[]).length === 0) {
          return res.status(404).json({ error: 'Receiver not found' });
        }

        const messageId = `support_${Date.now()}`;

        console.log('Inserting admin support reply:', {
          id: messageId,
          senderId: userId,
          receiverId: receiverId,
          subject,
          content,
          createdAt
        });

        await db.execute(
          'INSERT INTO messages (id, senderId, receiverId, subject, content, `read`, createdAt, officeId, reservationId, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            messageId,
            userId,
            receiverId,
            subject,
            content,
            false,
            createdAt,
            officeId || null,
            reservationId || null,
            'support'
          ]
        );

        // Log activity
        await logActivity(
          db,
          'support_message',
          `Réponse d'assistance: ${subject}`,
          userId,
          `${req.user?.firstName} ${req.user?.lastName}`
        );

        res.json({ 
          id: messageId,
          message: 'Admin support reply sent successfully'
        });

      } else {
        // Regular user sending support message to all admins
        // Get all admin users
        const [adminUsers] = await db.execute(
          'SELECT id FROM users WHERE role = "admin"'
        );

        const admins = adminUsers as any[];
        
        if (admins.length === 0) {
          return res.status(404).json({ error: 'No admin users found' });
        }

        const insertedMessages = [];

        // Create a message for each admin
        for (const admin of admins) {
          const messageId = `support_${Date.now()}_${admin.id}`;

          console.log('Inserting support message for admin:', {
            id: messageId,
            senderId: userId,
            receiverId: admin.id,
            subject,
            content,
            createdAt
          });

          await db.execute(
            'INSERT INTO messages (id, senderId, receiverId, subject, content, `read`, createdAt, officeId, reservationId, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              messageId,
              userId,
              admin.id,
              subject,
              content,
              false,
              createdAt,
              officeId || null,
              reservationId || null,
              'support'
            ]
          );

          insertedMessages.push(messageId);
        }

        // Log activity
        await logActivity(
          db,
          'support_message',
          `Nouveau message d'assistance: ${subject}`,
          userId,
          `${req.user?.firstName} ${req.user?.lastName}`
        );

        res.json({ 
          ids: insertedMessages,
          message: `Support message sent to ${admins.length} admin(s) successfully`
        });
      }
    } catch (error) {
      console.error('Error sending support message:', error);
      res.status(500).json({ 
        error: 'Failed to send support message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get all support messages (admin only)
  router.get('/support', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin role required.' });
      }

      console.log('Admin fetching support messages');

      // Fetch all support messages with sender information
      const [messages] = await db.execute(
        `SELECT m.*, 
          s.firstName as senderFirstName, 
          s.lastName as senderLastName,
          s.email as senderEmail,
          s.role as senderRole,
          r.firstName as receiverFirstName,
          r.lastName as receiverLastName,
          o.title as officeTitle,
          res.startDate as reservationStartDate,
          res.endDate as reservationEndDate
        FROM messages m
        LEFT JOIN users s ON m.senderId = s.id
        LEFT JOIN users r ON m.receiverId = r.id
        LEFT JOIN offices o ON m.officeId = o.id
        LEFT JOIN reservations res ON m.reservationId = res.id
        WHERE m.type = 'support'
        ORDER BY m.createdAt DESC`
      );

      console.log('Found support messages:', (messages as any[]).length);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching support messages:', error);
      res.status(500).json({ 
        error: 'Failed to fetch support messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get support messages for current user (conversation view)
  router.get('/support/conversation', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log('Fetching support conversation for user:', userId, 'with role:', userRole);

      let messages;

      if (userRole === 'admin') {
        // Admin sees all support messages (same as /support endpoint)
        const [result] = await db.execute(
          `SELECT m.*, 
            s.firstName as senderFirstName, 
            s.lastName as senderLastName,
            s.email as senderEmail,
            s.role as senderRole,
            r.firstName as receiverFirstName,
            r.lastName as receiverLastName,
            o.title as officeTitle,
            res.startDate as reservationStartDate,
            res.endDate as reservationEndDate
          FROM messages m
          LEFT JOIN users s ON m.senderId = s.id
          LEFT JOIN users r ON m.receiverId = r.id
          LEFT JOIN offices o ON m.officeId = o.id
          LEFT JOIN reservations res ON m.reservationId = res.id
          WHERE m.type = 'support'
          ORDER BY m.createdAt ASC`
        );
        messages = result;
      } else {
        // Regular user sees their own support messages and admin replies to them
        const [result] = await db.execute(
          `SELECT m.*, 
            s.firstName as senderFirstName, 
            s.lastName as senderLastName,
            s.email as senderEmail,
            s.role as senderRole,
            r.firstName as receiverFirstName,
            r.lastName as receiverLastName,
            o.title as officeTitle,
            res.startDate as reservationStartDate,
            res.endDate as reservationEndDate
          FROM messages m
          LEFT JOIN users s ON m.senderId = s.id
          LEFT JOIN users r ON m.receiverId = r.id
          LEFT JOIN offices o ON m.officeId = o.id
          LEFT JOIN reservations res ON m.reservationId = res.id
          WHERE m.type = 'support' AND (m.senderId = ? OR m.receiverId = ?)
          ORDER BY m.createdAt ASC`,
          [userId, userId]
        );
        messages = result;
      }

      console.log('Found support conversation messages:', (messages as any[]).length);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching support conversation:', error);
      res.status(500).json({ 
        error: 'Failed to fetch support conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get support messages for current user (legacy endpoint - keeping for backward compatibility)
  router.get('/support/my-messages', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log('Fetching support messages for user:', userId);

      // Fetch support messages sent by the current user and replies to them
      const [messages] = await db.execute(
        `SELECT m.*, 
          s.firstName as senderFirstName, 
          s.lastName as senderLastName,
          s.email as senderEmail,
          s.role as senderRole,
          o.title as officeTitle,
          res.startDate as reservationStartDate,
          res.endDate as reservationEndDate
        FROM messages m
        LEFT JOIN users s ON m.senderId = s.id
        LEFT JOIN offices o ON m.officeId = o.id
        LEFT JOIN reservations res ON m.reservationId = res.id
        WHERE m.type = 'support' AND (m.senderId = ? OR m.receiverId = ?)
        ORDER BY m.createdAt DESC`,
        [userId, userId]
      );

      console.log('Found user support messages:', (messages as any[]).length);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching user support messages:', error);
      res.status(500).json({ 
        error: 'Failed to fetch support messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Mark message as read
  router.put('/:id/read', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const messageId = req.params.id;
      const user = req.user;

      // Check if message exists and user has permission to mark it as read
      const [messageRows] = await db.execute(
        'SELECT * FROM messages WHERE id = ?',
        [messageId]
      );

      const message = (messageRows as any[])[0];
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // For support messages, both admins and the receiver can mark as read
      // For regular messages, only the receiver can mark as read
      if (message.type === 'support') {
        if (user?.role !== 'admin' && message.receiverId !== user?.id && message.senderId !== user?.id) {
          return res.status(403).json({ error: 'You do not have permission to mark this message as read' });
        }
      } else {
        if (message.receiverId !== user?.id) {
          return res.status(403).json({ error: 'You can only mark your own messages as read' });
        }
      }

      await db.execute('UPDATE messages SET `read` = 1 WHERE id = ?', [messageId]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking message as read:', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  });

  // Get conversation between two users
  router.get('/conversation/:otherUserId', authenticate(db), async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    const otherUserId = req.params.otherUserId;

    if (!user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const [rows] = await db.execute(
        'SELECT * FROM messages WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) AND type = "regular" ORDER BY createdAt ASC',
        [user.id, otherUserId, otherUserId, user.id]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  // Get all conversations (latest message per user) - excluding support messages
  router.get('/conversations', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get the latest message for each conversation (between the user and another user)
      const [rows] = await db.execute(
        `SELECT m1.*,
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
           WHERE (senderId = ? OR receiverId = ?) AND type = 'regular'
           GROUP BY otherUserId
         ) m2 ON (
           ((m1.senderId = ? AND m1.receiverId = m2.otherUserId) OR (m1.receiverId = ? AND m1.senderId = m2.otherUserId))
           AND m1.createdAt = m2.maxCreatedAt
         )
         WHERE (m1.senderId = ? OR m1.receiverId = ?) AND m1.type = 'regular'
         ORDER BY m1.createdAt DESC`,
        [userId, userId, userId, userId, userId, userId, userId]
      );
      res.json(rows);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Get unread message counts
  router.get('/unread-count', authenticate(db), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Count unread regular messages for the user
      const [regularMessages] = await db.execute(
        'SELECT COUNT(*) as count FROM messages WHERE receiverId = ? AND `read` = 0 AND type = "regular"',
        [userId]
      );

      let supportMessages = [{ count: 0 }];
      
      // Count unread support messages based on user role
      if (userRole === 'admin') {
        // Admin sees all unread support messages
        const [supportResult] = await db.execute(
          'SELECT COUNT(*) as count FROM messages WHERE `read` = 0 AND type = "support"'
        );
        supportMessages = supportResult as any[];
      } else {
        // Regular user sees unread support messages addressed to them (admin replies)
        const [supportResult] = await db.execute(
          'SELECT COUNT(*) as count FROM messages WHERE receiverId = ? AND `read` = 0 AND type = "support"',
          [userId]
        );
        supportMessages = supportResult as any[];
      }

      res.json({
        regular: (regularMessages as any[])[0].count,
        support: supportMessages[0].count
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  return router;
};