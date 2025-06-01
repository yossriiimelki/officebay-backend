import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Connection } from 'mysql2/promise';
import { User, UserRole } from '../types';
import { authenticate } from '../middleware/auth';

export default (db: Connection) => {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    console.log('Login attempt received:', { ...req.body, password: '***' });
    
    // Validation des champs requis
    if (!req.body.email || !req.body.password || !req.body.role) {
      console.log('Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'password', 'role']
      });
    }

    const { email, password, role }: { email: string; password: string; role: UserRole } = req.body;

    try {
      console.log('Executing query with:', { email, role });
      const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      console.log('Query result length:', (rows as any[]).length);
      
      const user = (rows as any[])[0];

      if (!user) {
        console.log('User not found for:', { email });
        return res.status(404).json({ 
          error: 'User not found',
          message: 'No user found with this email address'
        });
      }

      // Vérification du rôle après avoir trouvé l'utilisateur
      if (user.role !== role) {
        console.log('Invalid role for user:', { expected: role, actual: user.role });
        return res.status(400).json({ 
          error: 'Invalid role',
          message: 'The provided role does not match the user account'
        });
      }

      if (!user.isActive) {
        console.log('Account is deactivated:', { email });
        return res.status(403).json({ 
          error: 'Account deactivated',
          message: 'Your account has been deactivated. Please contact support.'
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        console.log('Invalid password for user:', { email });
        return res.status(401).json({ 
          error: 'Invalid credentials',
          message: 'The provided password is incorrect'
        });
      }

      const token = jwt.sign(
        { 
          userId: user.id,
          role: user.role,
          email: user.email
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      const { password: _, ...userWithoutPassword } = user;
      console.log('Login successful for:', { email, role });
      
      res.json({ 
        success: true,
        user: userWithoutPassword,
        token,
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        message: 'An unexpected error occurred during login'
      });
    }
  });

router.post('/register', async (req: Request, res: Response) => {
    const userData: Partial<Omit<User, 'id' | 'isActive' | 'createdAt'>> & { password: string } = req.body;

    // Validate required fields
    const { email, firstName, lastName, role, password } = userData;
    if (!email || !firstName || !lastName || !role || !password) {
      return res.status(400).json({
        error: 'Missing required fields: email, firstName, lastName, role, password',
      });
    }

    // Validate role
    const validRoles: UserRole[] = ['locataire', 'proprietaire', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: locataire, proprietaire, admin' });
    }

    try {
      // Check for existing email
      const [existingUsers] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      if ((existingUsers as User[]).length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Prepare optional fields
      const phone = userData.phone || null;
      const companyName = userData.companyName || null;

      // Insert new user
      const userId = `user_${Date.now()}`;
      const now = new Date();
      const createdAt = now.toISOString().slice(0, 19).replace('T', ' ');
      await db.execute(
        'INSERT INTO users (id, email, firstName, lastName, role, password, isActive, createdAt, phone, companyName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, email, firstName, lastName, role, hashedPassword, true, createdAt, phone, companyName]
      );

      // Generate token for immediate use (optional)
      const token = jwt.sign({ userId, role }, process.env.JWT_SECRET || 'your-secure-secret-key', { expiresIn: '24h' });

      // Fetch the newly created user (excluding password)
      const [newUserRows] = await db.execute('SELECT id, email, firstName, lastName, role, isActive, createdAt, phone, companyName FROM users WHERE id = ?', [userId]);
      const newUser = (newUserRows as User[])[0];

      res.status(201).json({ success: true, user: newUser, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  router.post('/logout', (req: Request, res: Response) => {
    // Client-side token removal is sufficient
    res.json({ success: true });
  });

  router.put('/users/:userId', authenticate(db), async (req: Request, res: Response) => {
    const { userId } = req.params;
    const updateData = req.body;

    try {
      const updates = Object.keys(updateData).map(key => `${key} = ?`);
      const values = Object.values(updateData);
      values.push(userId);

      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
      
      // Fetch updated user
      const [rows] = await db.execute('SELECT id, email, firstName, lastName, role, isActive, createdAt, phone, companyName FROM users WHERE id = ?', [userId]);
      const updatedUser = (rows as any[])[0];
      
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Get current user
  router.get('/me', authenticate(db), async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user data' });
    }
  });

  return router;
};