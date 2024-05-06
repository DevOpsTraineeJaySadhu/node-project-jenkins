const boardManager = require('../../game/BoardManager');
// const { queue } = require('../../utils'); // redis
const { queue, redis } = require('../../utils'); // redis

function PlayerListener(iBoardId, iUserId) {
  this.iBoardId = iBoardId;
  this.iUserId = iUserId;
}

PlayerListener.prototype.logError = function (error, callback) {
  // eslint-disable-next-line no-console
  console.log('error in logError');
  log.red(error);
  return callback(error);
};

PlayerListener.prototype.onEvent = async function ({ sEventName, oData }, callback = () => {}) {
  log.cyan('## sEventName in onEvent :: ', sEventName);
  switch (sEventName) {
    case 'reqMovePawn':
      const eventData = JSON.parse(await _.decryptDataGhetiya(oData));
      this.movePawn(eventData, callback);
      break;
    case 'reqRollDice':
      this.rollDice(oData, callback);
      break;
    case 'reqChangeTurn':
      this.changeTurn(oData, callback);
      break;
    case 'reqLeave':
      this.leave(oData, callback);
      break;
    case 'reqPowerUp':
      this.powerUp(oData, callback);
      break;
    case 'reqSendEmoji':
      this.sendEmoji(oData, callback);
      break;
    case 'reqExitGame':
      this.exitGame(oData, callback);
      break;
    case 'reqPawnCheck':
      this.pawnCheck(oData, callback);
      break;
    default:
      log.red('unknown event', sEventName);
      break;
  }
};

PlayerListener.prototype.movePawn = async function (oData, callback = () => {}) {
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);

  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);
  if (!participant.hasValidTurn()) return this.logError(messages.custom.wait_for_turn, callback);

  participant.movePawn(oData, async (error, data) => {
    if (error) return callback(error);
    const encryptedData = await _.encryptDataGhetiya(JSON.stringify(data));

    if (typeof callback === 'function') callback(null, encryptedData);
  });
};

PlayerListener.prototype.rollDice = async function (oData, callback) {
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);
  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);
  if (!participant.hasValidTurn()) return this.logError(messages.custom.wait_for_turn, callback);

  // if ((oData.bRollAgain === 'true' || oData.bRollAgain === 'undefined') && participant.nDiamond > 1) {
  board.rollDice(oData, async (error, data) => {
    if (error) return callback(error);
    const encryptedData = await _.encryptDataGhetiya(JSON.stringify(data));
    if (typeof callback === 'function') callback(null, encryptedData);
    callback(null, encryptedData);
  });
  // }
};

PlayerListener.prototype.powerUp = async function (oData, callback) {
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);

  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);

  const { id } = oData;
  log.green('powerUp called with powerup ID :: ', id);
  const isUsed = participant.aPowerUp.find(p => p.id === parseInt(id))?.eState !== 'notUsed';

  if (isUsed) return this.logError(messages.custom.power_up_used, callback);

  for (const powerUp of participant.aPowerUp) {
    if (powerUp.id !== parseInt(id) && powerUp.eState === 'using') {
      powerUp.eState = 'notUsed'; // unSelect previous selected powerup.
      log.cyan('previous powerup unselected :: ', powerUp);
    }
    if (powerUp.id === parseInt(id)) powerUp.eState = 'using';
  }

  await board.update({ aParticipant: [participant.toJSON()] });
  await board.emit('resPowerUp', { iUserId: this.iUserId, iPowerId: id });
  if (typeof callback === 'function') callback(null, participant.toJSON().aPowerUp);
};

PlayerListener.prototype.changeTurn = async function (oData, callback) {
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);

  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);

  participant.passTurn();
};

PlayerListener.prototype.leave = async function (oData, callback) {
  log.red('## leave table called from user ', this.iUserId);
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);
  if (!board.isExit && board.eState !== 'waiting') return callback("Can't leave at this stage", { oData: { eState: 'playing' } });

  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);

  queue.addJob(this.iBoardId, { sEventName: 'reqLeave', iBoardId: this.iBoardId, iUserId: this.iUserId });
};

PlayerListener.prototype.sendEmoji = async function (oData, callback) {
  const board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);

  // const participant = board.getParticipant(this.iUserId);
  // if (!participant) return this.logError(messages.not_found('participant'), callback);

  await board.emit('resSendEmoji', oData);
  callback(null, oData);
};

PlayerListener.prototype.pawnCheck = async function (oData, callback) {
  let board = await boardManager.getBoard(this.iBoardId);
  if (!board) return this.logError(messages.not_found('Board'), callback);

  const participant = board.getParticipant(this.iUserId);
  if (!participant) return this.logError(messages.not_found('participant'), callback);
  // if (error) return callback(error);
  // if (typeof callback === 'function') callback(null, data);
  // callback(null, data);

  board = _.removeKey(board, 'aPlayer');
  const encryptedData = await _.encryptDataGhetiya(JSON.stringify(board));

  await participant.emit('resPawnCheck', board);
  callback(null, board);
};

function Player(socket) {
  this.socket = socket;
  this.iUserId = socket.user.iUserId;
  this.setEventListeners();
}

Player.prototype.setEventListeners = function () {
  this.socket.on('ping', this.ping.bind(this));
  this.socket.on('disconnect', this.disconnect.bind(this));
  this.socket.on('reqJoinBoard', this.joinBoard.bind(this));
  this.socket.on('error', error => log.red('socket error', error));
};

Player.prototype.ping = function (body, callback) {
  callback(null, {});
};

Player.prototype.joinBoard = async function ({ iBoardId, isReconnect }, callback) {
  if (!iBoardId) return this.logError(messages.required_field('board id'), callback);
  log.green('##joinBoard with args :: ', iBoardId, isReconnect);
  const board = await boardManager.getBoard(iBoardId);
  log.green('board find in join table socket :: ');

  if (!board) {
    return callback(null, { oData: { eState: 'finished' } });
  }
  // TODO reconnection flag from BE side
  const participantReconnect = board.getParticipant(this.iUserId);
  if (participantReconnect) {
    log.white('participantReconnect :: reconnected ');
    isReconnect = true;
  } else {
    isReconnect = false;
    log.white('participantReconnect :: new participant.');
  }

  //* check Schedular Present or Not
  const schedularPresent = await redis.client.keys(`${iBoardId}:scheduler:assignTurnTimeout:*`);
  if (isReconnect && !schedularPresent.length) {
    log.green('in not Schedular Present condition in REconnect Only.....');
    await board.setScheduler('assignTurnTimeout', board.iUserTurn ? board.iUserTurn : this.iUserId, 10000);
  }

  let oPlayerObj = {};

  for (const participant of board.aPlayer) {
    if (participant.user_id === this.socket.user.iUserId)
      oPlayerObj = { _id: participant.user_id, sUserName: participant.sUserName, image: participant.image, nColor: participant.nColor, nDiamond: participant.nDiamond };
  }

  const params = {
    iBoardId: iBoardId,
    oUserData: oPlayerObj,
  };
  log.red('isReconnect before joining process :: ', isReconnect);
  if (!isReconnect && board.eState === 'waiting') {
    log.cyan('New player join here ############ ...');
    await board.addParticipant(params);
  }

  const participant = board.getParticipant(this.iUserId);
  log.red('new added player found from tbl :: ');
  if (!participant) return this.logError(messages.not_found('participant'), callback);

  if (!this.socket.eventNames().includes(iBoardId)) {
    const playerListener = new PlayerListener(iBoardId, participant.iUserId);
    this.socket.on(iBoardId, playerListener.onEvent.bind(playerListener));
  }

  if (!board.oSocketId) board.oSocketId = {};
  board.oSocketId[participant.iUserId] = this.socket.id;

  await board.update({ oSocketId: board.oSocketId });
  await _.removeFieldFromArray(participant.gameState.aPlayer, 'sUserToken');
  const encryptedDataParticipant = await _.encryptDataGhetiya(JSON.stringify({ oData: participant.gameState }));

  // callback(null, { oData: participant.gameState });
  callback(null, encryptedDataParticipant);
  // if (!isReconnect) {
  const encryptedData = await _.encryptDataGhetiya(JSON.stringify(participant.toJSON()));
  board.emit('resUserJoined', participant.toJSON());
  // board.emit('resUserJoined', encryptedData);
  // console.log('🚀 ~ file: player.js:226 ~ participant.toJSON():', participant.toJSON());
  // }

  participant.stateHandler();
};

Player.prototype.logError = function (error, callback = () => {}) {
  log.trace(error);
  callback(error);
};

Player.prototype.disconnect = async function () {
  // if (process.env.NODE_ENV !== 'prod')
  log.red('Root disconnected', this.iUserId, 'with ', this.socket.id);
};

module.exports = Player;
