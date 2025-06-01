import { Router } from 'express';
import { Connection } from 'mysql2/promise';
import { authenticate } from '../middleware/auth';

export default (db: Connection) => {
  const router = Router();

  router.get('/', authenticate(db), async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM activities ORDER BY createdAt DESC LIMIT 20'
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  return router;
}; 