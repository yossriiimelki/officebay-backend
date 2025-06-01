USE officebay;
DELETE FROM users WHERE email = 'admin@officebay.com';
INSERT INTO users (id, email, firstName, lastName, role, password, isActive, createdAt) VALUES ('admin_1', 'admin@officebay.com', 'Admin', 'OfficeBay', 'admin', 'admin123', 1, NOW());
USE officebay;
DELETE FROM users WHERE email = 'admin@officebay.com';



