from django.contrib import admin
from .models import Doctor


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'department', 'specialization', 'consultation_fee', 'is_active')
    list_filter = ('department', 'is_active')
    search_fields = ('name', 'specialization', 'qualification')
