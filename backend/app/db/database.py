from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL

# engine for connection
engine = create_engine(
  DATABASE_URL,
  echo=True,
  connect_args={"check_same_thread": False},
)

# session to interact with data
SessionLocal = sessionmaker(
  autocommit=False,
  autoflush=False,
  bind=engine
)


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()


def init_db():
  """Create database tables if they don't exist."""
  from app.db.base import Base
  import app.db.models  # ensure all models are imported and registered

  Base.metadata.create_all(bind=engine)
