from django.contrib.auth import logout
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import CustomUser
from .serializer import LoginSerializer, RegisterSerializer, UserSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.validated_data['user']
    token, _ = Token.objects.get_or_create(user=user)
    user_data = UserSerializer(user).data

    return Response({
        "success": True,
        "message": "Login successful",
        "user": user_data,
        "token": token.key,
        "role": user.role
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"success": False, "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    user_data = UserSerializer(user).data
    return Response({"success": True, "message": "Registration successful", "user": user_data}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    logout(request)
    return Response({"success": True, "message": "Logout successful"}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    user_data = UserSerializer(request.user).data
    return Response({"success": True, "user": user_data}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'register']:
            permission_classes = [AllowAny]
        return [permission() for permission in [IsAuthenticated]]

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def by_role(self, request):
        role = request.query_params.get('role')
        if not role:
            return Response({"error": "Please provide a role parameter"}, status=status.HTTP_400_BAD_REQUEST)
        users = CustomUser.objects.filter(role=role)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

