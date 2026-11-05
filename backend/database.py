import os
import sqlite3
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Override with DATABASE_URL (e.g. sqlite:////home/data/parking.db on Azure App Service,
# where only /home survives restarts and redeploys).
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./parking.db")

if DATABASE_URL.startswith("sqlite:////"):  # absolute path: make sure its folder exists
    os.makedirs(os.path.dirname(DATABASE_URL[len("sqlite:///"):]), exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
