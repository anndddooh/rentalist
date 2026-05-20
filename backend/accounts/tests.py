"""accounts アプリのテスト。"""
import pytest
from django.utils import timezone

from accounts.models import InviteToken

pytestmark = pytest.mark.django_db


def test_invite_create_requires_admin(api):
    """一般ユーザーは招待トークンを発行できない。"""
    resp = api.post("/api/auth/invite/")
    assert resp.status_code == 403


def test_admin_creates_invite_and_signup_flow(admin_user):
    """管理者が招待を発行 → トークンでサインアップできる。"""
    from rest_framework.test import APIClient

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)
    resp = admin_client.post("/api/auth/invite/")
    assert resp.status_code == 201
    token = resp.data["token"]

    anon = APIClient()
    check = anon.get(f"/api/auth/invite/check/{token}/")
    assert check.status_code == 200 and check.data["valid"] is True

    signup = anon.post(
        "/api/auth/signup/",
        {"token": token, "username": "newbie", "password": "pw-strong-123"},
        format="json",
    )
    assert signup.status_code == 201
    assert signup.data["username"] == "newbie"


def test_used_token_cannot_be_reused(admin_user):
    """使用済みトークンは再利用できない。"""
    from rest_framework.test import APIClient

    invite = InviteToken.objects.create(created_by=admin_user)
    anon = APIClient()
    first = anon.post(
        "/api/auth/signup/",
        {"token": str(invite.token), "username": "u1", "password": "pw-strong-123"},
        format="json",
    )
    assert first.status_code == 201
    second = anon.post(
        "/api/auth/signup/",
        {"token": str(invite.token), "username": "u2", "password": "pw-strong-123"},
        format="json",
    )
    assert second.status_code == 400


def test_expired_token_is_invalid(admin_user):
    invite = InviteToken.objects.create(created_by=admin_user)
    invite.expires_at = timezone.now() - timezone.timedelta(days=1)
    invite.save()
    assert invite.is_valid is False


def test_jwt_token_obtain(user):
    from rest_framework.test import APIClient

    anon = APIClient()
    resp = anon.post(
        "/api/auth/token/",
        {"username": "taro", "password": "pw-strong-123"},
        format="json",
    )
    assert resp.status_code == 200
    assert "access" in resp.data and "refresh" in resp.data


def test_me_returns_authenticated_user(api, user):
    """GET /api/auth/me/ がログイン中ユーザーの情報を返す。"""
    resp = api.get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.data["id"] == user.id
    assert resp.data["username"] == "taro"
    assert resp.data["is_staff"] is False


def test_me_requires_authentication():
    """未認証では /api/auth/me/ は 401。"""
    from rest_framework.test import APIClient

    anon = APIClient()
    resp = anon.get("/api/auth/me/")
    assert resp.status_code == 401
