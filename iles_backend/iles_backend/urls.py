from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from users.token_views import CustomTokenObtainPairView
from django.http import JsonResponse
from django.conf import settings
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),               # /api/users/
    path('api/', include('placements.urls')),          # /api/placements/
    path('api/', include('logbook.urls')),             # /api/logs/
    path('api/', include('evaluations.urls')),         # /api/criteria/ & /api/evaluations/
    path('api-auth/', include('rest_framework.urls')), # browsable API login
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('debug/', lambda request: JsonResponse({
        'ALLOWED_HOSTS': settings.ALLOWED_HOSTS,
        'DEBUG': settings.DEBUG,
        'CORS_ALLOWED_ORIGINS': settings.CORS_ALLOWED_ORIGINS,
    })),
]