"""Dump PostgreSQL to an encrypted S3 object and verify its uploaded size.

The cron process exits nonzero if any stage fails, so Render marks the run failed.
"""

import hashlib
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def backup():
    database_url = os.environ["DATABASE_URL"]
    bucket = os.environ["BACKUP_S3_BUCKET"]
    os.environ["AWS_DEFAULT_REGION"]
    now = datetime.now(timezone.utc)
    key = f"national-enterprises/{now:%Y/%m}/national-{now:%Y%m%dT%H%M%SZ}.dump"

    with tempfile.TemporaryDirectory(prefix="national-backup-") as directory:
        archive = Path(directory) / "database.dump"
        subprocess.run([
            "pg_dump", "--format=custom", "--no-owner", "--no-acl",
            "--dbname", database_url, "--file", str(archive),
        ], check=True)
        size = archive.stat().st_size
        if size == 0:
            raise RuntimeError("pg_dump produced an empty file")
        checksum = hashlib.sha256()
        with archive.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                checksum.update(chunk)
        digest = checksum.hexdigest()
        subprocess.run([
            "aws", "s3", "cp", str(archive), f"s3://{bucket}/{key}",
            "--sse", "AES256", "--only-show-errors",
        ], check=True)
        result = subprocess.run([
            "aws", "s3api", "head-object", "--bucket", bucket,
            "--key", key, "--query", "ContentLength", "--output", "text",
        ], check=True, text=True, capture_output=True)
        if int(result.stdout.strip()) != size:
            raise RuntimeError("Uploaded backup size does not match pg_dump file")
        print(f"Backup verified: s3://{bucket}/{key}, {size} bytes, SHA256 {digest}")


if __name__ == "__main__":
    backup()
