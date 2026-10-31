from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from settings import settings
DATABASE_URI = settings.database_url
# pool_pre_ping: a hosted database (Supabase's pooler) closes idle connections,
# and without a ping the first request after a quiet spell fails with
# "server closed the connection unexpectedly" instead of just reconnecting.
engine = create_engine(DATABASE_URI, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()