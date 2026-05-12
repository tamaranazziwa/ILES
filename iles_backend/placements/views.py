from rest_framework import viewsets
from .models import InternshipPlacement
from .serializers import PlacementSerializer
from users.permissions import IsStudentOrSupervisor


class PlacementViewSet(viewsets.ModelViewSet):
    serializer_class = PlacementSerializer
    queryset = InternshipPlacement.objects.none()
    permission_classes = [IsStudentOrSupervisor]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return InternshipPlacement.objects.filter(student=user)
        elif user.role == 'workplace_supervisor':
            return InternshipPlacement.objects.filter(supervisor=user)
        elif user.role == 'academic_supervisor':
            # Academic supervisors see placements they are assigned to
            return InternshipPlacement.objects.filter(academic_supervisor=user)
        elif user.role == 'admin':
            return InternshipPlacement.objects.all()
        return InternshipPlacement.objects.none()

    def perform_create(self, serializer):
        # Auto-assign student to the logged-in user when a student creates a placement
        if self.request.user.role == 'student':
            serializer.save(student=self.request.user)
        else:
            serializer.save()
