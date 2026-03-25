import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'database.sqlite');
export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      timezone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Employee', 'Approver', 'HR', 'SuperAdmin')),
      country_id INTEGER,
      manager_id INTEGER,
      department TEXT,
      join_date TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (country_id) REFERENCES countries(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      requires_attachment INTEGER DEFAULT 0,
      is_paid INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS leave_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      default_days REAL NOT NULL,
      carry_forward_limit REAL DEFAULT 0,
      FOREIGN KEY (country_id) REFERENCES countries(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    );

    CREATE TABLE IF NOT EXISTS public_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (country_id) REFERENCES countries(id)
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_days REAL NOT NULL,
      used_days REAL DEFAULT 0,
      carried_forward REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      UNIQUE(user_id, leave_type_id, year)
    );

    CREATE TABLE IF NOT EXISTS leave_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL NOT NULL,
      reason TEXT,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
      applied_at TEXT NOT NULL,
      attachment_url TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
    );

    CREATE TABLE IF NOT EXISTS approval_workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_application_id INTEGER NOT NULL,
      approver_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Approved', 'Rejected')),
      comments TEXT,
      action_at TEXT,
      level INTEGER NOT NULL,
      FOREIGN KEY (leave_application_id) REFERENCES leave_applications(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS blackout_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (country_id) REFERENCES countries(id)
    );
  `);

  // Seed initial data if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (count.count === 0) {
    seedData();
  }
}

function seedData() {
  const insertCountry = db.prepare('INSERT INTO countries (name, code, timezone) VALUES (?, ?, ?)');
  const myId = insertCountry.run('Malaysia', 'MY', 'Asia/Kuala_Lumpur').lastInsertRowid;
  const sgId = insertCountry.run('Singapore', 'SG', 'Asia/Singapore').lastInsertRowid;

  const insertLeaveType = db.prepare('INSERT INTO leave_types (name, code, requires_attachment, is_paid) VALUES (?, ?, ?, ?)');
  const alId = insertLeaveType.run('Annual Leave', 'AL', 0, 1).lastInsertRowid;
  const mcId = insertLeaveType.run('Medical Leave', 'MC', 1, 1).lastInsertRowid;
  const elId = insertLeaveType.run('Emergency Leave', 'EL', 0, 1).lastInsertRowid;

  const insertPolicy = db.prepare('INSERT INTO leave_policies (country_id, leave_type_id, default_days, carry_forward_limit) VALUES (?, ?, ?, ?)');
  insertPolicy.run(myId, alId, 14, 5);
  insertPolicy.run(myId, mcId, 14, 0);
  insertPolicy.run(myId, elId, 0, 0); // EL deducts from AL

  const insertUser = db.prepare('INSERT INTO users (email, password, name, role, country_id, department, join_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
  // Password is 'password' (in a real app, hash this!)
  const superAdminId = insertUser.run('admin@company.com', 'password', 'Super Admin', 'SuperAdmin', myId, 'Management', '2020-01-01').lastInsertRowid;
  const hrId = insertUser.run('hr@company.com', 'password', 'HR Manager', 'HR', myId, 'HR', '2021-01-01').lastInsertRowid;
  const managerId = insertUser.run('manager@company.com', 'password', 'Tech Manager', 'Approver', myId, 'Engineering', '2021-06-01').lastInsertRowid;
  
  const insertEmp = db.prepare('INSERT INTO users (email, password, name, role, country_id, manager_id, department, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const emp1Id = insertEmp.run('employee1@company.com', 'password', 'John Doe', 'Employee', myId, managerId, 'Engineering', '2023-01-01').lastInsertRowid;
  const emp2Id = insertEmp.run('employee2@company.com', 'password', 'Jane Smith', 'Employee', sgId, managerId, 'Engineering', '2023-05-01').lastInsertRowid;

  const insertBalance = db.prepare('INSERT INTO leave_balances (user_id, leave_type_id, year, total_days) VALUES (?, ?, ?, ?)');
  const currentYear = new Date().getFullYear();
  insertBalance.run(emp1Id, alId, currentYear, 14);
  insertBalance.run(emp1Id, mcId, currentYear, 14);
  insertBalance.run(emp2Id, alId, currentYear, 14);
  insertBalance.run(emp2Id, mcId, currentYear, 14);
}
