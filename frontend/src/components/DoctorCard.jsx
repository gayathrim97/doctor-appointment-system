import React from 'react';
import { Link } from 'react-router-dom';

export default function DoctorCard({ doctor }) {
  const getInitials = (name) => {
    return name
      .replace('Dr. ', '')
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
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
    <div className="doctor-card">
      <div className="doctor-card-header">
        <div className="doctor-avatar">
          {getInitials(doctor.name)}
        </div>
        <div className="doctor-info">
          <h3 className="doctor-name">Dr. {doctor.name.replace(/^Dr\.\s*/i, '')}</h3>
          <div className="doctor-spec">{doctor.specialization}</div>
          <span className="doctor-dept-badge">{doctor.department_name}</span>
        </div>
      </div>

      <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
        <strong>Qualification:</strong> {doctor.qualification}
      </div>

      <div className="doctor-meta-grid">
        <div>
          <span className="meta-item-label">Consultation Fee</span>
          <span className="meta-item-val" style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
            ${parseFloat(doctor.consultation_fee).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="meta-item-label">Slot Duration</span>
          <span className="meta-item-val">{doctor.slot_duration} mins</span>
        </div>
        <div>
          <span className="meta-item-label">Hours</span>
          <span className="meta-item-val">{formatTime(doctor.start_time)} - {formatTime(doctor.end_time)}</span>
        </div>
        <div>
          <span className="meta-item-label">Status</span>
          <span className="meta-item-val" style={{ color: doctor.is_active ? '#059669' : '#dc2626' }}>
            {doctor.is_active ? 'Available' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="doctor-days-tag">
        <span>📅 Available:</span>
        <span style={{ fontWeight: 600 }}>
          {doctor.available_days_list && doctor.available_days_list.length > 0
            ? doctor.available_days_list.join(', ')
            : doctor.available_days}
        </span>
      </div>

      <Link 
        to={`/book?doctor_id=${doctor.id}`} 
        className="btn btn-primary"
        style={{ width: '100%' }}
      >
        Book Appointment ➔
      </Link>
    </div>
  );
}
