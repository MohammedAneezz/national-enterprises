import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.init_db import init_db

from sqlalchemy.pool import StaticPool
from app.models import models  # ensure tables registered

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

def over():
    db = TestSession()
    try:
        init_db(db)
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = over
client = TestClient(app)

def token():
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}

def test_lines_seed():
    h = token()
    r = client.get("/api/v1/lines", headers=h)
    assert r.status_code == 200
    names = [x["name"] for x in r.json()]
    assert "A-Line" in names and "B-Line" in names and "C-Line" in names

def test_customer_area_only():
    h = token()
    r = client.post("/api/v1/customers", headers=h, json={"line_id": 1, "name": "Ravi", "phone": "999", "area": "Kovilpatti", "notes": ""})
    assert r.status_code == 200, r.text
    assert r.json()["area"] == "Kovilpatti"
    assert "address" not in r.json()

def test_emi_weekly_anchor_and_collect():
    h = token()
    c = client.post("/api/v1/customers", headers=h, json={"line_id": 1, "name": "EMI User", "area": "Sattur"}).json()
    p = client.post("/api/v1/products", headers=h, json={"name": "Mixer", "emi_price": 4000, "stock_in": 10}).json()
    s = client.post("/api/v1/sales", headers=h, json={"line_id": 1, "customer_id": c["id"], "product_id": p["id"], "qty": 1, "total_emi": 4000, "down_payment": 400, "weekly_amt": 900, "start_date": "2026-09-22", "tenure_weeks": 4}).json()
    assert s["financed"] == 3600
    sch = client.get(f"/api/v1/sales/{s['sale_id']}/schedule", headers=h).json()
    assert len(sch) == 4
    assert sch[1]["due_date"] == "2026-09-29"  # +7 days anchor
    # manual collect 100+200+500 style total = 800 cash
    pay = client.post("/api/v1/payments", headers=h, json={"line_id": 1, "sale_id": s["sale_id"], "amount": 800, "mode": "CASH"}).json()
    assert pay["mode"] == "CASH"
    # UPI requires ref
    bad = client.post("/api/v1/payments", headers=h, json={"line_id": 1, "sale_id": s["sale_id"], "amount": 100, "mode": "UPI"})
    assert bad.status_code != 200
    good = client.post("/api/v1/payments", headers=h, json={"line_id": 1, "sale_id": s["sale_id"], "amount": 100, "mode": "UPI", "upi_ref": "UPI123"}).json()
    assert good["mode"] == "UPI"

def test_daily_report_leftouts():
    h = token()
    r = client.get("/api/v1/reports/daily", headers=h, params={"line_id": 1, "day": "2026-09-22"})
    assert r.status_code == 200
    j = r.json()
    assert "left_outs" in j and "cash" in j and "upi" in j
