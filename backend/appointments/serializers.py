from rest_framework import serializers
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Appointment
from doctors.models import Doctor
from patients.models import Patient
from patients.serializers import PatientSerializer


class AppointmentDetailSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)
    doctor_specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    doctor_qualification = serializers.CharField(source='doctor.qualification', read_only=True)
    consultation_fee = serializers.DecimalField(source='doctor.consultation_fee', max_digits=8, decimal_places=2, read_only=True)
    department_id = serializers.IntegerField(source='doctor.department.id', read_only=True)
    department_name = serializers.CharField(source='doctor.department.name', read_only=True)
    is_cancellable = serializers.SerializerMethodField()
    has_patient_access_code = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'token_number',
            'patient',
            'doctor',
            'doctor_name',
            'doctor_specialization',
            'doctor_qualification',
            'consultation_fee',
            'department_id',
            'department_name',
            'appointment_date',
            'appointment_time',
            'reason',
            'status',
            'is_cancellable',
            'has_patient_access_code',
            'created_at',
        ]

    def get_is_cancellable(self, obj):
        # Eligible for cancellation only if currently Confirmed
        if obj.status != Appointment.STATUS_CONFIRMED:
            return False
        # Allow cancellation for today or future appointments
        today = timezone.localdate()
        if obj.appointment_date < today:
            return False
        return True

    def get_has_patient_access_code(self, obj):
        return bool(obj.access_token_hash)


class AppointmentCreateSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField(required=True)
    appointment_date = serializers.DateField(required=True)
    appointment_time = serializers.TimeField(required=True)
    patient_name = serializers.CharField(max_length=120, required=True)
    patient_phone = serializers.CharField(max_length=20, required=True)
    patient_email = serializers.EmailField(required=True)
    reason = serializers.CharField(max_length=500, required=True)

    def validate_patient_phone(self, value):
        cleaned = value.strip()
        digits = [c for c in cleaned if c.isdigit()]
        if len(digits) < 7 or len(digits) > 15:
            raise serializers.ValidationError("Please provide a valid phone number (7-15 digits).")
        return cleaned

    def validate_patient_name(self, value):
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Patient name must be at least 2 characters.")
        return cleaned

    def validate_reason(self, value):
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError("Please provide a brief reason for consultation.")
        return cleaned

    def validate(self, attrs):
        doctor_id = attrs.get('doctor_id')
        appt_date = attrs.get('appointment_date')
        appt_time = attrs.get('appointment_time')

        # 1. Doctor verification
        try:
            doctor = Doctor.objects.get(id=doctor_id)
        except Doctor.DoesNotExist:
            raise serializers.ValidationError({"doctor_id": "Selected doctor does not exist."})

        if not doctor.is_active:
            raise serializers.ValidationError({"doctor_id": f"Dr. {doctor.name} is currently not accepting appointments."})

        # 2. Date validation: must be today or in the future
        today = timezone.localdate()
        if appt_date < today:
            raise serializers.ValidationError({"appointment_date": "Appointment date cannot be in the past."})

        # 3. Available day of the week check
        day_name = appt_date.strftime('%A')
        if not doctor.is_available_on_day(day_name):
            raise serializers.ValidationError({
                "appointment_date": f"Dr. {doctor.name} is not available on {day_name}s. Available days: {doctor.available_days}"
            })

        # 4. Working hours and slot alignment check
        if appt_time < doctor.start_time or appt_time >= doctor.end_time:
            raise serializers.ValidationError({
                "appointment_time": f"Appointment time must be between {doctor.start_time.strftime('%I:%M %p')} and {doctor.end_time.strftime('%I:%M %p')}."
            })

        if appt_time.second or appt_time.microsecond:
            raise serializers.ValidationError({
                "appointment_time": "Appointment time must match an exact scheduled slot."
            })

        if (datetime.combine(appt_date, appt_time) + timedelta(minutes=doctor.slot_duration)).time() > doctor.end_time:
            raise serializers.ValidationError({
                "appointment_time": "The selected appointment would extend beyond the doctor's working hours."
            })

        # Check if appointment_time aligns with slot_duration from doctor start_time
        slot_minutes = doctor.slot_duration
        doctor_start_minutes = doctor.start_time.hour * 60 + doctor.start_time.minute
        appt_minutes = appt_time.hour * 60 + appt_time.minute
        diff = appt_minutes - doctor_start_minutes

        if diff < 0 or (diff % slot_minutes) != 0:
            raise serializers.ValidationError({
                "appointment_time": f"Appointment time does not align with doctor's {slot_minutes}-minute slot schedule."
            })

        # 5. If booking for today, time must be in the future
        if appt_date == today:
            current_time = timezone.localtime().time()
            if appt_time <= current_time:
                raise serializers.ValidationError({
                    "appointment_time": "The selected time slot has already passed for today. Please select a future time slot."
                })

        attrs['doctor'] = doctor
        return attrs


class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['status']

    def validate_status(self, new_status):
        instance = self.instance
        if not instance:
            return new_status

        current_status = instance.status

        if current_status == Appointment.STATUS_COMPLETED and new_status != Appointment.STATUS_COMPLETED:
            raise serializers.ValidationError(
                "A completed appointment cannot be transitioned back to Confirmed or Cancelled."
            )

        if current_status == Appointment.STATUS_CANCELLED and new_status == Appointment.STATUS_COMPLETED:
            raise serializers.ValidationError(
                "A cancelled appointment cannot be marked as Completed."
            )

        return new_status
