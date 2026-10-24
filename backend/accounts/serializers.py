"""アカウント関連のシリアライザ。"""
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings as jwt_settings

from .models import InviteToken


class UserSerializer(serializers.ModelSerializer):
    """ログイン中ユーザーの情報。"""

    class Meta:
        model = User
        fields = ("id", "username", "is_staff")


class TokenObtainPairWithUserSerializer(TokenObtainPairSerializer):
    """ログイン応答にユーザー情報を含める（クライアントの /auth/me/ 往復を省く）。"""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class TokenRefreshWithUserSerializer(TokenRefreshSerializer):
    """トークン更新の応答にユーザー情報を含める（起動時の /auth/me/ 往復を省く）。

    ユーザーを引くついでに、無効化・削除済みユーザーの更新は 401 で拒否する。
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        user_id = self.token_class(attrs["refresh"]).get(jwt_settings.USER_ID_CLAIM)
        user = User.objects.filter(
            **{jwt_settings.USER_ID_FIELD: user_id}, is_active=True
        ).first()
        if user is None:
            raise AuthenticationFailed("ユーザーが見つからないか無効です。", code="user_inactive")
        data["user"] = UserSerializer(user).data
        return data


class InviteTokenSerializer(serializers.ModelSerializer):
    signup_path = serializers.SerializerMethodField()

    class Meta:
        model = InviteToken
        fields = ("token", "created_at", "expires_at", "used_at", "is_valid", "signup_path")
        read_only_fields = fields

    def get_signup_path(self, obj):
        return f"/signup?token={obj.token}"


class SignupSerializer(serializers.Serializer):
    """招待トークン付きのサインアップ。"""

    token = serializers.UUIDField()
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)

    def validate_token(self, value):
        try:
            invite = InviteToken.objects.get(token=value)
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError("招待トークンが存在しません。")
        if not invite.is_valid:
            raise serializers.ValidationError("この招待トークンは使用済みか期限切れです。")
        self.context["invite"] = invite
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("このユーザー名は既に使われています。")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        invite = self.context["invite"]
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )
        invite.mark_used(user)
        return user
