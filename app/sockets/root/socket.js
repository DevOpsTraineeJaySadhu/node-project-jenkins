const Player = require('./player');
const { redis } = require('../../utils');
const { User } = require('../../models');
const { decode } = require('jsonwebtoken');

const Socket = function () {};

Socket.prototype.init = function () {
  // global.io.origins('*:*');
  // console.log(global.io.adapter(redis.getAdapter()));
  global.io.adapter(redis.getAdapter());
  this.setEventListeners();
};

Socket.prototype.setEventListeners = function () {
  global.io.use((socket, next) => this.middleware(socket, next));
  global.io.on('connection', socket => new Player(socket));
  global.io.on('error', error => log.console('error in socket :: ', error));
};

Socket.prototype.middleware = async function (socket, next) {
  const { authorization } = socket.handshake.query;
  if (!authorization) return next(new Error(messages.unauthorized().message));

  const decodedToken = _.decodeToken(authorization);
  if (!decodedToken) return next(new Error(messages.unauthorized().message));

  if (decodedToken.iUserId && decodedToken.iBoardId) {
    let board = await redis.client.json.get(_.getBoardKey(decodedToken.iBoardId));
    if (!board) return next(new Error(messages.not_found().message));
    for (ele of board.aPlayer) {
      if (ele.user_id === decodedToken.iUserId) {
        if (ele.sUserToken !== authorization) return next(new Error(messages.unauthorized().message));
        socket.user = { iUserId: decodedToken.iUserId.toString() };
      }
    }
  } else {
    return next(new Error(messages.unauthorized().message));
  }
  log.green('Root connected', socket.user.iUserId, 'with ', socket.id);
  log.green('step 3 completed......');
  // if (process.env.NODE_ENV !== 'prod') log.green('Root connected', socket.user.iUserId, 'with ', socket.id);
  next();
  // User.findOne(query, project, (error, user) => {
  //   if (error) return next(new Error(messages.server_error(), error.toString()));
  //   if (!user) return next(new Error(messages.unauthorized().message));
  //   if (user.eUserType !== 'ubot' && !user.isMobileVerified) return next(new Error(messages.unauthorized().message));
  //   if (user.eStatus === 'n') return next(new Error(messages.blocked('Account').message));
  //   if (user.eStatus === 'd') return next(new Error(messages.deleted('Account').message));
  //   if (user.sToken !== authorization) return next(new Error(messages.unauthorized().message));
  //   socket.user = { iUserId: user._id.toString() };
  //   User.updateOne(query, { $set: { sRootSocket: socket.id } }, _.errorCallback);
};

module.exports = new Socket();

// emitter.on('reqCreateTournamentChannel', tournament.init.bind(tournament));
