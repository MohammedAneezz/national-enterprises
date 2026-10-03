from datetime import timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import inspect, or_
from sqlalchemy.orm import Session
from app.core.database import get_db, begin_write
from app.models.models import Line, Customer, Product, Sale, Due, Payment
from app.schemas.schemas import CustomerIn, ProductIn, StockIn, SaleIn, PaymentIn
from app.api.deps import current_user

router = APIRouter(tags=["collections"])


def record(obj):
    return {column.key: (float(value) if isinstance(value, Decimal) else value)
            for column in inspect(obj).mapper.column_attrs
            for value in [getattr(obj, column.key)]}


def require(db, model, identity, line_id=None, for_update=False):
    query = db.query(model).filter(model.id == identity)
    obj = (query.with_for_update().first() if for_update and db.get_bind().dialect.name == "postgresql" else db.get(model, identity))
    if obj is None or (line_id is not None and obj.line_id != line_id):
        raise HTTPException(404, f"{model.__name__} not found in this line" if line_id else f"{model.__name__} not found")
    return obj


def product_record(product):
    return {**record(product), "came": product.stock_in, "sold": product.stock_sold, "available": product.available}


@router.get("/lines")
def lines(db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(Line).order_by(Line.id).all()


@router.post("/customers")
def add_customer(body: CustomerIn, db: Session = Depends(get_db), _=Depends(current_user)):
    begin_write(db)
    require(db, Line, body.line_id)
    customer = Customer(**body.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return record(customer)


@router.get("/customers")
def list_customers(line_id: int = Query(gt=0), area: str | None = None, q: str | None = None,
                   db: Session = Depends(get_db), _=Depends(current_user)):
    require(db, Line, line_id)
    query = db.query(Customer).filter(Customer.line_id == line_id)
    if area is not None:
        query = query.filter(Customer.area == area.strip())
    if q and q.strip():
        query = query.filter(or_(Customer.name.contains(q.strip(), autoescape=True), Customer.phone.contains(q.strip(), autoescape=True)))
    return [record(c) for c in query.order_by(Customer.name, Customer.id).all()]


@router.get("/areas")
def areas(line_id: int = Query(gt=0), db: Session = Depends(get_db), _=Depends(current_user)):
    require(db, Line, line_id)
    return [r[0] for r in db.query(Customer.area).filter(Customer.line_id == line_id, Customer.area != "").distinct().order_by(Customer.area).all()]


@router.get("/customers/{cid}")
def customer_ledger(cid: int, line_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db), _=Depends(current_user)):
    customer = require(db, Customer, cid, line_id)
    sales = db.query(Sale).filter(Sale.customer_id == cid, Sale.line_id == customer.line_id).order_by(Sale.id.desc()).all()
    payments = db.query(Payment).filter(Payment.sale_id.in_([s.id for s in sales]), Payment.line_id == customer.line_id).order_by(Payment.paid_at.desc(), Payment.id.desc()).all()
    return {"customer": record(customer), "sales": [record(s) for s in sales], "payments": [record(p) for p in payments]}


@router.post("/products")
def add_product(body: ProductIn, db: Session = Depends(get_db), _=Depends(current_user)):
    begin_write(db)
    if body.sku and db.query(Product).filter(Product.sku == body.sku).first():
        raise HTTPException(409, "This SKU already exists; use Stock In on the existing product")
    product = Product(**body.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product_record(product)


@router.get("/products")
def list_products(db: Session = Depends(get_db), _=Depends(current_user)):
    return [product_record(p) for p in db.query(Product).order_by(Product.name, Product.id).all()]


@router.post("/products/{pid}/stock-in")
def stock_in(pid: int, body: StockIn, db: Session = Depends(get_db), _=Depends(current_user)):
    begin_write(db)
    product = require(db, Product, pid, for_update=True)
    product.stock_in += body.qty
    db.commit()
    return product_record(product)


@router.post("/sales")
def create_sale(body: SaleIn, db: Session = Depends(get_db), _=Depends(current_user)):
    begin_write(db)
    require(db, Line, body.line_id)
    customer = require(db, Customer, body.customer_id, body.line_id, for_update=True)
    product = require(db, Product, body.product_id, for_update=True)
    if product.available < body.qty:
        raise HTTPException(400, f"Only {product.available} units are available")
    financed = body.total_emi - body.down_payment
    if financed < 0:
        raise HTTPException(400, "Down payment cannot exceed total EMI")
    # Keep regular weekly amounts and put the exact remainder in the final week.
    if financed and not (body.weekly_amt * (body.tenure_weeks - 1) < financed <= body.weekly_amt * body.tenure_weeks):
        raise HTTPException(400, "Tenure must equal financed / weekly amount, rounded up; the final installment may be smaller")
    sale = Sale(**body.model_dump(), financed=financed, status="OPEN" if financed else "CLOSED")
    db.add(sale)
    db.flush()
    remaining = financed
    for i in range(body.tenure_weeks):
        amount = min(body.weekly_amt, remaining)
        db.add(Due(sale_id=sale.id, line_id=body.line_id,
                   due_date=body.start_date + timedelta(days=7 * i),
                   due_amt=amount, paid_amt=0, status="PENDING" if amount else "PAID"))
        remaining -= amount
    product.stock_sold += body.qty
    customer.outstanding += financed
    db.commit()
    return {"sale_id": sale.id, "financed": float(financed), "dues": body.tenure_weeks}


@router.get("/sales/{sid}/schedule")
def schedule(sid: int, line_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db), _=Depends(current_user)):
    sale = require(db, Sale, sid, line_id)
    return [record(d) for d in db.query(Due).filter(Due.sale_id == sid, Due.line_id == sale.line_id).order_by(Due.due_date, Due.id).all()]


@router.post("/payments")
def add_payment(body: PaymentIn, db: Session = Depends(get_db), user=Depends(current_user)):
    mode = body.mode.upper()
    if mode not in ("CASH", "UPI"):
        raise HTTPException(400, "Payment mode must be CASH or UPI")
    if mode == "UPI" and not body.upi_ref:
        raise HTTPException(400, "UPI reference is required")
    begin_write(db)
    sale = require(db, Sale, body.sale_id, body.line_id, for_update=True)
    customer = require(db, Customer, sale.customer_id, body.line_id, for_update=True)
    dues = db.query(Due).filter(Due.sale_id == sale.id, Due.line_id == body.line_id).order_by(Due.due_date, Due.id).all()
    balance = sum((d.due_amt - d.paid_amt for d in dues), Decimal("0"))
    if sale.status == "CLOSED" or body.amount > balance:
        raise HTTPException(400, f"Collection exceeds the sale balance of {balance:.2f}")
    payment = Payment(line_id=sale.line_id, sale_id=sale.id, amount=body.amount, mode=mode,
                      upi_ref=body.upi_ref if mode == "UPI" else "", collector=user.username)
    db.add(payment)
    remaining = body.amount
    for due in dues:
        if remaining == 0:
            break
        needed = due.due_amt - due.paid_amt
        if needed <= 0:
            continue
        applied = min(needed, remaining)
        due.paid_amt += applied
        remaining -= applied
        due.status = "PAID" if due.paid_amt == due.due_amt else "PARTIAL"
    if all(d.status == "PAID" for d in dues):
        sale.status = "CLOSED"
    customer.outstanding = max(Decimal("0"), customer.outstanding - body.amount)
    db.commit()
    return {"payment_id": payment.id, "applied": float(body.amount), "amount": float(body.amount), "mode": mode,
            "sale_id": sale.id, "sale_status": sale.status, "outstanding": float(customer.outstanding)}
