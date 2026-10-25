from django.urls import path
from .views import DepartmentList, AdminDepartmentListCreate, AdminDepartmentDetail

urlpatterns = [
    path('departments/', DepartmentList.as_view(), name='department-list'),
    path('admin/departments/', AdminDepartmentListCreate.as_view(), name='admin-department-list-create'),
    path('admin/departments/<int:pk>/', AdminDepartmentDetail.as_view(), name='admin-department-detail'),
]
