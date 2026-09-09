const axios = require('axios');
const { pool } = require('../config/db');

const BOOK_SERVICE_URL = process.env.BOOK_SERVICE_URL || 'http://book-service:8001';

exports.getAllBorrowings = async (req, res) => {
  try {
    const { status, member_id } = req.query;
    let query = `
      SELECT b.*, m.name AS member_name, m.email AS member_email
      FROM borrowings b
      JOIN members m ON b.member_id = m.id
    `;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('b.status = ?');
      params.push(status.toUpperCase());
    }

    if (member_id) {
      conditions.push('b.member_id = ?');
      params.push(member_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY b.id DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching borrowings:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.getBorrowingById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT b.*, m.name AS member_name, m.email AS member_email
       FROM borrowings b
       JOIN members m ON b.member_id = m.id
       WHERE b.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Borrow record with ID ${id} not found.` });
    }

    // Attempt to enrich with book details from Book Service
    let bookDetails = null;
    try {
      const bookRes = await axios.get(`${BOOK_SERVICE_URL}/books/${rows[0].book_id}`, { timeout: 3000 });
      bookDetails = bookRes.data;
    } catch (err) {
      console.warn(`Could not fetch book ${rows[0].book_id} details from Book Service: ${err.message}`);
    }

    res.json({
      ...rows[0],
      book: bookDetails
    });
  } catch (error) {
    console.error(`Error fetching borrowing ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.borrowBook = async (req, res) => {
  try {
    const { member_id, book_id, notes } = req.body;

    if (!member_id || !book_id) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Both member_id and book_id are required to issue a book.'
      });
    }

    // 1. Verify Member exists
    const [memberRows] = await pool.query('SELECT * FROM members WHERE id = ?', [member_id]);
    if (memberRows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Member with ID ${member_id} does not exist.`
      });
    }

    // 2. Inter-service call to Book Service: Verify book exists and has stock
    let book;
    try {
      const bookRes = await axios.get(`${BOOK_SERVICE_URL}/books/${book_id}`, { timeout: 5000 });
      book = bookRes.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Book with ID ${book_id} not found in Book Catalog Service.`
        });
      }
      return res.status(502).json({
        error: 'Bad Gateway',
        message: `Failed to communicate with Book Service: ${err.message}`
      });
    }

    if (book.available_copies <= 0) {
      return res.status(400).json({
        error: 'Out of Stock',
        message: `Book '${book.title}' currently has 0 available copies for borrowing.`
      });
    }

    // 3. Create Borrowing record in MySQL
    const [result] = await pool.query(
      `INSERT INTO borrowings (member_id, book_id, status, notes, due_date)
       VALUES (?, ?, 'BORROWED', ?, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
      [member_id, book_id, notes || null]
    );

    const borrowId = result.insertId;

    // 4. Update stock in Book Service
    try {
      await axios.patch(`${BOOK_SERVICE_URL}/books/${book_id}/stock`, { action: 'BORROW' }, { timeout: 5000 });
    } catch (stockErr) {
      console.error(`Inter-service stock decrement failed for book ${book_id}:`, stockErr.message);
      // Compensating rollback in MySQL
      await pool.query('DELETE FROM borrowings WHERE id = ?', [borrowId]);
      return res.status(500).json({
        error: 'Transaction Failed',
        message: 'Failed to update book stock. Borrow transaction was rolled back.'
      });
    }

    // 5. Return created borrow record
    const [newRecord] = await pool.query(
      `SELECT b.*, m.name AS member_name, m.email AS member_email
       FROM borrowings b
       JOIN members m ON b.member_id = m.id
       WHERE b.id = ?`,
      [borrowId]
    );

    res.status(201).json({
      message: 'Book successfully issued to member.',
      borrowing: newRecord[0],
      book_title: book.title
    });
  } catch (error) {
    console.error('Error in borrowBook:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Check borrowing record
    const [records] = await pool.query('SELECT * FROM borrowings WHERE id = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Borrow record with ID ${id} not found.` });
    }

    const borrowRecord = records[0];
    if (borrowRecord.status === 'RETURNED') {
      return res.status(400).json({ error: 'Already Returned', message: 'This book has already been marked as returned.' });
    }

    // 2. Mark as RETURNED in MySQL
    await pool.query(
      'UPDATE borrowings SET status = "RETURNED", return_date = NOW() WHERE id = ?',
      [id]
    );

    // 3. Inter-service call to restore stock in Book Service
    try {
      await axios.patch(
        `${BOOK_SERVICE_URL}/books/${borrowRecord.book_id}/stock`,
        { action: 'RETURN' },
        { timeout: 5000 }
      );
    } catch (stockErr) {
      console.warn(`Could not increment stock in Book Service: ${stockErr.message}`);
    }

    const [updated] = await pool.query(
      `SELECT b.*, m.name AS member_name, m.email AS member_email
       FROM borrowings b
       JOIN members m ON b.member_id = m.id
       WHERE b.id = ?`,
      [id]
    );

    res.json({
      message: 'Book successfully marked as returned.',
      borrowing: updated[0]
    });
  } catch (error) {
    console.error(`Error returning borrowing ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
