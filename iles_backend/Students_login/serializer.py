from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'role_display']
        read_only_fields = ['id', 'role_display']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    role = serializers.ChoiceField(choices=['student', 'supervisor', 'admin'], required=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        selected_role = data.get('role')

        user = authenticate(username=username, password=password)
        if not user:
            raise serializers.ValidationError("Invalid username or password.")

        role_mapping = {
            'student': 'student_intern',
            'supervisor': ['workplace_supervisor', 'academic_supervisor'],
            'admin': 'internship_administrator'
        }
        expected_roles = role_mapping.get(selected_role)

        if isinstance(expected_roles, list):
            if user.role not in expected_roles:
                raise serializers.ValidationError(
                    f"Selected profile '{selected_role}' does not match your account role '{user.get_role_display()}'."
                )
        else:
            if user.role != expected_roles:
                raise serializers.ValidationError(
                    f"Selected profile '{selected_role}' does not match your account role '{user.get_role_display()}'."
                )

        data['user'] = user
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password_confirm', 'role']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = CustomUser.objects.create(
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user
