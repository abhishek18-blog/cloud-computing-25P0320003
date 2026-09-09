import logging
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.database import get_db, init_db_with_retry, engine, SessionLocal
from app.models import Book
import app.schemas as schemas
import app.crud as crud

logger = logging.getLogger("book_service")

# Sample seed data
SEED_BOOKS = [
    {
        "title": "Designing Data-Intensive Applications",
        "author": "Martin Kleppmann",
        "isbn": "978-1449373320",
        "category": "Cloud & Distributed Systems",
        "total_copies": 5,
        "available_copies": 5
    },
    {
        "title": "Cloud Native Patterns: Designing change-tolerant software",
        "author": "Cornelia Davis",
        "isbn": "978-1617294297",
        "category": "Cloud Computing",
        "total_copies": 4,
        "available_copies": 4
    },
    {
        "title": "Building Microservices: Designing Fine-Grained Systems",
        "author": "Sam Newman",
        "isbn": "978-1492034025",
        "category": "Microservices",
        "total_copies": 6,
        "available_copies": 6
    },
    {
        "title": "Kubernetes: Up and Running",
        "author": "Kelsey Hightower & Brendan Burns",
        "isbn": "978-1098110208",
        "category": "DevOps & Cloud",
        "total_copies": 3,
        "available_copies": 3
    },
    {
        "title": "Clean Code: A Handbook of Agile Software Craftsmanship",
        "author": "Robert C. Martin",
        "isbn": "978-0132350884",
        "category": "Software Engineering",
        "total_copies": 8,
        "available_copies": 8
    },
    {
        "title": "Introduction to Algorithms",
        "author": "Thomas H. Cormen",
        "isbn": "978-0262046305",
        "category": "Computer Science",
        "total_copies": 5,
        "available_copies": 5
    }
]

def seed_database():
    """Seeds initial book catalog if table is empty."""
    db = SessionLocal()
    try:
        count = db.query(Book).count()
        if count == 0:
            logger.info("Database empty. Seeding initial catalog of books...")
            for book_data in SEED_BOOKS:
                book = Book(**book_data)
                db.add(book)
            db.commit()
            logger.info("Successfully seeded book catalog.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Book Catalog Service...")
    init_db_with_retry()
    seed_database()
    yield
    # Shutdown
    logger.info("Shutting down Book Catalog Service...")

app = FastAPI(
    title="Book Catalog Microservice",
    description="Microservice managing library books catalog and inventory backed by PostgreSQL",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint validating service and database connectivity."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    return {
        "service": "book-catalog-service",
        "status": "up" if db_status == "healthy" else "degraded",
        "database": {
            "type": "PostgreSQL",
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "status": db_status
        }
    }

@app.get("/books", response_model=List[schemas.BookResponse], tags=["Books"])
def list_books(
    search: Optional[str] = Query(None, description="Search by title, author, or ISBN"),
    category: Optional[str] = Query(None, description="Filter by category"),
    available_only: bool = Query(False, description="Show only books with available copies > 0"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve catalog of books with optional search, category filters and pagination."""
    return crud.get_books(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        category=category,
        available_only=available_only
    )

@app.get("/books/{book_id}", response_model=schemas.BookResponse, tags=["Books"])
def get_book(book_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed information for a specific book by ID."""
    book = crud.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {book_id} not found."
        )
    return book

@app.post("/books", response_model=schemas.BookResponse, status_code=status.HTTP_201_CREATED, tags=["Books"])
def create_book(book_in: schemas.BookCreate, db: Session = Depends(get_db)):
    """Add a new book to the library catalog."""
    existing_book = crud.get_book_by_isbn(db, book_in.isbn)
    if existing_book:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A book with ISBN '{book_in.isbn}' already exists (ID: {existing_book.id})."
        )
    return crud.create_book(db, book_in)

@app.put("/books/{book_id}", response_model=schemas.BookResponse, tags=["Books"])
def update_book(book_id: int, book_update: schemas.BookUpdate, db: Session = Depends(get_db)):
    """Update metadata and copy count of an existing book."""
    db_book = crud.get_book_by_id(db, book_id)
    if not db_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {book_id} not found."
        )
    if book_update.isbn and book_update.isbn != db_book.isbn:
        existing_isbn = crud.get_book_by_isbn(db, book_update.isbn)
        if existing_isbn:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another book with ISBN '{book_update.isbn}' already exists."
            )
    return crud.update_book(db, db_book, book_update)

@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Books"])
def delete_book(book_id: int, db: Session = Depends(get_db)):
    """Remove a book from the catalog."""
    db_book = crud.get_book_by_id(db, book_id)
    if not db_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {book_id} not found."
        )
    crud.delete_book(db, db_book)
    return None

@app.patch("/books/{book_id}/stock", response_model=schemas.BookResponse, tags=["Inventory & Inter-Service"])
def update_stock(book_id: int, stock_update: schemas.BookStockUpdate, db: Session = Depends(get_db)):
    """Adjust book stock upon borrowing or returning (Called by Member & Borrowing Service)."""
    db_book = crud.get_book_by_id(db, book_id)
    if not db_book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with ID {book_id} not found."
        )
    try:
        return crud.modify_stock(db, db_book, stock_update.action)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
