from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from crud import crud_user
from database.database import get_db
from schemas.user import User, UserCreate

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=User)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    return crud_user.create_user(db, **payload.model_dump())

@router.get("/", response_model=List[User])
def list_users(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    return crud_user.get_all_users(db, skip=skip, limit=limit)

@router.get("/{user_id}", response_model=User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud_user.get_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
