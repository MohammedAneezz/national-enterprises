from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.models import Line, Sale, Payment, Due, Customer
from app.api.deps import current_user
from app.api.core import require, record

router = APIRouter(tags=["reports"])


@router.get("/reports/daily")
def daily(line_id: int = Query(gt=0), day: date | None = None, db: Session = Depends(get_db), _=Depends(current_user)):
    require(db, Line, line_id)
    zone = ZoneInfo(settings.BUSINESS_TIMEZONE)
    day = day or datetime.now(zone).date()
    start = datetime.combine(day, time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    end = datetime.combine(day + timedelta(days=1), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    sales = db.query(Sale).filter(Sale.line_id == line_id, Sale.start_date == day).all()
    payments = db.query(Payment).filter(Payment.line_id == line_id, Payment.paid_at >= start, Payment.paid_at < end).all()
    rows = db.query(Due, Customer).join(Sale, Due.sale_id == Sale.id).join(Customer, Sale.customer_id == Customer.id).filter(
        Due.line_id == line_id, Sale.line_id == line_id, Customer.line_id == line_id, Due.due_date <= day).order_by(Due.due_date, Due.id).all()

    def due_record(due, customer):
        return {**record(due), "due_id": due.id, "balance": float(due.due_amt - due.paid_amt),
                "customer_id": customer.id, "customer_name": customer.name, "area": customer.area, "phone": customer.phone}

    left_outs = [due_record(d, c) for d, c in rows if d.due_date == day and d.status != "PAID"]
    overdue = [due_record(d, c) for d, c in rows if d.due_date < day and d.status != "PAID"]
    cash = sum((p.amount for p in payments if p.mode == "CASH"), Decimal("0"))
    upi = sum((p.amount for p in payments if p.mode == "UPI"), Decimal("0"))
    return {
        "day": str(day), "line_id": line_id,
        "sales_count": len(sales), "sales_amount": float(sum((s.total_emi for s in sales), Decimal("0"))),
        "collected_count": len(payments), "collected_amount": float(cash + upi),
        "cash": float(cash), "upi": float(upi),
        "due_today_count": sum(d.due_date == day for d, _ in rows),
        "left_out_count": len(left_outs), "left_outs": left_outs,
        "overdue_count": len(overdue), "overdue": overdue,
    }
