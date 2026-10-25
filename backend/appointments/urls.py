from django.urls import path
from .views import (
    SlotAvailabilityView,
    AppointmentCreateView,
    AppointmentLookupView,
    AppointmentDetailView,
    AppointmentCancelView,
    AdminDashboardView,
    AdminAppointmentListView,
    AdminAppointmentStatusUpdateView,
    AdminAppointmentAccessCodeView,
)

urlpatterns = [
    # Patient APIs
    path('slots/', SlotAvailabilityView.as_view(), name='slot-availability'),
    path('appointments/', AppointmentCreateView.as_view(), name='appointment-create'),
    path('appointments/lookup/', AppointmentLookupView.as_view(), name='appointment-lookup'),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment-detail'),
    path('appointments/<int:pk>/cancel/', AppointmentCancelView.as_view(), name='appointment-cancel'),

    # Admin APIs
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/appointments/', AdminAppointmentListView.as_view(), name='admin-appointment-list'),
    path('admin/appointments/<int:pk>/status/', AdminAppointmentStatusUpdateView.as_view(), name='admin-appointment-status-update'),
    path('admin/appointments/<int:pk>/access-code/', AdminAppointmentAccessCodeView.as_view(), name='admin-appointment-access-code'),
]
