import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchDepartments, fetchDoctors, fetchSlots, bookAppointment } from '../services/api';
import SlotSelector from '../components/SlotSelector';
import Alert from '../components/Alert';

function getLocalDateString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split('T')[0];
}

export default function AppointmentBookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Reference lists
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  // Selection state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(searchParams.get('doctor_id') || '');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [selectedSlotTime, setSelectedSlotTime] = useState('');
  const [selectedSlotFormatted, setSelectedSlotFormatted] = useState('');

  // Slots state
  const [slotsData, setSlotsData] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Patient form fields
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [reason, setReason] = useState('');

  // UI status
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Minimum date is today (YYYY-MM-DD)
  const todayStr = getLocalDateString();

  // Load initial departments and doctors
  useEffect(() => {
    async function init() {
      try {
        const [deptsData, docsData] = await Promise.all([
          fetchDepartments(),
          fetchDoctors()
        ]);
        setDepartments(deptsData);
        setDoctors(docsData);

        const initialDocId = searchParams.get('doctor_id');
        if (initialDocId) {
          const match = docsData.find(d => String(d.id) === String(initialDocId));
          if (match) {
            setSelectedDoctorId(match.id);
            setSelectedDeptId(match.department);
          }
        }
      } catch (err) {
        setErrorMessage(err.message || 'Failed to initialize booking data.');
      } finally {
        setPageLoading(false);
      }
    }
    init();
  }, [searchParams]);

  // When doctor or date changes, dynamically fetch slots
  useEffect(() => {
    if (!selectedDoctorId || !appointmentDate) {
      return;
    }

    let isMounted = true;
    async function loadSlots() {
      try {
        const data = await fetchSlots(selectedDoctorId, appointmentDate);
        if (isMounted) {
          setSlotsData(data);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load doctor slots.');
          setSlotsData(null);
        }
      } finally {
        if (isMounted) {
          setSlotsLoading(false);
        }
      }
    }

    loadSlots();
    return () => { isMounted = false; };
  }, [selectedDoctorId, appointmentDate]);

  // Filter doctors by selected department if chosen
  const filteredDoctors = selectedDeptId
    ? doctors.filter(d => String(d.department) === String(selectedDeptId))
    : doctors;

  // Selected doctor object for summary
  const currentDoctor = doctors.find(d => String(d.id) === String(selectedDoctorId));

  const handleDepartmentChange = (e) => {
    const deptId = e.target.value;
    setSelectedDeptId(deptId);
    // If selected doctor doesn't belong to this department, reset doctor
    if (deptId && currentDoctor && String(currentDoctor.department) !== String(deptId)) {
      setSelectedDoctorId('');
      setSelectedSlotTime('');
      setSelectedSlotFormatted('');
      setSlotsData(null);
      setSlotsLoading(false);
    }
  };

  const handleDoctorChange = (e) => {
    const docId = e.target.value;
    setSelectedDoctorId(docId);
    setSelectedSlotTime('');
    setSelectedSlotFormatted('');
    setSlotsData(null);
    setErrorMessage(null);
    setSlotsLoading(Boolean(docId && appointmentDate));
    if (docId) {
      const doc = doctors.find(d => String(d.id) === String(docId));
      if (doc) {
        setSelectedDeptId(doc.department);
      }
    }
  };

  const handleDateChange = (e) => {
    setAppointmentDate(e.target.value);
    setSelectedSlotTime('');
    setSelectedSlotFormatted('');
    setSlotsData(null);
    setErrorMessage(null);
    setSlotsLoading(Boolean(selectedDoctorId && e.target.value));
  };

  const handleSlotSelect = (time, formatted) => {
    setSelectedSlotTime(time);
    setSelectedSlotFormatted(formatted);
    // Clear any slot selection error
    if (formErrors.slot) {
      setFormErrors(prev => ({ ...prev, slot: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!selectedDoctorId) errors.doctor = 'Please select a doctor.';
    if (!appointmentDate) errors.date = 'Please select an appointment date.';
    if (!selectedSlotTime) errors.slot = 'Please choose an available appointment time slot.';
    if (!patientName.trim()) errors.name = 'Patient full name is required.';
    if (!patientPhone.trim()) {
      errors.phone = 'Phone number is required.';
    } else {
      const digits = patientPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        errors.phone = 'Please enter a valid phone number (7-15 digits).';
      }
    }
    if (!patientEmail.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(patientEmail)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!reason.trim()) {
      errors.reason = 'Please briefly describe the reason for your appointment.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        doctor_id: parseInt(selectedDoctorId, 10),
        appointment_date: appointmentDate,
        appointment_time: selectedSlotTime,
        patient_name: patientName.trim(),
        patient_phone: patientPhone.trim(),
        patient_email: patientEmail.trim(),
        reason: reason.trim(),
      };

      const result = await bookAppointment(payload);
      sessionStorage.setItem(`appointment-access-${result.id}`, result.access_token);
      // Navigate to confirmation page with appointment details
      navigate(`/confirmation/${result.id}`, {
        state: { appointment: result, appointmentAccessToken: result.access_token }
      });
    } catch (err) {
      if (err.status === 409) {
        setErrorMessage('⚠️ Slot Conflict: This appointment slot was just booked by another patient. Please choose an alternate slot.');
        // Refresh slots immediately
        if (selectedDoctorId && appointmentDate) {
          try {
            const fresh = await fetchSlots(selectedDoctorId, appointmentDate);
            setSlotsData(fresh);
            setSelectedSlotTime('');
            setSelectedSlotFormatted('');
          } catch (slotErr) {
            setErrorMessage(
              `This slot was booked by another patient, and the latest schedule could not be loaded: ${slotErr.message}`
            );
          }
        }
      } else {
        setErrorMessage(err.message || 'Failed to complete appointment booking.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="container page-content">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Preparing appointment scheduler...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-content">
      <div className="section-header">
        <div>
          <h1 className="section-title">Schedule an Appointment</h1>
          <p className="section-subtitle">
            Select a specialist, choose a date & time slot, and receive your clinic token instantly.
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert 
          type={errorMessage.includes('⚠️') ? 'warning' : 'error'} 
          message={errorMessage} 
          onClose={() => setErrorMessage(null)} 
        />
      )}

      <form onSubmit={handleSubmitBooking}>
        <div className="booking-layout">
          {/* Summary / Doctor Info Column */}
          <div>
            <div className="booking-summary-card">
              <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                Booking Summary
              </h3>

              {currentDoctor ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="doctor-avatar" style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}>
                      🩺
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        Dr. {currentDoctor.name.replace(/^Dr\.\s*/i, '')}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {currentDoctor.specialization}
                      </div>
                      <span className="doctor-dept-badge">{currentDoctor.department_name}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                    <div>
                      <span className="meta-item-label">Consultation Fee</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '1.15rem' }}>
                        ${parseFloat(currentDoctor.consultation_fee).toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="meta-item-label">Working Hours</span>
                      <strong>{currentDoctor.start_time} - {currentDoctor.end_time}</strong>
                    </div>
                    <div>
                      <span className="meta-item-label">Available Days</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{currentDoctor.available_days}</span>
                    </div>
                  </div>

                  {appointmentDate && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-light)' }}>
                      <span className="meta-item-label">Selected Date</span>
                      <strong style={{ color: 'var(--text-main)' }}>{appointmentDate}</strong>
                    </div>
                  )}

                  {selectedSlotFormatted && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className="meta-item-label">Selected Time</span>
                      <strong style={{ color: 'var(--primary)' }}>{selectedSlotFormatted}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  Please select a physician to see consultation schedule and fees.
                </div>
              )}
            </div>
          </div>

          {/* Booking Steps Column */}
          <div>
            {/* Step 1: Doctor and Date */}
            <div className="booking-step-box">
              <div className="step-header">
                <span className="step-num">1</span>
                <div>
                  <h3>Select Physician & Appointment Date</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Filter by specialty or choose your preferred doctor directly
                  </p>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">
                    Department / Specialty
                  </label>
                  <select 
                    className="form-select" 
                    value={selectedDeptId} 
                    onChange={handleDepartmentChange}
                  >
                    <option value="">All Clinical Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Doctor <span className="required">*</span>
                  </label>
                  <select 
                    className="form-select" 
                    value={selectedDoctorId} 
                    onChange={handleDoctorChange}
                    required
                  >
                    <option value="">-- Choose a Doctor --</option>
                    {filteredDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.name} ({doc.specialization})
                      </option>
                    ))}
                  </select>
                  {formErrors.doctor && <span className="form-error">{formErrors.doctor}</span>}
                </div>
              </div>

              <div className="form-group" style={{ maxWidth: '320px', marginTop: '0.5rem' }}>
                <label className="form-label">
                  Appointment Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  min={todayStr}
                  value={appointmentDate}
                  onChange={handleDateChange}
                  disabled={!selectedDoctorId}
                  required
                />
                {formErrors.date && <span className="form-error">{formErrors.date}</span>}
                <span className="form-hint">Only future dates or today can be selected</span>
              </div>
            </div>

            {/* Step 2: Time Slot */}
            <div className="booking-step-box">
              <div className="step-header">
                <span className="step-num">2</span>
                <div>
                  <h3>Choose Consultation Slot</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Slots are generated automatically based on doctor consultation hours
                  </p>
                </div>
              </div>

              <SlotSelector
                slotsData={slotsData}
                selectedTime={selectedSlotTime}
                onSelectSlot={handleSlotSelect}
                loading={slotsLoading}
              />
              {formErrors.slot && <span className="form-error" style={{ display: 'block', marginTop: '0.5rem' }}>{formErrors.slot}</span>}
            </div>

            {/* Step 3: Patient Information */}
            <div className="booking-step-box">
              <div className="step-header">
                <span className="step-num">3</span>
                <div>
                  <h3>Patient Details & Consultation Reason</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Used for your unique clinic token allocation and verification
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Patient Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Gayatri Iyer"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  required
                />
                {formErrors.name && <span className="form-error">{formErrors.name}</span>}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">
                    Phone Number <span className="required">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9876543210"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    required
                  />
                  {formErrors.phone && <span className="form-error">{formErrors.phone}</span>}
                  <span className="form-hint">Used for appointment lookup and token retrieval</span>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Email Address <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. patient@example.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    required
                  />
                  {formErrors.email && <span className="form-error">{formErrors.email}</span>}
                  <span className="form-hint">Confirmation & slip can be retrieved with email</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reason for Consultation / Symptoms <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  placeholder="Briefly describe your symptoms or purpose of consultation (e.g. routine checkup, persistent chest ache, skin rash)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
                {formErrors.reason && <span className="form-error">{formErrors.reason}</span>}
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitting}
                  style={{ minWidth: '220px' }}
                >
                  {submitting ? (
                    <>
                      <span className="spinner spinner-sm"></span>
                      <span>Reserving Slot & Token...</span>
                    </>
                  ) : (
                    'Confirm & Generate Token ➔'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
