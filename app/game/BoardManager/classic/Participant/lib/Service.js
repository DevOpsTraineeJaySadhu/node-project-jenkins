const { User } = require('../../../../../models');
const { ExistBoard } = require('../../../../../models');
const axios = require('axios');
const crypto = require('crypto');
const { redis } = require('../../../../../utils');

class Service {
  constructor(oParticipantData, oBoard) {
    this.aPawn = oParticipantData.aPawn ?? [0, 0, 0, 0];
    this.aPublicPosition = oParticipantData.aPublicPosition || [0, 0, 0, 0];
    this.aMovedPawn = oParticipantData.aMovedPawn || [];
    this.aAutoMovePawn = oParticipantData.aAutoMovePawn || [];
    this.iUserId = oParticipantData.iUserId;
    this.nSeat = oParticipantData.nSeat;
    this.nChips = oParticipantData.nChips || 0;
    this.nTurnMissed = oParticipantData.nTurnMissed || 0;
    this.nColor = oParticipantData.nColor;
    this.sUserName = oParticipantData.sUserName;
    this.eState = oParticipantData.eState || 'waiting';
    this.nRank = oParticipantData.nRank;
    this.aScore = oParticipantData.aScore || [];
    this.aWinner = oParticipantData.aWinner;
    this.nWinningAmount = oParticipantData.nWinningAmount;
    this.eUserType = oParticipantData.eUserType;
    this.nGamePlayed = oParticipantData.nGamePlayed;
    this.nGameWon = oParticipantData.nGameWon;
    this.nGameLost = oParticipantData.nGameLost;
    this.nKills = oParticipantData.nKills || 0;
    this.nDeath = oParticipantData.nDeath || 0;
    this.bIsTie = oParticipantData.bIsTie;
    this.bSound = oParticipantData.bSound || true;
    this.sReason = oParticipantData.sReason || '';
    this.oBoard = oBoard;
  }

  async generateHashToken(data) {
    const timestamp = Date.now().toString();
    const dataWithTimestamp = data + timestamp;
    const secret = 'HASH-TOKEN-SECRET-12112';
    const hash = crypto.createHmac('sha256', secret).update(dataWithTimestamp).digest('hex');

    const prefixToken = `${this.oBoard._id}:dummy:${hash}`;
    return prefixToken;
  }

  get gameState() {
    log.red('gameState called ...');
    return this.oBoard.toJSON();
  }

  get sRootSocket() {
    return this.oBoard?.oSocketId ? this.oBoard?.oSocketId[this.iUserId] : null;
  }

  stateHandler() {
    // this.emit('resBoardState', this.gameState);
    log.red('stateHandler called for new joined player...', this.oBoard.eState);
    // this.oBoard.aLogs.push('🚀 ~ file: Service.js:42 ~ Service ~ stateHandler ~ stateHandler:', this.oBoard.eState);

    if (this.oBoard.eState === 'playing') return this.sendTurnInfo();
  }

  async sendTurnInfo() {
    const { nTurnTime, nTurnBuffer } = this.oBoard.oSetting;
    const turnInfo = {
      iUserId: this.oBoard.iUserTurn,
      bDiceRolled: this.oBoard.bDiceRolled,
      nTotalTurnTime: nTurnTime - nTurnBuffer,
      nDice: this.oBoard.nDice,
      // dTimeEvenSend: new Date()
      dTimeEvenSend: Date.now(),
      sHashToken: '',
      oBoard: this.oBoard ? this.oBoard : {},
    };
    /**
     * TODO: Need to share token here.
     * if same user has turn then create new hash token and share with user.
     */
    if (this.oBoard.iUserTurn === this.iUserId) {
      turnInfo.sHashToken = await this.generateHashToken(this.iUserId);
      const nTokenCount = await redis.client.zIncrBy(turnInfo.sHashToken, 1, _.toString(this.oBoard._id));
    }

    turnInfo.ttl = await this.oBoard.getScheduler('assignTurnTimeout', turnInfo.iUserId);
    turnInfo.ttl -= nTurnBuffer;
    if (turnInfo.bDiceRolled && turnInfo.iUserId === this.iUserId) turnInfo.aMovablePawns = this.getMovablePawns(this.oBoard.nDice);
    if (turnInfo.ttl < 200) return false;
    // this.oBoard.aLogs.push(`🚀 ~ file: Service.js:65 ~ Service ~ sendTurnInfo ~ turnInfo:, ${turnInfo} `);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });

    this.emit('resPlayerTurn', turnInfo);
  }

  hasValidTurn() {
    return this.iUserId === this.oBoard.iUserTurn;
  }

  async takeTurn() {
    // if (this.oBoard.iUserTurn === this.iUserId) return false;
    log.red('takeTurn called for :: ', this.iUserId);
    // this.oBoard.aLogs.push(`takeTurn called for :: , ${this.iUserId}`);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });

    this.oBoard.iUserTurn = this.iUserId;
    const { nTurnTime, nTurnBuffer } = this.oBoard.oSetting;

    this.oBoard.bDiceRolled = false;
    await this.oBoard.update({ iUserTurn: this.iUserId, bDiceRolled: false });

    // await this.oBoard.setScheduler('assignTurnTimeout', this.iUserId, nTurnTime + nTurnBuffer);
    //* new change
    const turnScheduler = await this.oBoard.getScheduler('assignTurnTimeout');
    if (turnScheduler) await this.oBoard.deleteScheduler('assignTurnTimeout');

    await this.oBoard.setScheduler('assignTurnTimeout', this.iUserId, nTurnTime);

    // TODO: generate turn token for net event.
    const eventToken = await this.generateHashToken(this.iUserId);
    // const nTokenCount = await redis.client.zIncrBy(_.getProtoKey(board.iProtoId), 1, _.toString(board._id));
    const nTokenCount = await redis.client.zIncrBy(eventToken, 1, _.toString(this.oBoard._id));
    this.oBoard.emit('resPlayerTurn', {
      // iUserId: this.iUserId, // need to remove this.
      iUserId: this.oBoard.iUserTurn,
      ttl: nTurnTime - nTurnBuffer,
      nTotalTurnTime: nTurnTime - nTurnBuffer,
      bDiceRolled: false,
      nDice: 'undefined',
      sHashToken: eventToken,
      // nDice: this.oBoard.nDice,
      // dTimeEvenSend: new Date()
      dTimeEvenSend: Date.now(),
      oBoard: this.oBoard,
    });
    // this.oBoard.aLogs.push(`takeTurn Scheduler create for User :: ${this.iUserId}`);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });
  }
  async endGameAPI(optionsEndGame) {
    const { endGame } = await axios(optionsEndGame);
    return endGame;
  }

  async leave(sReason = 'Left the board by quitting manually.', eState = 'left') {
    // TODO: Need to find better way for return false; statement.
    log.red('Leave Game State:::', eState);
    log.cyan('axios call for this waiting player left:::::::::::::::', this.oBoard.isEnvironment);
    let axiosOptions;
    try {
      // if (this.oBoard.eState === 'initialized') return false;
      log.green('leave table called for table .......', this.oBoard.eState);
      const sPreviousState = this.eState;
      this.eState = eState;
      await this.oBoard.update({ aParticipant: [this.toJSON()] });
      const aPlayingPlayer = await this.oBoard.aParticipant.filter(p => p.eState === 'playing');

      const playingPlayerLeft = async () => {
        log.yellow('playingPlayerLeft ::: called!!');
        if (!this.oBoard.isExit && this.eState !== 'ame') {
          this.eState = 'playing';
          await this.oBoard.update({ aParticipant: [this.toJSON()] });
          return this.passTurn(true);
        }
        this.sReason = sReason;
        await this.oBoard.update({ aParticipant: [this.toJSON()] });
        // remove this for stuck issue. // already updated before each.
        // if (!aPlayingPlayer.length) {
        //   // TODO: check if this is not a valid case
        //   this.eState = 'playing'; // undo changes for participant state.
        //   await this.oBoard.update({ aParticipant: [this.toJSON()] });
        //   return false;
        // }
        if (aPlayingPlayer.length === 1) {
          const playingPlayer = aPlayingPlayer[0];
          playingPlayer.nRank = 1;
          await this.oBoard.update({ aParticipant: [playingPlayer.toJSON()] });
          await this.oBoard.emit('resPlayerLeft', { iUserId: this.iUserId, sReason });
          return emitter.emit('finishGame', { iBoardId: this.oBoard._id, iUserId: playingPlayer.iUserId, sReason });
        }

        const aRank = this.oBoard.aParticipant.filter(p => p.eState === 'left' && p.iUserId !== this.iUserId).map(p => p.nRank);
        if (!this.nRank) this.nRank = !aRank.length ? this.oBoard.nMaxPlayer : aRank.sort((a, b) => b - a)[0] - 1;
        await this.oBoard.update({ aParticipant: [this.toJSON()] });
        this.oBoard.emit('resPlayerLeft', { iUserId: this.iUserId, sReason });
        if (this.iUserId === this.oBoard.iUserTurn) {
          const deletedSchedular = await this.oBoard.deleteScheduler('assignTurnTimeout', this.iUserId);
          if (deletedSchedular || sReason !== 'Left the board by quitting manually.') this.passTurn(true);
        }
      };

      const waitingPlayerLeft = async () => {
        log.green('waitingPlayerLeft:::::::: called');
        // this.oBoard.aLogs.push(`waitingPlayerLeft:::::::: called for Board ${this._id},  and User: ${this.iUserId}`);
        // await this.oBoard.update({ aLogs: this.oBoard.aLogs });

        this.eState = 'left';
        this.sReason = 'Left the board by quitting manually in waiting stag';
        await this.oBoard.update({ aParticipant: [this.toJSON()] });
        let aAPIResponse = [];
        let apiResponse = {};
        let nTimeApiCalled = 0;
        let sEndGameResponse = '';
        const retryAxiosCall = async (optionsEndGame, maxRetries = 3, delayMs = 15000) => {
          try {
            const response = await axios(optionsEndGame);
            return response.data;
          } catch (error) {
            apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
            apiResponse.sEndGameResponse = `API response ${error.message}`;
            aAPIResponse.push(apiResponse);
            apiResponse = {};
            if (maxRetries <= 0) {
              emitter.emit('saveBoardHistory', { iBoardId: this.oBoard._id, aAPIResponse });
              nTimeApiCalled = 0;
              sEndGameResponse = '';
              aAPIResponse = [];
              apiResponse = {};
              throw error; // No more retries, propagate the error
            }
            console.error(`API request failed. Retrying in ${delayMs / 1000} seconds...`);
            // Use setTimeout to introduce a delay before retrying the request
            await new Promise(resolve => setTimeout(resolve, delayMs));

            return retryAxiosCall(optionsEndGame, maxRetries - 1, delayMs);
          }
        };
        const _key = this.oBoard.sPrivateCode ?? this.oBoard.iProtoId;
        // const score = await redis.client.zScore(_.getProtoKey(_key), this.oBoard._id);
        // if (score > 1) await redis.client.zAdd(_.getProtoKey(_key), { score: score - 1, value: _.toString(this.oBoard._id) });

        // this.oBoard.nAmountIn -= this.oBoard.nBoardFee;

        // await this.oBoard.update({ nAmountIn: this.oBoard.nAmountIn });
        await this.oBoard.deleteParticipant(this.iUserId);

        if (this.oBoard.aParticipant.length === 1) {
          this.oBoard.emit('resPlayerLeft', { iUserId: this.iUserId, sReason });
          emitter.emit('flushBoard', { iBoardId: this.oBoard._id, iProtoId: this.oBoard.sPrivateCode || this.oBoard.iProtoId });
        }
        let isExit = [];
        for (const p of this.oBoard.aParticipant) {
          isExit.push(p.aMovedPawn);
        }
        // const bValidLeave = isExit.length ? false : true;
        const bValidLeave = isExit.flat().length ? false : true;
        // let optionsEndGame;

        log.green('axiosOptions::', axiosOptions);

        if (this.oBoard.isEnvironment === 'STAGING') {
          axiosOptions = {
            method: 'post',
            url: `${process.env.CLIENT_SERVER_STAG}/game-end`,
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_STAG },
            data: {
              game_id: this.oBoard._id,
              status: 'canceled',
              winner: '',
              score: [0, 0],
              isValidLeave: bValidLeave,
            },
          };
        } else {
          axiosOptions = {
            method: 'post',
            url: `${process.env.CLIENT_SERVER_PROD}/game-end`,
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_PROD },
            data: {
              game_id: this.oBoard._id,
              status: 'canceled',
              winner: '',
              score: [0, 0],
              // isValidLeave: this.oBoard.isValidLeave,
              isValidLeave: bValidLeave,
            },
          };
        }
        if (this.oBoard.isEnvironment !== 'DEV') {
          const endGame = await _.retryAxiosCall(axiosOptions);
          if (endGame) {
            apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
            apiResponse.sEndGameResponse = `API response send Successfully in ${nTimeApiCalled} try and: ${endGame}`;
            aAPIResponse.push(apiResponse);
            apiResponse = {};
          }
        }

        this.oBoard.emit('resPlayerLeft', { iUserId: this.iUserId, sReason });
        emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse });
      };

      if (this.oBoard.eState === 'waiting') {
        await waitingPlayerLeft();
      } else if (this.oBoard.eState === 'playing') {
        await playingPlayerLeft();
      } else {
        // additional.
        this.eState = sPreviousState;
        await this.oBoard.update({ aParticipant: [this.toJSON()] });
        return false; // TODO: need to do some betterway here. // table state might be initialized
      }
    } catch (error) {
      log.console('error from leave :: ', error.toString());
      await ExistBoard.create({
        iGameId: this.oBoard._id,
        sDescription: `Error in leave function :: ${error.toString()}`,
        sCurrentBoardState: this.oBoard.eState,
        eGameType: this.oBoard.eGameType,
      });
    }
  }

  async creditChips(nWinningAmount) {
    await this.updateUser({ $inc: { nChips: nWinningAmount } });
  }

  async updateUser(updateQuery) {
    const user = await User.findOneAndUpdate({ _id: this.iUserId }, updateQuery, { new: true });
    return user;
  }

  async emit(sEventName, oData) {
    if (!sEventName) return false;
    if (global.io.to(this.sRootSocket)) {
      const encryptedData = await _.encryptDataGhetiya(JSON.stringify({ sEventName, oData, oBoard: oData.oBoard }));
      // console.log('encryptedData in participant emit :: ', encryptedData);
      // global.io.to(this.sRootSocket).emit(this.oBoard._id, { sEventName, oData });
      global.io.to(this.sRootSocket).emit(this.oBoard._id, encryptedData);
    }
  }

  toJSON() {
    return _.pick(this, [
      //
      'iUserId',
      'nSeat',
      'aPawn',
      'eUserType',
      'sUserName',
      'nChips',
      'aPublicPosition',
      'aMovedPawn',
      'aAutoMovePawn',
      'sRootSocket',
      'nColor',
      'eState',
      'nRank',
      'bIsTie',
      'nTurnMissed',
      'nChips',
      'nWinningAmount',
      'nGameWon',
      'nGamePlayed',
      'nGameLost',
      'nKills',
      'nDeath',
      'aWinner',
      'bSound',
      'sReason',
    ]);
  }
}

module.exports = Service;
