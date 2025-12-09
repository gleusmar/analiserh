import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RoleRoute from './components/RoleRoute.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'

import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import AcceptInvite from './pages/AcceptInvite.jsx'
import Users from './pages/Users.jsx'
import Settings from './pages/Settings.jsx'
import Collaborators from './pages/Collaborators.jsx'
import Functions from './pages/Functions.jsx'
import Shifts from './pages/Shifts.jsx'
import ShiftFunctions from './pages/ShiftFunctions.jsx'
import ShiftsDashboard from './pages/ShiftsDashboard.jsx'
import Payroll from './pages/Payroll.jsx'
import PayrollEntries from './pages/PayrollEntries.jsx'
import Logs from './pages/Logs.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <Users />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/collaborators"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <Collaborators />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/functions"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <Functions />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shifts"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super", "gestor-plantoes", "user"]}>
              <DashboardLayout>
                <Shifts />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shifts/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super", "gestor-plantoes"]}>
              <DashboardLayout>
                <ShiftsDashboard />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/payroll"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super", "gestor-plantoes", "user"]}>
              <DashboardLayout>
                <Payroll />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings/payroll-entries"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <PayrollEntries />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/logs"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <Logs />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/shift-functions"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "super"]}>
              <DashboardLayout>
                <ShiftFunctions />
              </DashboardLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
