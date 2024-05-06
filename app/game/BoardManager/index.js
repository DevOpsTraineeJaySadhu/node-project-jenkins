/* eslint-disable no-restricted-syntax */
/* eslint-disable class-methods-use-this */
const emitter = require('../../../globals/lib/emitter');
const { redis, mongodb } = require('../../utils');
const ClassicBoard = require('./classic/Board');
const { LudoGame, LudoStuckGame, LudoWaitingGame } = require('../../models');

//board manager called for testing log
class BoardManager {
  constructor() {
    this.oDefaultSetting = {
      nPawnMoveDelay: 335, // change
      nInitializeTimer: 2000, // change
      nMaxWaitingTime: 60000,
      nMaxTurnMissAllowed: 6, // change for html5 3 to 5
      nTurnBuffer: 1200, // change 1000 // 1200
    };
    this.aSafePosition = [1, 9, 14, 22, 27, 35, 40, 48];
    this.oTableClasses = {};

    emitter.on('reqSchedule', this.schedular.bind(this));
    emitter.on('refundOnLongWait', this.schedular.bind(this, 'refundOnLongWait'));
    emitter.on('initializeGame', this.schedular.bind(this, 'initializeGame'));
    emitter.on('assignTurnTimeout', this.schedular.bind(this, 'assignTurnTimeout'));
    emitter.on('refundOnLongWait', this.schedular.bind(this, 'refundOnLongWait'));
    emitter.on('declareResult', this.schedular.bind(this, 'declareResult'));
    emitter.on('finishGame', this.schedular.bind(this, 'finishGame'));
    emitter.on('finishGameTimer', this.schedular.bind(this, 'finishGameTimer'));
    emitter.on('resetTable', this.schedular.bind(this, 'resetTable'));
    emitter.on('splitWinning', this.schedular.bind(this, 'splitWinning'));
    emitter.on('handleState', this.schedular.bind(this, 'handleState'));
    emitter.on('autoTurn', this.schedular.bind(this, 'autoTurn'));
    emitter.on('takeTurn', this.schedular.bind(this, 'takeTurn'));
    emitter.on('reqLeave', this.customQueue.bind(this));
    emitter.on('saveBoardHistory', this.saveBoardHistory.bind(this));
    emitter.on('flushBoard', this.flushBoard.bind(this));
    emitter.on('addWinner', this.schedular.bind(this));
    emitter.on('custom', this.customQueue.bind(this));
    //* new
    emitter.on('saveCanceledGame', this.schedular.bind(this, 'saveCanceledGame'));
    emitter.on('saveStuckGameHistory', this.saveStuckGameHistory.bind(this)); // change new
    emitter.on('saveWaitingGame', this.saveWaitingGame.bind(this));
  }

  async customQueue(oData, callback) {
    try {
      await this.scheduleTask(oData.sEventName, oData.iBoardId, oData.iUserId);
    } catch (error) {
      log.red(error);
    } finally {
      callback();
    }
  }

  async createBoard(oProtoData) {
    try {
      const tableSettings = {
        ...this.oDefaultSetting,
        nTurnTime: oProtoData?.nTurnTime * 1000 || 60000, //change
      };

      const oBoardData = {
        _id: mongodb.mongify(),
        iProtoId: _.toString(oProtoData._id),
        nBoardFee: oProtoData.nBoardFee ?? 0,
        aWinningAmount: oProtoData.aWinningAmount,
        nMaxPlayer: oProtoData.nMaxPlayer,
        aSafePosition: this.aSafePosition,
        iUserTurn: '',

        eState: 'waiting',
        eBoardType: 'cash',
        eGameType: oProtoData.eGameType || 'classic', // this is for either it's rush or classic and by default it's classic
        nGameTime: oProtoData.nGameTime || 300000, // this is for rush game only, this time is for each player
        nAmountIn: 0,
        nAmountOut: 0,
        nBoardColor: _.randomFromArray([0, 2, 3]),
        oSocketId: {},
        oSetting: { ...tableSettings },
        aPlayers: oProtoData.aPlayers,
        aParticipant: [],
        iRoomId: oProtoData.iRoomId,
      };

      // if (oProtoData.eBoardType === 'private') oBoardData.sPrivateCode = _.randomizeNumericString(7, 99999).pop();

      const boardClass = this.generateClass(oBoardData);
      this.oTableClasses[boardClass._id] = boardClass;

      await boardClass.save();
      return boardClass;
    } catch (error) {
      log.red('error from createBoard :: ', error.toString());
    }
  }

  schedular(sTaskName, message) {
    const { iBoardId, iUserId } = message;
    this.scheduleTask(sTaskName, iBoardId, iUserId);
  }

  async scheduleTask(sTaskName, iBoardId, iUserId) {
    const board = await this.getBoard(iBoardId);
    if (!board) return false;

    const participant = iUserId ? board.getParticipant(iUserId) : undefined;
    switch (sTaskName) {
      case 'assignTurnTimeout':
        if (!participant) return log.red(sTaskName, ' => ', messages.not_found('participant').message);
        participant.turnMissed();
        break;
      case 'refundOnLongWait':
        board.refundOnLongWait();
        break;
      case 'initializeGame':
        board.initializeGame();
        break;
      case 'handleState':
        board.handleState();
        break;
      case 'finishGame':
        board.finishGame(iUserId);
        break;
      case 'autoTurn':
        if (!participant) return log.red(sTaskName, ' => ', messages.not_found('participant').message);
        participant.autoTurn();
        break;
      case 'takeTurn':
        if (!participant) return log.red(sTaskName, ' => ', messages.not_found('participant').message);
        participant.takeTurn();
        break;
      case 'reqLeave':
        await participant.leave();
        break;
      case 'addWinner':
        board.addWinner();
        break;
      case 'finishGameTimer':
        board.setTimerFinished();
        break;
      case 'saveCanceledGame':
        board.saveCanceledGameData(iBoardId);
        break;
      default:
        log.red('case did not matched', sTaskName);
        break;
    }
  }

  generateClass(oBoardData) {
    let boardClass;
    switch (oBoardData.eGameType) {
      case 'classic':
        boardClass = new ClassicBoard(oBoardData);
        break;
      default:
        log.red('Invalid boardType while generating class');
        break;
    }
    return boardClass;
  }

  async saveBoardHistory({ iBoardId, aAPIResponse }) {
    try {
      console.log('save board history calleddddddddd...................');
      const board = await this.getBoard(iBoardId);
      if (!board) return false;
      const oBoardJSON = board.toJSON();
      await LudoGame.create({ ...oBoardJSON, aAPIResponse: aAPIResponse, iGameId: oBoardJSON._id });
      log.green('game data save Successfully!!!!');
      const keys = await redis.client.keys(`${iBoardId}:*`);
      await redis.client.unlink(keys);
    } catch (error) {
      log.red(`save history :: ${error}`);
    }
  }

  async saveStuckGameHistory({ iBoardId, aAPIResponse, bTurnSchedulerPresent }) {
    try {
      console.log('save Stuck Game History called for :: ', iBoardId);
      const board = await this.getBoard(iBoardId);
      if (!board) return false;
      const oBoardJSON = board.toJSON();
      // if (oBoardJSON.eState === 'waiting' && oBoardJSON.aParticipant.length < 2) {
      if (oBoardJSON.eState === 'waiting') {
        // && oBoardJSON.aParticipant.length < 2 change in production
        await LudoWaitingGame.create({ ...oBoardJSON, aAPIResponse: aAPIResponse, iGameId: oBoardJSON._id, bTurnSchedulerPresent });
      } else {
        await LudoStuckGame.create({ ...oBoardJSON, aAPIResponse: aAPIResponse, iGameId: oBoardJSON._id, bTurnSchedulerPresent });
      }
      log.green('game data save Successfully!!!!');
      const keys = await redis.client.keys(`${iBoardId}:*`);
      await redis.client.unlink(keys);
    } catch (error) {
      log.red(`save history :: ${error}`);
      return error;
    }
  }
  async saveWaitingGame({ iBoardId }) {
    try {
      console.log('waiting Game save event called...................');
      const board = await this.getBoard(iBoardId);
      if (!board) return false;
      const oBoardJSON = board.toJSON();
      await LudoWaitingGame.create({ ...oBoardJSON, iGameId: oBoardJSON._id });
      log.green('save Waiting Game  Successfully!!!!');
      const keys = await redis.client.keys(`${iBoardId}:*`);
      await redis.client.unlink(keys);
    } catch (error) {
      log.red(`save history :: ${error}`);
    }
  }

  async flushBoard({ iBoardId, iProtoId }) {
    const keys = await redis.client.keys(`${iBoardId}:*`);
    if (keys.length) await redis.client.unlink(keys);
    await redis.client.unlink(_.getProtoKey(iProtoId));
  }

  async getBoard(iBoardId) {
    if (!iBoardId) return false; // change
    const key = _.getBoardKey(iBoardId);
    const oTableData = await redis.client.json.GET(key);
    if (!oTableData) return false;

    const aParticipant = [];
    for (const [_key, value] of Object.entries(oTableData)) {
      if (_key.includes('aParticipant')) {
        aParticipant.push(value);
      }
    }

    oTableData.aParticipant = aParticipant;
    oTableData.aParticipant.sort((a, b) => a?.nSeat - b?.nSeat);
    // new Board(oTableData);
    return iBoardId in this.oTableClasses ? this.oTableClasses[iBoardId].updateClass(oTableData) : this.generateClass(oTableData);
  }
  async createBoardMM(oProtoData) {
    try {
      log.green('## createBoardMM called for new game :: ');
      const tableSettings = {
        ...this.oDefaultSetting,
        nMaxWaitingTime: oProtoData?.nMaxRefundTime || 60000, // 1 minute
        nTurnTime: oProtoData?.nTurnTime || 20000,
        // nTurnTime: 20000,
      };

      const oBoardData = {
        _id: oProtoData.iGameId,
        iProtoId: _.toString(oProtoData._id),
        nBoardFee: oProtoData.nBoardFee ?? 0,
        aWinningAmount: oProtoData.aWinningAmount,
        nMaxPlayer: oProtoData.nMaxPlayer,
        nRealPlayerCount: oProtoData.nRealPlayerCount,
        aSafePosition: this.aSafePosition,
        iUserTurn: '',
        eState: 'waiting',
        eBoardType: 'cash', //oProtoData.eBoardType ||
        eGameType: oProtoData.eGameType || 'classic', // this is for either it's rush or classic and by default it's classic
        nGameTime: oProtoData.nGameTime || 300000, // this is for rush game only, this time is for each player
        nAmountIn: 0,
        nAmountOut: 0,
        oSocketId: {},
        isExit: true, // change p
        isValidLeave: true, // change p
        oSetting: { ...tableSettings },
        aPlayer: oProtoData.aPlayer ?? [],
        nBoardColor: _.randomFromArray([0, 2, 3]),
        iRoomId: oProtoData.iRoomId,
        isEnvironment: oProtoData.isEnvironment,
        aLogs: [],
        dCreatedDate: oProtoData.dCreatedDate || new Date(),
      };
      const boardClass = this.generateClass(oBoardData);
      this.oTableClasses[boardClass._id] = boardClass;

      await boardClass.save();
      log.yellow('## boardClass generated.');
      return boardClass;
    } catch (error) {
      console.log(error);
      log.red('error from createBoard :: ', error.toString());
    }
  }
}

module.exports = new BoardManager();
