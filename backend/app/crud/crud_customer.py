from sqlalchemy.orm import Session
from models.customer import customer
from schemas.customer import CustomerCreate
def add_customer(db:Session, name:str, email:str, phone:str, priority_lvl:str= None):
	db_customer=Customer(name=name, email=email, phone=phone)
	if priority_lvl:
        db_customer.priority_lvl = priority_lvl
	db.add(db_customer)
	db.commit()
	db.refresh(db_customer)
	return db_customer
def get_customer(db: Session, customer_id: int):
	return db.query(Customer).filter(Customer.id==customer_id).first()
def get_customer_by_email(db: Session, email: str):
	return db.query(Customer).filter(Customer.email==email).first()
def get_all_customera(db:Session,skip:int=0, limit: int=10):
	return db.query(Customer).offset(skip).limit(limit).all()

