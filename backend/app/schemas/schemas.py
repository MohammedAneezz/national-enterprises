from pydantic import BaseModel
from datetime import date, datetime

class LoginIn(BaseModel):
    username: str
    password: str

class CustomerIn(BaseModel):
    line_id: int
    name: str
    phone: str = ""
    area: str = ""
    notes: str = ""

class ProductIn(BaseModel):
    name: str
    sku: str = ""
    cost_price: float = 0
    emi_price: float = 0
    stock_in: int = 0

class StockIn(BaseModel):
    qty: int

class SaleIn(BaseModel):
    line_id: int
    customer_id: int
    product_id: int | None = None
    qty: int = 1
    total_emi: float
    down_payment: float = 0
    weekly_amt: float
    start_date: date
    tenure_weeks: int

class PaymentIn(BaseModel):
    line_id: int
    sale_id: int
    amount: float
    mode: str  # CASH|UPI
    upi_ref: str = ""
    collector: str = "admin"

    def check(self):
        m = self.mode.upper()
        assert m in ("CASH", "UPI"), "mode must be CASH or UPI"
        assert self.amount > 0, "amount must be > 0"
        if m == "UPI":
            assert self.upi_ref.strip(), "upi_ref required for UPI"
        return m
