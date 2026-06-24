import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Dashboard from './pages/Dashboard';
import Display from './pages/Display';
import Projection from './pages/Projection';
import Overlay from './pages/Overlay';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings';
import ToastContainer from './components/common/Toast';

// Protected Route — requires login
const ProtectedRoute = ({ children }) => {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Operator Dashboard */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Audience Display — no auth needed, opens in separate window */}
        <Route path="/display" element={<Display />} />

        {/* Legacy routes */}
        <Route path="/projection" element={<Projection />} />
        <Route path="/overlay" element={<Overlay />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
