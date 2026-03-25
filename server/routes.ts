import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { eachDayOfInterval, isWeekend, format, parseISO } from 'date-fns';

const JWT_SECRET = 'super-secret-key-for-eleave-system-2026';

export function setupRoutes(app: Express) {
  // --- Auth Routes ---
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, country_id: user.country_id }, JWT_SECRET, { expiresIn: '24h' });
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  });

  // Middleware to verify token
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // --- Dashboard Routes ---
  app.get('/api/dashboard/summary', authenticate, (req: any, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Who is on leave today
    const onLeaveToday = db.prepare(`
      SELECT la.*, u.name as user_name, lt.name as leave_type_name
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE la.status = 'Approved' 
      AND la.start_date <= ? AND la.end_date >= ?
    `).all(today, today);

    res.json({ onLeaveToday });
  });

  app.get('/api/dashboard/calendar', authenticate, (req: any, res) => {
    const { start, end } = req.query; // YYYY-MM-DD
    
    const leaves = db.prepare(`
      SELECT la.*, u.name as user_name, lt.name as leave_type_name, lt.code as leave_type_code
      FROM leave_applications la
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE la.status = 'Approved'
      AND (la.start_date <= ? AND la.end_date >= ?)
    `).all(end, start);

    const holidays = db.prepare(`
      SELECT * FROM public_holidays
      WHERE date >= ? AND date <= ?
    `).all(start, end);

    res.json({ leaves, holidays });
  });

  // --- Leave Management Routes ---
  app.get('/api/leaves/types', authenticate, (req, res) => {
    const types = db.prepare('SELECT * FROM leave_types').all();
    res.json(types);
  });

  app.get('/api/leaves/balances', authenticate, (req: any, res) => {
    const currentYear = new Date().getFullYear();
    const balances = db.prepare(`
      SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code
      FROM leave_balances lb
      JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.user_id = ? AND lb.year = ?
    `).all(req.user.id, currentYear);
    res.json(balances);
  });

  app.get('/api/leaves/my-applications', authenticate, (req: any, res) => {
    const applications = db.prepare(`
      SELECT la.*, lt.name as leave_type_name
      FROM leave_applications la
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE la.user_id = ?
      ORDER BY la.applied_at DESC
    `).all(req.user.id);
    res.json(applications);
  });

  app.get('/api/leaves/holidays', authenticate, (req: any, res) => {
    const holidays = db.prepare('SELECT * FROM public_holidays WHERE country_id = ?').all(req.user.country_id);
    res.json(holidays);
  });

  app.post('/api/leaves/apply', authenticate, (req: any, res) => {
    const { leave_type_id, start_date, end_date, days, reason } = req.body;
    const user_id = req.user.id;
    const country_id = req.user.country_id;
    const applied_at = new Date().toISOString();

    // Basic validation
    if (!leave_type_id || !start_date || !end_date || !days) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate working days (exclude weekends and public holidays)
    const holidays = db.prepare('SELECT date FROM public_holidays WHERE country_id = ? AND date >= ? AND date <= ?').all(country_id, start_date, end_date) as any[];
    const holidayDates = holidays.map(h => h.date);

    const start = parseISO(start_date);
    const end = parseISO(end_date);
    
    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }

    const daysInterval = eachDayOfInterval({ start, end });
    let maxWorkingDays = 0;
    daysInterval.forEach(day => {
      if (!isWeekend(day)) {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!holidayDates.includes(dateStr)) {
          maxWorkingDays++;
        }
      }
    });

    if (days > maxWorkingDays) {
      return res.status(400).json({ error: `Requested days (${days}) exceeds available working days (${maxWorkingDays}) in the selected period.` });
    }
    if (days <= 0) {
      return res.status(400).json({ error: 'Leave days must be greater than 0.' });
    }

    // Check for blackout dates
    const blackoutDates = db.prepare(`
      SELECT * FROM blackout_dates 
      WHERE (country_id IS NULL OR country_id = ?)
      AND start_date <= ? AND end_date >= ?
    `).all(country_id, end_date, start_date);

    if (blackoutDates.length > 0) {
      return res.status(400).json({ 
        error: `Leave application overlaps with a blackout period: ${(blackoutDates[0] as any).reason}` 
      });
    }

    // Check balance (simplified)
    const currentYear = new Date().getFullYear();
    const balance = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?').get(user_id, leave_type_id, currentYear) as any;

    
    // If it's EL, it deducts from AL, so check AL balance
    const leaveType = db.prepare('SELECT code FROM leave_types WHERE id = ?').get(leave_type_id) as any;
    
    if (leaveType.code !== 'Unpaid Leave') {
       let checkBalance = balance;
       if (leaveType.code === 'EL') {
          const alType = db.prepare('SELECT id FROM leave_types WHERE code = "AL"').get() as any;
          checkBalance = db.prepare('SELECT * FROM leave_balances WHERE user_id = ? AND leave_type_id = ? AND year = ?').get(user_id, alType.id, currentYear) as any;
       }
       if (!checkBalance || (checkBalance.total_days + checkBalance.carried_forward - checkBalance.used_days) < days) {
         return res.status(400).json({ error: 'Insufficient leave balance' });
       }
    }

    const insert = db.prepare(`
      INSERT INTO leave_applications (user_id, leave_type_id, start_date, end_date, days, reason, status, applied_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
    `);
    
    const result = insert.run(user_id, leave_type_id, start_date, end_date, days, reason, applied_at);
    
    // Create approval workflow
    const user = db.prepare('SELECT manager_id FROM users WHERE id = ?').get(user_id) as any;
    if (user.manager_id) {
      db.prepare(`
        INSERT INTO approval_workflows (leave_application_id, approver_id, status, level)
        VALUES (?, ?, 'Pending', 1)
      `).run(result.lastInsertRowid, user.manager_id);
    }

    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.post('/api/leaves/:id/cancel', authenticate, (req: any, res) => {
    const { id } = req.params;
    const application = db.prepare('SELECT * FROM leave_applications WHERE id = ? AND user_id = ?').get(id, req.user.id) as any;
    
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.status !== 'Pending') return res.status(400).json({ error: 'Can only cancel pending applications' });

    db.prepare('UPDATE leave_applications SET status = "Cancelled" WHERE id = ?').run(id);
    db.prepare('UPDATE approval_workflows SET status = "Rejected", comments = "Cancelled by user" WHERE leave_application_id = ?').run(id);
    
    res.json({ success: true });
  });

  // --- Approver Routes ---
  app.get('/api/approvals/pending', authenticate, (req: any, res) => {
    const pending = db.prepare(`
      SELECT aw.*, la.start_date, la.end_date, la.days, la.reason, la.applied_at, 
             u.name as applicant_name, lt.name as leave_type_name
      FROM approval_workflows aw
      JOIN leave_applications la ON aw.leave_application_id = la.id
      JOIN users u ON la.user_id = u.id
      JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE aw.approver_id = ? AND aw.status = 'Pending'
    `).all(req.user.id);
    res.json(pending);
  });

  app.post('/api/approvals/:id/action', authenticate, (req: any, res) => {
    const { id } = req.params; // approval_workflow id
    const { action, comments } = req.body; // 'Approve' or 'Reject'
    
    if (!['Approved', 'Rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const workflow = db.prepare('SELECT * FROM approval_workflows WHERE id = ? AND approver_id = ?').get(id, req.user.id) as any;
    if (!workflow) return res.status(404).json({ error: 'Approval task not found' });

    // Update workflow
    db.prepare('UPDATE approval_workflows SET status = ?, comments = ?, action_at = ? WHERE id = ?')
      .run(action, comments, new Date().toISOString(), id);

    // Update main application status
    const appId = workflow.leave_application_id;
    db.prepare('UPDATE leave_applications SET status = ? WHERE id = ?').run(action, appId);

    // If approved, deduct balance
    if (action === 'Approved') {
      const app = db.prepare('SELECT * FROM leave_applications WHERE id = ?').get(appId) as any;
      const currentYear = new Date(app.start_date).getFullYear();
      
      let targetLeaveTypeId = app.leave_type_id;
      const leaveType = db.prepare('SELECT code FROM leave_types WHERE id = ?').get(targetLeaveTypeId) as any;
      
      if (leaveType.code === 'EL') {
        const alType = db.prepare('SELECT id FROM leave_types WHERE code = "AL"').get() as any;
        targetLeaveTypeId = alType.id;
      }

      if (leaveType.code !== 'Unpaid Leave') {
        db.prepare(`
          UPDATE leave_balances 
          SET used_days = used_days + ? 
          WHERE user_id = ? AND leave_type_id = ? AND year = ?
        `).run(app.days, app.user_id, targetLeaveTypeId, currentYear);
      }
    }

    res.json({ success: true });
  });

  // --- Admin/HR Routes ---
  app.get('/api/admin/users', authenticate, (req: any, res) => {
    if (!['HR', 'SuperAdmin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const users = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.department, u.is_active, c.name as country_name, m.name as manager_name
      FROM users u
      LEFT JOIN countries c ON u.country_id = c.id
      LEFT JOIN users m ON u.manager_id = m.id
    `).all();
    res.json(users);
  });

  // --- Blackout Dates Routes ---
  app.get('/api/admin/blackout-dates', authenticate, (req: any, res) => {
    const dates = db.prepare(`
      SELECT b.*, c.name as country_name 
      FROM blackout_dates b
      LEFT JOIN countries c ON b.country_id = c.id
      ORDER BY b.start_date DESC
    `).all();
    res.json(dates);
  });

  app.post('/api/admin/blackout-dates', authenticate, (req: any, res) => {
    if (!['HR', 'SuperAdmin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const { country_id, start_date, end_date, reason } = req.body;
    
    if (!start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const insert = db.prepare(`
      INSERT INTO blackout_dates (country_id, start_date, end_date, reason)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insert.run(country_id || null, start_date, end_date, reason);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.delete('/api/admin/blackout-dates/:id', authenticate, (req: any, res) => {
    if (!['HR', 'SuperAdmin'].includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    const { id } = req.params;
    db.prepare('DELETE FROM blackout_dates WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.get('/api/countries', authenticate, (req, res) => {
    const countries = db.prepare('SELECT * FROM countries').all();
    res.json(countries);
  });
}
