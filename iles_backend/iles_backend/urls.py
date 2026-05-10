
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from rest_framework.routers import DefaultRouter

from core.views import (
    InternshipPlacementViewSet,
    WeeklyLogViewSet,
    EvaluationCriteriaViewSet,
    EvaluationViewSet,
)

# DRF Router – registers all RESTful API endpoints
router = DefaultRouter()
router.register(r'placements', InternshipPlacementViewSet, basename='placement')
router.register(r'weekly-logs', WeeklyLogViewSet, basename='weekly-log')
router.register(r'evaluation-criteria', EvaluationCriteriaViewSet, basename='evaluation-criteria')
router.register(r'evaluations', EvaluationViewSet, basename='evaluation')

# Root redirect for user-friendly landing page
def root_redirect(request):
    return redirect('/api/')

urlpatterns = [
    path('', root_redirect, name='root-redirect'),          # Handles http://127.0.0.1:8000/
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),                     # Correct: router object (NO quotes)
    path('api/auth/', include('Students_login.urls')),
]