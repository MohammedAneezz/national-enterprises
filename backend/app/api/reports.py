from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from app.core.database import get_db
from app.models.models import Sale, Payment, Due
from app.api.deps import current_user

router = APIRouter(tags=["reports"])

@router.get("/reports/daily")
def daily(line_id: int | None = None, day: date | None = None, db: Session = Depends(get_db), _=Depends(current_user)):
    day = day or date.today()
    start = datetime(day.year, day.month, day.day)
    end = datetime(day.year, day.month, day.day, 23, 59, 59)
    sq = db.query(Sale)
    pq = db.query(Payment).filter(Payment.paid_at >= start, Payment.paid_at <= end)
    dq = db.query(Due).filter(Due.due_date == day)
    if line_id:
        sq = sq.filter(Sale.line_id == line_id); pq = pq.filter(Payment.line_id == line_id); dq = dq.filter(Due.line_id == line_id)
    sales = sq.filter(Sale.created_at >= start, Sale.created_at <= end).all()
    pays = pq.all()
    dues_today = dq.all()
    paid_ids = {d.sale_id for d in dues_today if d.status == "PAID"}
    left_outs = [{"due_id": d.id, "sale_id": d.sale_id, "due_date": d.due_date, "due_amt": d.due_amt, "paid_amt": d.paid_amt, "status": d.status} for d in dues_today if d.status != "PAID"]
    overdue = db.query(Due).filter(Due.due_date < day, Due.status != "PAID")
    if line_id: overdue = overdue.filter(Due.line_id == line_id)
    overdue = overdue.order_by(Due.due_date).limit(500).all()
    return {
        "day": str(day), "line_id": line_id,
        "sales_count": len(sales), "sales_amount": sum(s.total_emi for s in sales),
        "collected_count": len(pays), "collected_amount": sum(p.amount for p in pays),
        "cash": sum(p.amount for p in pays if p.mode == "CASH"),
        "upi": sum(p.amount for p in pays if p.mode == "UPI"),
        "due_today_count": len(dues_today), "left_out_count": len(left_outs),
        "left_outs": left_outs,
        "overdue_count": len(overdue),
        "overdue": [{"due_id": d.id, "sale_id": d.sale_id, "due_date": d.due_date, "balance": d.due_amt - d.paid_amt} for d in overdue],
    }
