const router = require('express').Router();
const controllers = require('./lib/controllers');
const middleware = require('./lib/middlewares');
const { multer } = require('../../../utils');

router.post('/board/initGame', middleware.isApiKeyValid, middleware.createPrototype, controllers.joinTableMM);
router.get('/board/game/:iGameId', middleware.isApiKeyValid, controllers.findGame);
router.get('/board/stuck-game/:iGameId', middleware.isApiKeyValid, controllers.findStuckGame);
router.get('/board/status', middleware.isClientAuthenticated, controllers.gatGameState);
// router.post(
//   '/board/image/:iGameId',
//   //   middleware.isApiKeyValid,
//   multer.imageUpload('sGameImage', req => req.query.iGameId),
//   controllers.resultImage
// );
router.post('/result-presign-url', controllers.generatePreSignUrl);

module.exports = router;
