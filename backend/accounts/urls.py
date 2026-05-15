"""アカウント関連の URL。"""
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import InviteCheckView, InviteCreateView, MeView, SignupView

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("invite/", InviteCreateView.as_view(), name="invite_create"),
    path("invite/check/<str:token>/", InviteCheckView.as_view(), name="invite_check"),
    path("signup/", SignupView.as_view(), name="signup"),
]
