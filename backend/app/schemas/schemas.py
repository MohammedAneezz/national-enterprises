from datetime import date
from decimal import Decimal
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]
Id = Annotated[int, Field(gt=0)]


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class LoginIn(BaseModel):
    username: str
    password: str


class CustomerIn(Input):
    line_id: Id
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(default="", max_length=30)
    area: str = Field(default="", max_length=150)
    notes: str = Field(default="", max_length=2000)


class ProductIn(Input):
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(default="", max_length=80)
    cost_price: Money = Decimal("0")
    emi_price: Money = Decimal("0")
    stock_in: int = Field(default=0, ge=0)


class StockIn(Input):
    qty: int = Field(gt=0)


class SaleIn(Input):
    line_id: Id
    customer_id: Id
    product_id: Id
    qty: int = Field(default=1, gt=0)
    total_emi: PositiveMoney
    down_payment: Money = Decimal("0")
    weekly_amt: PositiveMoney
    start_date: date
    tenure_weeks: int = Field(gt=0, le=520)


class PaymentIn(Input):
    line_id: Id
    sale_id: Id
    amount: PositiveMoney
    mode: str
    upi_ref: str = Field(default="", max_length=150)
