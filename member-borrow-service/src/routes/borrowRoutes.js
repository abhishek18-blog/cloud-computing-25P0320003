const express = require('express');
const router = express.Router();
const borrowController = require('../controllers/borrowController');

router.get('/', borrowController.getAllBorrowings);
router.get('/:id', borrowController.getBorrowingById);
router.post('/borrow', borrowController.borrowBook);
router.post('/return/:id', borrowController.returnBook);

module.exports = router;
