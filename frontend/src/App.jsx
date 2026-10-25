import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import HomePage from './pages/HomePage';
import DoctorListingPage from './pages/DoctorListingPage';
import AppointmentBookingPage from './pages/AppointmentBookingPage';
import BookingConfirmationPage from './pages/BookingConfirmationPage';
import MyAppointmentsPage from './pages/MyAppointmentsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDoctorManagementPage from './pages/AdminDoctorManagementPage';
import AdminAppointmentManagementPage from './pages/AdminAppointmentManagementPage';

// Styles
import './styles/index.css';
import './styles/components.css';
import './styles/pages.css';

function NotFoundPage() {
  return (
    <div className="container page-content">
      <div className="empty-state" style={{ maxWidth: '500px', margin: '3rem auto' }}>
        <div className="empty-state-icon">404</div>
        <h2 className="empty-state-title">Page Not Found</h2>
        <p className="empty-state-desc">
          The requested page does not exist or has been relocated.
        </p>
        <Link to="/" className="btn btn-primary">
          Return to Clinic Home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Patient facing routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/doctors" element={<DoctorListingPage />} />
              <Route path="/book" element={<AppointmentBookingPage />} />
              <Route path="/confirmation/:id" element={<BookingConfirmationPage />} />
              <Route path="/my-appointments" element={<MyAppointmentsPage />} />

              {/* Admin staff routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/doctors" element={<AdminDoctorManagementPage />} />
              <Route path="/admin/appointments" element={<AdminAppointmentManagementPage />} />

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
