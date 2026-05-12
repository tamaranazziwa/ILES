from rest_framework import serializers
from .models import EvaluationCriteria, Evaluation, PlacementEvaluation


class EvaluationCriteriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationCriteria
        fields = '__all__'


class EvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evaluation
        fields = '__all__'
        read_only_fields = ['evaluator', 'created_at']


class PlacementEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlacementEvaluation
        fields = '__all__'
        read_only_fields = ['evaluator', 'created_at']