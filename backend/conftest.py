"""pytest 共通フィクスチャ。"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def user(db):
    return User.objects.create_user(username="taro", password="pw-strong-123")


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="hanako", password="pw-strong-123")


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(username="admin", password="pw-strong-123")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client
