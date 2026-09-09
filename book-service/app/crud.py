from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import Book
from app.schemas import BookCreate, BookUpdate

def get_books(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category: Optional[str] = None,
    available_only: bool = False
) -> List[Book]:
    query = db.query(Book)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_filter),
                Book.author.ilike(search_filter),
                Book.isbn.ilike(search_filter)
            )
        )
        
    if category:
        query = query.filter(Book.category.ilike(f"%{category}%"))
        
    if available_only:
        query = query.filter(Book.available_copies > 0)
        
    return query.order_by(Book.id.asc()).offset(skip).limit(limit).all()

def get_book_by_id(db: Session, book_id: int) -> Optional[Book]:
    return db.query(Book).filter(Book.id == book_id).first()

def get_book_by_isbn(db: Session, isbn: str) -> Optional[Book]:
    return db.query(Book).filter(Book.isbn == isbn).first()

def create_book(db: Session, book_in: BookCreate) -> Book:
    avail = book_in.available_copies if book_in.available_copies is not None else book_in.total_copies
    db_book = Book(
        title=book_in.title,
        author=book_in.author,
        isbn=book_in.isbn,
        category=book_in.category,
        total_copies=book_in.total_copies,
        available_copies=avail
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

def update_book(db: Session, db_book: Book, book_update: BookUpdate) -> Book:
    update_data = book_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_book, field, value)
    db.commit()
    db.refresh(db_book)
    return db_book

def delete_book(db: Session, db_book: Book) -> None:
    db.delete(db_book)
    db.commit()

def modify_stock(db: Session, db_book: Book, action: str) -> Book:
    action_upper = action.strip().upper()
    if action_upper == "BORROW":
        if db_book.available_copies <= 0:
            raise ValueError("No copies currently available to borrow.")
        db_book.available_copies -= 1
    elif action_upper == "RETURN":
        if db_book.available_copies >= db_book.total_copies:
            raise ValueError("All copies of this book have already been returned.")
        db_book.available_copies += 1
    else:
        raise ValueError(f"Invalid stock action '{action}'. Must be 'BORROW' or 'RETURN'.")
        
    db.commit()
    db.refresh(db_book)
    return db_book
