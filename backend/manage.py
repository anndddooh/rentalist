#!/usr/bin/env python
"""Django のコマンドラインユーティリティ。"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rentalist.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django をインポートできませんでした。仮想環境を有効化し "
            "`pip install -r requirements.txt` を実行してください。"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
