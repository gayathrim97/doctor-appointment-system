import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchAdminDoctors,
  fetchDepartments,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../services/api';
import { useAuth } from '../context/useAuth';
import Modal from '../components/Modal';
import Alert from '../components/Alert';

const INITIAL_FORM = {
  name: '',
  department: '',
  specialization: '',
  qualification: '',
  consultation_fee: '50.00',
  available_days: 'Monday,Tuesday,Wednesday,Thursday,Friday',
  start_time: '09:00:00',
  end_time: '17:00:00',
  slot_duration: 15,
  is_active: true,
};

export default function AdminDoctorManagementPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertInfo, setAlertInfo] = useState(null);

  // Modal states
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [doctorForm, setDoctorForm] = useState(INITIAL_FORM);
  const [savingDoctor, setSavingDoctor] = useState(false);

  // Department creation modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const loadData = async () => {
    try {
      const [docsData, deptsData] = await Promise.all([
        fetchAdminDoctors(),
        fetchDepartments()
      ]);
      setDoctors(docsData);
      setDepartments(deptsData);
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to load doctors and departments.' });
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    setLoading(true);
    loadData();
  };

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let isMounted = true;
    Promise.all([fetchAdminDoctors(), fetchDepartments()])
      .then(([docsData, deptsData]) => {
        if (isMounted) {
          setDoctors(docsData);
          setDepartments(deptsData);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setAlertInfo({ type: 'error', message: err.message || 'Failed to load doctors and departments.' });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const openAddDoctorModal = () => {
    setEditingDoctorId(null);
    setDoctorForm({
      ...INITIAL_FORM,
      department: departments[0]?.id || ''
    });
    setIsDoctorModalOpen(true);
  };

  const openEditDoctorModal = (doc) => {
    setEditingDoctorId(doc.id);
    setDoctorForm({
      name: doc.name,
      department: doc.department,
      specialization: doc.specialization,
      qualification: doc.qualification,
      consultation_fee: doc.consultation_fee,
      available_days: doc.available_days,
      start_time: doc.start_time,
      end_time: doc.end_time,
      slot_duration: doc.slot_duration,
      is_active: doc.is_active,
    });
    setIsDoctorModalOpen(true);
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    setSavingDoctor(true);
    setAlertInfo(null);

    try {
      const payload = {
        ...doctorForm,
        department: parseInt(doctorForm.department, 10),
        slot_duration: parseInt(doctorForm.slot_duration, 10),
        consultation_fee: parseFloat(doctorForm.consultation_fee),
      };

      if (editingDoctorId) {
        await updateDoctor(editingDoctorId, payload);
        setAlertInfo({ type: 'success', message: `Dr. ${doctorForm.name} updated successfully.` });
      } else {
        await createDoctor(payload);
        setAlertInfo({ type: 'success', message: `Dr. ${doctorForm.name} added successfully.` });
      }
      setIsDoctorModalOpen(false);
      refreshData();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to save doctor record.' });
    } finally {
      setSavingDoctor(false);
    }
  };

  const handleDeleteDoctor = async (doc) => {
    if (!window.confirm(`Remove Dr. ${doc.name} from booking? Doctors with appointment history will be deactivated so those records are preserved.`)) {
      return;
    }
    try {
      await deleteDoctor(doc.id);
      setAlertInfo({ type: 'success', message: `Dr. ${doc.name} was removed from booking. Existing appointment history is preserved.` });
      refreshData();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to delete doctor.' });
    }
  };

  const handleToggleActive = async (doc) => {
    try {
      await updateDoctor(doc.id, { ...doc, is_active: !doc.is_active });
      setAlertInfo({
        type: 'success',
        message: `Dr. ${doc.name} is now ${!doc.is_active ? 'Active' : 'Inactive'}.`
      });
      refreshData();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to toggle status.' });
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSavingDept(true);
    try {
      const departmentData = { name: deptName.trim(), description: deptDesc.trim() };
      if (editingDepartmentId) {
        await updateDepartment(editingDepartmentId, departmentData);
        setAlertInfo({ type: 'success', message: `Department "${deptName}" updated successfully.` });
      } else {
        await createDepartment(departmentData);
        setAlertInfo({ type: 'success', message: `Department "${deptName}" created successfully.` });
      }
      setDeptName('');
      setDeptDesc('');
      setEditingDepartmentId(null);
      setIsDeptModalOpen(false);
      refreshData();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to create department.' });
    } finally {
      setSavingDept(false);
    }
  };

  const openAddDepartmentModal = () => {
    setEditingDepartmentId(null);
    setDeptName('');
    setDeptDesc('');
    setIsDeptModalOpen(true);
  };

  const openEditDepartmentModal = (department) => {
    setEditingDepartmentId(department.id);
    setDeptName(department.name);
    setDeptDesc(department.description);
    setIsDeptModalOpen(true);
  };

  const handleDeleteDepartment = async (department) => {
    if (!window.confirm(`Delete the ${department.name} department? Departments with doctors cannot be deleted.`)) {
      return;
    }
    try {
      await deleteDepartment(department.id);
      setAlertInfo({ type: 'success', message: `Department "${department.name}" deleted.` });
      refreshData();
    } catch (err) {
      setAlertInfo({ type: 'error', message: err.message || 'Failed to delete department.' });
    }
  };

  return (
    <div className="container page-content">
      <div className="admin-header-bar">
        <div>
          <h1 className="section-title">Physician & Department Management</h1>
          <p className="section-subtitle">
            Configure doctors, consulting departments, working shifts, and slot intervals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={openAddDepartmentModal} className="btn btn-secondary btn-sm">
            + Add Department
          </button>
          <button onClick={openAddDoctorModal} className="btn btn-primary btn-sm">
            + Add New Doctor
          </button>
        </div>
      </div>

      {alertInfo && (
        <Alert type={alertInfo.type} message={alertInfo.message} onClose={() => setAlertInfo(null)} />
      )}

      {!loading && (
        <section className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Departments</h2>
          {departments.length === 0 ? (
            <p>No departments have been created yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Description</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td><strong>{department.name}</strong></td>
                      <td>{department.description || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => openEditDepartmentModal(department)} className="btn btn-secondary btn-sm">
                            Edit
                          </button>
                          <button onClick={() => handleDeleteDepartment(department)} className="btn btn-danger btn-sm">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tabs */}
      <div className="admin-nav-tabs">
        <Link to="/admin/dashboard" className="admin-tab">Overview & Today</Link>
        <Link to="/admin/appointments" className="admin-tab">All Appointments</Link>
        <Link to="/admin/doctors" className="admin-tab active">Doctors Management</Link>
      </div>

      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading doctor rosters...</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor Name</th>
                  <th>Department</th>
                  <th>Specialization & Qualification</th>
                  <th>Consultation Fee</th>
                  <th>Working Hours</th>
                  <th>Available Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <strong>Dr. {doc.name.replace(/^Dr\.\s*/i, '')}</strong>
                    </td>
                    <td>
                      <span className="doctor-dept-badge">{doc.department_name}</span>
                    </td>
                    <td>
                      <div>{doc.specialization}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{doc.qualification}</small>
                    </td>
                    <td>
                      <strong>${parseFloat(doc.consultation_fee).toFixed(2)}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {doc.slot_duration} min slots
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {doc.start_time} - {doc.end_time}
                    </td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '200px' }}>
                      {doc.available_days}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(doc)}
                        className={`badge ${doc.is_active ? 'badge-active' : 'badge-inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {doc.is_active ? 'Active ✓' : 'Inactive ✕'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => openEditDoctorModal(doc)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Doctor"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDoctor(doc)}
                          className="btn btn-danger btn-sm"
                          title="Delete Doctor"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doctor Modal (Add / Edit) */}
      <Modal
        isOpen={isDoctorModalOpen}
        title={editingDoctorId ? 'Edit Doctor Profile' : 'Add New Physician'}
        onClose={() => setIsDoctorModalOpen(false)}
      >
        <form onSubmit={handleSaveDoctor}>
          <div className="form-group">
            <label className="form-label">Doctor Full Name <span className="required">*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Robert Vance"
              value={doctorForm.name}
              onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Department <span className="required">*</span></label>
              <select
                className="form-select"
                value={doctorForm.department}
                onChange={(e) => setDoctorForm({ ...doctorForm, department: e.target.value })}
                required
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Specialization <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Interventional Cardiology"
                value={doctorForm.specialization}
                onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Qualification <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MBBS, MD, FRCS"
                value={doctorForm.qualification}
                onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Fee ($) <span className="required">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={doctorForm.consultation_fee}
                onChange={(e) => setDoctorForm({ ...doctorForm, consultation_fee: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Available Days (Comma Separated) <span className="required">*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="Monday,Tuesday,Wednesday,Thursday,Friday"
              value={doctorForm.available_days}
              onChange={(e) => setDoctorForm({ ...doctorForm, available_days: e.target.value })}
              required
            />
            <span className="form-hint">E.g. Monday,Tuesday,Wednesday,Thursday,Friday,Saturday</span>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Start Time <span className="required">*</span></label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={doctorForm.start_time}
                onChange={(e) => setDoctorForm({ ...doctorForm, start_time: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Time <span className="required">*</span></label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={doctorForm.end_time}
                onChange={(e) => setDoctorForm({ ...doctorForm, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Slot Duration (Minutes) <span className="required">*</span></label>
              <input
                type="number"
                min="5"
                max="120"
                className="form-control"
                value={doctorForm.slot_duration}
                onChange={(e) => setDoctorForm({ ...doctorForm, slot_duration: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label className="form-label">Accepting Appointments?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={doctorForm.is_active}
                  onChange={(e) => setDoctorForm({ ...doctorForm, is_active: e.target.checked })}
                />
                <span style={{ fontWeight: 600 }}>Active in Clinic Registry</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setIsDoctorModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingDoctor}>
              {savingDoctor ? 'Saving Doctor...' : editingDoctorId ? 'Save Changes' : 'Create Doctor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        title={editingDepartmentId ? 'Edit Clinical Department' : 'Add Clinical Department'}
        onClose={() => {
          setIsDeptModalOpen(false);
          setEditingDepartmentId(null);
        }}
      >
        <form onSubmit={handleCreateDept}>
          <div className="form-group">
            <label className="form-label">Department Name <span className="required">*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Ophthalmology, Oncology"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Summary of department clinical services..."
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setIsDeptModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={savingDept}>
              {savingDept ? 'Saving...' : editingDepartmentId ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
