"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const promise_1 = require("mysql2/promise");
const auth_1 = __importDefault(require("./routes/auth"));
const offices_1 = __importDefault(require("./routes/offices"));
const reservations_1 = __importDefault(require("./routes/reservations"));
const messages_1 = __importDefault(require("./routes/messages"));
const favorites_1 = __importDefault(require("./routes/favorites"));
const payments_1 = __importDefault(require("./routes/payments"));
const users_1 = __importDefault(require("./routes/users"));
const dotenv_1 = __importDefault(require("dotenv"));
const activities_1 = __importDefault(require("./routes/activities"));
dotenv_1.default.config();
const app = (0, express_1.default)();
async function startServer() {
    // Initialize MySQL connection
    const db = await (0, promise_1.createConnection)({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456789',
        database: process.env.DB_NAME || 'officebay',
    });
    // Middleware
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    // Routes
    app.use('/api/auth', (0, auth_1.default)(db));
    app.use('/api/offices', (0, offices_1.default)(db));
    app.use('/api/reservations', (0, reservations_1.default)(db));
    app.use('/api/messages', (0, messages_1.default)(db));
    app.use('/api/favorites', (0, favorites_1.default)(db));
    app.use('/api/payments', (0, payments_1.default)(db));
    app.use('/api/users', (0, users_1.default)(db));
    app.use('/api/activities', (0, activities_1.default)(db));
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
            const totalUsers = usersRows[0]?.totalUsers || 0;
            const locataires = locatairesRows[0]?.locataires || 0;
            const proprietaires = proprietairesRows[0]?.proprietaires || 0;
            const totalOffices = officesRows[0]?.totalOffices || 0;
            const pendingOffices = pendingOfficesRows[0]?.pendingOffices || 0;
            const approvedOffices = approvedOfficesRows[0]?.approvedOffices || 0;
            const totalReservations = reservationsRows[0]?.totalReservations || 0;
            const reservationsThisMonth = monthlyReservationsRows[0]?.reservationsThisMonth || 0;
            const totalRevenue = revenueRows[0]?.totalRevenue || 0;
            res.json({
                users: { total: totalUsers, locataires, proprietaires },
                offices: { total: totalOffices, pending: pendingOffices, approved: approvedOffices },
                reservations: { total: totalReservations, thisMonth: reservationsThisMonth, revenue: totalRevenue },
            });
        }
        catch (error) {
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
