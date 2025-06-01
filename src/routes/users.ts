// src/routes/users.ts
import { Router } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';

export default (db: Connection) => {
  const router = Router();

  router.get('/', authenticate(db), async (req, res) => {
    const { role } = req.query;
    let query = 'SELECT * FROM users';
    const params: any[] = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    try {
      const [rows] = await db.execute(query, params);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  router.put('/:userId/status', authenticate(db), async (req, res) => {
    const { isActive } = req.body;

    try {
      await db.execute('UPDATE users SET isActive = ? WHERE id = ?', [isActive, req.params.userId]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user status' });
    }
  });

  router.put('/profile', authenticate(db), async (req, res) => {
    const user = (req as any).user;
    const updateData = req.body;

    try {
      const updates = Object.keys(updateData).map(key => `${key} = ?`);
      const values = Object.values(updateData);
      values.push(user.id);

      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  return router;
};