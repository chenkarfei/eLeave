/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ApplyLeave } from './pages/ApplyLeave';
import { MyLeaves } from './pages/MyLeaves';
import { Approvals } from './pages/Approvals';
import { AdminUsers } from './pages/AdminUsers';
import { AdminBlackoutDates } from './pages/AdminBlackoutDates';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="apply" element={<ApplyLeave />} />
        <Route path="my-leaves" element={<MyLeaves />} />
        <Route path="approvals" element={<ProtectedRoute allowedRoles={['Approver', 'HR', 'SuperAdmin']}><Approvals /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute allowedRoles={['HR', 'SuperAdmin']}><AdminUsers /></ProtectedRoute>} />
        <Route path="admin/blackout-dates" element={<ProtectedRoute allowedRoles={['HR', 'SuperAdmin']}><AdminBlackoutDates /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

