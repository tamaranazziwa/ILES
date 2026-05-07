from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.
class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('student_intern', 'Student Intern'),
        ('workplace_supervisor', 'Workplace Supervisor'),
        ('academic_supervisor', 'Academic Supervisor'),
        ('internship_administrator', 'Internship Administrator'),
    ]
    
    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES,
        default='student_intern',
        verbose_name="User Role"
    )
    
    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        
    def __str__(self):
        return f"{self.username} ({self.get_role_display})" 