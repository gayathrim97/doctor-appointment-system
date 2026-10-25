import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="navbar" aria-label="Main Navigation">
      <div className="container navbar-container">
        <Link to="/" className="brand-logo" onClick={closeMenu}>
          <div className="brand-icon">✚</div>
          <span>MediCare Clinic</span>
          <span className="brand-badge">Rx</span>
        </Link>

        <button 
          className="mobile-menu-btn"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>

        <ul className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <li>
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/doctors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              Doctors
            </NavLink>
          </li>
          <li>
            <NavLink to="/book" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              Book Appointment
            </NavLink>
          </li>
          <li>
            <NavLink to="/my-appointments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
              My Appointments
            </NavLink>
          </li>

          {isAuthenticated ? (
            <>
              <li>
                <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                  Admin Portal
                </NavLink>
              </li>
              <li>
                <button onClick={handleLogout} className="btn btn-outline btn-sm">
                  Logout ({user?.username})
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link to="/admin/login" className="btn btn-primary btn-sm nav-admin-btn" onClick={closeMenu}>
                Staff Login 🔒
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
