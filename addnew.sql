-- Add new columns to messages table for support functionality
ALTER TABLE messages 
ADD COLUMN type ENUM('regular', 'support') DEFAULT 'regular',
ADD COLUMN priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
ADD COLUMN status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
ADD COLUMN adminAssignedId VARCHAR(255) NULL,
ADD COLUMN adminResponse TEXT NULL,
ADD COLUMN updatedAt TIMESTAMP NULL,
ADD FOREIGN KEY (adminAssignedId) REFERENCES users(id) ON DELETE SET NULL;

-- Make receiverId nullable for support messages (since support messages don't have specific receivers)
ALTER TABLE messages MODIFY COLUMN receiverId VARCHAR(255) NULL;

-- Add index for better performance on support message queries
CREATE INDEX idx_messages_type_status ON messages(type, status);
CREATE INDEX idx_messages_type_priority ON messages(type, priority);
CREATE INDEX idx_messages_sender_type ON messages(senderId, type);

-- Update users table to include role if not already present
-- (Assuming you already have this, but if not, add it)
-- ALTER TABLE users ADD COLUMN role ENUM('user', 'admin', 'super_admin') DEFAULT 'user';

-- Optional: Create a view for easy support message queries
CREATE VIEW support_messages_view AS
SELECT 
    m.id,
    m.senderId,
    m.subject,
    m.content,
    m.priority,
    m.status,
    m.adminAssignedId,
    m.adminResponse,
    m.createdAt,
    m.updatedAt,
    m.read,
    u.firstName as senderFirstName,
    u.lastName as senderLastName,
    u.email as senderEmail,
    admin.firstName as adminFirstName,
    admin.lastName as adminLastName,
    admin.email as adminEmail
FROM messages m
LEFT JOIN users u ON m.senderId = u.id
LEFT JOIN users admin ON m.adminAssignedId = admin.id
WHERE m.type = 'support';