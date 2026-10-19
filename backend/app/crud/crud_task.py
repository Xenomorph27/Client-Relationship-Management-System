from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models.enums import Priority_Level
from models.tasks import Task
from schemas.task import TaskCreate, TaskUpdate


def create_task(db: Session, payload: TaskCreate) -> Task:
    data = payload.model_dump()
    if data.get("priority_lvl") is None:
        data["priority_lvl"] = Priority_Level.medium_priority
    if data.get("is_done"):
        data["completed_at"] = datetime.now()
    task = Task(**data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get_task(db: Session, task_id: int) -> Optional[Task]:
    return db.query(Task).filter(Task.id == task_id).first()


def get_all_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 200,
    is_done: Optional[bool] = None,
    assignee_id: Optional[int] = None,
    order_id: Optional[int] = None,
    lead_id: Optional[int] = None,
):
    query = db.query(Task)
    if is_done is not None:
        query = query.filter(Task.is_done == is_done)
    if assignee_id is not None:
        query = query.filter(Task.assignee_id == assignee_id)
    if order_id is not None:
        query = query.filter(Task.order_id == order_id)
    if lead_id is not None:
        query = query.filter(Task.lead_id == lead_id)
    return query.order_by(Task.id).offset(skip).limit(limit).all()


def update_task(db: Session, task_id: int, payload: TaskUpdate) -> Optional[Task]:
    """
    completed_at is maintained here, not accepted from the client.

    Ticking a task stamps it; un-ticking clears it. Leaving a stale
    completed_at on a re-opened task would make "finished this week" counts
    include work that is open again.
    """
    task = get_task(db, task_id)
    if task is None:
        return None

    fields = payload.model_dump(exclude_unset=True)
    was_done = task.is_done

    for field, value in fields.items():
        setattr(task, field, value)

    if "is_done" in fields and fields["is_done"] != was_done:
        task.completed_at = datetime.now() if fields["is_done"] else None

    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int) -> bool:
    task = get_task(db, task_id)
    if task is None:
        return False
    db.delete(task)
    db.commit()
    return True
