from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.db.models import Q
from .models import Doctor
from .serializers import DoctorSerializer


class DoctorList(generics.ListAPIView):
    """
    Public doctor listing endpoint.
    Supports filtering by department (id or name) and specialization.
    Only shows active doctors.
    """
    serializer_class = DoctorSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Doctor.objects.filter(is_active=True).select_related('department')

        department = self.request.query_params.get('department')
        if department:
            if department.isdigit():
                queryset = queryset.filter(department_id=int(department))
            else:
                queryset = queryset.filter(department__name__iexact=department)

        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(specialization__icontains=specialization)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(specialization__icontains=search) |
                Q(department__name__icontains=search)
            )

        return queryset.order_by('name')


class DoctorDetail(generics.RetrieveAPIView):
    """
    Public endpoint to view single doctor details.
    """
    queryset = Doctor.objects.select_related('department')
    serializer_class = DoctorSerializer
    permission_classes = [permissions.AllowAny]


class AdminDoctorListCreate(generics.ListCreateAPIView):
    """
    Admin endpoint to view all doctors (including inactive) and create new doctors.
    """
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = Doctor.objects.all().select_related('department')
        department = self.request.query_params.get('department')
        if department and department.isdigit():
            queryset = queryset.filter(department_id=int(department))

        status_param = self.request.query_params.get('is_active')
        if status_param is not None:
            is_active = status_param.lower() in ['true', '1']
            queryset = queryset.filter(is_active=is_active)

        return queryset.order_by('name')


class AdminDoctorDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin endpoint to retrieve, update, or soft/hard delete a doctor.
    """
    queryset = Doctor.objects.select_related('department')
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_destroy(self, instance):
        if instance.appointments.exists():
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            return
        instance.delete()
