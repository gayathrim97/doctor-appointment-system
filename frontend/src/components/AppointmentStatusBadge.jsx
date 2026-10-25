import React from 'react';

export default function AppointmentStatusBadge({ status }) {
  let badgeClass = 'badge-confirmed';
  let icon = '●';

  switch (status) {
    case 'Confirmed':
      badgeClass = 'badge-confirmed';
      icon = '✓';
      break;
    case 'Completed':
      badgeClass = 'badge-completed';
      icon = '★';
      break;
    case 'Cancelled':
      badgeClass = 'badge-cancelled';
      icon = '✕';
      break;
    default:
      badgeClass = 'badge-active';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span>{icon}</span>
      <span>{status}</span>
    </span>
  );
}
