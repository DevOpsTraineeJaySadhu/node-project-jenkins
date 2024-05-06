const router = require('express').Router();

const ludoRoute = require('./ludo');

router.use('/ludo', ludoRoute);

module.exports = router;
