// src/routes/favorites.ts
import { Router } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';
import { Favorite } from '../types';

export default (db: Connection) => {
  const router = Router();

  router.get('/', authenticate(db), async (req, res) => {
    const user = (req as any).user;
    
    try {
      const [rows] = await db.execute('SELECT * FROM favorites WHERE userId = ?', [user.id]);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites. Please try again later.' });
    }
  });

  router.post('/', authenticate(db), async (req, res) => {
    const { officeId } = req.body;
    const user = (req as any).user;
    const favoriteId = `fav_${Date.now()}`;

    if (!officeId) {
      return res.status(400).json({ error: 'Office ID is required' });
    }

    try {
      // Check if the office exists
      const [officeRows] = await db.execute('SELECT id FROM offices WHERE id = ?', [officeId]);
      if ((officeRows as any[]).length === 0) {
        return res.status(404).json({ error: 'Office not found. Please try again with a valid office.' });
      }

      // Check if the favorite already exists
      const [existing] = await db.execute('SELECT * FROM favorites WHERE userId = ? AND officeId = ?', [user.id, officeId]);
      if ((existing as any[]).length > 0) {
        return res.json({ id: (existing as any[])[0].id });
      }

      // Create the favorite
      const now = new Date();
      const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
      await db.execute(
        'INSERT INTO favorites (id, userId, officeId, createdAt) VALUES (?, ?, ?, ?)',
        [favoriteId, user.id, officeId, createdAt]
      );
      res.json({ id: favoriteId });
    } catch (error) {
      console.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add favorite. Please try again later.' });
    }
  });

  router.delete('/:officeId', authenticate(db), async (req, res) => {
    const { officeId } = req.params;
    const user = (req as any).user;

    if (!officeId) {
      return res.status(400).json({ error: 'Office ID is required' });
    }

    try {
      // Check if the favorite exists
      const [existing] = await db.execute('SELECT * FROM favorites WHERE userId = ? AND officeId = ?', [user.id, officeId]);
      if ((existing as any[]).length === 0) {
        return res.status(404).json({ error: 'Favorite not found. It may have been already removed.' });
      }

      // Delete the favorite
      await db.execute('DELETE FROM favorites WHERE userId = ? AND officeId = ?', [user.id, officeId]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite. Please try again later.' });
    }
  });

  return router;
};
