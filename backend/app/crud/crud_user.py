from sqlalchemy.orm import Session
from models.users import User
from schemas.user import UserCreate

def create_user(db: Session, username: str, email: str, full_name: str, password: str, priority_lvl: str = None):
    db_user = User(username=username, email=email, full_name=full_name, password=password)
    if priority_lvl:
        db_user.priority_lvl = priority_lvl
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_all_users(db: Session, skip: int = 0, limit: int = 10):
    return db.query(User).offset(skip).limit(limit).all()


def update_user(db: Session, user_id: int, payload: "UserUpdate"):
    """exclude_unset is what makes this a real PATCH: a field the client did
    not send stays untouched, instead of being overwritten with None."""
    row = get_user(db, user_id)
    if row is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


def delete_user(db: Session, user_id: int) -> bool:
    row = get_user(db, user_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True
