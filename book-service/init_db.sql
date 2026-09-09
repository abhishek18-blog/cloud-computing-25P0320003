-- PostgreSQL Initialization Script for Book Catalog Service

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_copies INT NOT NULL DEFAULT 1,
    available_copies INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial catalog of books
INSERT INTO books (title, author, isbn, category, total_copies, available_copies)
VALUES
    ('Designing Data-Intensive Applications', 'Martin Kleppmann', '978-1449373320', 'Cloud & Distributed Systems', 5, 5),
    ('Cloud Native Patterns: Designing change-tolerant software', 'Cornelia Davis', '978-1617294297', 'Cloud Computing', 4, 4),
    ('Building Microservices: Designing Fine-Grained Systems', 'Sam Newman', '978-1492034025', 'Microservices', 6, 6),
    ('Kubernetes: Up and Running', 'Kelsey Hightower & Brendan Burns', '978-1098110208', 'DevOps & Cloud', 3, 3),
    ('Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', '978-0132350884', 'Software Engineering', 8, 8),
    ('Introduction to Algorithms', 'Thomas H. Cormen', '978-0262046305', 'Computer Science', 5, 5),
    ('Docker in Action', 'Jeff Nickoloff & Stephen Kuenzli', '978-1617294761', 'DevOps & Containers', 4, 4)
ON CONFLICT (isbn) DO NOTHING;
