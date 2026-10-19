from sqlalchemy.orm import Session
from models.customer import Customer
from schemas.customer import CustomerCreate

def add_customer(db: Session, name: str, email: str = None, phone: str = None, priority_lvl: str = None, source: str = None):
    db_customer = Customer(name=name, email=email, phone=phone, source=source)
    if priority_lvl:
        db_customer.priority_lvl = priority_lvl
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def get_customer(db: Session, customer_id: int):
    return db.query(Customer).filter(Customer.id == customer_id).first()

def get_customer_by_email(db: Session, email: str):
    return db.query(Customer).filter(Customer.email == email).first()

def get_all_customers(db: Session, skip: int = 0, limit: int = 10):
    return db.query(Customer).offset(skip).limit(limit).all()


def update_customer(db: Session, customer_id: int, payload: "CustomerUpdate"):
    """exclude_unset is what makes this a real PATCH: a field the client did
    not send stays untouched, instead of being overwritten with None."""
    row = get_customer(db, customer_id)
    if row is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_customer(db: Session, customer_id: int) -> bool:
    row = get_customer(db, customer_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
