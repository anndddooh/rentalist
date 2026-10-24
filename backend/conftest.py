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


@pytest.fixture(autouse=True)
def _disable_rakuten_network(settings):
    """テスト中は楽天APIを呼ばない（認証情報を空にしてモック動作させる）。"""
    settings.RAKUTEN_APP_ID = ""
    settings.RAKUTEN_ACCESS_KEY = ""


@pytest.fixture(autouse=True)
def _clear_cache():
    """楽天表紙の結果キャッシュ等がテスト間で漏れないよう毎回クリアする。"""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()
