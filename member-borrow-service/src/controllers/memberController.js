const { pool } = require('../config/db');

exports.getAllMembers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM members';
    const params = [];

    if (search) {
      query += ' WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY id ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Member with ID ${id} not found.` });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(`Error fetching member ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.createMember = async (req, res) => {
  try {
    const { name, email, phone, membership_type } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Validation Error', message: 'Name and email are required fields.' });
    }

    // Check for existing email
    const [existing] = await pool.query('SELECT id FROM members WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Conflict', message: `Member with email '${email}' already exists.` });
    }

    const type = membership_type || 'STUDENT';
    const [result] = await pool.query(
      'INSERT INTO members (name, email, phone, membership_type) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), phone ? phone.trim() : null, type]
    );

    const [newMember] = await pool.query('SELECT * FROM members WHERE id = ?', [result.insertId]);
    res.status(201).json(newMember[0]);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, membership_type } = req.body;

    const [existing] = await pool.query('SELECT * FROM members WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Member with ID ${id} not found.` });
    }

    if (email && email !== existing[0].email) {
      const [emailCheck] = await pool.query('SELECT id FROM members WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length > 0) {
        return res.status(409).json({ error: 'Conflict', message: `Email '${email}' is already in use by another member.` });
      }
    }

    await pool.query(
      'UPDATE members SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), membership_type = COALESCE(?, membership_type) WHERE id = ?',
      [name, email, phone, membership_type, id]
    );

    const [updated] = await pool.query('SELECT * FROM members WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error(`Error updating member ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id FROM members WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Member with ID ${id} not found.` });
    }

    await pool.query('DELETE FROM members WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting member ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

exports.getMemberBorrowHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const [member] = await pool.query('SELECT * FROM members WHERE id = ?', [id]);
    if (member.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: `Member with ID ${id} not found.` });
    }

    const [history] = await pool.query('SELECT * FROM borrowings WHERE member_id = ? ORDER BY id DESC', [id]);
    res.json({
      member: member[0],
      borrowings: history
    });
  } catch (error) {
    console.error(`Error fetching borrow history for member ${req.params.id}:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
