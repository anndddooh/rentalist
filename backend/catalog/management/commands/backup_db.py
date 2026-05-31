"""DB の論理バックアップを取り、Cloudflare R2（S3 互換）にオフサイト保存する。

Neon の無料プランは Point-in-Time Restore のウィンドウが短い（数時間〜最大24時間）
ため、家族用途でも安心できるよう日次の論理バックアップを別所に退避する。
データ量が小さいので pg_dump ではなく Django の dumpdata（純 Python・追加バイナリ
不要）で JSON 出力し、gzip 圧縮してアップロードする。

復旧は migrate 済みの空 DB に対して loaddata するだけ（手順は DEPLOY.md 参照）。

設定（settings 経由・環境変数）:
  BACKUP_R2_BUCKET_NAME       保存先バケット（必須。画像用と分けることを推奨）
  BACKUP_R2_ACCESS_KEY_ID     未設定なら R2_ACCESS_KEY_ID にフォールバック
  BACKUP_R2_SECRET_ACCESS_KEY 同上（R2_SECRET_ACCESS_KEY）
  BACKUP_R2_ENDPOINT_URL      同上（R2_ENDPOINT_URL）
  BACKUP_RETENTION            保持世代数（既定 30）。超過した古い世代は自動削除
  BACKUP_PREFIX               キー接頭辞（既定 "db-backups/"）

例:
  python manage.py backup_db                 # R2 へアップロード＋古い世代を掃除
  python manage.py backup_db --local-only    # ローカルに dump.json.gz を出すだけ
  python manage.py backup_db --no-prune      # アップロードのみ（古い世代を消さない）
  python manage.py backup_db --keep 7        # この実行に限り保持7世代で掃除
"""
import datetime
import gzip
import io

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

# dumpdata から除外するもの:
#  - contenttypes / auth.permission は migrate で再生成されるため loaddata 時に
#    主キー衝突を起こしやすい。除外が Django の定石。
#  - sessions は揮発データなのでバックアップ不要。
EXCLUDED_APPS_MODELS = [
    "contenttypes",
    "auth.permission",
    "sessions.session",
    "admin.logentry",
]


class Command(BaseCommand):
    help = "DB を dumpdata で JSON 化・gzip 圧縮し、Cloudflare R2 に退避する"

    def add_arguments(self, parser):
        parser.add_argument(
            "--local-only",
            action="store_true",
            help="R2 にアップロードせず、カレントに dump ファイルを出力するだけ。",
        )
        parser.add_argument(
            "--no-prune",
            action="store_true",
            help="アップロードのみ行い、古い世代の自動削除をしない。",
        )
        parser.add_argument(
            "--keep",
            type=int,
            default=None,
            help="この実行での保持世代数（既定は settings.BACKUP_RETENTION）。",
        )

    def handle(self, **options):
        payload = self._dump_gzip()
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        filename = f"rentalist-{timestamp}.json.gz"

        if options["local_only"]:
            with open(filename, "wb") as f:
                f.write(payload)
            self.stdout.write(self.style.SUCCESS(
                f"ローカルに書き出しました: {filename} ({len(payload):,} bytes)"
            ))
            return

        bucket = settings.BACKUP_R2_BUCKET_NAME
        if not bucket:
            raise CommandError(
                "BACKUP_R2_BUCKET_NAME が未設定です。R2 へ退避するバケット名を設定するか、"
                "--local-only を使ってください。"
            )

        client = self._r2_client()
        key = f"{settings.BACKUP_PREFIX}{filename}"
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=payload,
            ContentType="application/gzip",
        )
        self.stdout.write(self.style.SUCCESS(
            f"R2 にアップロードしました: s3://{bucket}/{key} ({len(payload):,} bytes)"
        ))

        if not options["no_prune"]:
            keep = options["keep"] if options["keep"] is not None else settings.BACKUP_RETENTION
            self._prune(client, bucket, keep)

    def _dump_gzip(self):
        """dumpdata の出力を gzip 圧縮したバイト列を返す。"""
        buf = io.StringIO()
        call_command(
            "dumpdata",
            *(f"--exclude={item}" for item in EXCLUDED_APPS_MODELS),
            natural_foreign=True,
            indent=None,
            stdout=buf,
        )
        return gzip.compress(buf.getvalue().encode("utf-8"))

    def _r2_client(self):
        import boto3

        missing = [
            name for name, val in (
                ("BACKUP_R2_ACCESS_KEY_ID/R2_ACCESS_KEY_ID", settings.BACKUP_R2_ACCESS_KEY_ID),
                ("BACKUP_R2_SECRET_ACCESS_KEY/R2_SECRET_ACCESS_KEY", settings.BACKUP_R2_SECRET_ACCESS_KEY),
                ("BACKUP_R2_ENDPOINT_URL/R2_ENDPOINT_URL", settings.BACKUP_R2_ENDPOINT_URL),
            ) if not val
        ]
        if missing:
            raise CommandError(
                "R2 の認証情報が不足しています: " + ", ".join(missing)
            )
        return boto3.client(
            "s3",
            aws_access_key_id=settings.BACKUP_R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.BACKUP_R2_SECRET_ACCESS_KEY,
            endpoint_url=settings.BACKUP_R2_ENDPOINT_URL,
            region_name="auto",
        )

    def _prune(self, client, bucket, keep):
        """接頭辞配下のダンプを新しい順に keep 世代残し、古いものを削除する。"""
        if keep <= 0:
            return
        prefix = settings.BACKUP_PREFIX
        objects = []
        token = None
        while True:
            kwargs = {"Bucket": bucket, "Prefix": prefix}
            if token:
                kwargs["ContinuationToken"] = token
            resp = client.list_objects_v2(**kwargs)
            objects.extend(resp.get("Contents", []))
            if not resp.get("IsTruncated"):
                break
            token = resp.get("NextContinuationToken")

        # キー名にUTCタイムスタンプを含むため辞書順＝時系列順。新しい順に並べ替える。
        objects.sort(key=lambda o: o["Key"], reverse=True)
        stale = objects[keep:]
        if not stale:
            self.stdout.write(f"古い世代の削除対象はありません（保持 {keep} 世代）。")
            return

        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": o["Key"]} for o in stale]},
        )
        self.stdout.write(self.style.SUCCESS(
            f"古い世代を {len(stale)} 件削除しました（保持 {keep} 世代）。"
        ))
