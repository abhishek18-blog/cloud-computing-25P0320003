-- MySQL Initialization Script for Member and Borrowing Service

CREATE DATABASE IF NOT EXISTS library_members_db;
USE library_members_db;

CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NULL,
    membership_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS borrowings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    book_id INT NOT NULL,
    borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 14 DAY),
    return_date TIMESTAMP NULL DEFAULT NULL,
    status ENUM('BORROWED', 'RETURNED') NOT NULL DEFAULT 'BORROWED',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_member (member_id),
    INDEX idx_book (book_id),
    INDEX idx_status (status),
    CONSTRAINT fk_borrow_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial members
INSERT INTO members (name, email, phone, membership_type)
VALUES
    ('Alice Fernandes', 'alice.f@unigoa.ac.in', '+91-9822114455', 'FACULTY'),
    ('Rahul Naik', 'rahul.n@student.unigoa.ac.in', '+91-9876543210', 'STUDENT'),
    ('Pooja Kamat', 'pooja.k@student.unigoa.ac.in', '+91-9765432109', 'STUDENT'),
    ('Milisha Almeida', 'milisha.a@unigoa.ac.in', '+91-9922334455', 'STUDENT')
ON DUPLICATE KEY UPDATE id=id;
