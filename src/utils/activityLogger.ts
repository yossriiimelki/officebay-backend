import { Connection } from 'mysql2/promise';

export async function logActivity(
  db: Connection,
  type: 'new_office' | 'new_reservation' | 'support_message' | 'report' | 'payment',
  description: string,
  userId: string,
  userName: string
) {
  const id = `activity_${Date.now()}`;
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await db.execute(
    'INSERT INTO activities (id, type, description, userId, userName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, type, description, userId, userName, createdAt]
  );
} 