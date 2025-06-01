// src/routes/reservations.ts
import { Router } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { Reservation } from '../types';
import { logActivity } from '../utils/activityLogger';

function formatToMySQLDateTime(date: string | Date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export default (db: Connection) => {
  const router = Router();

  router.get('/', async (req, res) => {
    const filters = req.query;
    let query = 'SELECT * FROM reservations WHERE 1=1';
    const params: any[] = [];

    if (filters.officeId) {
      query += ' AND officeId = ?';
      params.push(filters.officeId);
    }
    if (filters.tenantId) {
      query += ' AND tenantId = ?';
      params.push(filters.tenantId);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.paymentStatus) {
      query += ' AND paymentStatus = ?';
      params.push(filters.paymentStatus);
    }

    try {
      const [rows] = await db.execute(query, params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
      const reservation = (rows as any[])[0];
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch reservation' });
    }
  });

  router.post('/', authenticate(db), async (req, res) => {
    const reservationData: Omit<Reservation, 'id' | 'status' | 'paymentStatus' | 'createdAt'> = req.body;
    const reservationId = `reservation_${Date.now()}`;

    try {
      await db.execute(
        'INSERT INTO reservations (id, officeId, tenantId, startDate, endDate, totalPrice, status, paymentStatus, paymentMethod, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          reservationId,
          reservationData.officeId,
          reservationData.tenantId,
          formatToMySQLDateTime(reservationData.startDate),
          formatToMySQLDateTime(reservationData.endDate),
          reservationData.totalPrice,
          'pending',
          'pending',
          reservationData.paymentMethod,
          formatToMySQLDateTime(new Date()),
        ]
      );
      // Log activity
      const user = (req as any).user;
      await logActivity(
        db,
        'new_reservation',
        `Nouvelle réservation pour le bureau ${reservationData.officeId}`,
        reservationData.tenantId,
        user ? `${user.firstName} ${user.lastName}` : ''
      );
      res.json({ id: reservationId });
    } catch (error) {
      console.error('Reservation creation error:', error);
      res.status(500).json({ error: 'Failed to create reservation' });
    }
  });

  router.put('/:id', authenticate(db), async (req, res) => {
    const reservationData: Partial<Reservation> = req.body;
    
    try {
      const updates = Object.entries(reservationData)
        .filter(([key]) => key !== 'id')
        .map(([key]) => `${key} = ?`);
      const values = Object.values(reservationData)
        .filter((_, i) => Object.keys(reservationData)[i] !== 'id');
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(req.params.id);
      await db.execute(`UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update reservation' });
    }
  });

  return router;
};
