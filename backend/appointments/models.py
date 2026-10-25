import hashlib
import hmac
import secrets

from django.db import models
from patients.models import Patient
from doctors.models import Doctor


class Appointment(models.Model):
    STATUS_CONFIRMED = 'Confirmed'
    STATUS_COMPLETED = 'Completed'
    STATUS_CANCELLED = 'Cancelled'

    STATUS_CHOICES = [
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='appointments'
    )
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.CASCADE,
        related_name='appointments'
    )
    appointment_date = models.DateField(db_index=True)
    appointment_time = models.TimeField()
    token_number = models.PositiveIntegerField(help_text="Unique daily token number per doctor")
    access_token_hash = models.CharField(max_length=64, blank=True, default="")
    reason = models.TextField(help_text="Reason for consultation or symptoms")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_CONFIRMED,
        db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['appointment_date', 'appointment_time']
        constraints = [
            # Ensure no two active (non-cancelled) appointments can share the same doctor, date, and time
            models.UniqueConstraint(
                fields=['doctor', 'appointment_date', 'appointment_time'],
                condition=~models.Q(status='Cancelled'),
                name='unique_doctor_active_slot'
            ),
            # Ensure unique token per doctor per appointment date
            models.UniqueConstraint(
                fields=['doctor', 'appointment_date', 'token_number'],
                name='unique_doctor_date_token'
            ),
        ]
        indexes = [
            models.Index(fields=['appointment_date', 'status']),
            models.Index(fields=['doctor', 'appointment_date']),
        ]

    def __str__(self):
        return f"Token #{self.token_number} - Dr. {self.doctor.name} on {self.appointment_date} {self.appointment_time} ({self.status})"

    @staticmethod
    def generate_access_token():
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
        return token, token_hash

    def has_access_token(self, token):
        if not token or not self.access_token_hash:
            return False
        candidate_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
        return hmac.compare_digest(candidate_hash, self.access_token_hash)
