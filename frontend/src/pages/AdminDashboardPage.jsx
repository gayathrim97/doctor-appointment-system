import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminDashboard, updateAppointmentStatus } from '../services/api';
import { useAuth } from '../context/useAuth';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import Alert from '../components/Alert';

export default function AdminDashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const loadDashboard = async () => {
    try {
      const data = await fetchAdminDashboard();
      setDashboardData(data);
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to load clinic dashboard metrics.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let isMounted = true;
    fetchAdminDashboard()
      .then((data) => {
        if (isMounted) setDashboardData(data);
      })
      .catch((err) => {
        if (isMounted) {
          setAlertInfo({ type: 'error', message: err.message || 'Failed to load clinic dashboard metrics.' });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const handleQuickStatusChange = async (appointmentId, newStatus) => {
    try {
      await updateAppointmentStatus(appointmentId, newStatus);
      setAlertInfo({
        type: 'success',
        message: `Appointment #${appointmentId} status updated to ${newStatus}.`
      });
      setLoading(true);
      loadDashboard();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to update status.' });
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

  if (authLoading || loading) {
    return (
      <div className="container page-content">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading clinic operations dashboard...</p>
        </div>
      </div>
    );
  }

  const { stats, today_schedule, today_date } = dashboardData || {};

  return (
    <div className="container page-content">
      {/* Header bar */}
      <div className="admin-header-bar">
        <div>
          <h1 className="section-title">Clinic Administration Portal</h1>
          <p className="section-subtitle">
            OPD operations overview for <strong>{today_date}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/admin/appointments" className="btn btn-primary btn-sm">
            Manage All Appointments ➔
          </Link>
          <Link to="/admin/doctors" className="btn btn-secondary btn-sm">
            Manage Doctors & Departments ➔
          </Link>
        </div>
      </div>

      {alertInfo && (
        <Alert type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo(null)} />
      )}

      {/* Navigation Tabs */}
      <div className="admin-nav-tabs">
        <Link to="/admin/dashboard" className="admin-tab active">Overview & Today</Link>
        <Link to="/admin/appointments" className="admin-tab">All Appointments</Link>
        <Link to="/admin/doctors" className="admin-tab">Doctors Management</Link>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card-title">Total Doctors</span>
          <div className="stat-card-val" style={{ color: 'var(--primary)' }}>
            {stats?.total_doctors || 0}
          </div>
          <span className="stat-card-sub">{stats?.active_doctors || 0} currently active</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Total Appointments</span>
          <div className="stat-card-val">{stats?.total_appointments || 0}</div>
          <span className="stat-card-sub">All time clinic registrations</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Confirmed Visits</span>
          <div className="stat-card-val" style={{ color: '#059669' }}>
            {stats?.confirmed_appointments || 0}
          </div>
          <span className="stat-card-sub">Upcoming & in-queue</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Completed Consultations</span>
          <div className="stat-card-val" style={{ color: '#2563eb' }}>
            {stats?.completed_appointments || 0}
          </div>
          <span className="stat-card-sub">Successfully consulted</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-title">Cancelled Visits</span>
          <div className="stat-card-val" style={{ color: '#e11d48' }}>
            {stats?.cancelled_appointments || 0}
          </div>
          <span className="stat-card-sub">Released slots</span>
        </div>
      </div>

      {/* Today's Schedule Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>Today's OPD Consultation Schedule</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Live queue sequence and token assignments for today ({today_schedule?.length || 0} bookings)
            </p>
          </div>
          <button onClick={loadDashboard} className="btn btn-secondary btn-sm">
            ↻ Refresh Queue
          </button>
        </div>

        {!today_schedule || today_schedule.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p className="empty-state-desc">No appointments scheduled for today yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Time Slot</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {today_schedule.map((appt) => (
                  <tr key={appt.id}>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>
                        #{String(appt.token_number).padStart(2, '0')}
                      </span>
                    </td>
                    <td>
                      <strong>{appt.patient?.full_name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {appt.patient?.phone}
                      </div>
                    </td>
                    <td>
                      <strong>Dr. {appt.doctor_name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                        {appt.doctor_specialization}
                      </div>
                    </td>
                    <td>
                      <strong>{formatTime(appt.appointment_time)}</strong>
                    </td>
                    <td style={{ maxWidth: '240px', fontSize: '0.85rem' }}>
                      {appt.reason}
                    </td>
                    <td>
                      <AppointmentStatusBadge status={appt.status} />
                    </td>
                    <td>
                      {appt.status === 'Confirmed' ? (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleQuickStatusChange(appt.id, 'Completed')}
                            className="btn btn-outline btn-sm"
                            title="Mark Completed"
                          >
                            ✓ Complete
                          </button>
                          <button
                            onClick={() => handleQuickStatusChange(appt.id, 'Cancelled')}
                            className="btn btn-danger btn-sm"
                            title="Cancel Appointment"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Finalized
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
