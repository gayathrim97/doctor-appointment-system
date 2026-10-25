"""
URL configuration for Doctor Appointment & Token Scheduling System.
"""
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from .auth_views import LoginView, LogoutView, MeView


def api_root(request):
    return JsonResponse({
        'message': 'Doctor Appointment and Clinic Token Scheduling API',
        'endpoints': {
            'departments': '/api/departments/',
            'doctors': '/api/doctors/',
            'slots': '/api/slots/?doctor_id={id}&date={YYYY-MM-DD}',
            'appointments': '/api/appointments/',
            'appointment_lookup': '/api/appointments/lookup/?email={email}',
            'staff_login': '/api/auth/login/',
            'admin_dashboard': '/api/admin/dashboard/',
        },
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api_root, name='api-root'),

    # Authentication APIs
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/auth/me/', MeView.as_view(), name='auth-me'),

    # Application APIs
    path('api/', include('departments.urls')),
    path('api/', include('doctors.urls')),
    path('api/', include('appointments.urls')),
]
