const { User, BoardProtoType } = require('../../../../models');
const { requestLimiter, redis, redlock } = require('../../../../utils');
const boardManager = require('../../../../game/BoardManager');
const _ = require('../../../../../globals/lib/helper');

const middleware = {};

middleware.isAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('authorization');
    if (!token) return res.reply(messages.unauthorized());

    const decodedToken = _.decodeToken(token);
    if (!decodedToken) return res.reply(messages.unauthorized());

    const project = {
      sUserName: true,
      sEmail: true,
      eStatus: true,
      sToken: true,
      nChips: true,
      eOpponent: true,
      aAllowedBot: true,
      aLudoBoard: true,
      sRootSocket: true,
    };

    const user = await User.findOne({ _id: decodedToken._id }, project).lean();

    if (!user) return res.reply(messages.custom.user_not_found);
    if (user.sToken !== token) return res.reply(messages.unauthorized());
    if (user.eStatus === 'd') return res.reply(messages.custom.user_deleted);
    if (user.eStatus === 'n') return res.reply(messages.custom.user_blocked);
    req.user = user;
    next();
  } catch (error) {
    res.reply(messages.server_error(), error.toString());
  }
};
middleware.isApiKeyValid = async (req, res, next) => {
  try {
    const token = req.header('api-key');
    if (token !== process.env.API_KEY) {
      log.red('## unauthorized user in initGame.');
      return res.reply(messages.unauthorized());
    }
    next();
  } catch (error) {
    log.red('## error in initGame.', error);
    return res.reply(messages.server_error(), error.toString());
  }
};
middleware.createPrototype = async (req, res, next) => {
  try {
    if (typeof req.body != 'object') req.body = JSON.parse(req.body);
    let body = { ...req.body };
    let data = typeof req.body != 'object' ? JSON.parse(body) : body;
    const oProtoBody = _.pick(data, [
      'max_participants',
      'game_id',
      'game_fee',
      'game_time',
      'turn_timer',
      'waiting_timer',
      'initialize_timer',
      'game_mode', // 'classic', 'twoToken', 'threeToken', 'popular'
      'participation_count',
      'environment',
      // 'pot_size',
      'rewards',
      'user_info',
      'aPlayer',
    ]);
    log.green('oProtoBody :: ', oProtoBody.game_id);
    const oProtoData = {
      _id: `PROTO-${oProtoBody.game_id}`,
      iGameId: oProtoBody.game_id, // game id
      eGameType: oProtoBody.game_mode, //  classic
      nGameTime: oProtoBody.game_time, // game timer
      nMaxPlayer: oProtoBody.max_participants, // max player
      eBoardType: 'cash', // cash
      nBoardFee: oProtoBody.game_fee, // fee
      // aAllowedBot: oProtoBody.opponent_type === 'ALL' ? [1, 2, 3] : [],
      nTurnTime: oProtoBody.turn_timer, // turn time
      // nTurnTime: 15000, // ONLY FOR TESTING PURPOSE.
      aWinningAmount: Object.values(oProtoBody.rewards), // winner price
      nRealPlayerCount: oProtoBody.participation_count ? oProtoBody.participation_count : 1, //player
      nMaxRefundTime: oProtoBody.waiting_timer, // Refund time
      aPlayer: oProtoBody.aPlayer,
      // isEnvironment: 'DEV', //oProtoBody.environment
      isEnvironment: oProtoBody.environment, //oProtoBody.environment
      iRoomId: _.randomizeNumber(),
      // aBotsData: oProtoBody.bot_players,
    };

    req.oProtoData = oProtoData;
    log.green('step 1 completed..........', oProtoData);
    next();
  } catch (error) {
    log.red('error in createPrototype!');
    console.log(error);
    res.reply(messages.server_error(), error);
  }
};
middleware.isClientAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('authorization');
    if (!token) return res.reply(messages.unauthorized());

    const decodedToken = _.decodeToken(token);
    if (!decodedToken) return res.reply(messages.unauthorized());

    let game = await redis.client.json.get(_.getBoardKey(decodedToken.iBoardId));
    if (!game) return res.reply(messages.not_found('Game'));
    for (ele of game.aPlayer) {
      if (ele.sUserToken !== token) return res.reply(messages.unauthorized());
    }
    req.game = game;
    next();
  } catch (error) {
    console.log('🚀 middleware Error::', error);
    return res.reply(messages.server_error(), error.toString());
  }
};
middleware.apiLimiter = (req, res, next) => {
  const params = {
    path: req.path,
    remoteAddress: req.sRemoteAddress || '127.0.0.1',
    maxRequestTime: 1000,
  };
  requestLimiter.setLimit(params, error => {
    if (error) return res.reply(messages.too_many_request());
    next();
  });
};

module.exports = middleware;
