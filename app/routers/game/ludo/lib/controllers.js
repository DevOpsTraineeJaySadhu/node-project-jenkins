const { LudoGame, LudoStuckGame, ExistBoard } = require('../../../../models');
const boardManager = require('../../../../game/BoardManager');
const { redis, multer } = require('../../../../utils');

const controllers = {};
//* new match making flow
controllers.joinTableMM = async (req, res) => {
  try {
    log.yellow('joiningProcessMM called...');
    //* create token for client
    // change
    if (!req.oProtoData.iGameId) return res.reply(messages.required_field('Game Id'));
    const key = _.getBoardKey(req.oProtoData.iGameId);
    const createdBoard = await redis.client.json.GET(key);
    if (createdBoard) {
      await ExistBoard.create({
        iGameId: _.toString(req.oProtoData.iGameId),
        sDescription: 'Game is Already Running in Server, GameInit api called twice',
        sCurrentBoardState: createdBoard.eState,
        eGameType: this.eGameType,
      });
      return res.reply(messages.already_exists('Game'));
    }

    for (const element of req.oProtoData.aPlayer) {
      element.sUserToken = _.encodeToken({ iUserId: element.user_id, iBoardId: req.oProtoData.iGameId });
      element.sToken = _.salt(4, Number);
    }

    req.board = await boardManager.createBoardMM(req.oProtoData);

    return res.reply(messages.success(), {
      game_id: req.oProtoData.iGameId,
      aPlayer: req.oProtoData.aPlayer,
      iRoomId: req.oProtoData.iRoomId,
    });
  } catch (error) {
    log.error('🚀 ~ file: controllers.js ~ line 42 ~ controllers.joinTable= ~ error', error);
    return res.reply(messages.server_error(), error);
  }
};
controllers.gatGameState = (req, res) => {
  try {
    return res.reply(messages.success('game State', { eGameState: req.game.eState }));
  } catch (error) {
    console.log('🚀 controllers Error ::', error);
    return res.reply(messages.server_error(), error.toString());
  }
};

controllers.findGame = async (req, res) => {
  try {
    const { iGameId } = _.pick(req.params, ['iGameId']);
    console.log('🚀 ~ file: controllers.js:50 ~ controllers.findGame= ~ iGameId:', iGameId);
    if (!iGameId) return res.reply(messages.required_field('Game Id'));

    // let game = await redis.client.json.get(_.getBoardKey(iGameId));
    let gameData;
    gameData = await boardManager.getBoard(iGameId);
    if (!gameData) gameData = await LudoGame.findOne({ iGameId: iGameId }).lean();

    if (!gameData) return res.reply(messages.not_found('Game'));

    let userData;
    if (gameData.aParticipant) {
      userData = gameData.aParticipant.map(item => ({
        iUserId: item.iUserId,
        eState: item.eState,
      }));
    }

    return res.reply(messages.success('game State'), {
      gameState: gameData.eState,
      dCreatedDate: gameData.dCreatedDate,
      aPlayer: userData || [],
      isExit: gameData.isExit,
      isValidLeave: gameData.isValidLeave,
      sGameScreenShort: `https://webgame-screenshoots.s3.ap-south-1.amazonaws.com/${iGameId}.png`,
    });
  } catch (error) {
    console.log('🚀 controllers Error ::', error);
    return res.reply(messages.server_error(), error.toString());
  }
};

controllers.findStuckGame = async (req, res) => {
  try {
    const { iGameId } = _.pick(req.params, ['iGameId']);
    console.log('🚀 ~ file: controllers.js:85 ~ controllers.findStuckGame= ~ iGameId:', iGameId);

    if (!iGameId) return res.reply(messages.required_field('Game Id'));

    let gameData = await LudoStuckGame.findOne({ iGameId: iGameId }).lean();
    if (!gameData) return res.reply(messages.not_found('Game'));

    return res.reply(messages.success('game State'), {
      gameData,
      sGameScreenShort: `https://webgame-screenshoots.s3.ap-south-1.amazonaws.com/${iGameId}.png`,
    });
  } catch (error) {
    console.log('🚀 controllers Error ::', error);
    return res.reply(messages.server_error(), error.toString());
  }
};

controllers.generatePreSignUrl = async (req, res) => {
  try {
    const { key, sMedia } = req.query;

    const url = await multer.signedUrlForImage(key, 'classic-multiplayer');
    if (!url) return res.reply(messages.not_generate('url'));
    if (url === 'type Not Match') return res.reply(messages.custom.type_not_match);
    if (sMedia === 'image' && key.split('.')[1] !== 'png') return res.reply(messages.custom.image_allowed); //

    return res.reply(messages.successfully('url created'), url);
  } catch (error) {
    console.log(error);
    log.red('🚀 Controller Error::', error.toString());
    return res.reply(messages.server_error(), error.toString());
  }
};

module.exports = controllers;
