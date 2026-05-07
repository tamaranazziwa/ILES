from django.shortcuts import render
from rest_framework import viewsets, permissions
from .models import WeeklyLog
from .serializers import WeeklyLogSerializer
from users.permissions import IsStudent, IsSupervisor
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.core.mail import send_mail
class WeeklyLogViewSet(viewsets.ModelViewSet):
    queryset = WeeklyLog.objects.none()  # placeholder required by router; actual queryset is dynamic
    serializer_class = WeeklyLogSerializer

    def get_queryset(self):
        """Return logs based on the user's role."""
        user = self.request.user
        if user.role == 'student':
            return WeeklyLog.objects.filter(student=user)  # students see their own logs
        elif user.role in ['workplace_supervisor', 'academic_supervisor']:
            return WeeklyLog.objects.filter(placement__supervisor=user)  # supervisors see logs of their supervisees
        elif user.role == 'admin':
            return WeeklyLog.objects.all()
        return WeeklyLog.objects.none()

    def get_permissions(self):
        #Only students can CREATE logs,Anyone authenticated can VIEW (list/retrieve) based on get_queryset.
        if self.action == 'create':
            return [IsStudent()]
        elif self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        #Force student to current user and status to 'draft'
        student = self.request.user
        week_number = serializer.validated_data.get('week_number')
        placement = serializer.validated_data.get('placement')

        existing = WeeklyLog.objects.filter(student=student,
                                            placement=placement,
                                            week_number=week_number,
                                            ).exists()
        if existing:
            raise ValidationError('You already have a log for this week and placement.')
        serializer.save(student=student, status='draft')

    def perform_update(self, serializer):
        instance = self.get_object() #get log being updated
        user = self.request.user
        new_status = serializer.validated_data.get('status', instance.status) #get new status from request or keep old
        feedback = serializer.validated_data.get('feedback', instance.feedback)

        if user.role == 'student':
            if instance.student != user:
                raise PermissionDenied('You can only update your own logs.')
            if instance.status != 'draft':
                raise ValidationError('You can only edit or submit a draft log.')
            if new_status not in ['draft', 'submitted']:
                raise ValidationError('Invalid status.')
            # Students are not allowed to set feedback
            if 'feedback' in serializer.validated_data:
                del serializer.validated_data['feedback']
            if new_status == 'submitted':
                serializer.save(submitted_at=timezone.now())
            else:
                serializer.save()
            if new_status == 'submitted':
                supervisor_email = instance.placement.supervisor.email if instance.placement.supervisor else None
                if supervisor_email:
                    send_mail(
                        subject='New Weekly Log Submitted',
                        message=f'A new weekly log has been submitted for review by {instance.student.get_full_name()}.',
                        from_email='noreply@iles.com',
                        recipient_list=[supervisor_email],
                        fail_silently = True,
                    )

        elif user.role in ['workplace_supervisor', 'academic_supervisor']:
            if new_status not in ['reviewed', 'approved', 'draft']:
                raise ValidationError('Invalid status for supervisor.')
            if new_status == 'reviewed' and instance.status != 'submitted':
                raise ValidationError('Only submitted logs can be reviewed.')
            if new_status in ['approved', 'draft'] and instance.status != 'reviewed':
                raise ValidationError('You can only approve or request changes on a reviewed log.')
            if new_status == 'draft' and not feedback:
                raise ValidationError('Please provide feedback when requesting changes.')  # feedback is required
            serializer.save()
            if new_status == 'reviewed':
                student_email = instance.student.email
                if student_email:
                    send_mail(
                        'Log Reviewed',
                        f'Your Week {instance.week_number} log has been reviewed. Please check for feedback.',
                        'admin@iles.com',
                        [student_email],
                        fail_silently = True,
                    )
            elif new_status == 'approved':
                student_email = instance.student.email
                if student_email:
                    send_mail(
                        'Log Approved',
                        f'Congratulations! Your Week {instance.week_number} log has been approved.',
                        'admin@iles.com',
                        [student_email],
                        fail_silently = True,
                    )
            elif new_status == 'draft':
                student_email = instance.student.email
                if student_email:
                    send_mail(
                        'Changes Requested on Log',
                        f'Your Week {instance.week_number} log requires changes. Please review the feedback and resubmit.',
                        'admin@iles.com',
                        [student_email],
                        fail_silently = True,
                    )
        else:
            serializer.save()  # admin can update freely