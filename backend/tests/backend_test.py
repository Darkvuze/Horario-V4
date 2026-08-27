"""Backend regression tests for FaZes parse-schedule async job API."""
import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

PDF_PATH = "/app/test_files/HORARIO_TTAES_PLACA_SETEMBRO_2026.pdf"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    return s


# ---------- health ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["service"] == "FaZes API"


# ---------- validation ----------
class TestValidation:
    def test_non_pdf_rejected(self, api):
        r = api.post(
            f"{BASE_URL}/api/parse-schedule",
            files={"file": ("a.txt", b"hello", "text/plain")},
            timeout=30,
        )
        assert r.status_code == 400
        assert "PDF" in r.json().get("detail", "")

    def test_empty_pdf_rejected(self, api):
        r = api.post(
            f"{BASE_URL}/api/parse-schedule",
            files={"file": ("a.pdf", b"", "application/pdf")},
            timeout=30,
        )
        assert r.status_code == 400

    def test_missing_file_returns_422(self, api):
        r = api.post(f"{BASE_URL}/api/parse-schedule", timeout=30)
        assert r.status_code == 422

    def test_unknown_job_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/parse-schedule/deadbeefdeadbeef", timeout=30)
        assert r.status_code == 404


# ---------- OCR job flow (image PDF -> Gemini vision) ----------
class TestParseScheduleJob:
    def test_image_pdf_ocr_job(self, api):
        assert os.path.exists(PDF_PATH), f"missing test file {PDF_PATH}"
        with open(PDF_PATH, "rb") as f:
            r = api.post(
                f"{BASE_URL}/api/parse-schedule",
                files={"file": (os.path.basename(PDF_PATH), f.read(), "application/pdf")},
                timeout=60,
            )
        assert r.status_code == 200, r.text[:500]
        body = r.json()
        assert body["status"] == "pending"
        job_id = body["job_id"]
        assert isinstance(job_id, str) and len(job_id) > 10

        result = None
        deadline = time.time() + 240
        saw_pending = False
        while time.time() < deadline:
            pr = api.get(f"{BASE_URL}/api/parse-schedule/{job_id}", timeout=30)
            assert pr.status_code == 200, pr.text[:300]
            pdata = pr.json()
            if pdata["status"] == "pending":
                saw_pending = True
                time.sleep(3)
                continue
            if pdata["status"] == "error":
                pytest.fail(f"Job failed: {pdata.get('detail')}")
            result = pdata["result"]
            break
        assert result is not None, "job did not finish within 240s"
        print(f"saw_pending={saw_pending}")

        assert result["month"] == 9
        assert result["year"] == 2026
        assert len(result["employees"]) == 7, [e["name"] for e in result["employees"]]
        for emp in result["employees"]:
            assert emp["employee_id"]
            assert emp["name"]
            assert len(emp["days"]) == 30, f"{emp['name']} has {len(emp['days'])} days"
            filled = [d for d in emp["days"] if d["code"]]
            assert len(filled) == 30, f"{emp['name']} filled={len(filled)}"
        assert isinstance(result["raw_codes"], list) and len(result["raw_codes"]) > 0
        print("codes:", result["raw_codes"])
