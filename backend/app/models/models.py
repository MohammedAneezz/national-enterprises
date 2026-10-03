from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Line(Base):
    __tablename__ = "lines"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed = Column(String, nullable=False)
    role = Column(String, default="admin", nullable=False)


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, default="", nullable=False)
    area = Column(String, default="", nullable=False, index=True)
    notes = Column(String, default="", nullable=False)
    outstanding = Column(Numeric(14, 2), default=0, nullable=False)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    sku = Column(String, default="")
    cost_price = Column(Numeric(14, 2), default=0)
    emi_price = Column(Numeric(14, 2), default=0)
    stock_in = Column(Integer, default=0, nullable=False)
    stock_sold = Column(Integer, default=0, nullable=False)

    @property
    def available(self):
        return self.stock_in - self.stock_sold


class Sale(Base):
    __tablename__ = "sales"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, default=1, nullable=False)
    total_emi = Column(Numeric(14, 2), nullable=False)
    down_payment = Column(Numeric(14, 2), default=0, nullable=False)
    financed = Column(Numeric(14, 2), nullable=False)
    weekly_amt = Column(Numeric(14, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    tenure_weeks = Column(Integer, nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    dues = relationship("Due", backref="sale", cascade="all, delete-orphan")


class Due(Base):
    __tablename__ = "dues"
    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False, index=True)
    due_date = Column(Date, nullable=False, index=True)
    due_amt = Column(Numeric(14, 2), nullable=False)
    paid_amt = Column(Numeric(14, 2), default=0, nullable=False)
    status = Column(String, default="PENDING", nullable=False)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    line_id = Column(Integer, ForeignKey("lines.id"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    mode = Column(String, nullable=False)
    upi_ref = Column(String, default="")
    collector = Column(String, nullable=False)
    paid_at = Column(DateTime, default=utc_now, nullable=False, index=True)
