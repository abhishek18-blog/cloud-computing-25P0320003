from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, example="Clean Architecture")
    author: str = Field(..., min_length=1, max_length=255, example="Robert C. Martin")
    isbn: str = Field(..., min_length=5, max_length=50, example="978-0134494166")
    category: str = Field(..., min_length=1, max_length=100, example="Software Architecture")
    total_copies: int = Field(1, ge=1, example=5)
    available_copies: Optional[int] = Field(None, ge=0, example=5)

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    author: Optional[str] = Field(None, min_length=1, max_length=255)
    isbn: Optional[str] = Field(None, min_length=5, max_length=50)
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    total_copies: Optional[int] = Field(None, ge=1)
    available_copies: Optional[int] = Field(None, ge=0)

class BookStockUpdate(BaseModel):
    action: str = Field(..., description="Action to perform: 'BORROW' (-1) or 'RETURN' (+1)")

class BookResponse(BaseModel):
    id: int
    title: str
    author: str
    isbn: str
    category: str
    total_copies: int
    available_copies: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
