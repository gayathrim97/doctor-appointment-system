from django.urls import path
from .views import DoctorList, DoctorDetail, AdminDoctorListCreate, AdminDoctorDetail

urlpatterns = [
    path('doctors/', DoctorList.as_view(), name='doctor-list'),
    path('doctors/<int:pk>/', DoctorDetail.as_view(), name='doctor-detail'),
    path('admin/doctors/', AdminDoctorListCreate.as_view(), name='admin-doctor-list-create'),
    path('admin/doctors/<int:pk>/', AdminDoctorDetail.as_view(), name='admin-doctor-detail'),
]
