// src/routes/payments.ts
import { Router } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { Payment } from '../types';
import { logActivity } from '../utils/activityLogger';

export default (db: Connection) => {
  const router = Router();

  router.get('/reservation/:reservationId', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM payments WHERE reservationId = ?', [req.params.reservationId]);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  function formatToMySQLDateTime(date: string | Date) {
    const d = new Date(date);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  router.post('/', authenticate(db), async (req, res) => {
    const paymentData: Omit<Payment, 'id' | 'status' | 'createdAt'> & { cardNumber?: string, cardExpiry?: string, cardCVC?: string } = req.body;
    const paymentId = `payment_${Date.now()}`;

    // Simulate credit card validation
    if (paymentData.method === 'credit_card') {
      if (!paymentData.cardNumber || !paymentData.cardExpiry || !paymentData.cardCVC) {
        return res.status(400).json({ error: 'Missing credit card information.' });
      }
      // Here you could add more validation or mock a payment gateway
    }

    try {
      await db.execute(
        'INSERT INTO payments (id, reservationId, amount, status, method, createdAt, receiptUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          paymentId,
          paymentData.reservationId,
          paymentData.amount,
          'completed',
          paymentData.method,
          formatToMySQLDateTime(new Date()),
          paymentData.receiptUrl || `https://mock-receipts.com/receipt/${paymentId}`,
        ]
      );

      await db.execute('UPDATE reservations SET paymentStatus = ?, status = ? WHERE id = ?', ['completed', 'completed', paymentData.reservationId]);

      // Log payment activity
      // Try to get tenantId from reservation
      let userId = null;
      let userName = '';
      try {
        const [reservationRows] = await db.execute('SELECT tenantId FROM reservations WHERE id = ?', [paymentData.reservationId]);
        if ((reservationRows as any[])[0]) {
          userId = (reservationRows as any[])[0].tenantId;
        }
      } catch (e) {}
      await logActivity(
        db,
        'payment',
        `Paiement reçu pour la réservation ${paymentData.reservationId} (montant: ${paymentData.amount} €)`,
        userId,
        userName
      );

      res.json({ id: paymentId, receiptUrl: paymentData.receiptUrl || `https://mock-receipts.com/receipt/${paymentId}` });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create payment' });
    }
  });

  return router;
};
