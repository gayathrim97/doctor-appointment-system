/**
 * API Service for Online Doctor Appointment & Token Scheduling System
 * Uses standard Fetch API to interact with the Django REST Framework backend.
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Universal request wrapper with error parsing and token authentication
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Attach auth token if available in localStorage
  const token = localStorage.getItem('clinic_auth_token');
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // If 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Format error message from DRF error format
      let errorMessage = 'An unexpected error occurred. Please try again.';

      if (typeof data === 'object' && data !== null) {
        if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else {
          // Flatten field validation errors e.g. { "appointment_date": ["..."] }
          const errorList = [];
          for (const [key, val] of Object.entries(data)) {
            const field = key === 'non_field_errors' ? '' : `${key}: `;
            if (Array.isArray(val)) {
              errorList.push(`${field}${val.join(' ')}`);
            } else if (typeof val === 'string') {
              errorList.push(`${field}${val}`);
            }
          }
          if (errorList.length > 0) {
            errorMessage = errorList.join('\n');
          }
        }
      } else if (typeof data === 'string' && data.length > 0) {
        errorMessage = data;
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      const connErr = new Error('Could not connect to the backend server. Please verify Django is running on http://localhost:8000.');
      connErr.status = 503;
      throw connErr;
    }
    throw err;
  }
}

// ----------------- Public Patient APIs -----------------

export async function fetchDepartments() {
  return apiRequest('/departments/');
}

export async function fetchDoctors(params = {}) {
  const query = new URLSearchParams();
  if (params.department) query.append('department', params.department);
  if (params.specialization) query.append('specialization', params.specialization);
  if (params.search) query.append('search', params.search);

  const queryString = query.toString();
  return apiRequest(`/doctors/${queryString ? `?${queryString}` : ''}`);
}

export async function fetchDoctorById(id) {
  return apiRequest(`/doctors/${id}/`);
}

export async function fetchSlots(doctorId, date) {
  return apiRequest(`/slots/?doctor_id=${doctorId}&date=${date}`);
}

export async function bookAppointment(bookingData) {
  return apiRequest('/appointments/', {
    method: 'POST',
    body: JSON.stringify(bookingData)
  });
}

export async function lookupAppointments(query, accessToken) {
  const encoded = encodeURIComponent(query.trim());
  return apiRequest(`/appointments/lookup/?query=${encoded}`, {
    headers: { 'X-Appointment-Access-Token': accessToken }
  });
}

export async function fetchAppointmentById(id, accessToken) {
  return apiRequest(`/appointments/${id}/`, {
    headers: { 'X-Appointment-Access-Token': accessToken }
  });
}

export async function cancelAppointment(id, accessToken) {
  return apiRequest(`/appointments/${id}/cancel/`, {
    method: 'POST',
    headers: { 'X-Appointment-Access-Token': accessToken }
  });
}

// ----------------- Authentication APIs -----------------

export async function loginUser(username, password) {
  return apiRequest('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function logoutUser() {
  return apiRequest('/auth/logout/', {
    method: 'POST'
  });
}

export async function fetchCurrentUser() {
  return apiRequest('/auth/me/');
}

// ----------------- Admin Dashboard & Management APIs -----------------

export async function fetchAdminDashboard() {
  return apiRequest('/admin/dashboard/');
}

export async function fetchAdminAppointments(filters = {}) {
  const query = new URLSearchParams();
  if (filters.doctor_id) query.append('doctor_id', filters.doctor_id);
  if (filters.department_id) query.append('department_id', filters.department_id);
  if (filters.date) query.append('date', filters.date);
  if (filters.status) query.append('status', filters.status);
  if (filters.search) query.append('search', filters.search);

  const queryString = query.toString();
  return apiRequest(`/admin/appointments/${queryString ? `?${queryString}` : ''}`);
}

export async function updateAppointmentStatus(appointmentId, newStatus) {
  return apiRequest(`/admin/appointments/${appointmentId}/status/`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus })
  });
}

export async function issueAppointmentAccessCode(appointmentId, rotate = false) {
  return apiRequest(`/admin/appointments/${appointmentId}/access-code/`, {
    method: 'POST',
    body: JSON.stringify({ rotate })
  });
}

export async function fetchAdminDoctors(filters = {}) {
  const query = new URLSearchParams();
  if (filters.department) query.append('department', filters.department);
  if (filters.is_active !== undefined) query.append('is_active', filters.is_active);

  const queryString = query.toString();
  return apiRequest(`/admin/doctors/${queryString ? `?${queryString}` : ''}`);
}

export async function createDoctor(doctorData) {
  return apiRequest('/admin/doctors/', {
    method: 'POST',
    body: JSON.stringify(doctorData)
  });
}

export async function updateDoctor(doctorId, doctorData) {
  return apiRequest(`/admin/doctors/${doctorId}/`, {
    method: 'PUT',
    body: JSON.stringify(doctorData)
  });
}

export async function deleteDoctor(doctorId) {
  return apiRequest(`/admin/doctors/${doctorId}/`, {
    method: 'DELETE'
  });
}

export async function createDepartment(departmentData) {
  return apiRequest('/admin/departments/', {
    method: 'POST',
    body: JSON.stringify(departmentData)
  });
}


export async function updateDepartment(id, departmentData) {
  return apiRequest(`/admin/departments/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(departmentData)
  });
}

export async function deleteDepartment(id) {
  return apiRequest(`/admin/departments/${id}/`, {
    method: 'DELETE'
  });
}
