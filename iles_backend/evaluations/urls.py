from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EvaluationCriteriaViewSet, EvaluationViewSet, PlacementEvaluationViewSet

router = DefaultRouter()
router.register(r'criteria', EvaluationCriteriaViewSet)
router.register(r'evaluations', EvaluationViewSet)
router.register(r'placement-evaluations', PlacementEvaluationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]