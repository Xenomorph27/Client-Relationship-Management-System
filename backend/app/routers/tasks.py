from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from crud import crud_task
from database.database import get_db
from schemas.task import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=Task, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    return crud_task.create_task(db, payload)


@router.get("/", response_model=List[Task])
def list_tasks(
    skip: int = 0,
    limit: int = 200,
    is_done: Optional[bool] = None,
    assignee_id: Optional[int] = None,
    order_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    The limit is 200 rather than 100: the Todo board shows every open task at
    once, and a board that silently stops at 100 is a board that hides work.
    """
    return crud_task.get_all_tasks(
        db,
        skip=skip,
        limit=limit,
        is_done=is_done,
        assignee_id=assignee_id,
        order_id=order_id,
        lead_id=lead_id,
    )


@router.get("/{task_id}", response_model=Task)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = crud_task.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=Task)
def patch_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    """Ticking a task here is what stamps completed_at."""
    task = crud_task.update_task(db, task_id, payload)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
def remove_task(task_id: int, db: Session = Depends(get_db)):
    if not crud_task.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return None
