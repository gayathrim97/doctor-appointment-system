from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework import status
from .models import Department
from .serializers import DepartmentSerializer


class DepartmentList(generics.ListAPIView):
    """
    Public endpoint to list all departments.
    """
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.AllowAny]


class AdminDepartmentListCreate(generics.ListCreateAPIView):
    """
    Admin endpoint to list and create departments.
    """
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminDepartmentDetail(generics.RetrieveUpdateDestroyAPIView):
    """
    Admin endpoint to retrieve, update or delete a department.
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, *args, **kwargs):
        department = self.get_object()
        if department.doctors.exists():
            return Response(
                {"error": "Move or remove this department's doctors before deleting it."},
                status=status.HTTP_409_CONFLICT
            )
        return super().delete(request, *args, **kwargs)
