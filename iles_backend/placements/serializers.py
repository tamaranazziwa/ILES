from rest_framework import serializers
from .models import InternshipPlacement


class PlacementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternshipPlacement
        fields = '__all__'
        read_only_fields = ['created_at']
