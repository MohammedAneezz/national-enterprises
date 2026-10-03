"""Start an isolated API for browser tests. Never opens national.db."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="national-e2e-") as directory:
        os.environ["DATABASE_URL"] = "sqlite:///" + (Path(directory) / "test.db").as_posix()
        os.environ["ADMIN_PASSWORD"] = "admin123"
        os.environ["BUSINESS_TIMEZONE"] = "Asia/Kolkata"
        import uvicorn
        uvicorn.run("app.main:app", host="127.0.0.1", port=8001)
