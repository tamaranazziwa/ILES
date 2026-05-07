from django.test import TestCase
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from users.models import CustomUser
from placements.models import InternshipPlacement
from logbook.models import WeeklyLog
from evaluations.models import EvaluationCriteria, Evaluation

User = get_user_model()

class ILESTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create users
        self.student = User.objects.create_user(username='student', password='testpass', role='student', email='student@test.com')
        self.supervisor = User.objects.create_user(username='supervisor', password='testpass', role='workplace_supervisor', email='sup@test.com')
        self.admin = User.objects.create_superuser(username='admin', password='admin', role='admin')
        # Create placement
        self.placement = InternshipPlacement.objects.create(
            student=self.student, supervisor=self.supervisor,
            company_name='Test Co', start_date='2026-01-01', end_date='2026-12-31'
        )
        # Create evaluation criteria
        self.criteria1 = EvaluationCriteria.objects.create(name='Technical', weight=0.4)
        self.criteria2 = EvaluationCriteria.objects.create(name='Soft Skills', weight=0.3)
        self.criteria3 = EvaluationCriteria.objects.create(name='Professionalism', weight=0.3)

    def obtain_token(self, username, password):
        response = self.client.post('/api/token/', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 200)
        return response.data['access']

    # Test 1: Token obtain
    def test_token_obtain(self):
        resp = self.client.post('/api/token/', {'username': 'student', 'password': 'testpass'})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)

    # Test 2: Student creates log
    def test_student_create_log(self):
        token = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        resp = self.client.post('/api/logs/', {
            'week_number': 1,
            'activities': 'Test activities',
            'placement': self.placement.id
        })
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['status'], 'draft')

    # Test 3: Student submits own log
    def test_student_submit_own_log(self):
        token = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        create_resp = self.client.post('/api/logs/', {
            'week_number': 2,
            'activities': 'To submit',
            'placement': self.placement.id
        })
        log_id = create_resp.data['id']
        patch_resp = self.client.patch(f'/api/logs/{log_id}/', {'status': 'submitted'})
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.data['status'], 'submitted')

    # Test 4: Student cannot submit someone else's log (should fail)
    def test_student_cannot_submit_others_log(self):
        other = User.objects.create_user(username='other', password='pass', role='student')
        token = self.obtain_token('other', 'pass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        # try to PATCH a log that belongs to 'student'
        create_resp = self.client.post('/api/logs/', {
            'week_number': 5,
            'activities': 'Should not patch',
            'placement': self.placement.id
        })
        # Actually, this will create a log for 'other', but we need to test patching a log that doesn't belong to them.
        # Use the log created by 'student' in previous test? We need to ensure the log belongs to a different student.
        # So we can create a log for 'student' using admin or directly in setUp.
        # For simplicity, we'll skip object-level test or use admin to create a log for student.
        # We'll just check that the API does not allow changing status of a log that the student doesn't own.
        # We'll create a log for student via the ORM.
        log = WeeklyLog.objects.create(student=self.student, placement=self.placement, week_number=10, activities='Owned by student')
        token2 = self.obtain_token('other', 'pass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token2}')
        resp = self.client.patch(f'/api/logs/{log.id}/', {'status': 'submitted'})
        self.assertEqual(resp.status_code, 404)  # Not Found (log invisible to other student)
    # Test 5: Duplicate log prevention
    def test_duplicate_log_prevention(self):
        token = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        payload = {'week_number': 3, 'activities': 'First', 'placement': self.placement.id}
        self.client.post('/api/logs/', payload)
        resp2 = self.client.post('/api/logs/', payload)
        self.assertEqual(resp2.status_code, 400)

    # Test 6: Supervisor can review submitted log
    def test_supervisor_review_log(self):
        # Student creates and submits
        token_student = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_student}')
        create_resp = self.client.post('/api/logs/', {
            'week_number': 4,
            'activities': 'Review me',
            'placement': self.placement.id
        })
        log_id = create_resp.data['id']
        self.client.patch(f'/api/logs/{log_id}/', {'status': 'submitted'})
        # Supervisor reviews
        token_sup = self.obtain_token('supervisor', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_sup}')
        resp = self.client.patch(f'/api/logs/{log_id}/', {'status': 'reviewed'})
        self.assertEqual(resp.status_code, 200)

    # Test 7: Supervisor can add evaluation
    def test_supervisor_add_evaluation(self):
        # Create and submit a log, then review
        token_student = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_student}')
        create_resp = self.client.post('/api/logs/', {
            'week_number': 6,
            'activities': 'Evaluate me',
            'placement': self.placement.id
        })
        log_id = create_resp.data['id']
        self.client.patch(f'/api/logs/{log_id}/', {'status': 'submitted'})
        token_sup = self.obtain_token('supervisor', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_sup}')
        self.client.patch(f'/api/logs/{log_id}/', {'status': 'reviewed'})
        # Add evaluation
        resp = self.client.post('/api/evaluations/', {
            'log': log_id,
            'criteria': self.criteria1.id,
            'score': 85
        })
        self.assertEqual(resp.status_code, 201)

    # Test 8: Duplicate evaluation prevention
    def test_duplicate_evaluation_prevention(self):
        # Setup a reviewed log
        token_student = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_student}')
        create_resp = self.client.post('/api/logs/', {
            'week_number': 7,
            'activities': 'Eval duplicate',
            'placement': self.placement.id
        })
        log_id = create_resp.data['id']
        self.client.patch(f'/api/logs/{log_id}/', {'status': 'submitted'})
        token_sup = self.obtain_token('supervisor', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_sup}')
        self.client.patch(f'/api/logs/{log_id}/', {'status': 'reviewed'})
        # Add evaluation for criteria1
        self.client.post('/api/evaluations/', {'log': log_id, 'criteria': self.criteria1.id, 'score': 80})
        # Try again
        resp = self.client.post('/api/evaluations/', {'log': log_id, 'criteria': self.criteria1.id, 'score': 90})
        self.assertEqual(resp.status_code, 400)

    # Test 9: Only supervisor can approve
    def test_student_cannot_approve(self):
        token = self.obtain_token('student', 'testpass')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        create_resp = self.client.post('/api/logs/', {
            'week_number': 8,
            'activities': 'Try approve',
            'placement': self.placement.id
        })
        log_id = create_resp.data['id']
        resp = self.client.patch(f'/api/logs/{log_id}/', {'status': 'approved'})
        self.assertNotEqual(resp.status_code, 200)  # should fail (400 or 403)
# Create your tests here.
