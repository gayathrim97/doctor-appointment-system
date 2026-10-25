import hashlib
import logging
import smtplib
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import IntegrityError, transaction, models
from django.db.models import Q
from django.core.mail import send_mail
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Appointment
from .serializers import (
    AppointmentDetailSerializer,
    AppointmentCreateSerializer,
    AppointmentStatusUpdateSerializer,
)
from doctors.models import Doctor
from departments.models import Department
from patients.models import Patient

logger = logging.getLogger(__name__)


def send_appointment_access_email(appointment, access_token):
    subject = f"Your clinic appointment access details - #{appointment.id}"
    message = (
        f"Hello {appointment.patient.full_name},\n\n"
        f"Appointment status: {appointment.status}\n"
        f"Doctor: Dr. {appointment.doctor.name}\n"
        f"Department: {appointment.doctor.department.name}\n"
        f"Date: {appointment.appointment_date}\n"
        f"Time: {appointment.appointment_time.strftime('%I:%M %p')}\n"
        f"Clinic token: {appointment.token_number}\n"
        f"Appointment reference: {appointment.id}\n\n"
        "Your private appointment access code is:\n"
        f"{access_token}\n\n"
        "Use this code together with your registered email or phone number to view "
        "or cancel this appointment. Keep it private.\n"
    )
    try:
        sent_count = send_mail(
            subject,
            message,
            None,
            [appointment.patient.email],
            fail_silently=False,
        )
        if sent_count != 1:
            logger.error(
                "Appointment confirmation email was not accepted for appointment id=%s",
                appointment.id,
            )
            return False
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception(
            "Appointment confirmation email failed for appointment id=%s",
            appointment.id,
        )
        return False


class SlotAvailabilityView(APIView):
    """
    GET /api/slots/?doctor_id={id}&date={YYYY-MM-DD}
    Generates dynamic appointment slots based on doctor's working hours,
    slot duration, and current bookings.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        doctor_id = request.query_params.get('doctor_id')
        date_str = request.query_params.get('date')

        if not doctor_id or not date_str:
            return Response(
                {"error": "Both 'doctor_id' and 'date' query parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            doctor = Doctor.objects.select_related('department').get(id=doctor_id)
        except (Doctor.DoesNotExist, ValueError):
            return Response(
                {"error": "Doctor not found with the provided ID."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not doctor.is_active:
            return Response(
                {
                    "doctor": {"id": doctor.id, "name": doctor.name},
                    "available": False,
                    "message": f"Dr. {doctor.name} is currently inactive and not accepting appointments.",
                    "slots": []
                },
                status=status.HTTP_200_OK
            )

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Expected YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        today = timezone.localdate()
        day_name = target_date.strftime('%A')
        is_doctor_day = doctor.is_available_on_day(day_name)

        if not is_doctor_day:
            return Response(
                {
                    "doctor": {
                        "id": doctor.id,
                        "name": doctor.name,
                        "specialization": doctor.specialization,
                        "department": doctor.department.name
                    },
                    "date": date_str,
                    "day_name": day_name,
                    "available": False,
                    "message": f"Dr. {doctor.name} is not available on {day_name}s. Available days: {doctor.available_days}",
                    "slots": []
                },
                status=status.HTTP_200_OK
            )

        # Retrieve all active bookings for this doctor on this date
        active_bookings = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=target_date
        ).exclude(status=Appointment.STATUS_CANCELLED)

        booked_times = {
            b.appointment_time.strftime('%H:%M:%S') for b in active_bookings
        }

        # Generate time slots that can still be booked.
        slots = []
        current_dt = datetime.combine(target_date, doctor.start_time)
        end_dt = datetime.combine(target_date, doctor.end_time)
        slot_delta = timedelta(minutes=doctor.slot_duration)
        now_time = timezone.localtime().time()

        while target_date >= today and current_dt + slot_delta <= end_dt:
            slot_time = current_dt.time()
            time_str = slot_time.strftime('%H:%M:%S')
            is_booked = time_str in booked_times
            is_past = target_date == today and slot_time <= now_time

            slots.append({
                "time": time_str,
                "formatted_time": slot_time.strftime('%I:%M %p'),
                "is_booked": is_booked,
                "is_past": is_past,
                "is_available": (not is_booked) and (not is_past),
            })

            current_dt += slot_delta

        available_count = sum(1 for s in slots if s['is_available'])

        return Response({
            "doctor": {
                "id": doctor.id,
                "name": doctor.name,
                "specialization": doctor.specialization,
                "department": doctor.department.name,
                "consultation_fee": str(doctor.consultation_fee),
                "working_hours": f"{doctor.start_time.strftime('%I:%M %p')} - {doctor.end_time.strftime('%I:%M %p')}",
                "slot_duration": doctor.slot_duration
            },
            "date": date_str,
            "day_name": day_name,
            "available": True,
            "total_slots": len(slots),
            "available_slots_count": available_count,
            "slots": slots
        }, status=status.HTTP_200_OK)


class AppointmentCreateView(APIView):
    """
    POST /api/appointments/
    Atomic booking endpoint with server-side validation and double-booking prevention.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AppointmentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        doctor = validated_data['doctor']
        appt_date = validated_data['appointment_date']
        appt_time = validated_data['appointment_time']
        patient_name = validated_data['patient_name']
        patient_phone = validated_data['patient_phone']
        patient_email = validated_data['patient_email'].lower().strip()
        reason = validated_data['reason']

        # Atomic transaction to prevent race conditions & double-booking
        try:
            with transaction.atomic():
                doctor_locked = Doctor.objects.select_for_update().get(id=doctor.id)

                conflict = Appointment.objects.filter(
                    doctor=doctor_locked,
                    appointment_date=appt_date,
                    appointment_time=appt_time
                ).exclude(status=Appointment.STATUS_CANCELLED).exists()

                if conflict:
                    return Response(
                        {
                            "error": "This appointment slot has already been booked. Please select an alternate time slot.",
                            "code": "SLOT_CONFLICT"
                        },
                        status=status.HTTP_409_CONFLICT
                    )

                max_token = Appointment.objects.filter(
                    doctor=doctor_locked,
                    appointment_date=appt_date
                ).aggregate(models.Max('token_number'))['token_number__max'] or 0
                token_number = max_token + 1

                patient = Patient.objects.create(
                    full_name=patient_name,
                    phone=patient_phone,
                    email=patient_email,
                )

                access_token, access_token_hash = Appointment.generate_access_token()
                appointment = Appointment.objects.create(
                    patient=patient,
                    doctor=doctor_locked,
                    appointment_date=appt_date,
                    appointment_time=appt_time,
                    token_number=token_number,
                    access_token_hash=access_token_hash,
                    reason=reason,
                    status=Appointment.STATUS_CONFIRMED
                )
        except IntegrityError:
            return Response(
                {
                    "error": "This appointment slot has already been booked. Please select an alternate time slot.",
                    "code": "SLOT_CONFLICT"
                },
                status=status.HTTP_409_CONFLICT
            )

        detail_serializer = AppointmentDetailSerializer(appointment)
        return Response(
            {
                **detail_serializer.data,
                "access_token": access_token,
                "email_sent": send_appointment_access_email(appointment, access_token),
            },
            status=status.HTTP_201_CREATED
        )


class AppointmentLookupView(APIView):
    """
    GET /api/appointments/lookup/?email={email} or ?query={query}
    Patient-facing lookup by registered email or phone number.
    Does not expose other patients' appointments.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('query') or request.query_params.get('email') or request.query_params.get('phone')
        if not query or len(query.strip()) < 3:
            return Response(
                {"error": "Please provide your registered email or phone number to view your appointments."},
                status=status.HTTP_400_BAD_REQUEST
            )

        access_token = request.headers.get('X-Appointment-Access-Token')
        if not access_token:
            return Response(
                {"error": "An appointment access code is required to protect patient information."},
                status=status.HTTP_400_BAD_REQUEST
            )

        query = query.strip()
        token_digest = hashlib.sha256(access_token.encode('utf-8')).hexdigest()
        appointments = Appointment.objects.filter(
            Q(patient__email__iexact=query) | Q(patient__phone__iexact=query),
            access_token_hash=token_digest,
        ).select_related('patient', 'doctor', 'doctor__department').order_by('-appointment_date', '-appointment_time')

        serializer = AppointmentDetailSerializer(appointments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AppointmentDetailView(APIView):
    """
    GET /api/appointments/{id}/
    Retrieve single appointment details.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        access_token = request.headers.get('X-Appointment-Access-Token')
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'doctor__department').get(id=pk)
        except Appointment.DoesNotExist:
            return Response(
                {"error": "Appointment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not appointment.has_access_token(access_token):
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AppointmentDetailSerializer(appointment)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AppointmentCancelView(APIView):
    """
    POST /api/appointments/{id}/cancel/
    Patient or staff can cancel an eligible confirmed appointment.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        access_token = request.headers.get('X-Appointment-Access-Token')
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'doctor__department').get(id=pk)
        except Appointment.DoesNotExist:
            return Response(
                {"error": "Appointment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if not appointment.has_access_token(access_token):
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        if appointment.status == Appointment.STATUS_CANCELLED:
            return Response(
                {"error": "This appointment has already been cancelled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if appointment.status == Appointment.STATUS_COMPLETED:
            return Response(
                {"error": "Completed appointments cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appointment.status = Appointment.STATUS_CANCELLED
        appointment.save()

        serializer = AppointmentDetailSerializer(appointment)
        return Response(
            {
                "message": "Appointment has been cancelled successfully. Your slot has been released.",
                "appointment": serializer.data
            },
            status=status.HTTP_200_OK
        )


class AdminDashboardView(APIView):
    """
    GET /api/admin/dashboard/
    Staff-only dashboard metrics and today's schedule.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        today = timezone.localdate()

        total_doctors = Doctor.objects.count()
        active_doctors = Doctor.objects.filter(is_active=True).count()
        total_departments = Department.objects.count()

        all_appointments = Appointment.objects.all()
        total_appointments = all_appointments.count()
        confirmed_count = all_appointments.filter(status=Appointment.STATUS_CONFIRMED).count()
        completed_count = all_appointments.filter(status=Appointment.STATUS_COMPLETED).count()
        cancelled_count = all_appointments.filter(status=Appointment.STATUS_CANCELLED).count()

        # Today's appointments
        today_appointments = Appointment.objects.filter(
            appointment_date=today
        ).select_related('patient', 'doctor', 'doctor__department').order_by('appointment_time')

        today_total = today_appointments.count()
        today_confirmed = today_appointments.filter(status=Appointment.STATUS_CONFIRMED).count()
        today_completed = today_appointments.filter(status=Appointment.STATUS_COMPLETED).count()
        today_cancelled = today_appointments.filter(status=Appointment.STATUS_CANCELLED).count()

        today_schedule_serialized = AppointmentDetailSerializer(today_appointments, many=True).data

        return Response({
            "today_date": today.strftime('%Y-%m-%d'),
            "stats": {
                "total_doctors": total_doctors,
                "active_doctors": active_doctors,
                "total_departments": total_departments,
                "total_appointments": total_appointments,
                "confirmed_appointments": confirmed_count,
                "completed_appointments": completed_count,
                "cancelled_appointments": cancelled_count,
                "today_total": today_total,
                "today_confirmed": today_confirmed,
                "today_completed": today_completed,
                "today_cancelled": today_cancelled,
            },
            "today_schedule": today_schedule_serialized
        }, status=status.HTTP_200_OK)


class AdminAppointmentListView(APIView):
    """
    GET /api/admin/appointments/
    Searchable and filterable appointments list for staff administrators.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        queryset = Appointment.objects.select_related('patient', 'doctor', 'doctor__department')

        # Filter by doctor
        doctor_id = request.query_params.get('doctor_id')
        if doctor_id and doctor_id.isdigit():
            queryset = queryset.filter(doctor_id=int(doctor_id))

        # Filter by department
        dept_id = request.query_params.get('department_id')
        if dept_id and dept_id.isdigit():
            queryset = queryset.filter(doctor__department_id=int(dept_id))

        # Filter by date
        date_param = request.query_params.get('date')
        if date_param:
            try:
                parsed_date = datetime.strptime(date_param, '%Y-%m-%d').date()
                queryset = queryset.filter(appointment_date=parsed_date)
            except ValueError:
                pass

        # Filter by status
        status_param = request.query_params.get('status')
        if status_param and status_param in [
            Appointment.STATUS_CONFIRMED,
            Appointment.STATUS_COMPLETED,
            Appointment.STATUS_CANCELLED
        ]:
            queryset = queryset.filter(status=status_param)

        # Keyword search (patient name, phone, email, doctor name, token)
        search = request.query_params.get('search')
        if search:
            search = search.strip()
            q_filter = (
                Q(patient__full_name__icontains=search) |
                Q(patient__phone__icontains=search) |
                Q(patient__email__icontains=search) |
                Q(doctor__name__icontains=search)
            )
            if search.isdigit():
                q_filter |= Q(token_number=int(search)) | Q(id=int(search))
            queryset = queryset.filter(q_filter)

        queryset = queryset.order_by('-appointment_date', 'appointment_time')
        serializer = AppointmentDetailSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminAppointmentStatusUpdateView(APIView):
    """
    PATCH /api/admin/appointments/{id}/status/
    Updates appointment status with transition safety checks.
    """
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            appointment = Appointment.objects.select_related('patient', 'doctor', 'doctor__department').get(id=pk)
        except Appointment.DoesNotExist:
            return Response(
                {"error": "Appointment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AppointmentStatusUpdateSerializer(appointment, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        detail_serializer = AppointmentDetailSerializer(appointment)
        return Response(detail_serializer.data, status=status.HTTP_200_OK)


class AdminAppointmentAccessCodeView(APIView):
    """
    POST /api/admin/appointments/{id}/access-code/
    Issues a private access code once for legacy appointments that have none.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                appointment = Appointment.objects.select_related(
                    'patient', 'doctor', 'doctor__department'
                ).get(pk=pk)
                previous_hash = appointment.access_token_hash
                if previous_hash and request.data.get('rotate') is not True:
                    return Response(
                        {"error": "This appointment already has a patient access code. Set rotate=true to replace it."},
                        status=status.HTTP_409_CONFLICT
                    )
                access_token, token_hash = Appointment.generate_access_token()
                updated = Appointment.objects.filter(
                    pk=pk,
                    access_token_hash=previous_hash,
                ).update(access_token_hash=token_hash)
                if not updated:
                    return Response(
                        {"error": "An access code was just issued for this appointment. Refresh the appointment list."},
                        status=status.HTTP_409_CONFLICT
                    )
        except Appointment.DoesNotExist:
            return Response(
                {"error": "Appointment not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            {
                "message": "Access code issued and emailed to the patient's address. Any previous code is invalid. Copy the new code now; it cannot be retrieved again.",
                "appointment_id": appointment.id,
                "patient_email": appointment.patient.email,
                "access_token": access_token,
                "email_sent": send_appointment_access_email(appointment, access_token),
            },
            status=status.HTTP_201_CREATED
        )
