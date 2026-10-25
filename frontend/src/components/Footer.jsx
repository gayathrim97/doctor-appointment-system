import React from 'react';
import { Link } from 'react-router-dom';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <span style={{ color: '#2dd4bf', fontSize: '1.4rem' }}>✚</span>
              <span>MediCare Clinic & Diagnostics</span>
            </div>
            <p className="footer-desc">
              Providing compassionate, high-quality patient care and streamlined online token scheduling.
              Consult top specialized physicians with zero queue uncertainty.
            </p>
          </div>

          <div className="footer-col">
            <h4>Quick Navigation</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/doctors">Find Doctors</Link></li>
              <li><Link to="/book">Book an Appointment</Link></li>
              <li><Link to="/my-appointments">Track Token / Status</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Clinic Hours & Help</h4>
            <ul>
              <li>Mon - Sat: 08:30 AM - 08:00 PM</li>
              <li>Sunday: Emergency Services</li>
              <li>Helpdesk: (555) 234-5678</li>
              <li>support@medicareclinic.com</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {CURRENT_YEAR} MediCare Clinic Appointment & Token Scheduling System. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
