from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Line(Base):
    __tablename__ = "lines"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)  # A-Line, B-Line, C-Line

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed = Column(String, nullable=False)
    role = Column(String, default="admin")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, default="")
    area = Column(String, default="", index=True)
    notes = Column(String, default="")
    outstanding = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    sku = Column(String, default="")
    cost_price = Column(Float, default=0.0)
    emi_price = Column(Float, default=0.0)
    stock_in = Column(Integer, default=0)
    stock_sold = Column(Integer, default=0)

    @property
    def available(self):
        return (self.stock_in or 0) - (self.stock_sold or 0)

class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    qty = Column(Integer, default=1)
    total_emi = Column(Float, nullable=False)
    down_payment = Column(Float, default=0.0)
    financed = Column(Float, default=0.0)
    weekly_amt = Column(Float, nullable=False)
    start_date = Column(Date, nullable=False)
    tenure_weeks = Column(Integer, nullable=False)
    status = Column(String, default="OPEN")
    created_at = Column(DateTime, default=datetime.utcnow)
    dues = relationship("Due", backref="sale", cascade="all, delete-orphan")

class Due(Base):
    __tablename__ = "dues"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    due_amt = Column(Float, nullable=False)
    paid_amt = Column(Float, default=0.0)
    status = Column(String, default="PENDING")  # PENDING|PARTIAL|PAID|OVERDUE

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    amount = Column(Float, nullable=False)
    mode = Column(String, nullable=False)  # CASH|UPI only
    upi_ref = Column(String, default="")
    collector = Column(String, default="admin")
    paid_at = Column(DateTime, default=datetime.utcnow)
