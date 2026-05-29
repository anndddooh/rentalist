"""purge_provisional_covers 管理コマンドのテスト。"""
from io import StringIO

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command

from catalog.models import Series, VolumeCover

pytestmark = pytest.mark.django_db


PROV_URL_A = "https://thumbnail.image.rakuten.co.jp/x/9784098640294.gif?_ex=200x200"
PROV_URL_B = "https://thumbnail.image.rakuten.co.jp/x/9999999999999.gif"
REAL_URL = "https://thumbnail.image.rakuten.co.jp/x/9784098630158_1_45.jpg"


@pytest.fixture
def populated_db():
    """対象シリーズ（仮表紙＋本表紙）、対象外シリーズ（仮表紙）、別ユーザーの同名シリーズを用意。"""
    alice = User.objects.create_user(username="alice", password="x")
    bob = User.objects.create_user(username="bob", password="x")

    target = Series.objects.create(user=alice, title="ありす、宇宙までも")
    untargeted = Series.objects.create(user=alice, title="鬼滅の刃")
    same_title_other_user = Series.objects.create(user=bob, title="ありす、宇宙までも")

    VolumeCover.objects.create(
        series=target, volume_number=7, image_url=PROV_URL_A,
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    VolumeCover.objects.create(
        series=target, volume_number=1, image_url=REAL_URL,
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    VolumeCover.objects.create(
        series=untargeted, volume_number=99, image_url=PROV_URL_B,
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    VolumeCover.objects.create(
        series=same_title_other_user, volume_number=7, image_url=PROV_URL_A,
        source=VolumeCover.SOURCE_RAKUTEN,
    )


def test_dry_run_lists_candidates_without_deleting(populated_db):
    out = StringIO()
    call_command(
        "purge_provisional_covers", "--series", "ありす、宇宙までも", stdout=out
    )
    output = out.getvalue()
    assert "dry-run" in output
    # 全件残ってる
    assert VolumeCover.objects.count() == 4


def test_commit_deletes_only_provisional_rows_for_targeted_series(populated_db):
    call_command(
        "purge_provisional_covers", "--series", "ありす、宇宙までも", "--commit",
        stdout=StringIO(),
    )
    # ありす vol 7 (両ユーザー分) は削除
    assert VolumeCover.objects.filter(image_url=PROV_URL_A).count() == 0
    # ありす vol 1 (本表紙) は残る
    assert VolumeCover.objects.filter(image_url=REAL_URL).count() == 1
    # 鬼滅の刃の仮表紙は対象シリーズ外なので残る
    assert VolumeCover.objects.filter(image_url=PROV_URL_B).count() == 1


def test_user_filter_scopes_deletion(populated_db):
    call_command(
        "purge_provisional_covers", "--series", "ありす、宇宙までも",
        "--user", "alice", "--commit", stdout=StringIO(),
    )
    # alice の vol 7 だけ消える、bob の vol 7 は残る
    assert VolumeCover.objects.filter(
        series__user__username="alice", image_url=PROV_URL_A,
    ).count() == 0
    assert VolumeCover.objects.filter(
        series__user__username="bob", image_url=PROV_URL_A,
    ).count() == 1


def test_no_matching_series_runs_cleanly(db):
    out = StringIO()
    call_command(
        "purge_provisional_covers", "--series", "存在しないシリーズ", stdout=out
    )
    assert "ありませんでした" in out.getvalue()


def test_multiple_series_can_be_purged_at_once(populated_db):
    call_command(
        "purge_provisional_covers",
        "--series", "ありす、宇宙までも", "鬼滅の刃",
        "--commit",
        stdout=StringIO(),
    )
    # 両シリーズの仮表紙が消える
    assert VolumeCover.objects.filter(image_url=PROV_URL_A).count() == 0
    assert VolumeCover.objects.filter(image_url=PROV_URL_B).count() == 0
    # ありす vol 1 (本表紙) は残る
    assert VolumeCover.objects.filter(image_url=REAL_URL).count() == 1
