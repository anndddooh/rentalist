"""backup_db 管理コマンドのテスト。

boto3/R2 へは実際に接続せず、put/list/delete を記録する偽クライアントに
差し替えて検証する（既存テスト同様、追加の重い依存を増やさない方針）。
"""
import gzip
import json
from io import StringIO
from unittest import mock

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError

from catalog.management.commands.backup_db import Command as BackupCommand
from catalog.models import Series, VolumeCover

pytestmark = pytest.mark.django_db


class FakeR2:
    """list_objects_v2 / put_object / delete_objects だけを持つ偽 S3 クライアント。"""

    def __init__(self, existing_keys=None):
        # key -> body
        self.store = {k: b"" for k in (existing_keys or [])}
        self.put_calls = []
        self.deleted = []

    def put_object(self, Bucket, Key, Body, **kwargs):
        self.store[Key] = Body
        self.put_calls.append((Bucket, Key, Body))

    def list_objects_v2(self, Bucket, Prefix="", **kwargs):
        contents = [{"Key": k} for k in self.store if k.startswith(Prefix)]
        return {"Contents": contents, "IsTruncated": False}

    def delete_objects(self, Bucket, Delete):
        for obj in Delete["Objects"]:
            self.store.pop(obj["Key"], None)
            self.deleted.append(obj["Key"])


@pytest.fixture
def seeded():
    alice = User.objects.create_user(username="alice", password="x")
    s = Series.objects.create(user=alice, title="ありす、宇宙までも")
    VolumeCover.objects.create(
        series=s, volume_number=1,
        image_url="https://example.com/1.jpg",
        source=VolumeCover.SOURCE_RAKUTEN,
    )
    return alice


def _settings(settings, **over):
    settings.BACKUP_R2_BUCKET_NAME = "rentalist-backups"
    settings.BACKUP_R2_ACCESS_KEY_ID = "ak"
    settings.BACKUP_R2_SECRET_ACCESS_KEY = "sk"
    settings.BACKUP_R2_ENDPOINT_URL = "https://acc.r2.cloudflarestorage.com"
    settings.BACKUP_PREFIX = "db-backups/"
    settings.BACKUP_RETENTION = 30
    for k, v in over.items():
        setattr(settings, k, v)


def test_local_only_writes_valid_gzip_json(seeded, settings, tmp_path, monkeypatch):
    _settings(settings)
    monkeypatch.chdir(tmp_path)
    call_command("backup_db", "--local-only", stdout=StringIO())

    files = list(tmp_path.glob("rentalist-*.json.gz"))
    assert len(files) == 1
    with gzip.open(files[0], "rt", encoding="utf-8") as f:
        data = json.load(f)
    models = {row["model"] for row in data}
    # 業務データは含まれ、除外対象（permission 等）は含まれない
    assert "catalog.series" in models
    assert "contenttypes.contenttype" not in models
    assert "auth.permission" not in models


def test_upload_puts_object_to_r2(seeded, settings):
    _settings(settings)
    fake = FakeR2()
    with mock.patch.object(
        BackupCommand,
        "_r2_client", return_value=fake,
    ):
        call_command("backup_db", stdout=StringIO())

    assert len(fake.put_calls) == 1
    bucket, key, body = fake.put_calls[0]
    assert bucket == "rentalist-backups"
    assert key.startswith("db-backups/rentalist-")
    assert key.endswith(".json.gz")
    # 中身が gzip された有効な JSON であること
    json.loads(gzip.decompress(body).decode("utf-8"))


def test_missing_bucket_raises(seeded, settings):
    _settings(settings, BACKUP_R2_BUCKET_NAME="")
    with pytest.raises(CommandError, match="BACKUP_R2_BUCKET_NAME"):
        call_command("backup_db", stdout=StringIO())


def test_prune_keeps_newest_generations(seeded, settings):
    _settings(settings, BACKUP_RETENTION=3)
    # 既存5世代（タイムスタンプの辞書順＝時系列順）
    existing = [f"db-backups/rentalist-2026010{i}T000000Z.json.gz" for i in range(1, 6)]
    fake = FakeR2(existing_keys=existing)
    with mock.patch.object(
        BackupCommand,
        "_r2_client", return_value=fake,
    ):
        call_command("backup_db", stdout=StringIO())

    # アップロード後は6世代 → 新しい3世代だけ残る
    remaining = sorted(fake.store)
    assert len(remaining) == 3
    # 最古2世代が削除されている
    assert "db-backups/rentalist-20260101T000000Z.json.gz" in fake.deleted
    assert "db-backups/rentalist-20260102T000000Z.json.gz" in fake.deleted


def test_no_prune_skips_deletion(seeded, settings):
    _settings(settings, BACKUP_RETENTION=1)
    existing = ["db-backups/rentalist-20260101T000000Z.json.gz"]
    fake = FakeR2(existing_keys=existing)
    with mock.patch.object(
        BackupCommand,
        "_r2_client", return_value=fake,
    ):
        call_command("backup_db", "--no-prune", stdout=StringIO())

    assert fake.deleted == []
