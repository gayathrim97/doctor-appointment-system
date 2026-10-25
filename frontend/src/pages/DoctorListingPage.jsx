import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchDepartments, fetchDoctors } from '../services/api';
import DoctorCard from '../components/DoctorCard';
import Alert from '../components/Alert';

export default function DoctorListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const selectedDept = searchParams.get('department') || '';
  const searchKeyword = searchParams.get('search') || '';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [deptsData, docsData] = await Promise.all([
          fetchDepartments(),
          fetchDoctors({
            department: selectedDept,
            search: searchKeyword
          })
        ]);
        setDepartments(deptsData);
        setDoctors(docsData);
      } catch (err) {
        setError(err.message || 'Failed to load doctors list.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedDept, searchKeyword]);

  const handleDeptChange = (e) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set('department', val);
    } else {
      newParams.delete('department');
    }
    setSearchParams(newParams);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set('search', val);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  return (
    <div className="container page-content">
      <div className="section-header">
        <div>
          <h1 className="section-title">Medical Specialists & Physicians</h1>
          <p className="section-subtitle">
            Find doctors by specialization, view available OPD days, and schedule appointments.
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="filter-input-wrap">
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search doctor by name or specialization..."
            value={searchKeyword}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-select-wrap">
          <select
            className="form-select"
            value={selectedDept}
            onChange={handleDeptChange}
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {(selectedDept || searchKeyword) && (
          <button onClick={handleClearFilters} className="btn btn-secondary btn-sm">
            Reset Filters ✕
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Retrieving doctor profiles from clinic registry...</p>
        </div>
      ) : doctors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🩺</div>
          <h3 className="empty-state-title">No Doctors Found</h3>
          <p className="empty-state-desc">
            No doctors matched your current filter criteria. Try searching with different keywords or clear your filters.
          </p>
          <button onClick={handleClearFilters} className="btn btn-primary btn-sm">
            View All Doctors
          </button>
        </div>
      ) : (
        <div className="doctors-grid">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}
