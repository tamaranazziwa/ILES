from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from .models import EvaluationCriteria, Evaluation, PlacementEvaluation
from .serializers import EvaluationCriteriaSerializer, EvaluationSerializer, PlacementEvaluationSerializer
from users.permissions import IsAdmin, IsSupervisor


class EvaluationCriteriaViewSet(viewsets.ModelViewSet):
    queryset = EvaluationCriteria.objects.all()
    serializer_class = EvaluationCriteriaSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]


class EvaluationViewSet(viewsets.ModelViewSet):
    """Per-weekly-log evaluations by workplace supervisors."""
    queryset = Evaluation.objects.none()
    serializer_class = EvaluationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return Evaluation.objects.filter(log__student=user)
        elif user.role == 'workplace_supervisor':
            return Evaluation.objects.filter(log__placement__supervisor=user)
        elif user.role == 'academic_supervisor':
            # Academic supervisors can see ALL evaluations on their students' logs
            return Evaluation.objects.filter(log__placement__academic_supervisor=user)
        elif user.role == 'admin':
            return Evaluation.objects.all()
        return Evaluation.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsSupervisor()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        log = serializer.validated_data['log']
        criteria = serializer.validated_data['criteria']
        if Evaluation.objects.filter(log=log, criteria=criteria).exists():
            raise ValidationError('This log has already been evaluated on this criteria.')
        serializer.save(evaluator=self.request.user)


class PlacementEvaluationViewSet(viewsets.ModelViewSet):
    """Overall placement evaluations by workplace or academic supervisors."""
    queryset = PlacementEvaluation.objects.none()
    serializer_class = PlacementEvaluationSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return PlacementEvaluation.objects.filter(placement__student=user)
        elif user.role == 'workplace_supervisor':
            return PlacementEvaluation.objects.filter(placement__supervisor=user)
        elif user.role == 'academic_supervisor':
            return PlacementEvaluation.objects.filter(placement__academic_supervisor=user)
        elif user.role == 'admin':
            return PlacementEvaluation.objects.all()
        return PlacementEvaluation.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            return [IsSupervisor()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        placement = serializer.validated_data['placement']
        criteria = serializer.validated_data['criteria']
        user = self.request.user
        if PlacementEvaluation.objects.filter(placement=placement, evaluator=user, criteria=criteria).exists():
            raise ValidationError('You have already scored this criteria for this placement.')
        serializer.save(evaluator=user)
