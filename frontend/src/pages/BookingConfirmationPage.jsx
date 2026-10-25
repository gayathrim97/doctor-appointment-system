import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { fetchAppointmentById } from '../services/api';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import Alert from '../components/Alert';

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const accessToken = location.state?.appointmentAccessToken
    || sessionStorage.getItem(`appointment-access-${id}`);

  const [appointment, setAppointment] = useState(location.state?.appointment || null);
  const [loading, setLoading] = useState(!location.state?.appointment);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appointment && id) {
      async function loadAppointment() {
        if (!accessToken) {
          setError('Enter the appointment access code from your booking confirmation on My Appointments to view this slip.');
          setLoading(false);
          return;
        }
        try {
          const data = await fetchAppointmentById(id, accessToken);
          setAppointment(data);
        } catch (err) {
          setError(err.message || 'Unable to retrieve appointment confirmation.');
        } finally {
          setLoading(false);
        }
      }
      loadAppointment();
    }
  }, [id, appointment, accessToken]);

  const handlePrint = () => {
    window.print();
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="container page-content">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Retrieving appointment token and details...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="container page-content">
        <Alert type="error" message={error || 'Appointment record not found.'} />
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/book" className="btn btn-primary">Book an Appointment</Link>
          <Link to="/my-appointments" className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
            Look Up Existing Appointments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <div className="no-print" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#ecfdf5', color: '#065f46', padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          ✓ Booking Successfully Confirmed
        </div>
        <h1 className="section-title">Official Clinic Token Slip</h1>
        <p className="section-subtitle">
          Please present this token number or printed slip at the clinic reception upon arrival.
        </p>
      </div>

      <div className="no-print" style={{ maxWidth: '720px', margin: '0 auto 1.5rem', padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-muted)' }}>
        <strong>Private appointment access code</strong>
        <p style={{ margin: '0.4rem 0', color: 'var(--text-secondary)' }}>
          Keep this code private. You need it with your registered email or phone number to look up, view, or cancel this appointment.
        </p>
        <code style={{ display: 'block', overflowWrap: 'anywhere', userSelect: 'all' }}>{accessToken}</code>
      </div>
      {appointment.email_sent === false && (
        <div className="no-print" style={{ maxWidth: '720px', margin: '0 auto 1.5rem' }}>
          <Alert
            type="warning"
            message="Your booking is confirmed, but the confirmation email could not be sent. Save the access code above; you can still use it to manage this appointment."
          />
        </div>
      )}

      {/* Printable Token Pass Card */}
      <div className="token-pass-card">
        <div className="token-pass-header">
          <div>
            <h3>MediCare Clinic & Diagnostics</h3>
            <p>Outpatient Department (OPD) Consultation Slip</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Appointment Ref:</span>
            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>#{appointment.id}</div>
          </div>
        </div>

        {/* Hero Token Box */}
        <div className="token-hero-box">
          <div className="token-label">Your Clinic Queue Token</div>
          <div className="token-huge-number">
            #{String(appointment.token_number).padStart(2, '0')}
          </div>
          <div className="token-subtext">
            Guaranteed consultation queue sequence for Dr. {appointment.doctor_name}
          </div>
        </div>

        {/* Details Grid */}
        <div className="token-details-grid">
          <div className="token-detail-row">
            <span className="token-detail-label">Patient Name</span>
            <span className="token-detail-value">{appointment.patient?.full_name}</span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Phone & Email</span>
            <span className="token-detail-value">
              {appointment.patient?.phone} <br />
              <small style={{ color: 'var(--text-muted)' }}>{appointment.patient?.email}</small>
            </span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Physician / Specialist</span>
            <span className="token-detail-value">
              Dr. {appointment.doctor_name} <br />
              <small style={{ color: 'var(--primary)' }}>{appointment.doctor_specialization}</small>
            </span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Department</span>
            <span className="token-detail-value">{appointment.department_name}</span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Appointment Date</span>
            <span className="token-detail-value" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              📅 {appointment.appointment_date}
            </span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Time Slot</span>
            <span className="token-detail-value" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              ⏰ {formatTime(appointment.appointment_time)}
            </span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Consultation Fee</span>
            <span className="token-detail-value" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
              ${parseFloat(appointment.consultation_fee).toFixed(2)}
            </span>
          </div>

          <div className="token-detail-row">
            <span className="token-detail-label">Status</span>
            <div>
              <AppointmentStatusBadge status={appointment.status} />
            </div>
          </div>

          <div className="token-detail-row" style={{ gridColumn: 'span 2' }}>
            <span className="token-detail-label">Reason for Consultation</span>
            <span className="token-detail-value" style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
              {appointment.reason}
            </span>
          </div>
        </div>

        <div className="token-pass-footer">
          <div>
            🏥 <strong>MediCare Outpatient Clinic</strong> • Room 204, 2nd Floor
          </div>
          <div>
            Issued: {new Date(appointment.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
        <button onClick={handlePrint} className="btn btn-primary btn-lg">
          🖨️ Print Appointment Slip
        </button>
        <Link to="/my-appointments" className="btn btn-secondary btn-lg">
          View in My Appointments ➔
        </Link>
        <Link to="/book" className="btn btn-outline btn-lg">
          + Book Another Appointment
        </Link>
      </div>
    </div>
  );
}
