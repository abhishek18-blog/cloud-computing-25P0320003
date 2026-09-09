import time
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("book_service_db")

# Create SQLAlchemy engine with connection pool settings
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db_with_retry(max_retries=10, delay=3):
    """Wait for PostgreSQL database to be ready and initialize tables."""
    retries = 0
    while retries < max_retries:
        try:
            logger.info(f"Connecting to PostgreSQL database at {settings.DB_HOST}:{settings.DB_PORT} (Attempt {retries+1}/{max_retries})...")
            Base.metadata.create_all(bind=engine)
            logger.info("Successfully connected to database and verified tables.")
            return True
        except Exception as e:
            retries += 1
            logger.warning(f"Database connection attempt failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
    logger.error("Failed to connect to PostgreSQL database after multiple retries.")
    return False
