from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Line, Customer, Product, Sale, Due, Payment
from app.schemas.schemas import CustomerIn, ProductIn, StockIn, SaleIn, PaymentIn
from app.api.deps import current_user
from datetime import date, timedelta

router = APIRouter(tags=["core"])

# --- Lines ---
@router.get("/lines")
def lines(db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(Line).order_by(Line.id).all()

# --- Customers (area only, no address/id-proof) ---
@router.post("/customers")
def add_customer(b: CustomerIn, db: Session = Depends(get_db), _=Depends(current_user)):
    c = Customer(line_id=b.line_id, name=b.name, phone=b.phone, area=b.area, notes=b.notes)
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.get("/customers")
def list_customers(line_id: int | None = None, area: str | None = None, q: str | None = None,
                   db: Session = Depends(get_db), _=Depends(current_user)):
    qry = db.query(Customer)
    if line_id: qry = qry.filter(Customer.line_id == line_id)
    if area: qry = qry.filter(Customer.area == area)
    if q: qry = qry.filter(Customer.name.contains(q))
    return qry.order_by(Customer.id.desc()).limit(500).all()

@router.get("/areas")
def areas(line_id: int | None = None, db: Session = Depends(get_db), _=Depends(current_user)):
    qry = db.query(Customer.area)
    if line_id: qry = qry.filter(Customer.line_id == line_id)
    return sorted({r[0] for r in qry.distinct().all() if r[0]})

@router.get("/customers/{cid}")
def customer_ledger(cid: int, db: Session = Depends(get_db), _=Depends(current_user)):
    c = db.query(Customer).get(cid)
    sales = db.query(Sale).filter(Sale.customer_id == cid).all()
    pays = db.query(Payment).filter(Payment.sale_id.in_([s.id for s in sales])).order_by(Payment.paid_at.desc()).all() if sales else []
    return {"customer": {"id": c.id, "name": c.name, "phone": c.phone, "area": c.area, "outstanding": c.outstanding, "line_id": c.line_id}, "sales": [{"id": s.id, "total_emi": s.total_emi, "financed": s.financed, "weekly_amt": s.weekly_amt, "status": s.status} for s in sales], "payments": [{"id": p.id, "amount": p.amount, "mode": p.mode, "paid_at": p.paid_at} for p in pays]}

# --- Products (came vs sold) ---
@router.post("/products")
def add_product(b: ProductIn, db: Session = Depends(get_db), _=Depends(current_user)):
    p = Product(**b.model_dump()); db.add(p); db.commit(); db.refresh(p)
    return p

@router.get("/products")
def list_products(db: Session = Depends(get_db), _=Depends(current_user)):
    ps = db.query(Product).all()
    return [{"id": p.id, "name": p.name, "sku": p.sku, "cost_price": p.cost_price, "emi_price": p.emi_price, "came": p.stock_in, "sold": p.stock_sold, "available": p.available} for p in ps]

@router.post("/products/{pid}/stock-in")
def stock_in(pid: int, b: StockIn, db: Session = Depends(get_db), _=Depends(current_user)):
    p = db.query(Product).get(pid); p.stock_in += b.qty; db.commit()
    return {"available": p.available}

# --- Sales + weekly anchored schedule ---
@router.post("/sales")
def create_sale(b: SaleIn, db: Session = Depends(get_db), _=Depends(current_user)):
    financed = b.total_emi - b.down_payment
    s = Sale(line_id=b.line_id, customer_id=b.customer_id, product_id=b.product_id, qty=b.qty,
             total_emi=b.total_emi, down_payment=b.down_payment, financed=financed,
             weekly_amt=b.weekly_amt, start_date=b.start_date, tenure_weeks=b.tenure_weeks)
    db.add(s); db.flush()
    for i in range(b.tenure_weeks):
        db.add(Due(sale_id=s.id, line_id=b.line_id, due_date=b.start_date + timedelta(days=7*i), due_amt=b.weekly_amt))
    if b.product_id:
        pr = db.query(Product).get(b.product_id)
        if pr: pr.stock_sold += b.qty
    c = db.query(Customer).get(b.customer_id)
    if c: c.outstanding += financed
    db.commit(); db.refresh(s)
    return {"sale_id": s.id, "financed": financed, "dues": b.tenure_weeks}

@router.get("/sales/{sid}/schedule")
def schedule(sid: int, db: Session = Depends(get_db), _=Depends(current_user)):
    return db.query(Due).filter(Due.sale_id == sid).order_by(Due.due_date).all()

# --- Payments: manual amt, CASH|UPI only, FIFO ---
@router.post("/payments")
def add_payment(b: PaymentIn, db: Session = Depends(get_db), _=Depends(current_user)):
    from fastapi import HTTPException
    try:
        mode = b.check()
    except AssertionError as e:
        raise HTTPException(400, str(e))
    s = db.get(Sale, b.sale_id)
    if not s:
        raise HTTPException(404, "sale not found")
    p = Payment(line_id=b.line_id, sale_id=b.sale_id, amount=b.amount, mode=mode, upi_ref=b.upi_ref, collector=b.collector)
    db.add(p)
    # FIFO apply to oldest unpaid dues
    rem = b.amount
    dues = db.query(Due).filter(Due.sale_id == b.sale_id, Due.status != "PAID").order_by(Due.due_date).all()
    for d in dues:
        if rem <= 0: break
        need = d.due_amt - d.paid_amt
        take = min(need, rem)
        d.paid_amt += take; rem -= take
        d.status = "PAID" if d.paid_amt >= d.due_amt - 1e-6 else "PARTIAL"
    # update balances
    s_dues = db.query(Due).filter(Due.sale_id == b.sale_id).all()
    if all(d.status == "PAID" for d in s_dues):
        s.status = "CLOSED"
    c = db.query(Customer).get(s.customer_id)
    if c: c.outstanding = max(0, (c.outstanding or 0) - b.amount)
    db.commit()
    return {"payment_id": p.id, "applied": b.amount - rem, "mode": mode}
