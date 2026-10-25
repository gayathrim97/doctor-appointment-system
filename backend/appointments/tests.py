from datetime import date, time, timedelta
from django.utils import timezone
from django.contrib.auth.models import User
from django.core import mail
from django.urls import reverse
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.authtoken.models import Token

from departments.models import Department
from doctors.models import Doctor
from patients.models import Patient
from appointments.models import Appointment


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class AppointmentSystemTests(APITestCase):
    def setUp(self):
        # Create department
        self.department = Department.objects.create(
            name="Test Cardiology",
            description="Heart health"
        )

        # Create doctor available Mon-Fri, 09:00 to 11:00 with 30 min slots
        self.doctor = Doctor.objects.create(
            name="Alice Smith",
            department=self.department,
            specialization="Cardiology",
            qualification="MD",
            consultation_fee=100.00,
            available_days="Monday,Tuesday,Wednesday,Thursday,Friday",
            start_time=time(9, 0),
            end_time=time(11, 0),
            slot_duration=30,
            is_active=True
        )

        # Find a future date that is a Monday (or guaranteed available day)
        today = timezone.localdate()
        days_ahead = (0 - today.weekday()) % 7  # 0 is Monday
        if days_ahead <= 0:
            days_ahead += 7
        self.valid_future_monday = today + timedelta(days=days_ahead)

        # Create admin staff user
        self.admin_user = User.objects.create_user(
            username='staff_test',
            password='password123',
            is_staff=True
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        # Create regular non-staff user
        self.regular_user = User.objects.create_user(
            username='regular_test',
            password='password123',
            is_staff=False
        )
        self.regular_token = Token.objects.create(user=self.regular_user)

    def test_slot_generation(self):
        """Verify dynamic slot generation, working hours, and availability"""
        url = reverse('slot-availability')
        response = self.client.get(url, {
            'doctor_id': self.doctor.id,
            'date': self.valid_future_monday.strftime('%Y-%m-%d')
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['available'])
        self.assertEqual(data['total_slots'], 4)  # 09:00, 09:30, 10:00, 10:30
        self.assertEqual(data['available_slots_count'], 4)

    def test_booking_creates_appointment_and_token(self):
        """Test booking creates appointment with token #1"""
        url = reverse('appointment-create')
        payload = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Test Patient",
            "patient_phone": "9876543210",
            "patient_email": "patient@test.com",
            "reason": "Chest pain routine review"
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['token_number'], 1)
        self.assertEqual(data['status'], 'Confirmed')
        self.assertEqual(data['doctor_name'], 'Alice Smith')
        self.assertTrue(data['access_token'])
        self.assertNotIn('access_token_hash', data)
        self.assertTrue(data['email_sent'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(data['access_token'], mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, ['patient@test.com'])

    def test_token_increments_for_subsequent_booking(self):
        """Test token increments sequentially per doctor and date"""
        url = reverse('appointment-create')
        payload_1 = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Patient One",
            "patient_phone": "9876543211",
            "patient_email": "p1@test.com",
            "reason": "Checkup 1"
        }
        res1 = self.client.post(url, payload_1, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res1.json()['token_number'], 1)

        payload_2 = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:30:00",
            "patient_name": "Patient Two",
            "patient_phone": "9876543212",
            "patient_email": "p2@test.com",
            "reason": "Checkup 2"
        }
        res2 = self.client.post(url, payload_2, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res2.json()['token_number'], 2)

    def test_double_booking_prevention_returns_409(self):
        """Test attempting to book an already occupied slot returns 409 Conflict"""
        url = reverse('appointment-create')
        payload = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "First Booker",
            "patient_phone": "9876543210",
            "patient_email": "first@test.com",
            "reason": "First booking"
        }
        res1 = self.client.post(url, payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempt to book exact same slot
        payload2 = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Second Booker",
            "patient_phone": "9812345678",
            "patient_email": "second@test.com",
            "reason": "Second booking attempt"
        }
        res2 = self.client.post(url, payload2, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("already been booked", res2.json()['error'])

    def test_booking_on_doctor_unavailable_day_rejected(self):
        """Test booking on a day the doctor doesn't work (e.g. Sunday) is rejected with 400"""
        today = timezone.localdate()
        days_ahead = (6 - today.weekday()) % 7  # 6 is Sunday
        if days_ahead <= 0:
            days_ahead += 7
        future_sunday = today + timedelta(days=days_ahead)

        url = reverse('appointment-create')
        payload = {
            "doctor_id": self.doctor.id,
            "appointment_date": future_sunday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Sunday Booker",
            "patient_phone": "9876543210",
            "patient_email": "sunday@test.com",
            "reason": "Sunday appointment"
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not available on Sundays", str(response.json()))

    def test_appointment_cancellation_releases_slot(self):
        """Test that cancelling an appointment frees up the slot"""
        book_url = reverse('appointment-create')
        payload = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Cancel Test",
            "patient_phone": "9876543210",
            "patient_email": "cancel@test.com",
            "reason": "Testing cancellation"
        }
        res = self.client.post(book_url, payload, format='json')
        appt_id = res.json()['id']

        # Cancel appointment
        cancel_url = reverse('appointment-cancel', kwargs={'pk': appt_id})
        access_token = res.json()['access_token']
        cancel_res = self.client.post(
            cancel_url,
            HTTP_X_APPOINTMENT_ACCESS_TOKEN=access_token
        )
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_res.json()['appointment']['status'], 'Cancelled')

        # Check slots again: 09:00:00 should now be available again!
        slot_url = reverse('slot-availability')
        slot_res = self.client.get(slot_url, {
            'doctor_id': self.doctor.id,
            'date': self.valid_future_monday.strftime('%Y-%m-%d')
        })
        first_slot = slot_res.json()['slots'][0]
        self.assertEqual(first_slot['time'], "09:00:00")
        self.assertTrue(first_slot['is_available'])
        self.assertFalse(first_slot['is_booked'])

    def test_patient_appointment_data_requires_access_code(self):
        response = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Private Patient",
            "patient_phone": "9876543210",
            "patient_email": "private@test.com",
            "reason": "Private appointment test"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appointment = response.json()
        detail_url = reverse('appointment-detail', kwargs={'pk': appointment['id']})

        self.assertEqual(self.client.get(detail_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.post(reverse('appointment-cancel', kwargs={'pk': appointment['id']})).status_code,
            status.HTTP_404_NOT_FOUND
        )

        lookup_url = reverse('appointment-lookup')
        self.assertEqual(
            self.client.get(lookup_url, {'email': 'private@test.com'}).status_code,
            status.HTTP_400_BAD_REQUEST
        )

        self.client.credentials(HTTP_X_APPOINTMENT_ACCESS_TOKEN='wrong-access-code')
        self.assertEqual(
            self.client.get(detail_url).status_code,
            status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.client.get(lookup_url, {'email': 'private@test.com'}).json(),
            []
        )

        self.client.credentials(
            HTTP_X_APPOINTMENT_ACCESS_TOKEN=appointment['access_token']
        )
        detail_response = self.client.get(detail_url)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertNotIn('access_token', detail_response.json())
        lookup_response = self.client.get(lookup_url, {'email': 'private@test.com'})
        self.assertEqual(lookup_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(lookup_response.json()), 1)
        self.assertEqual(lookup_response.json()[0]['id'], appointment['id'])

    def test_booking_succeeds_and_returns_code_if_email_delivery_fails(self):
        with self.settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            from unittest.mock import patch

            with patch('appointments.views.send_mail', side_effect=OSError('SMTP unavailable')):
                response = self.client.post(reverse('appointment-create'), {
                    "doctor_id": self.doctor.id,
                    "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
                    "appointment_time": "09:00:00",
                    "patient_name": "Mail Failure Patient",
                    "patient_phone": "9876543210",
                    "patient_email": "mail-failure@test.com",
                    "reason": "Email failure handling"
                }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json()['access_token'])
        self.assertFalse(response.json()['email_sent'])

    def test_booking_does_not_overwrite_an_existing_patient_record(self):
        existing_patient = Patient.objects.create(
            full_name='Existing Patient',
            phone='9812345678',
            email='shared-address@test.com'
        )
        response = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "New Booking Name",
            "patient_phone": "9876543210",
            "patient_email": "shared-address@test.com",
            "reason": "Patient record privacy test"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        existing_patient.refresh_from_db()
        self.assertEqual(existing_patient.full_name, 'Existing Patient')
        self.assertEqual(existing_patient.phone, '9812345678')
        self.assertEqual(response.json()['patient']['full_name'], 'New Booking Name')

    def test_invalid_time_with_seconds_is_rejected(self):
        response = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:30",
            "patient_name": "Time Test",
            "patient_phone": "9876543210",
            "patient_email": "time@test.com",
            "reason": "Invalid time test"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('appointment_time', response.json())

    def test_cancelled_appointment_does_not_reuse_token_number(self):
        payload = {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "First Patient",
            "patient_phone": "9876543210",
            "patient_email": "first-token@test.com",
            "reason": "Token allocation test"
        }
        first = self.client.post(reverse('appointment-create'), payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.client.post(
            reverse('appointment-cancel', kwargs={'pk': first.json()['id']}),
            HTTP_X_APPOINTMENT_ACCESS_TOKEN=first.json()['access_token']
        )

        payload.update({
            "appointment_time": "09:30:00",
            "patient_email": "second-token@test.com"
        })
        second = self.client.post(reverse('appointment-create'), payload, format='json')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.json()['token_number'], 2)

    def test_past_appointment_date_is_rejected(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        response = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": yesterday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Past Date Patient",
            "patient_phone": "9876543210",
            "patient_email": "past-date@test.com",
            "reason": "Past date validation"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('appointment_date', response.json())

    def test_doctor_delete_preserves_appointment_history(self):
        booking = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "History Patient",
            "patient_phone": "9876543210",
            "patient_email": "history@test.com",
            "reason": "History retention test"
        }, format='json')
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.delete(
            reverse('admin-doctor-detail', kwargs={'pk': self.doctor.id})
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.doctor.refresh_from_db()
        self.assertFalse(self.doctor.is_active)
        self.assertTrue(Appointment.objects.filter(id=booking.json()['id']).exists())

    def test_department_crud_is_staff_only_and_delete_is_safe(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        create_response = self.client.post(reverse('admin-department-list-create'), {
            "name": "New Department",
            "description": "Test department"
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        department_id = create_response.json()['id']

        self.assertEqual(
            self.client.delete(
                reverse('admin-department-detail', kwargs={'pk': self.department.id})
            ).status_code,
            status.HTTP_409_CONFLICT
        )
        self.assertEqual(
            self.client.patch(
                reverse('admin-department-detail', kwargs={'pk': department_id}),
                {"description": "Updated test department"},
                format='json'
            ).status_code,
            status.HTTP_200_OK
        )
        self.assertEqual(
            self.client.delete(
                reverse('admin-department-detail', kwargs={'pk': department_id})
            ).status_code,
            status.HTTP_204_NO_CONTENT
        )

    def test_admin_status_updates_reject_invalid_transitions(self):
        booking = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Status Patient",
            "patient_phone": "9876543210",
            "patient_email": "status@test.com",
            "reason": "Status transition test"
        }, format='json')
        self.assertEqual(booking.status_code, status.HTTP_201_CREATED)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        status_url = reverse(
            'admin-appointment-status-update',
            kwargs={'pk': booking.json()['id']}
        )
        completed = self.client.patch(status_url, {"status": "Completed"}, format='json')
        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        invalid = self.client.patch(status_url, {"status": "Confirmed"}, format='json')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_staff_can_issue_one_time_code_for_legacy_appointment(self):
        patient = Patient.objects.create(
            full_name='Legacy Patient',
            phone='9876543210',
            email='legacy@test.com'
        )
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=self.doctor,
            appointment_date=self.valid_future_monday,
            appointment_time=time(9, 0),
            token_number=1,
            reason='Existing legacy appointment'
        )
        access_code_url = reverse(
            'admin-appointment-access-code',
            kwargs={'pk': appointment.id}
        )

        self.assertEqual(
            self.client.post(access_code_url).status_code,
            status.HTTP_401_UNAUTHORIZED
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        response = self.client.post(access_code_url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()['patient_email'], patient.email)
        self.assertTrue(response.json()['email_sent'])
        self.assertIn(response.json()['access_token'], mail.outbox[-1].body)
        self.assertNotIn('access_token_hash', response.json())

        appointment.refresh_from_db()
        self.assertTrue(appointment.has_access_token(response.json()['access_token']))
        self.assertEqual(
            self.client.post(access_code_url).status_code,
            status.HTTP_409_CONFLICT
        )
        rotated = self.client.post(access_code_url, {"rotate": True}, format='json')
        self.assertEqual(rotated.status_code, status.HTTP_201_CREATED)
        appointment.refresh_from_db()
        self.assertFalse(appointment.has_access_token(response.json()['access_token']))
        self.assertTrue(appointment.has_access_token(rotated.json()['access_token']))
        self.assertEqual(mail.outbox[-1].to, [patient.email])

    def test_booking_confirmation_email_uses_configured_sender(self):
        response = self.client.post(reverse('appointment-create'), {
            "doctor_id": self.doctor.id,
            "appointment_date": self.valid_future_monday.strftime('%Y-%m-%d'),
            "appointment_time": "09:00:00",
            "patient_name": "Email Patient",
            "patient_phone": "9876543210",
            "patient_email": "email@test.com",
            "reason": "Email delivery test"
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mail.outbox[-1].to, ['email@test.com'])
        self.assertIn('Your clinic appointment access details', mail.outbox[-1].subject)

    def test_admin_dashboard_security(self):
        """Test admin dashboard requires staff permissions"""
        url = reverse('admin-dashboard')

        # 1. Unauthenticated request -> 401
        res_unauth = self.client.get(url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Non-staff request -> 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.regular_token.key}')
        res_nonstaff = self.client.get(url)
        self.assertEqual(res_nonstaff.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Staff request -> 200
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.admin_token.key}')
        res_staff = self.client.get(url)
        self.assertEqual(res_staff.status_code, status.HTTP_200_OK)
        self.assertIn('stats', res_staff.json())
        self.assertIn('today_schedule', res_staff.json())

    def test_admin_doctor_and_department_endpoints_require_staff(self):
        doctor_url = reverse('admin-doctor-list-create')
        department_url = reverse('admin-department-list-create')
        self.assertEqual(self.client.get(doctor_url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(department_url).status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.regular_token.key}')
        self.assertEqual(self.client.get(doctor_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(department_url).status_code, status.HTTP_403_FORBIDDEN)

    def test_frontend_access_code_header_is_allowed_by_cors(self):
        response = self.client.options(
            reverse('appointment-lookup'),
            HTTP_ORIGIN='http://localhost:5173',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-appointment-access-token'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:5173')
        self.assertIn(
            'x-appointment-access-token',
            response['Access-Control-Allow-Headers'].lower()
        )
