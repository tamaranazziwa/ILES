
from django.contrib import admin
from django.urls import path, include
<<<<<<< HEAD
from rest_framework_simplejwt.views import TokenRefreshView
from users.token_views import CustomTokenObtainPairView  # import our custom view
=======
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
>>>>>>> 96c4eeeacfc2ef84914c780558687bad158dfe89

urlpatterns = [
    path('', root_redirect, name='root-redirect'),          # Handles http://127.0.0.1:8000/
    path('admin/', admin.site.urls),
<<<<<<< HEAD
    path('api/', include('users.urls')),           # /api/users/
    path('api/', include('placements.urls')),      # /api/placements/
    path('api/', include('logbook.urls')),         # /api/logs/
    path('api/', include('evaluations.urls')),     # /api/criteria/ & /api/evaluations/
    path('api-auth/', include('rest_framework.urls')),  # browsable API login
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]#refresh token is long term(used when access token expires), access token is short term(every API call)
=======
    path('api/', include(router.urls)),                     # Correct: router object (NO quotes)
]
>>>>>>> 96c4eeeacfc2ef84914c780558687bad158dfe89
