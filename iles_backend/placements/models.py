from django.db import models
from django.conf import settings


class InternshipPlacement(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='placements'
    )
    # Workplace supervisor
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='workplace_placements', null=True, blank=True
    )
    # Academic supervisor — separate role, separate FK
    academic_supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='academic_placements', null=True, blank=True
    )
    company_name = models.CharField(max_length=200)
    start_date = models.DateField()
    end_date = models.DateField()

    # Student school details
    school_name = models.CharField(max_length=200, blank=True, default='')
    course = models.CharField(max_length=200, blank=True, default='')
    registration_number = models.CharField(max_length=100, blank=True, default='')
    # Shareable link to placement approval letter (Google Drive, OneDrive, etc.)
    placement_letter_url = models.CharField(max_length=500, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        sup = self.supervisor.username if self.supervisor else 'None'
        return f"{self.student.username} at {self.company_name} (work supervisor: {sup})"
