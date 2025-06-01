// src/types.ts
export type UserRole = 'locataire' | 'proprietaire' | 'admin';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  phone?: string;
  companyName?: string;
  password?: string;
}

export interface Office {
  id: string;
  title: string;
  location: string;
  address: string;
  price: number;
  priceUnit: 'heure' | 'jour' | 'semaine' | 'mois';
  description: string;
  images: string[];
  surface: string;
  capacity: string;
  features: string[];
  type: 'private' | 'coworking' | 'meeting';
  ownerId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Reservation {
  id: string;
  officeId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'partial' | 'completed';
  paymentMethod?: 'online' | 'onsite';
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string; // Optional for support messages
  subject: string;
  content: string;
  read: boolean;
  createdAt: string;
  type: 'regular' | 'support'; // New field to distinguish message types
  officeId?: string;
  reservationId?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  officeId: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  status: 'pending' | 'completed' | 'refunded';
  method: 'credit_card' | 'paypal' | 'bank_transfer' | 'onsite';
  createdAt: string;
  receiptUrl?: string;
}