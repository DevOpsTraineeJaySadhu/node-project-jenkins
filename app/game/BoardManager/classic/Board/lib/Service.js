/* eslint-disable no-continue */

const { ExistBoard } = require('../../../../../models');
const { redis } = require('../../../../../utils');
const Participant = require('../../Participant');
const crypto = require('crypto');

class Service {
  constructor(oBoardData) {
    this._id = oBoardData._id;
    this.iProtoId = oBoardData.iProtoId;
    this.aParticipant = oBoardData.aParticipant ? oBoardData.aParticipant.map(p => new Participant(p, this)) : [];
    this.iWinnerId = oBoardData.iWinnerId;
    this.aWinningAmount = oBoardData.aWinningAmount;
    this.aSafePosition = oBoardData.aSafePosition;
    this.oSocketId = oBoardData.oSocketId;
    this.bDiceRolled = oBoardData.bDiceRolled;
    this.eState = oBoardData.eState;
    this.iUserTurn = oBoardData.iUserTurn;
    this.iNextUserTurn = oBoardData.iNextUserTurn;
    this.nBoardFee = oBoardData.nBoardFee;
    this.eBoardType = oBoardData.eBoardType;
    this.eGameType = oBoardData.eGameType;
    this.nMaxPlayer = oBoardData.nMaxPlayer;
    this.nDice = oBoardData.nDice || 0;
    this.nAmountIn = oBoardData.nAmountIn;
    this.nAmountOut = oBoardData.nAmountOut;
    this.sPrivateCode = oBoardData.sPrivateCode;
    this.nRepeatSix = oBoardData.nRepeatSix || 0;
    this.oSetting = oBoardData.oSetting;
    this.nBoardColor = oBoardData.nBoardColor;
    this.iRoomId = oBoardData.iRoomId;
    this.aPlayer = oBoardData.aPlayer;
    this.isExit = oBoardData.isExit; //change p
    this.isValidLeave = oBoardData.isValidLeave; // change p
    this.isSix = oBoardData.isSix || 0;
    this.isEnvironment = oBoardData.isEnvironment;
    this.dCreatedDate = oBoardData.dCreatedDate;
    this.aLogs = oBoardData.aLogs || [];
    this.sVersion = oBoardData.sVersion || 'v2.0.0';
  }

  async generateHashToken(data) {
    const timestamp = Date.now().toString();
    const dataWithTimestamp = data + timestamp;
    const secret = 'HASH-TOKEN-SECRET-12112';
    const hash = crypto.createHmac('sha256', secret).update(dataWithTimestamp).digest('hex');

    const prefixToken = `${this._id}:dummy:${hash}`;
    return prefixToken;
  }

  //* new
  async initializeGame() {
    log.green('initializeGame called for battle...', this._id);
    // this.aLogs.push(`initializeGame with GameId: ${this._id}`);
    const key = _.getBoardKey(this._id);
    const oTableData = await redis.client.json.GET(key);
    log.green('initializeGame oTableData state ...', oTableData.eState);
    if (!oTableData) return false;

    if (oTableData.eState === 'playing') {
      // change
      await ExistBoard.create({
        iGameId: _.toString(this._id),
        sDescription: 'Initialized Game called when table state is already Playing.',
        sCurrentBoardState: this.eState,
        eGameType: this.eGameType,
      });
      return false;
    }
    this.eState = 'playing';
    await this.update({ eState: 'playing' }); // change
    // await _.delay(3000);
    this.aParticipant.map(p => (p.eState = 'playing'));
    await this.update({ aParticipant: this.aParticipant.map(p => p.toJSON()) });
    log.green('## resBoardState send to client::::', this._id);
    await _.removeFieldFromArray(this.toJSON().aPlayer, 'sUserToken');
    this.emit('resBoardState', this.toJSON());
    this.aParticipant.map((p, i) => {
      p.eState = 'playing';
      p.nSeat = i;
      return false;
    });
    const oParticipant = _.randomFromArray(this.aParticipant);
    this.iUserTurn = oParticipant.iUserId;
    await this.update({ iUserTurn: this.iUserTurn, eState: 'playing', aParticipant: this.aParticipant.map(p => p.toJSON()) }); // change
    oParticipant.takeTurn();
  }

  updateClass(oBoardData) {
    this._id = oBoardData._id;
    this.iProtoId = oBoardData.iProtoId;
    this.iWinnerId = oBoardData.iWinnerId;
    this.aParticipant = oBoardData.aParticipant ? oBoardData.aParticipant.map(p => new Participant(p, this)) : [];
    this.aWinningAmount = oBoardData.aWinningAmount;
    this.aSafePosition = oBoardData.aSafePosition;
    this.oSocketId = oBoardData.oSocketId;
    this.bDiceRolled = oBoardData.bDiceRolled;
    this.eState = oBoardData.eState;
    this.iUserTurn = oBoardData.iUserTurn;
    this.iNextUserTurn = oBoardData.iNextUserTurn;
    this.nBoardFee = oBoardData.nBoardFee;
    this.eBoardType = oBoardData.eBoardType;
    this.nMaxPlayer = oBoardData.nMaxPlayer;
    this.nDice = oBoardData.nDice;
    this.nAmountIn = oBoardData.nAmountIn;
    this.nAmountOut = oBoardData.nAmountOut;
    this.nRepeatSix = oBoardData.nRepeatSix;
    this.nBoardColor = oBoardData.nBoardColor;
    this.iRoomId = oBoardData.iRoomId;
    this.isExit = oBoardData.isExit;
    this.isValidLeave = oBoardData.isValidLeave;
    this.isSix = oBoardData.isSix;
    this.isEnvironment = oBoardData.isEnvironment;
    this.dCreatedDate = oBoardData.dCreatedDate;
    this.aLogs = oBoardData.aLogs;
    this.sVersion = oBoardData.sVersion;
    return this;
  }

  getParticipant(iUserId) {
    return this.aParticipant.find(p => p.iUserId === iUserId);
  }

  getNextParticipant(nSeat, isForcePassTurn) {
    let participant;
    if (this.nDice === 6 && !isForcePassTurn) {
      participant = this.aParticipant.find(p => p.nSeat === nSeat);
      return participant;
    }
    participant = this.aParticipant.find(p => p.nSeat > nSeat && p.eState === 'playing');
    if (!participant) participant = this.aParticipant.find(p => p.nSeat < nSeat && p.eState === 'playing');
    if (!participant) return log.red('next participant not found');
    // if (!participant) return undefined;
    return participant;
  }

  async addParticipant(oUserData) {
    try {
      log.green('## addParticipant called for user....');
      // const key = this.sPrivateCode ? _.getProtoKey(this.sPrivateCode) : _.getProtoKey(this.iProtoId);
      // const nTotalParticipant = oUserData.nTurn;
      const nTotalParticipant = this.aParticipant.length;

      const _userData = {
        ...oUserData.oUserData,
        sUserName: oUserData.oUserData.sUserName,
        iUserId: oUserData.oUserData._id,
        nSeat: this.getEmptySeat(),
        nChips: _.salt(4, Number),
      };
      const oParticipant = new Participant(_userData, this);
      const { nMaxWaitingTime } = this.oSetting;

      this.aParticipant.push(oParticipant);
      // console.log('participant Array::::::', this.aParticipant);
      // oParticipant.updateUser({ $inc: { nChips: -this.nBoardFee } });
      // this.nAmountIn += this.nBoardFee;

      // if (this.aParticipant.length === 1) this.setSchedular('refundOnLongWait', null, 60000);
      // this.setSchedular('initializeGame', null, this.oSetting.nInitializeTimer);//TODO : 3 kalak * 3 * 1000
      // log.red('this.nMaxPlayer :: ', this.nMaxPlayer);
      // log.red('nTotalParticipant :: ', this.aParticipant.length);
      if (this.nMaxPlayer === this.aParticipant.length) {
        const _key = this.sPrivateCode ? _.getProtoKey(this.sPrivateCode) : _.getProtoKey(this.iProtoId);
        await redis.client.unlink(_key);
        await this.deleteScheduler('refundOnLongWait');
        // await ExistBoard.create({
        //   iGameId: this.iGameId,
        //   sDescription: 'Table state Will be Set as Initialized',
        //   sCurrentBoardState: this.eState,
        // });
        this.eState = 'initialized';
        // this.eState = 'playing';
        // this.aParticipant.map(p => (p.eState = 'playing')); // change
        // await this.update({ aParticipant: this.aParticipant.map(p => p.toJSON()) });// change
        this.setSchedular('initializeGame', null, this.oSetting.nInitializeTimer);
        // this.aLogs.push(`Two participant Join in Board : ${this.aParticipant.toString()} and game is Start in ${this.oSetting.nInitializeTimer}`);
        // await this.update({ aLogs: this.aLogs });
      }

      await this.update({
        aParticipant: [oParticipant.toJSON()],
        eState: this.eState,
      });

      return { iBoardId: this._id, eState: this.eState, nChips: oParticipant.nChips, sPrivateCode: this.sPrivateCode, nTotalParticipant };
    } catch (error) {
      // this.aLogs.push('🚀 ~ file: Service.js:176 ~ Service ~ addParticipant ~ error:', error.toString());
      // await this.update({ aLogs: this.aLogs });
      log.error(`${error}`);
      return false;
    }
  }

  getEmptySeat() {
    const aBookedSeat = this.aParticipant.map(p => p.nSeat);
    const aEmptySeat = [];
    for (let i = 0; i < this.nMaxPlayer; i += 1) if (!aBookedSeat.includes(i)) aEmptySeat.push(i);
    const randomSeatIndex = _.randomBetween(0, aEmptySeat.length - 1);
    return aEmptySeat[randomSeatIndex];
  }

  async rollDice(oData) {
    log.green('rollDice called for user....');
    if (this.bDiceRolled) return false;
    if ((!oData.sHashToken || oData.sHashToken == '') && !oData.bTurnMissed) {
      log.red('we will restrict user to roll dice,Lake of token here ............');
      return false;
    }
    if (!oData.bTurnMissed) {
      let tokenValue = await redis.client.zScore(oData.sHashToken, _.toString(this._id));
      if (!tokenValue || tokenValue > 2) {
        log.red('we will restrict user to roll dice here ............');
        return false;
      }
      const dltToken = await redis.client.del(oData.sHashToken); // remove token from redis.
    }

    const eventToken = await this.generateHashToken(this.iUserTurn);
    // const nTokenCount = await redis.client.zIncrBy(_.getProtoKey(board.iProtoId), 1, _.toString(board._id));
    const nTokenCount = await redis.client.zIncrBy(eventToken, 1, _.toString(this._id));
    let availableDices = await this.availableDices();
    if (oData.bTurnMissed) availableDices = availableDices.filter(d => d !== 6);
    if (!availableDices.length) availableDices = [1, 2, 3, 4, 5];
    const currentDice = oData.nDice || _.randomFromArray(availableDices);
    if (!currentDice) {
      return passTurn();
    }
    this.nDice = currentDice;
    log.cyan('user GEt ::::', this.nDice);

    if (currentDice === 6 && this.isSix === 0) {
      this.isSix += 1;
      this.isExit = false;
      await this.update({ isExit: this.isExit });
    }
    const participant = this.getParticipant(this.iUserTurn);

    const passTurn = async bForcePassTurn => {
      await this.deleteScheduler('assignTurnTimeout', participant.iUserId);
      await _.delay(1000);

      participant.passTurn(bForcePassTurn);
    };
    const aMovablePawns = participant.getMovablePawns(currentDice);
    if (currentDice === 6) this.nRepeatSix += 1;
    this.bDiceRolled = true;
    await this.update({ nDice: currentDice, bDiceRolled: true, nRepeatSix: this.nRepeatSix, isSix: this.isSix });
    const { aPublicPosition } = participant;

    let bAutoMove = aMovablePawns.every(i => aPublicPosition[aMovablePawns[0]] === aPublicPosition[i]);

    if (bAutoMove) {
      if (aMovablePawns.every(i => aPublicPosition[i] === 0) && aMovablePawns.length !== 1) bAutoMove = false;
    }
    if (!aMovablePawns.length && aPublicPosition[0] < 100) {
      bAutoMove = true;
    }
    const key = _.getBoardKey(this._id);
    const oTableData = await redis.client.json.GET(key);
    // if (oTableData && oTableData != {}) {
    if (oTableData) {
      if (currentDice !== oTableData.nDice) {
        this.nDice = oTableData.nDice !== 0 ? oTableData.nDice : currentDice;
        await this.update({ nDice: this.nDice });
        await ExistBoard.create({
          iGameId: _.toString(this._id),
          sDescription: `Redis Dice: ${oTableData.nDice}, local This Dice: ${currentDice}`,
          sCurrentBoardState: this.eState,
          eGameType: this.eGameType,
        });
      }
    } else {
      await ExistBoard.create({
        iGameId: _.toString(this._id),
        sDescription: `Not able to get redis data in rollDice(),Redis table key is ${key}.`,
        sCurrentBoardState: this.eState,
        eGameType: this.eGameType,
      });
    }

    const eventData = {
      nDice: this.nDice,
      aMovablePawns: aMovablePawns,
      bTurnMissed: oData?.bTurnMissed || false,
      bAutoMove,
      iUserTurn: this.iUserTurn,
      isExit: this.isExit,
      sHashToken: eventToken,
    };
    this.emit('resRollDice', eventData);

    // this.emit('resRollDice', {
    //   nDice: this.nDice,
    //   aMovablePawns: aMovablePawns,
    //   bTurnMissed: oData?.bTurnMissed || false,
    //   bAutoMove,
    //   iUserTurn: this.iUserTurn,
    //   isExit: this.isExit,
    //   sHashToken:eventToken
    // });
    if (!bAutoMove && (!aMovablePawns || !aMovablePawns.length)) {
      return passTurn(true);
    }
    if (oData?.bTurnMissed || bAutoMove) {
      await _.delay(500);
      participant.autoTurn(eventToken);
    }
  }

  async availableDices() {
    const participant = this.getParticipant(this.iUserTurn);
    const { aPawn, aPublicPosition } = participant;
    let aDice;
    this.nRepeatSix === 2 ? (aDice = [1, 2, 3, 4, 5]) : (aDice = [1, 2, 3, 4, 5, 6]);
    let aRemove = [];

    for (const p of aPawn) {
      if (p === 0) continue;
      for (const d of aDice) {
        const nDestination = positions[this.nMaxPlayer][participant.nSeat][d + p];
        if (nDestination < 100 && aPublicPosition.includes(nDestination) && !this.aSafePosition.includes(nDestination)) {
          aRemove.push(d);
        }
      }
    }

    return aDice.filter(d => !aRemove.includes(d));
    // return [6];
  }

  async save(oData = this.toJSON()) {
    try {
      delete oData.aParticipant;
      log.green('saving data for table :: ');
      await redis.client.json.set(_.getBoardKey(this._id), '.', oData);
      await redis.client.EXPIRE(_.getBoardKey(this._id), 60 * 480); //TODO:- this.oSetting.nMaxWaitingTime
      this.setSchedular('saveCanceledGame', null, 3600 * 7.8 * 1000); // change
      // this.aLogs.push('🚀 ~ file: Service.js:306 Save Board Data in To Redis Data:');
      // await this.update({ aLogs: this.aLogs });

      return true;
    } catch (error) {
      // this.aLogs.push('🚀 ~ file: Service.js:315 ~ Service ~ save ~ error:', error.toString());
      // await this.update({ aLogs: this.aLogs });

      return false;
    }
  }

  async update(oData) {
    try {
      const _key = _.getBoardKey(this._id);
      const aPromise = [];
      for (const [field, value] of Object.entries(oData)) {
        if (field !== 'aParticipant') {
          if (this[field] !== undefined) {
            // this[field] = value;
            if (field !== 'nDice') this[field] = value; // TODO: Think for this twice.
            // aPromise.push(redis.client.json.set(_key, `.${field}`, value));
            await redis.client.json.set(_key, `.${field}`, value);
          }
        } else {
          for (const p of value) {
            // aPromise.push(redis.client.json.set(_key, `.${field}-${p.iUserId}`, p));
            await redis.client.json.set(_key, `.${field}-${p.iUserId}`, p);
          }
        }
      }
      // await Promise.all(aPromise);
    } catch (error) {
      log.console(error);
      // this.aLogs.push(`🚀 ~ file: Service.js:337 ~ Service ~ update ~ error:, ${error.toString()}`);
      // await this.update({ aLogs: this.aLogs });
    }
  }

  async setSchedular(sTaskName = '', iUserId = '', nTimeMS = 0) {
    try {
      if (!sTaskName) return false;
      if (!nTimeMS) return false;

      log.yellow('setSchedular:', sTaskName, this._id, iUserId, nTimeMS);
      return redis.client.pSetEx(_.getSchedulerKey(sTaskName, _.toString(this._id), iUserId), nTimeMS, sTaskName);
    } catch (err) {
      log.error('err.message :: ', _.stringify(err.message));
      log.error('err :: ', _.stringify(err));
      log.error(
        `table.setSchedular() failed.${{
          reason: err.message,
          stack: err.stack,
        }}`
      );
      // this.aLogs.push(
      //   `table.setSchedular() failed.${{
      //     reason: err.message,
      //     stack: err.stack,
      //   }}`
      // );
      // await this.update({ aLogs: this.aLogs });

      return false;
    }
  }

  async getScheduler(sTask, iUserId = '*') {
    try {
      let schedularKey = '';

      const aSchedular = await redis.client.keys(_.getSchedulerKey(sTask, this._id, iUserId, '*'));
      if (aSchedular.length > 1) redis.client.unlink(aSchedular.slice(1));
      schedularKey = aSchedular[0];

      if (!schedularKey) return null;
      const ttl = await redis.client.pTTL(schedularKey);
      return ttl;
    } catch (error) {
      // this.aLogs.push(`table.getScheduler(sTaskName: ${sTask}, iUserId: ${iUserId}, iBoardId: ${this._id}) failed. reason: ${err.message}`);
      // await this.update({ aLogs: this.aLogs });

      log.error(`table.getScheduler(sTaskName: ${sTask}, iUserId: ${iUserId}, iBoardId: ${this._id}) failed. reason: ${err.message}`);
      return false;
    }
  }

  async deleteScheduler(sTaskName = '', iUserId = '*') {
    try {
      // const sKey = _.getSchedulerKey(sTaskName, this._id, iUserId);
      const sKey = _.getSchedulerKeyWithOutHost(sTaskName, this._id, iUserId);

      const schedularKeys = await redis.client.keys(sKey);
      if (!schedularKeys.length) return false;

      const deletionCount = await redis.client.unlink(schedularKeys);

      return deletionCount;
    } catch (err) {
      log.error(`table.deleteScheduler(sTaskName: ${sTaskName}, iUserId: ${iUserId}, iBoardId: ${this._id}) failed. reason: ${err.message}`);
      // this.aLogs.push(`table.deleteScheduler(sTaskName: ${sTaskName}, iUserId: ${iUserId}, iBoardId: ${this._id}) failed. reason: ${err.message}`);
      // await this.update({ aLogs: this.aLogs })
      return false;
    }
  }

  async handleState() {
    try {
      const aPlayingPlayer = this.aParticipant.filter(p => p.eUserType === 'user');
      if (!aPlayingPlayer.length && this.eState !== 'playing') return emitter.emit('flushBoard', { iBoardId: this._id, iProtoId: this.sPrivateCode || this.iProtoId });
      if (!aPlayingPlayer.length) {
        this.finishGame(_.randomFromArray(this.aParticipant).iUserId);
      }
    } catch (error) {
      // this.aLogs.push('🚀 ~ file: Service.js:413 ~ Service ~ handleState ~ error:', error.toString());
      // await this.update({ aLogs: this.aLogs });

      return false;
    }
  }

  toJSON() {
    const table = _.pick(this, [
      //
      '_id',
      'aSafePosition',
      'iWinnerId',
      'oSocketId',
      'bDiceRolled',
      'eBoardType',
      'eGameType',
      'iProtoId',
      'iUserTurn',
      'iNextUserTurn',
      'nDice',
      'nBoardFee',
      'nMaxPlayer',
      'oSetting',
      'nAmountIn',
      'nAmountOut',
      'aWinningAmount',
      'eState',
      'sPrivateCode',
      'nRepeatSix',
      'nBoardColor',
      'iRoomId',
      'aPlayer',
      'isExit',
      'isValidLeave',
      'isSix',
      'isEnvironment',
      'dCreatedDate',
      'aLogs',
      'sVersion',
    ]);
    table.aParticipant = this.aParticipant.map(p => p.toJSON());
    return table;
  }
}

module.exports = Service;
