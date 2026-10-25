import React from 'react';

export default function SlotSelector({
  slotsData,
  selectedTime,
  onSelectSlot,
  loading
}) {
  if (loading) {
    return (
      <div className="spinner-container" style={{ padding: '2rem' }}>
        <div className="spinner"></div>
        <p>Loading available appointment slots...</p>
      </div>
    );
  }

  if (!slotsData) {
    return (
      <div className="empty-state" style={{ padding: '1.5rem' }}>
        <p className="empty-state-desc">Please select an appointment date to view available time slots.</p>
      </div>
    );
  }

  if (!slotsData.available) {
    return (
      <div className="alert alert-warning" style={{ margin: '1rem 0' }}>
        <span>ℹ</span>
        <div>{slotsData.message || 'Doctor is not available on this date.'}</div>
      </div>
    );
  }

  const { slots, available_slots_count, total_slots } = slotsData;

  if (!slots || slots.length === 0) {
    return (
      <div className="alert alert-info">
        No consultation slots are configured for this doctor on this day.
      </div>
    );
  }

  return (
    <div>
      <div className="slot-legend">
        <div className="legend-item">
          <span className="legend-dot avail"></span>
          <span>Available ({available_slots_count})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot select"></span>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot booked"></span>
          <span>Booked / Past ({total_slots - available_slots_count})</span>
        </div>
      </div>

      <div className="slots-grid">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          let btnClass = 'slot-btn';

          if (isSelected) {
            btnClass += ' selected';
          } else if (slot.is_booked) {
            btnClass += ' booked';
          } else if (slot.is_past) {
            btnClass += ' past';
          } else {
            btnClass += ' available';
          }

          return (
            <button
              key={slot.time}
              type="button"
              className={btnClass}
              disabled={!slot.is_available}
              onClick={() => onSelectSlot(slot.time, slot.formatted_time)}
              title={
                slot.is_booked
                  ? 'This slot is already booked'
                  : slot.is_past
                  ? 'This time slot has already passed'
                  : `Select ${slot.formatted_time}`
              }
            >
              <span>{slot.formatted_time}</span>
              {slot.is_booked && <span className="slot-badge-hint">Booked</span>}
              {slot.is_past && !slot.is_booked && <span className="slot-badge-hint">Past</span>}
              {isSelected && <span className="slot-badge-hint">✓ Selected</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
