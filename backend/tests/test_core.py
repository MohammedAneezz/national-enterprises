from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.init_db import init_db
from app.core.security import create_token
from app.models.models import Customer, Due, Payment, Product, Sale, User


@pytest.fixture
def setup(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False, "timeout": 30})
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    factory = sessionmaker(bind=engine, autoflush=False)
    Base.metadata.create_all(engine)
    with factory() as db:
        init_db(db)
    def override():
        with factory() as db:
            try:
                yield db
            except Exception:
                db.rollback()
                raise
    app.dependency_overrides[get_db] = override
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {create_token('admin')}"
    yield client, factory
    client.close()
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def client(setup):
    return setup[0]


def create_sale(client, **overrides):
    customer = client.post("/api/v1/customers", json={"line_id": 1, "name": "Ravi", "area": "Sattur"}).json()
    product = client.post("/api/v1/products", json={"name": "Mixer", "emi_price": 4000, "stock_in": 10}).json()
    body = {"line_id": 1, "customer_id": customer["id"], "product_id": product["id"], "qty": 1,
            "total_emi": 4000, "down_payment": 400, "weekly_amt": 900, "start_date": "2026-09-22", "tenure_weeks": 4}
    body.update(overrides)
    response = client.post("/api/v1/sales", json=body)
    assert response.status_code == 200, response.text
    return response.json(), customer, product


def pay(client, sid, amount, **extra):
    return client.post("/api/v1/payments", json={"line_id": 1, "sale_id": sid, "amount": amount, "mode": "CASH", **extra})


def schedule(client, sid):
    return client.get(f"/api/v1/sales/{sid}/schedule", params={"line_id": 1}).json()


def report(client, day="2026-09-22", line=1):
    response = client.get("/api/v1/reports/daily", params={"line_id": line, "day": day})
    assert response.status_code == 200, response.text
    return response.json()


def test_lines_seed_and_login(client):
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    lines = client.get("/api/v1/lines", headers={"Authorization": "Bearer " + response.json()["access_token"]}).json()
    assert [line["name"] for line in lines] == ["A-Line", "B-Line", "C-Line"]


def test_customer_only_name_area(client):
    response = client.post("/api/v1/customers", json={"line_id": 1, "name": "Ravi", "area": "Kovilpatti"})
    assert response.status_code == 200
    assert set(response.json()) == {"id", "line_id", "name", "phone", "area", "notes", "outstanding"}
    assert response.json()["phone"] == ""
    assert response.json()["outstanding"] == 0


def test_emi_weekly_anchor_and_collect(client):
    sale, customer, _ = create_sale(client)
    assert sale["financed"] == 3600
    dues = schedule(client, sale["sale_id"])
    assert len(dues) == 4
    assert dues[0]["due_date"] == "2026-09-22"
    assert dues[1]["due_date"] == "2026-09-29"
    # Matches quick-add 100+200+500, then manually edit to 750.
    assert pay(client, sale["sale_id"], 750).json()["applied"] == 750
    assert pay(client, sale["sale_id"], 100, mode="UPI").status_code == 400
    assert pay(client, sale["sale_id"], 100, mode="UPI", upi_ref="  ").status_code == 400
    assert pay(client, sale["sale_id"], 150, mode="UPI", upi_ref="UPI123").status_code == 200
    dues = schedule(client, sale["sale_id"])
    assert dues[0]["status"] == "PAID"
    ledger = client.get(f"/api/v1/customers/{customer['id']}").json()
    assert ledger["customer"]["outstanding"] == 2700


def test_daily_report_leftouts(client):
    sale, _, _ = create_sale(client)
    result = report(client)
    assert {"left_outs", "cash", "upi"}.issubset(result)
    assert result["sales_count"] == 1
    assert result["sales_amount"] == 4000
    assert result["due_today_count"] == result["left_out_count"] == 1
    assert result["left_outs"][0]["sale_id"] == sale["sale_id"]
    pay(client, sale["sale_id"], 100)
    assert report(client)["left_outs"][0]["status"] == "PARTIAL"
    pay(client, sale["sale_id"], 800)
    assert report(client)["left_outs"] == []
    assert report(client, "2026-10-01")["overdue_count"] == 1


def test_line_isolation_and_required_scope(client):
    sale, customer, _ = create_sale(client)
    for endpoint in ("customers", "areas", "reports/daily"):
        assert client.get(f"/api/v1/{endpoint}").status_code == 422
    assert client.get("/api/v1/customers", params={"line_id": 2}).json() == []
    assert client.get("/api/v1/areas", params={"line_id": 2}).json() == []
    assert client.get(f"/api/v1/customers/{customer['id']}", params={"line_id": 2}).status_code == 404
    assert client.get(f"/api/v1/sales/{sale['sale_id']}/schedule", params={"line_id": 2}).status_code == 404
    assert pay(client, sale["sale_id"], 100, line_id=2).status_code == 404
    pay(client, sale["sale_id"], 100)
    result = report(client, line=2)
    assert result["collected_amount"] == result["sales_amount"] == result["due_today_count"] == 0


def test_cross_line_sale_rejected(client):
    _, customer, product = create_sale(client)
    response = client.post("/api/v1/sales", json={"line_id": 2, "customer_id": customer["id"], "product_id": product["id"],
        "qty": 1, "total_emi": 100, "weekly_amt": 100, "start_date": "2026-09-22", "tenure_weeks": 1})
    assert response.status_code == 404
    assert client.get("/api/v1/products").json()[0]["sold"] == 1


def test_fifo_closure_and_overpayment(client):
    sale, customer, _ = create_sale(client)
    sid = sale["sale_id"]
    assert pay(client, sid, 1000).status_code == 200
    dues = schedule(client, sid)
    assert [(d["paid_amt"], d["status"]) for d in dues] == [(900, "PAID"), (100, "PARTIAL"), (0, "PENDING"), (0, "PENDING")]
    assert pay(client, sid, 2601).status_code == 400
    assert pay(client, sid, 2600).json()["sale_status"] == "CLOSED"
    assert all(d["status"] == "PAID" for d in schedule(client, sid))
    assert pay(client, sid, 1).status_code == 400
    assert client.get(f"/api/v1/customers/{customer['id']}").json()["customer"]["outstanding"] == 0


def test_final_installment_exact(client):
    sale, _, _ = create_sale(client, total_emi="100.00", down_payment=0, weekly_amt="33.34", tenure_weeks=3)
    dues = schedule(client, sale["sale_id"])
    assert [d["due_amt"] for d in dues] == [33.34, 33.34, 33.32]
    assert sum(Decimal(str(d["due_amt"])) for d in dues) == Decimal("100.00")
    assert pay(client, sale["sale_id"], "100.00").json()["sale_status"] == "CLOSED"


def test_fully_paid_purchase(client):
    sale, customer, _ = create_sale(client, down_payment=4000)
    assert sale["financed"] == 0
    assert all(d["status"] == "PAID" for d in schedule(client, sale["sale_id"]))
    assert client.get(f"/api/v1/customers/{customer['id']}").json()["sales"][0]["status"] == "CLOSED"


@pytest.mark.parametrize("overrides", [{"qty": 0}, {"qty": -1}, {"tenure_weeks": 0}, {"down_payment": 5000}, {"weekly_amt": 100}, {"weekly_amt": 5000}, {"total_emi": -1}, {"total_emi": "NaN"}])
def test_invalid_sale_is_atomic(client, overrides):
    _, customer, product = create_sale(client)
    body = {"line_id": 1, "customer_id": customer["id"], "product_id": product["id"], "qty": 1,
            "total_emi": 4000, "down_payment": 400, "weekly_amt": 900, "start_date": "2026-09-22", "tenure_weeks": 4, **overrides}
    assert client.post("/api/v1/sales", json=body).status_code in (400, 422)
    assert client.get("/api/v1/products").json()[0]["sold"] == 1
    assert client.get(f"/api/v1/customers/{customer['id']}").json()["customer"]["outstanding"] == 3600


@pytest.mark.parametrize("amount", [0, -1, "NaN", "Infinity", "1.001"])
def test_invalid_payment(client, amount):
    sale, _, _ = create_sale(client)
    assert pay(client, sale["sale_id"], amount).status_code == 422


def test_modes_collector_and_auth(client):
    sale, _, _ = create_sale(client)
    assert pay(client, sale["sale_id"], 1, mode="CARD").status_code == 400
    assert pay(client, sale["sale_id"], 1, collector="forged").status_code == 422
    assert client.get("/api/v1/lines", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401


def test_not_found_and_stock_validation(client):
    assert client.get("/api/v1/customers/999").status_code == 404
    assert client.get("/api/v1/sales/999/schedule").status_code == 404
    assert client.post("/api/v1/products/999/stock-in", json={"qty": 1}).status_code == 404
    assert client.post("/api/v1/customers", json={"line_id": 999, "name": "Ravi"}).status_code == 404
    product = client.post("/api/v1/products", json={"name": "Fan", "stock_in": 0}).json()
    assert client.post(f"/api/v1/products/{product['id']}/stock-in", json={"qty": -1}).status_code == 422
    stock = client.post(f"/api/v1/products/{product['id']}/stock-in", json={"qty": 3}).json()
    assert (stock["came"], stock["sold"], stock["available"]) == (3, 0, 3)


def test_daily_timezone_and_exclusive_end(setup):
    client, factory = setup
    sale, _, _ = create_sale(client)
    with factory() as db:
        for stamp, mode, amount in [
            (datetime(2026, 9, 21, 18, 29, 59), "CASH", 10),
            (datetime(2026, 9, 21, 18, 30), "CASH", 20),
            (datetime(2026, 9, 22, 18, 29, 59, 999999), "UPI", 30),
            (datetime(2026, 9, 22, 18, 30), "UPI", 40),
        ]:
            db.add(Payment(line_id=1, sale_id=sale["sale_id"], amount=amount, mode=mode, collector="admin", upi_ref="test", paid_at=stamp))
        db.commit()
    result = report(client)
    assert (result["collected_count"], result["cash"], result["upi"], result["collected_amount"]) == (2, 20, 30, 50)
    assert report(client, line=2)["collected_amount"] == 0


def test_concurrent_payments_cannot_overcollect(client):
    sale, _, _ = create_sale(client, total_emi=1000, down_payment=0, weekly_amt=250)
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda _: pay(client, sale["sale_id"], 800).status_code, range(2)))
    assert sorted(codes) == [200, 400]
    assert sum(d["paid_amt"] for d in schedule(client, sale["sale_id"])) == 800


def test_oversell_rejected_without_balance_change(client):
    sale, customer, product = create_sale(client, qty=10)
    response = client.post("/api/v1/sales", json={"line_id": 1, "customer_id": customer["id"], "product_id": product["id"],
        "qty": 1, "total_emi": 100, "weekly_amt": 100, "start_date": "2026-09-22", "tenure_weeks": 1})
    assert response.status_code == 400
    assert client.get("/api/v1/products").json()[0]["available"] == 0
    assert client.get(f"/api/v1/customers/{customer['id']}").json()["customer"]["outstanding"] == 3600
