from datetime import time

from django.core.management.base import BaseCommand

from departments.models import Department
from doctors.models import Doctor


class Command(BaseCommand):
    help = 'Create sample departments and doctors for local development'

    def handle(self, *args, **options):
        departments = [
            ("General Medicine", "Primary and preventive healthcare."),
            ("Cardiology", "Heart and cardiovascular care."),
            ("Dermatology", "Skin, hair, and nail care."),
            ("Pediatrics", "Medical care for infants, children, and adolescents."),
            ("Orthopedics", "Bone, joint, and musculoskeletal care."),
            ("Neurology", "Brain, spine, and nervous system care."),
        ]
        department_map = {}
        for name, description in departments:
            department, _ = Department.objects.get_or_create(
                name=name,
                defaults={"description": description},
            )
            department_map[name] = department

        doctors = [
            {
                "name": "Robert Vance",
                "department": "General Medicine",
                "specialization": "Family Medicine",
                "qualification": "MBBS, MD",
                "consultation_fee": 50,
                "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                "start_time": time(9),
                "end_time": time(14),
                "slot_duration": 15,
            },
            {
                "name": "Sarah Jenkins",
                "department": "Cardiology",
                "specialization": "Interventional Cardiology",
                "qualification": "MBBS, DM",
                "consultation_fee": 95,
                "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
                "start_time": time(10),
                "end_time": time(16),
                "slot_duration": 20,
            },
            {
                "name": "Elena Rostova",
                "department": "Dermatology",
                "specialization": "Clinical Dermatology",
                "qualification": "MD Dermatology",
                "consultation_fee": 75,
                "available_days": "Monday,Wednesday,Thursday,Friday,Saturday",
                "start_time": time(9, 30),
                "end_time": time(15, 30),
                "slot_duration": 15,
            },
            {
                "name": "Michael Chang",
                "department": "Pediatrics",
                "specialization": "Pediatric Care",
                "qualification": "MD Pediatrics",
                "consultation_fee": 60,
                "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
                "start_time": time(9),
                "end_time": time(13),
                "slot_duration": 15,
            },
            {
                "name": "Alexander Stone",
                "department": "Orthopedics",
                "specialization": "Sports Medicine",
                "qualification": "MS Orthopedics",
                "consultation_fee": 85,
                "available_days": "Tuesday,Wednesday,Thursday,Friday",
                "start_time": time(11),
                "end_time": time(17),
                "slot_duration": 20,
            },
            {
                "name": "Ananya Sharma",
                "department": "Neurology",
                "specialization": "Clinical Neurology",
                "qualification": "MBBS, DM Neurology",
                "consultation_fee": 90,
                "available_days": "Monday,Tuesday,Wednesday,Thursday,Friday",
                "start_time": time(10),
                "end_time": time(15),
                "slot_duration": 20,
            },
        ]
        for doctor_data in doctors:
            department_name = doctor_data.pop("department")
            Doctor.objects.get_or_create(
                name=doctor_data["name"],
                defaults={**doctor_data, "department": department_map[department_name]},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Ready: {len(departments)} sample departments and {len(doctors)} sample doctors."
        ))
        self.stdout.write(self.style.NOTICE(
            "No patients, appointments, or admin users were created. Create staff with manage.py createsuperuser."
        ))
