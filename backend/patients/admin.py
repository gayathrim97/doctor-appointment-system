from django.contrib import admin
from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'phone', 'email', 'created_at')
    search_fields = ('full_name', 'phone', 'email')
