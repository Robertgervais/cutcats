const express = require('express');
const router = express.Router();

router.use('/couriers', require('./couriers'));
router.use('/me', require('./me'));
router.use('/jobs', require('./jobs'));

module.exports = router;
