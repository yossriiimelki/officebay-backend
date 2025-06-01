

USE officebay;

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  role ENUM('locataire', 'proprietaire', 'admin') NOT NULL,
  password VARCHAR(255) NOT NULL,
  isActive TINYINT(1) DEFAULT 1,
  createdAt DATETIME NOT NULL,
  phone VARCHAR(20),
  companyName VARCHAR(255)
);

CREATE TABLE offices (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  priceUnit ENUM('heure', 'jour', 'semaine', 'mois') NOT NULL,
  description TEXT NOT NULL,
  images JSON NOT NULL,
  surface VARCHAR(50) NOT NULL,
  capacity VARCHAR(50) NOT NULL,
  features JSON NOT NULL,
  type ENUM('private', 'coworking', 'meeting') NOT NULL,
  ownerId VARCHAR(50) NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL,
  createdAt DATETIME NOT NULL,
  FOREIGN KEY (ownerId) REFERENCES users(id)
);

CREATE TABLE reservations (
  id VARCHAR(50) PRIMARY KEY,
  officeId VARCHAR(50) NOT NULL,
  tenantId VARCHAR(50) NOT NULL,
  startDate DATETIME NOT NULL,
  endDate DATETIME NOT NULL,
  totalPrice DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed') NOT NULL,
  paymentStatus ENUM('pending', 'partial', 'completed') NOT NULL,
  paymentMethod ENUM('online', 'onsite'),
  createdAt DATETIME NOT NULL,
  FOREIGN KEY (officeId) REFERENCES offices(id),
  FOREIGN KEY (tenantId) REFERENCES users(id)
);

CREATE TABLE messages (
  id VARCHAR(50) PRIMARY KEY,
  senderId VARCHAR(50) NOT NULL,
  receiverId VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  `read` TINYINT(1) DEFAULT 0,
  createdAt DATETIME NOT NULL,
  officeId VARCHAR(50),
  reservationId VARCHAR(50),
  FOREIGN KEY (senderId) REFERENCES users(id),
  FOREIGN KEY (receiverId) REFERENCES users(id),
  FOREIGN KEY (officeId) REFERENCES offices(id),
  FOREIGN KEY (reservationId) REFERENCES reservations(id)
);

CREATE TABLE favorites (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  officeId VARCHAR(50) NOT NULL,
  createdAt DATETIME NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (officeId) REFERENCES offices(id),
  UNIQUE (userId, officeId)
);

CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  reservationId VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'completed', 'refunded') NOT NULL,
  method ENUM('credit_card', 'paypal', 'bank_transfer', 'onsite') NOT NULL,
  createdAt DATETIME NOT NULL,
  receiptUrl VARCHAR(255),
  FOREIGN KEY (reservationId) REFERENCES reservations(id)
);

CREATE TABLE activities (
  id VARCHAR(50) PRIMARY KEY,
  type ENUM('new_office', 'new_reservation', 'support_message', 'report') NOT NULL,
  description TEXT NOT NULL,
  userId VARCHAR(50),
  userName VARCHAR(100),
  createdAt DATETIME NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);