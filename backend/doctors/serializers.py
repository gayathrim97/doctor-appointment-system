from rest_framework import serializers
from .models import Doctor
from departments.models import Department
from departments.serializers import DepartmentSerializer


class DoctorSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    available_days_list = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Doctor
        fields = [
            'id',
            'name',
            'department',
            'department_name',
            'specialization',
            'qualification',
            'consultation_fee',
            'available_days',
            'available_days_list',
            'start_time',
            'end_time',
            'slot_duration',
            'is_active',
            'created_at',
        ]

    def get_available_days_list(self, obj):
        return obj.get_available_days_list()

    def validate(self, data):
        start_time = data.get('start_time') or (self.instance and self.instance.start_time)
        end_time = data.get('end_time') or (self.instance and self.instance.end_time)
        slot_duration = data.get('slot_duration') or (self.instance and self.instance.slot_duration)

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError({
                "end_time": "Doctor end time must be after start time."
            })

        if slot_duration and slot_duration <= 0:
            raise serializers.ValidationError({
                "slot_duration": "Slot duration must be a positive integer in minutes."
            })

        return data
