import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create an admin superuser from environment variables if none exists'

    def handle(self, *args, **kwargs):
        username = os.environ.get('ADMIN_USERNAME')
        email = os.environ.get('ADMIN_EMAIL')
        password = os.environ.get('ADMIN_PASSWORD')

        if not all([username, email, password]):
            self.stdout.write('Skipping admin creation: ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD not all set')
            return

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write('Superuser already exists, skipping')
            return

        User.objects.create_superuser(username=username, email=email, password=password, role='admin')
        self.stdout.write(f'Superuser "{username}" created successfully')
