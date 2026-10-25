import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchAdminAppointments,
  fetchDepartments,
  fetchDoctors,
  updateAppointmentStatus,
  issueAppointmentAccessCode
} from '../services/api';
import { useAuth } from '../context/useAuth';
import AppointmentStatusBadge from '../components/AppointmentStatusBadge';
import Alert from '../components/Alert';
import Modal from '../components/Modal';

export default function AdminAppointmentManagementPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState(null);

  // Filters
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [accessCodeAppointment, setAccessCodeAppointment] = useState(null);
  const [issuedAccessCode, setIssuedAccessCode] = useState('');
  const [legacyCodeEmailSent, setLegacyCodeEmailSent] = useState(false);
  const [issuingAccessCode, setIssuingAccessCode] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Initial metadata load
  useEffect(() => {
    async function loadMeta() {
      try {
        const [deptsData, docsData] = await Promise.all([
          fetchDepartments(),
          fetchDoctors()
        ]);
        setDepartments(deptsData);
        setDoctors(docsData);
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    if (isAuthenticated) {
      loadMeta();
    }
  }, [isAuthenticated]);

  // Load appointments with filters
  const loadAppointments = useCallback(async () => {
    try {
      const data = await fetchAdminAppointments({
        doctor_id: selectedDoctor,
        department_id: selectedDept,
        date: selectedDate,
        status: selectedStatus,
        search: appliedSearchTerm
      });
      setAppointments(data);
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to fetch appointments.' });
    } finally {
      setLoading(false);
    }
  }, [appliedSearchTerm, selectedDate, selectedDept, selectedDoctor, selectedStatus]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let isMounted = true;
    fetchAdminAppointments({
      doctor_id: selectedDoctor,
      department_id: selectedDept,
      date: selectedDate,
      status: selectedStatus,
      search: appliedSearchTerm
    })
      .then((data) => {
        if (isMounted) setAppointments(data);
      })
      .catch((err) => {
        if (isMounted) {
          setAlertInfo({ type: 'error', message: err.message || 'Failed to fetch appointments.' });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, appliedSearchTerm, selectedDate, selectedDept, selectedDoctor, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setAppliedSearchTerm(searchTerm);
  };

  const handleStatusChange = async (appointmentId, currentStatus, newStatus) => {
    if (currentStatus === newStatus) return;

    if (currentStatus === 'Completed') {
      setAlertInfo({
        type: 'warning',
        message: 'Invalid Transition: A completed consultation cannot be set back to Confirmed or Cancelled.'
      });
      return;
    }

    if (currentStatus === 'Cancelled' && newStatus === 'Completed') {
      setAlertInfo({
        type: 'warning',
        message: 'Invalid Transition: A cancelled appointment cannot be marked as Completed.'
      });
      return;
    }

    try {
      await updateAppointmentStatus(appointmentId, newStatus);
      setAlertInfo({
        type: 'success',
        message: `Appointment #${appointmentId} successfully changed to ${newStatus}.`
      });
      setLoading(true);
      loadAppointments();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Status transition rejected.' });
    }
  };

  const handleIssueAccessCode = async (appointment) => {
    const rotate = appointment.has_patient_access_code;
    if (rotate && !window.confirm(
      `Issue a new access code for appointment #${appointment.id}? The patient's current code will stop working.`
    )) {
      return;
    }
    setIssuingAccessCode(true);
    try {
      const result = await issueAppointmentAccessCode(appointment.id, rotate);
      setAccessCodeAppointment(appointment);
      setIssuedAccessCode(result.access_token);
      setLegacyCodeEmailSent(result.email_sent);
      setAppointments((current) => current.map((item) => (
        item.id === appointment.id ? { ...item, has_patient_access_code: true } : item
      )));
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to issue appointment access code.' });
    } finally {
      setIssuingAccessCode(false);
    }
  };

  const handleResetFilters = () => {
    setLoading(true);
    setSelectedDoctor('');
    setSelectedDept('');
    setSelectedDate('');
    setSelectedStatus('');
    setSearchTerm('');
    setAppliedSearchTerm('');
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
      <div className="admin-header-bar">
        <div>
          <h1 className="section-title">All Clinic Appointments & Queue Registry</h1>
          <p className="section-subtitle">
            Search, filter, monitor tokens, and update status with transition safety.
          </p>
        </div>

        <button onClick={() => {
          setLoading(true);
          loadAppointments();
        }} className="btn btn-secondary btn-sm">
          ↻ Refresh List
        </button>
      </div>

      {alertInfo && (
        <Alert type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo(null)} />
      )}

      {/* Tabs */}
      <div className="admin-nav-tabs">
        <Link to="/admin/dashboard" className="admin-tab">Overview & Today</Link>
        <Link to="/admin/appointments" className="admin-tab active">All Appointments</Link>
        <Link to="/admin/doctors" className="admin-tab">Doctors Management</Link>
      </div>

      {/* Filter Bar */}
      <div className="filter-toolbar">
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, gap: '0.75rem', minWidth: '240px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search patient, phone, email, doctor, token..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Search
          </button>
        </form>

        <div className="filter-select-wrap">
          <select
            className="form-select"
            value={selectedDept}
            onChange={(e) => {
              setLoading(true);
              setSelectedDept(e.target.value);
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-select-wrap">
          <select
            className="form-select"
            value={selectedDoctor}
            onChange={(e) => {
              setLoading(true);
              setSelectedDoctor(e.target.value);
            }}
          >
            <option value="">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>Dr. {doc.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-select-wrap" style={{ minWidth: '150px' }}>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => {
              setLoading(true);
              setSelectedDate(e.target.value);
            }}
            title="Filter by appointment date"
          />
        </div>

        <div className="filter-select-wrap">
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => {
              setLoading(true);
              setSelectedStatus(e.target.value);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {(selectedDoctor || selectedDept || selectedDate || selectedStatus || searchTerm) && (
          <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
            Reset ✕
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Filtering and fetching appointments registry...</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Showing <strong>{appointments.length}</strong> matching appointment records
          </div>

          {appointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">No Appointments Match Filters</h3>
              <p className="empty-state-desc">
                Try widening your search criteria or resetting filters.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Date & Time</th>
                    <th>Patient Name & Phone</th>
                    <th>Doctor & Department</th>
                    <th>Reason</th>
                    <th>Current Status</th>
                    <th>Update Status</th>
                    <th>Patient Access</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>
                          #{String(appt.token_number).padStart(2, '0')}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID #{appt.id}
                        </div>
                      </td>
                      <td>
                        <strong>{appt.appointment_date}</strong>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {formatTime(appt.appointment_time)}
                        </div>
                      </td>
                      <td>
                        <strong>{appt.patient?.full_name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {appt.patient?.phone} <br />
                          {appt.patient?.email}
                        </div>
                      </td>
                      <td>
                        <strong>Dr. {appt.doctor_name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                          {appt.doctor_specialization}
                        </div>
                        <span className="doctor-dept-badge">{appt.department_name}</span>
                      </td>
                      <td style={{ maxWidth: '200px', fontSize: '0.85rem' }}>
                        {appt.reason}
                      </td>
                      <td>
                        <AppointmentStatusBadge status={appt.status} />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                          value={appt.status}
                          disabled={appt.status === 'Completed'}
                          onChange={(e) => handleStatusChange(appt.id, appt.status, e.target.value)}
                        >
                          <option value="Confirmed">Confirmed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        {appt.has_patient_access_code ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleIssueAccessCode(appt)}
                            disabled={issuingAccessCode}
                            title="Rotate and email a new code if the patient lost the previous one"
                          >
                            Reissue code
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleIssueAccessCode(appt)}
                            disabled={issuingAccessCode}
                            title="Issue a one-time access code for a legacy appointment"
                          >
                            {issuingAccessCode ? 'Issuing...' : 'Issue code'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(issuedAccessCode)}
        title="One-time patient access code"
        onClose={() => {
          setIssuedAccessCode('');
          setAccessCodeAppointment(null);
          setLegacyCodeEmailSent(false);
        }}
      >
        <p>
          This code is for appointment #{accessCodeAppointment?.id} ({accessCodeAppointment?.patient?.email}).
          {legacyCodeEmailSent
            ? ' The code was emailed to the address on file.'
            : ' Email delivery failed; verify the patient’s identity before sharing the code through another channel.'}
          {' '}The code is shown only once.
        </p>
        {!legacyCodeEmailSent && <p>Copy the code below and deliver it only through a verified contact channel.</p>}
        <code style={{ display: 'block', marginTop: '1rem', overflowWrap: 'anywhere', userSelect: 'all' }}>
          {issuedAccessCode}
        </code>
      </Modal>
    </div>
  );
}
