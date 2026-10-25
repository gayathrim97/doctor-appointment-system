from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    doctors_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'doctors_count', 'created_at']

    def get_doctors_count(self, obj):
        return obj.doctors.filter(is_active=True).count()
