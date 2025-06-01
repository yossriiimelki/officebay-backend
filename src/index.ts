import express from 'express';
import cors from 'cors';
import { createConnection } from 'mysql2/promise';
import authRoutes from './routes/auth';
import officeRoutes from './routes/offices';
import reservationRoutes from './routes/reservations';
import messageRoutes from './routes/messages';
import favoriteRoutes from './routes/favorites';
import paymentRoutes from './routes/payments';
import userRoutes from './routes/users';
import dotenv from 'dotenv';
import { Connection } from 'mysql2/promise';
import activityRoutes from './routes/activities';

dotenv.config();

const app = express();

async function startServer() {
  // Initialize MySQL connection
  const db = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'officebay',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  });

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use('/api/auth', authRoutes(db));
  app.use('/api/offices', officeRoutes(db));
  app.use('/api/reservations', reservationRoutes(db));
  app.use('/api/messages', messageRoutes(db));
  app.use('/api/favorites', favoriteRoutes(db));
  app.use('/api/payments', paymentRoutes(db));
  app.use('/api/users', userRoutes(db));
  app.use('/api/activities', activityRoutes(db));

  // Stats endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      // Users
      const [usersRows] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
      const [locatairesRows] = await db.query("SELECT COUNT(*) as locataires FROM users WHERE role = 'locataire'");
      const [proprietairesRows] = await db.query("SELECT COUNT(*) as proprietaires FROM users WHERE role = 'proprietaire'");
      
      // Offices
      const [officesRows] = await db.query('SELECT COUNT(*) as totalOffices FROM offices');
      const [pendingOfficesRows] = await db.query("SELECT COUNT(*) as pendingOffices FROM offices WHERE status = 'pending'");
      const [approvedOfficesRows] = await db.query("SELECT COUNT(*) as approvedOffices FROM offices WHERE status = 'approved'");
      
      // Reservations
      const [reservationsRows] = await db.query('SELECT COUNT(*) as totalReservations FROM reservations');
      const [monthlyReservationsRows] = await db.query("SELECT COUNT(*) as reservationsThisMonth FROM reservations WHERE MONTH(createdAt) = MONTH(CURRENT_DATE()) AND YEAR(createdAt) = YEAR(CURRENT_DATE())");
      
      // Revenue (from payments)
      const [revenueRows] = await db.query("SELECT IFNULL(SUM(amount),0) as totalRevenue FROM payments WHERE status = 'completed'");

      // Extract values from rows
      const totalUsers = (usersRows as any[])[0]?.totalUsers || 0;
      const locataires = (locatairesRows as any[])[0]?.locataires || 0;
      const proprietaires = (proprietairesRows as any[])[0]?.proprietaires || 0;
      const totalOffices = (officesRows as any[])[0]?.totalOffices || 0;
      const pendingOffices = (pendingOfficesRows as any[])[0]?.pendingOffices || 0;
      const approvedOffices = (approvedOfficesRows as any[])[0]?.approvedOffices || 0;
      const totalReservations = (reservationsRows as any[])[0]?.totalReservations || 0;
      const reservationsThisMonth = (monthlyReservationsRows as any[])[0]?.reservationsThisMonth || 0;
      const totalRevenue = (revenueRows as any[])[0]?.totalRevenue || 0;

      res.json({
        users: { total: totalUsers, locataires, proprietaires },
        offices: { total: totalOffices, pending: pendingOffices, approved: approvedOffices },
        reservations: { total: totalReservations, thisMonth: reservationsThisMonth, revenue: totalRevenue },
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
