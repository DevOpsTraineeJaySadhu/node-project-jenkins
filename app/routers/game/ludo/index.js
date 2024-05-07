const router = require('express').Router();
const controllers = require('./lib/controllers');
const middleware = require('./lib/middlewares');
const { multer } = require('../../../utils');

router.post('/board/initGame', middleware.isApiKeyValid, middleware.createPrototype, controllers.joinTableMM);
router.post('/result-presign-url', controllers.generatePreSignUrl);

module.exports = router;
