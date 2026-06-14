"""アカウント関連のビュー。"""
from django.core.exceptions import ValidationError
from rest_framework import permissions, status
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import InviteToken
from .serializers import InviteTokenSerializer, SignupSerializer, UserSerializer


class MeView(APIView):
    """ログイン中ユーザーの情報を返す。"""

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class InviteCreateView(APIView):
    """招待トークンを発行する（管理者のみ）。"""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        invite = InviteToken.objects.create(created_by=request.user)
        return Response(
            InviteTokenSerializer(invite).data, status=status.HTTP_201_CREATED
        )

    def get(self, request):
        """発行済みの招待トークン一覧。"""
        invites = InviteToken.objects.filter(created_by=request.user)
        return Response(InviteTokenSerializer(invites, many=True).data)


class InviteCheckView(APIView):
    """サインアップ画面表示前にトークンの有効性を確認する。"""

    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            invite = InviteToken.objects.get(token=token)
        except (InviteToken.DoesNotExist, ValueError, ValidationError):
            return Response({"valid": False}, status=status.HTTP_404_NOT_FOUND)
        return Response({"valid": invite.is_valid})


class SignupView(CreateAPIView):
    """招待トークンを用いたアカウント作成。"""

    permission_classes = [permissions.AllowAny]
    serializer_class = SignupSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserSerializer(user).data, status=status.HTTP_201_CREATED
        )
