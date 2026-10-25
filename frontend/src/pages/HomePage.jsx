import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchDepartments, fetchDoctors } from '../services/api';
import DoctorCard from '../components/DoctorCard';

export default function HomePage() {
  const [departments, setDepartments] = useState([]);
  const [featuredDoctors, setFeaturedDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      try {
        const [depts, docs] = await Promise.all([
          fetchDepartments(),
          fetchDoctors()
        ]);
        setDepartments(depts);
        setFeaturedDoctors(docs.slice(0, 3)); // show top 3 doctors
      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  return (
    <div className="container page-content">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>🩺</span>
              <span>Next-Gen Clinic Scheduling</span>
            </div>
            <h1 className="hero-title">
              Instant Doctor Appointments & Live Clinic Tokens
            </h1>
            <p className="hero-subtitle">
              Book specialist consultations in seconds. Select real-time dynamic slots,
              avoid crowded waiting rooms, and receive your verified clinic token instantly.
            </p>
            <div className="hero-actions">
              <Link to="/book" className="btn btn-lg hero-btn-white">
                Book Appointment Now ➔
              </Link>
              <Link to="/doctors" className="btn btn-lg hero-btn-ghost">
                Browse Doctors
              </Link>
              <Link to="/my-appointments" className="btn btn-lg hero-btn-ghost">
                Track My Token 🔍
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="features-grid">
        <div className="feature-card">
          <div className="feature-icon-box">🎟️</div>
          <h3>Guaranteed Tokens</h3>
          <p>Every booking generates an official, sequential clinic token number for streamlined OPD queue flow.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-box">⏱️</div>
          <h3>Dynamic Slot Generation</h3>
          <p>Real-time slot engine generates valid slots from doctor schedules and locks slots against double-booking.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-box">🖨️</div>
          <h3>Printable Slip</h3>
          <p>Download or print your appointment pass with doctor details, consultation fee, and clinic instructions.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-box">🛡️</div>
          <h3>Easy Self-Service Lookup</h3>
          <p>Search your bookings anytime using your registered phone or email, and cancel eligible visits safely.</p>
        </div>
      </section>

      {/* Departments Section */}
      <section style={{ marginBottom: '4rem' }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Clinical Specializations</h2>
            <p className="section-subtitle">Comprehensive medical disciplines staffed by board-certified specialists</p>
          </div>
          <Link to="/doctors" className="btn btn-outline btn-sm">
            View All Specialists ➔
          </Link>
        </div>

        {loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Loading departments...</p>
          </div>
        ) : (
          <div className="dept-grid">
            {departments.map((dept) => (
              <div key={dept.id} className="dept-card">
                <div className="dept-card-top">
                  <h3 className="dept-title">{dept.name}</h3>
                  <p className="dept-desc">{dept.description}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {dept.doctors_count} Active {dept.doctors_count === 1 ? 'Doctor' : 'Doctors'}
                  </span>
                  <Link to={`/doctors?department=${dept.id}`} className="btn btn-outline btn-sm">
                    View Doctors
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Featured Doctors Section */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">Meet Our Leading Physicians</h2>
            <p className="section-subtitle">Dedicated healthcare experts available for OPD consultation</p>
          </div>
          <Link to="/doctors" className="btn btn-primary btn-sm">
            Explore All Doctors ➔
          </Link>
        </div>

        {loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Loading doctors...</p>
          </div>
        ) : (
          <div className="doctors-grid">
            {featuredDoctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
