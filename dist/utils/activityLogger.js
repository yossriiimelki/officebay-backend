"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
async function logActivity(db, type, description, userId, userName) {
    const id = `activity_${Date.now()}`;
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute('INSERT INTO activities (id, type, description, userId, userName, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [id, type, description, userId, userName, createdAt]);
}
