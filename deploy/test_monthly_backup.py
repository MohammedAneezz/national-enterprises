"""No cloud credentials required: exercise the backup command and verification flow."""
import os
import subprocess
from pathlib import Path
from unittest.mock import patch
from monthly_backup import backup


def test_monthly_backup_uploads_and_verifies():
    commands = []

    def run(command, **kwargs):
        commands.append(command)
        if command[0] == "pg_dump":
            Path(command[command.index("--file") + 1]).write_bytes(b"postgres backup")
        if command[0:3] == ["aws", "s3api", "head-object"]:
            return subprocess.CompletedProcess(command, 0, stdout="15\n")
        return subprocess.CompletedProcess(command, 0)

    env = {"DATABASE_URL": "postgresql://test:test@localhost/test", "BACKUP_S3_BUCKET": "test-backup", "AWS_DEFAULT_REGION": "ap-southeast-1"}
    with patch.dict(os.environ, env), patch("monthly_backup.subprocess.run", side_effect=run):
        backup()

    assert commands[0][0] == "pg_dump"
    assert "--format=custom" in commands[0]
    assert commands[1][:3] == ["aws", "s3", "cp"]
    assert commands[1][5:7] == ["--sse", "AES256"]
    assert commands[2][:3] == ["aws", "s3api", "head-object"]
