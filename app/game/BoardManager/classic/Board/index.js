const Service = require('./lib/Service');
const { redis } = require('../../../../utils');
const axios = require('axios');
class Board extends Service {
  async setScheduler(sTask, iUserId = '', ttl = 0, oData = '') {
    const key = _.getSchedulerKey(sTask, this._id, iUserId);
    await redis.client.set(key, oData);
    return redis.client.pExpire(key, parseInt(ttl));
  }

  async refundOnLongWait() {
    try {
      if (this.eState === 'waiting') {
        this.emit('resKickOut', { message: messages.custom.no_player_found });
        console.log("message:::::::::::",{ message: messages.custom.no_player_found });
        
        // emitter.emit('flushBoard', { sTaskName: 'flushBoard', iBoardId: this._id, iUserId: this.iUserId ?? '' });
        // await redis.client.unlink(_.getProtoKey(this.iProtoId));
        // await redis.client.unlink(_.getBoardKey(this._id));
        // return true;
        let axiosOptions;
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
              // emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse }); // TODO: flushBoard
              emitter.emit('flushBoard', { sTaskName: 'flushBoard', iBoardId: this._id, aAPIResponse });
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
        if (this.isEnvironment === 'STAGING') {
          axiosOptions = {
            method: 'post',
            url: `${process.env.CLIENT_SERVER_STAG}/game-end`,
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_STAG },
            data: {
              game_id: this._id,
              status: 'canceled',
              winner: '',
              score: [0, 0],
              isValidLeave: this.isValidLeave,
              game_mode: this.eGameType,
            },
          };
        } else {
          axiosOptions = {
            method: 'post',
            url: `${process.env.CLIENT_SERVER_PROD}/game-end`,
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_PROD },
            data: {
              game_id: this._id,
              status: 'canceled',
              winner: '',
              score: [0, 0],
              // isValidLeave: this.oBoard.isValidLeave,
              isValidLeave: this.isValidLeave,
              game_mode: this.eGameType,
            },
          };
        }
        console.log("🚀 ~ file: index.js:54 ~ Board ~ refundOnLongWait ~ axiosOptions:", axiosOptions)
        log.green("data:::::::",{
          game_id: this._id,
          status: 'canceled',
          winner: '',
          score: [0, 0],
          // isValidLeave: this.oBoard.isValidLeave,
          isValidLeave: this.isValidLeave,
          game_mode: this.eGameType,
        })
        if (this.isEnvironment !== 'DEV') {
          const endGame = await retryAxiosCall(axiosOptions);
          if (endGame) {
            apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
            apiResponse.sEndGameResponse = `API response send Successfully in ${nTimeApiCalled} try and: ${endGame}`;
            aAPIResponse.push(apiResponse);
            apiResponse = {};
          }
        }
        // emitter.emit('save', { sTaskName: 'flushBoard', iBoardId: this._id, aAPIResponse });
        return emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse });
      }
      return false;
    } catch (error) {
      console.log(error);
      log.red(`Error in refundOnLongWait ${error.message} `);
      return false;
    }
  }

  async emit(sEventName, oData) {
    const board = await redis.client.json.GET(_.getBoardKey(this._id));
    if (!board) return false;
    const encryptedData = await _.encryptDataGhetiya(JSON.stringify({ sEventName, oData, oBoard: this }));

    Object.values(board?.oSocketId).forEach(sRootSocket => {
      if (sRootSocket) {
        // global.io.to(sRootSocket).emit(this._id, { sEventName, oData });
        global.io.to(sRootSocket).emit(this._id, encryptedData);
      }
    });
  }

  deleteParticipant(iUserId) {
    return redis.client.json.del(_.getBoardKey(this._id), `.aParticipant-${iUserId}`);
  }

  async endGameAPI(optionsEndGame) {
    const { endGame } = await axios(optionsEndGame);
    return endGame;
  }
  async finishGame(iWinnerId) {
    let aAPIResponse = [];
    let apiResponse = {};
    let nTimeApiCalled = 0;
    let sEndGameResponse = '';

    try {
      const retryAxiosCall = async (optionsEndGame, maxRetries = 3, delayMs = 15000) => {
        try {
          const response = await axios(optionsEndGame);
          return response.data;
        } catch (error) {
          apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
          apiResponse.sEndGameResponse = `API response ${error.message}`;
          aAPIResponse.push(apiResponse);
          apiResponse = {};
          console.log('🚀 ~ file: index.js:50 ~ Board ~ retryAxiosCall ~ aAPIResponse:', aAPIResponse);

          if (maxRetries <= 0) {
            emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse });
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
      let axiosOptions;

      log.cyan('axios call for this :::::::::::::::', this.isEnvironment);


      let highestScore = Math.max(...this.aParticipant.map(p => p.nScore));
      let tiedPlayers = this.aParticipant.filter(p => p.nScore === highestScore);

      if(tiedPlayers.length>1){
        await this.setSchedular('finishGameTimer', null, 60000);
        await this.emit('resTieGameTimer', {nRemainingTime:60000, message:messages.custom.game_tie});
        // await this.emit('resGameTimer', {nRemainingTime:60000});
        return false;
        // for (const winner of tiedPlayers) {
        //   winner.nWinningAmount = this.aWinningAmount[0] / tiedPlayers.length;
        //   winner.nRank = 1;
        //   winner.eState = 'winner';
        //   winner.sReason = 'Congratulations! It\'s a tie!';
        // }

        // for (const participant of this.aParticipant) {
        //   if (!tiedPlayers.some(winner => winner.iUserId === participant.iUserId)) {
        //     participant.nWinningAmount = 0;
        //     participant.nRank = 2;
        //     participant.eState = 'lost';
        //     participant.sReason = participant.sReason === '' ? 'Better Luck Next Time!' : participant.sReason;
        //   }
        // }
     
      }else{
      const winner = this.getParticipant(iWinnerId);
      winner.nWinningAmount = this.aWinningAmount[0];
      winner.nRank = 1;
      winner.eState = 'winner';
      winner.sReason = 'winning the game congratulation!';
      for (const participant of this.aParticipant) {
        if (iWinnerId !== participant.iUserId) {
          //* Change for Two winnerIssue
          participant.nWinningAmount = 0;
          participant.nRank = 2;
          participant.eState = 'lost';
          participant.sReason = participant.sReason === '' ? 'Batter Luck Next Time!' : participant.sReason;
        }
      }
    }
      this.iWinnerId = iWinnerId;
      this.eState = 'finished';
      await this.update({ aParticipant: this.aParticipant.map(p => p.toJSON()), eState: 'finished', iWinnerId: this.iWinnerId, nAmountOut: this.aWinningAmount[0] });

      let aPayload = [];
      let aPlayerScore = [];
      for (let i = 0; i < this.aParticipant.length; i++) {
        const _user = this.aParticipant[i];
        let data = {
          user_id: _user.iUserId,
          score: {
            kills: _user.nKills,
            deaths: _user.nDeath,
            rank: _user.nRank,
          },
          playerScore:{
            user_id: _user.iUserId,
            nScore: _user.nScore,
          }
        };

        // this.aParticipant[i].aScore.nKills = _user.nKills;
        // this.aParticipant[i].aScore.nDeath = _user.nDeath;
        this.aParticipant[i].aScore.nRank = _user.nRank;
        this.aParticipant[i].aScore.eState = _user.eState;
        aPayload.push(data.score.rank);
        aPlayerScore.push(data.playerScore);
      }
      let isExit = [];
      for (const p of this.aParticipant) {
        // log.green('Participant aMovedPawn :: ', p.aMovedPawn);
        isExit.push(p.aMovedPawn);
      }
      const bValidLeave = isExit.flat().length ? false : true;
      if (this.isEnvironment === 'STAGING') {
        axiosOptions = {
          method: 'post',
          url: `${process.env.CLIENT_SERVER_STAG}/game-end`,
          headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_STAG },
          data: {
            game_id: this._id,
            status: this.eState,
            winner: this.iWinnerId ? this.iWinnerId : this.aParticipant.filter(e => e.nRank === 1)[0].iUserId,
            score: aPayload,
            aPlayerScore:aPlayerScore,
            isValidLeave: bValidLeave,
            // sWinningImage: `${this._id}.png`,
            sWinningImage: `${process.env.BUCKET_URL}${process.env.BUCKET_FOLDER_NAME}/${this._id}.png`,
            game_mode: this.eGameType,
          },
        };
      } else {
        axiosOptions = {
          method: 'post',
          url: `${process.env.CLIENT_SERVER_PROD}/game-end`,
          headers: { 'Content-Type': 'application/json', 'api-key': process.env.AUTH_PROD },
          data: {
            game_id: this._id,
            status: this.eState,
            // winner: this.aParticipant.filter(e => e.nRank === 1)[0].iUserId,
            winner: this.iWinnerId ? this.iWinnerId : this.aParticipant.filter(e => e.nRank === 1)[0].iUserId,
            score: aPayload,
            aPlayerScore:aPlayerScore,
            isValidLeave: bValidLeave,
            // sWinningImage: `${this._id}.png`,
            sWinningImage: `${process.env.BUCKET_URL}${process.env.BUCKET_FOLDER_NAME}/${this._id}.png`,
            game_mode: this.eGameType,
          },
        };
      }

      await _.removeFieldFromArray(this.aPlayer, 'sUserToken'),
        this.emit('resResult', {
          aParticipant: this.aParticipant.sort((a, b) => b.nScore - a.nScore),
          isValidLeave: this.isValidLeave,
          aPlayer: this.aPlayer,
        });

      log.green('optionsEndGame :: ', axiosOptions);

      if (this.isEnvironment !== 'DEV') {
        const endGame = await retryAxiosCall(axiosOptions);
        if (endGame) {
          apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
          apiResponse.sEndGameResponse = `API response send Successfully in ${nTimeApiCalled} try and: ${endGame}`;
          aAPIResponse.push(apiResponse);
          apiResponse = {};
        }

        log.green('api response ARRAY', aAPIResponse);
      }
      // this.aLogs.push(`🚀 ~ file: index.js:169 ~  Board ~ finishGame ~ saveBoardHistory:', 'iBoardId:', ${this._id}`);
      // await this.update({ aLogs: this.aLogs });
      emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse });
    } catch (error) {
      // this.aLogs.push('🚀 ~ file: index.js:171 ~ Board ~ finishGame ~ error:', error.toString());
      // await this.update({ aLogs: this.aLogs });
      log.red('Error in finishGame :: ', error.toString());
    }
  }

  //* for stuck Game
  async saveCanceledGameData(iBoardId) {
    log.cyan('saveCanceledGameData after 8  .............................');
    let aAPIResponse = [];
    let apiResponse = {};
    let nTimeApiCalled = 0;
    let sEndGameResponse = '';

    try {
      const retryAxiosCall = async (optionsEndGame, maxRetries = 3, delayMs = 15000) => {
        try {
          const response = await axios(optionsEndGame);
          return response.data;
        } catch (error) {
          apiResponse.nTimeApiCalled = nTimeApiCalled += 1;
          apiResponse.sEndGameResponse = `API response ${error.message}`;
          aAPIResponse.push(apiResponse);
          apiResponse = {};
          log.green('🚀  stuck game APIs response  ::', aAPIResponse);

          if (maxRetries <= 0) {
            emitter.emit('saveBoardHistory', { iBoardId: this._id, aAPIResponse });
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
      let axiosOptions;

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
      const sKey1 = _.getSchedulerKeyWithOutHost('assignTurnTimeout', this._id, oTableData.aParticipant[0]?.iUserId);
      const sKey2 = _.getSchedulerKeyWithOutHost('assignTurnTimeout', this._id, oTableData.aParticipant[1]?.iUserId);
      const schedularKeys1 = await redis.client.keys(sKey1);
      const schedularKeys2 = await redis.client.keys(sKey2);

      let bTurnSchedulerPresent;

      if (schedularKeys1.length || schedularKeys2.length) bTurnSchedulerPresent = true;

      // add or not
      await _.removeFieldFromArray(this.aPlayer, 'sUserToken'),
        this.emit('resResult', {
          aParticipant: this.aParticipant,
          isValidLeave: this.isValidLeave,
          aPlayer: this.aPlayer,
          'access key id': process.env.AWS_ACCESS_ID,
          'secret access key': process.env.AWS_SECRET_KEY,
        });

      // this.aLogs.push(`🚀 ~ file: index.js:245 ~ Board ~ saveCanceledGameData ~ saveStuckGameHistory: iBoardID ${this._id} `);
      // await this.update({ aLogs: this.aLogs });
      emitter.emit('saveStuckGameHistory', { iBoardId: this._id, aAPIResponse, bTurnSchedulerPresent });
    } catch (error) {
      // this.aLogs.push('🚀 ~ file: index.js:246 ~ Board ~ saveCanceledGameData ~ error:', error.toString());
      // await this.update({ aLogs: this.aLogs });
      console.log('error in cath block :: ', error);
      log.green('api response ARRAY in ERROR', aAPIResponse);

      log.red('Error in finishGame :: ', error.toString());
    }
  }
}

module.exports = Board;
