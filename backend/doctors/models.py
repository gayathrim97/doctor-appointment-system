from django.db import models
from departments.models import Department


class Doctor(models.Model):
    name = models.CharField(max_length=120)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='doctors'
    )
    specialization = models.CharField(max_length=150)
    qualification = models.CharField(max_length=150)
    consultation_fee = models.DecimalField(max_digits=8, decimal_places=2)
    # Comma-separated list of day names, e.g. "Monday,Tuesday,Wednesday,Thursday,Friday"
    available_days = models.CharField(
        max_length=200,
        default="Monday,Tuesday,Wednesday,Thursday,Friday",
        help_text="Comma-separated days doctor is available (e.g. Monday,Tuesday,Wednesday)"
    )
    start_time = models.TimeField(help_text="Daily consultation start time (HH:MM:SS)")
    end_time = models.TimeField(help_text="Daily consultation end time (HH:MM:SS)")
    slot_duration = models.PositiveIntegerField(
        default=15,
        help_text="Duration per appointment slot in minutes"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"Dr. {self.name} ({self.specialization})"

    def get_available_days_list(self):
        if not self.available_days:
            return []
        return [d.strip() for d in self.available_days.split(',') if d.strip()]

    def is_available_on_day(self, day_name):
        available_list = [d.lower() for d in self.get_available_days_list()]
        return day_name.lower() in available_list
