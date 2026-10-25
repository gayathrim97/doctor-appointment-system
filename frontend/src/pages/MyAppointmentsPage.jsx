import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { lookupAppointments, cancelAppointment } from '../services/api';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import Modal from '../components/Modal';
import Alert from '../components/Alert';

export default function MyAppointmentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appointments, setAppointments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  // Cancellation Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setAlertInfo({ type: 'warning', message: 'Please enter your registered email address or phone number.' });
      return;
    }
    if (!accessToken.trim()) {
      setAlertInfo({ type: 'warning', message: 'Please enter the private appointment access code from your booking confirmation.' });
      return;
    }

    setLoading(true);
    setAlertInfo(null);
    try {
      const results = await lookupAppointments(searchQuery.trim(), accessToken.trim());
      setAppointments(results);
      if (results.length === 0) {
        setAlertInfo({
          type: 'info',
          message: `No appointment records found for "${searchQuery}". Please verify that you entered the exact email or phone number provided during booking.`
        });
      }
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to search appointments.' });
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (appointment) => {
    setAppointmentToCancel(appointment);
    setCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    setCancelModalOpen(false);
    setAppointmentToCancel(null);
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;

    setCancelling(true);
    try {
      await cancelAppointment(appointmentToCancel.id, accessToken.trim());
      setAlertInfo({
        type: 'success',
        message: `Appointment #${appointmentToCancel.id} with Dr. ${appointmentToCancel.doctor_name} has been successfully cancelled. Your slot has been released.`
      });
      // Refresh list
      const updated = await lookupAppointments(searchQuery.trim(), accessToken.trim());
      setAppointments(updated);
      closeCancelModal();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Unable to cancel appointment.' });
    } finally {
      setCancelling(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  return (
    <div className="container page-content">
      <div className="section-header" style={{ textAlign: 'center', display: 'block', marginBottom: '2.5rem' }}>
        <h1 className="section-title">My Appointments & Token Tracker</h1>
        <p className="section-subtitle">
          Search with your registered email or mobile number to track status, reprint token slips, or manage visits.
        </p>
      </div>

      {alertInfo && (
        <div style={{ maxWidth: '680px', margin: '0 auto 1.5rem' }}>
          <Alert type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo(null)} />
        </div>
      )}

      {/* Lookup Card */}
      <div className="lookup-box">
        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Find Your Appointments</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Enter the email or phone number you used when booking and the private access code shown on your confirmation slip.
        </p>

        <form onSubmit={handleSearch}>
          <div className="lookup-input-group">
            <input
              type="text"
              className="form-control"
              placeholder="e.g. gayatri@example.com or 9876543210"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              required
            />
            <input
              type="password"
              className="form-control"
              placeholder="Appointment access code"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              autoComplete="off"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: '150px' }}>
              {loading ? (
                <>
                  <span className="spinner spinner-sm"></span>
                  <span>Searching...</span>
                </>
              ) : (
                'Search Records 🔍'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Appointments List */}
      {appointments !== null && (
        <div className="appt-list">
          {appointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3 className="empty-state-title">No Appointments on Record</h3>
              <p className="empty-state-desc">
                We couldn't find any appointments linked to "{searchQuery}".
              </p>
              <Link to="/book" className="btn btn-primary">
                Book a New Appointment Now
              </Link>
            </div>
          ) : (
            appointments.map((appt) => (
              <div key={appt.id} className="appt-card">
                <div className="appt-token-bubble">
                  <div className="bubble-label">Token</div>
                  <div className="bubble-number">#{String(appt.token_number).padStart(2, '0')}</div>
                  <small style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>ID #{appt.id}</small>
                </div>

                <div className="appt-main-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <h3 style={{ fontSize: '1.15rem' }}>Dr. {appt.doctor_name}</h3>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.4rem' }}>
                    {appt.doctor_specialization} • {appt.department_name}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>📅 <strong>{appt.appointment_date}</strong></span>
                    <span>⏰ <strong>{formatTime(appt.appointment_time)}</strong></span>
                    <span>Fee: <strong>${parseFloat(appt.consultation_fee).toFixed(2)}</strong></span>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <strong>Patient:</strong> {appt.patient?.full_name} ({appt.patient?.phone})
                  </div>
                </div>

                <div className="appt-actions">
                  <Link
                    to={`/confirmation/${appt.id}`}
                    state={{ appointmentAccessToken: accessToken.trim() }}
                    onClick={() => sessionStorage.setItem(`appointment-access-${appt.id}`, accessToken.trim())}
                    className="btn btn-outline btn-sm"
                  >
                    🖨️ View Token Slip
                  </Link>

                  {appt.is_cancellable && (
                    <button
                      onClick={() => openCancelModal(appt)}
                      className="btn btn-danger btn-sm"
                    >
                      Cancel Visit
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirmation Modal for Cancellation */}
      <Modal
        isOpen={cancelModalOpen}
        title="Confirm Appointment Cancellation"
        onClose={closeCancelModal}
        footer={
          <>
            <button onClick={closeCancelModal} className="btn btn-secondary" disabled={cancelling}>
              Keep Appointment
            </button>
            <button onClick={handleConfirmCancel} className="btn btn-danger" disabled={cancelling}>
              {cancelling ? (
                <>
                  <span className="spinner spinner-sm"></span>
                  <span>Cancelling...</span>
                </>
              ) : (
                'Yes, Cancel Appointment'
              )}
            </button>
          </>
        }
      >
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Are you sure you want to cancel this appointment?
        </p>

        {appointmentToCancel && (
          <div style={{ background: 'var(--bg-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
            <div><strong>Token:</strong> #{appointmentToCancel.token_number}</div>
            <div><strong>Doctor:</strong> Dr. {appointmentToCancel.doctor_name} ({appointmentToCancel.doctor_specialization})</div>
            <div><strong>Date & Time:</strong> {appointmentToCancel.appointment_date} at {formatTime(appointmentToCancel.appointment_time)}</div>
          </div>
        )}

        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#e11d48' }}>
          ⚠️ This action releases your reserved slot back to the clinic queue. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
