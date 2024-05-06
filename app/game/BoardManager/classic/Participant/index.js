/* eslint-disable prefer-destructuring */
/* eslint-disable no-continue */
const { redis, redlock } = require('../../../../utils');
const Service = require('./lib/Service');
const { ExistBoard } = require('../../../../models');

class Participant extends Service {
  async movePawn(oData, callback = () => {}) {
    // this.oBoard.aLogs.push(`move Pawn called for user: ${this.iUserId} and nDice from this: ${this.oBoard.nDice}: pag Index: ${oData?.nIndex}`);
    // const _lock = await redlock.lock.acquire([`lock:${_.getProtoKey(req.oProtoData._id)}`], 1000);

    if (!oData.sHashToken && !oData.bTurnMissed) {
      log.red('Token is missing for user: ', this.iUserId);
      return callback(null);
    }
    if (!oData.bTurnMissed) {
      let tokenValue = await redis.client.zScore(oData.sHashToken, _.toString(this.oBoard._id));
      if (!tokenValue || tokenValue > 2) {
        log.red('Token is not valid or expired for user: ', this.iUserId);
        return callback(null);
      }
      await redis.client.del(oData.sHashToken); // remove token from redis.
    }
    if (!this.oBoard.bDiceRolled) return callback(null); //! DON'T TOUCH THIS LINE
    await this.oBoard.update({ bDiceRolled: false });
    await this.oBoard.deleteScheduler('assignTurnTimeout', this.iUserId);
    // if (this.oBoard.nDice === 6) {
    //   this.oBoard.nRepeatSix = this.oBoard.nRepeatSix + 1;
    // }
    // await this.oBoard.update({ nRepeatSix: this.oBoard.nRepeatSix });

    let currentPosition = this.aPawn[oData?.nIndex] || 0;
    const nCurrentPosition = positions[this.oBoard.nMaxPlayer][this.nSeat][this.aPawn[oData?.nIndex]] || 0;
    const { nIndex } = oData;

    let nMove;
    if (currentPosition === 0 && this.oBoard.nDice === 6) {
      nMove = 1;
      this.aAutoMovePawn.push(nIndex);
      if (!this.aMovedPawn.includes(nIndex)) this.aMovedPawn.push(nIndex);
      this.oBoard.isExit = false;
      this.oBoard.isValidLeave = false;
    } else {
      this.oBoard.nDice = this.oBoard.nDice >= 6 ? 6 : this.oBoard.nDice;
      nMove = this.oBoard.nDice;
    }
    currentPosition += nMove;
    if (currentPosition >= 57) currentPosition = 57;
    const nDestination = currentPosition;
    this.aPublicPosition[nIndex] = positions[this.oBoard.nMaxPlayer][this.nSeat][nDestination];
    let _oData = this.checkPawnKilled(this.aPublicPosition[nIndex]);

    if (currentPosition >= 57) this.aAutoMovePawn.splice(this.aAutoMovePawn.indexOf(nIndex), 1);
    this.aPawn[nIndex] = currentPosition;

    const aParticipant = [this.toJSON()];
    if (_oData?.oParticipant) aParticipant.push(_oData.oParticipant.toJSON());
    await this.oBoard.update({
      aParticipant,
      // isExit: this.oBoard.isExit,
      isValidLeave: this.oBoard.isValidLeave,
      // aLogs: this.oBoard.aLogs,
    });

    let isExit = [];
    for (const p of this.oBoard.aParticipant) {
      isExit.push(p.aMovedPawn);
    }
    if (isExit.flat().length === 8) {
      await this.oBoard.update({ isExit: true });
    }
    log.yellow('resMovePawn emit will be sent to user :: ', this.oBoard.nDice, nMove);

    this.oBoard.emit('resMovePawn', { iUserId: this.iUserId, nIndex, nMove, nDestination, isExit: this.oBoard.isExit });

    await _.delay(175 * nMove);
    // await _.delay(250 * nMove); // D

    if (_oData && _oData?.iUserId) {
      this.oBoard.emit('resSendToHome', {
        iUserId: _oData.iUserId,
        nIndex: _oData.nIndex,
      });
      await _.delay(17.5 * _oData.nMoved);
      // await _.delay(25 * _oData.nMoved); // D

      this.nKills = this.nKills + 1; // Add kils
      await this.oBoard.update({
        aParticipant: [this.toJSON()],
      });
    }
    let winnerFlag = await this.isWinner();
    if (winnerFlag) {
      this.nRank = 1;
      this.eState = 'winner';
      this.oBoard.emit('resWinner', { iUserId: this.iUserId, nRank: this.nRank });
      await this.oBoard.update({
        aParticipant: [this.toJSON()],
        // aLogs: this.oBoard.aLogs,
      });
      callback();
      return emitter.emit('finishGame', { iBoardId: this.oBoard._id, iUserId: this.iUserId });
    }

    /**
     * check for my own peg kill for dynamic safe zone break.
     * check my other peg is available on same position
     */
    let aSiblingPresent = [];
    for (let index = 0; index < this.aPawn.length; index++) {
      if (positions[this.oBoard.nMaxPlayer][this.nSeat][this.aPawn[index]] === nCurrentPosition && nCurrentPosition !== 0)
        aSiblingPresent.push({ nPublicPosition: this.aPawn[index], nPegIndex: index });
    }
    if (aSiblingPresent.length === 1) {
      let myPegKill = await this.checkMyPawnKilled(nCurrentPosition, aSiblingPresent[0].nPegIndex);
      if (myPegKill?.oParticipant) {
        aParticipant.push(this.toJSON());
        aParticipant.push(myPegKill.oParticipant.toJSON());
        await this.oBoard.update({
          aParticipant,
        });
        this.oBoard.emit('resSendToHome', {
          iUserId: this.iUserId,
          nIndex: aSiblingPresent[0].nPegIndex,
        });
        await _.delay(17.5 * _oData.nMoved);
        await this.oBoard.update({
          aParticipant: [this.toJSON()],
        });
      }
    }
    /**
     * END
     */

    if (this.aPawn[nIndex] >= 57 || _oData?.iUserId) {
      this.takeTurn();
    } else {
      this.passTurn();
    }
    // await _lock.release();
    return callback(null);
  }

  checkPawnKilled(nPublicPosition) {
    log.green('checkPawnKilled called... ', this.iUserId);
    // this.oBoard.aLogs.push('checkPawnKilled called...');
    if (this.oBoard.aSafePosition.includes(nPublicPosition)) return false;

    let nIndex;
    let iUserId;
    let nMoved;
    let oParticipant;

    for (const participant of this.oBoard.aParticipant) {
      if (participant.iUserId === this.iUserId || participant.eState !== 'playing') continue;

      const result = [];
      for (let i = 0; i < participant.aPublicPosition.length; i += 1) {
        if (participant.aPublicPosition[i] === nPublicPosition) result.push(i);
      }
      const myPegs = this.aPublicPosition.filter(position => position === nPublicPosition).length;

      if (result.length === 1 && myPegs === 1) {
        nIndex = result[0];
        oParticipant = participant;
        iUserId = participant.iUserId;
        participant.aPublicPosition[nIndex] = 0;
        nMoved = participant.aPawn[nIndex];
        participant.aPawn[nIndex] = 0;
        participant.aAutoMovePawn.splice(participant.aAutoMovePawn.indexOf(nIndex), 1);
        participant.nDeath = participant.nDeath + 1;
        break;
      }
    }

    return {
      nIndex,
      oParticipant,
      iUserId,
      nMoved,
    };
  }

  async checkMyPawnKilled(nPublicPosition, killedPegIndex) {
    log.cyan('will check for checkMyPawnKilled...');
    // this.oBoard.aLogs.push(`will check for checkMyPawnKilled...::, nPublicPosition: ${nPublicPosition},killedPegIndex: ${killedPegIndex} `);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });
    if (this.oBoard.aSafePosition.includes(nPublicPosition)) return false;
    let nIndex;
    let iUserId;
    let nMoved;
    let oParticipant;

    for (const participant of this.oBoard.aParticipant) {
      if (participant.iUserId === this.iUserId || participant.eState !== 'playing') continue;
      // nIndex = participant.aPublicPosition.findIndex(pos => nPublicPosition === pos);
      const opponentPeg = [];
      for (let i = 0; i < participant.aPublicPosition.length; i += 1) {
        if (participant.aPublicPosition[i] === nPublicPosition) opponentPeg.push(i);
      }
      if (opponentPeg.length === 1) {
        // nIndex = opponentPeg[0];
        // iUserId = participant.iUserId;
        this.aPawn[killedPegIndex] = 0;
        // participant.aPublicPosition[nIndex] = 0;
        // nMoved = participant.aPawn[nIndex];
        // participant.aPawn[nIndex] = 0;
        this.aAutoMovePawn.splice(killedPegIndex, 1);
        participant.nKills = participant.nKills + 1;
        oParticipant = participant;
        this.nDeath = this.nDeath + 1;
        break;
      }
    }

    return {
      // nIndex,
      oParticipant,
      iUserId,
      nMoved,
    };
  }

  async turnMissed() {
    if (this.oBoard.eState !== 'playing' || this.eState !== 'playing') return false;

    this.nTurnMissed += 1;

    const { nMaxTurnMissAllowed } = this.oBoard.oSetting;

    await this.oBoard.update({ aParticipant: this.oBoard.aParticipant.map(p => p.toJSON()) });
    log.green('resTurnMissed send for user :: ', this.iUserId);
    // this.oBoard.aLogs.push(`resTurnMissed send for user :: , ${this.iUserId}`);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });

    this.oBoard.emit('resTurnMissed', { nTurnMissed: this.nTurnMissed, iUserId: this.iUserId, nMaxTurnMissAllowed });

    if (nMaxTurnMissAllowed === this.nTurnMissed) return this.leave(`Left the board due to missed turn ${nMaxTurnMissAllowed} times.`, 'ame');
    if (!this.oBoard.bDiceRolled) return this.oBoard.rollDice({ bTurnMissed: true });
    emitter.emit('autoTurn', { iBoardId: this.oBoard._id, iUserId: this.iUserId });
  }

  async autoTurn(token) {
    const aMovablePawns = this.getMovablePawns(this.oBoard.nDice);
    if (!aMovablePawns.length) {
      await this.oBoard.deleteScheduler('assignTurnTimeout', this.iUserId); // TODO new change for auto turn bug.
      return this.passTurn();
    }
    const nIndex = this.aAutoMovePawn.find(p => aMovablePawns.includes(p)) || aMovablePawns[0];
    return this.movePawn({ nIndex, sHashToken: token, bTurnMissed: true }, () => {});
  }

  async passTurn(bForcePassTurn = false) {
    const participant = this.oBoard.getNextParticipant(this.nSeat, bForcePassTurn);
    if (!participant) {
      // TODO: get Playing Participant. if opponent left than declare current participant winner
      let oLeftParticipant = await this.oBoard.aParticipant.filter(p => p.eState === 'left' && p.iUserId !== this.iUserId);
      if (oLeftParticipant) {
        return emitter.emit('finishGame', { iBoardId: this.oBoard._id, iUserId: this.iUserId });
      }
      return log.red('No next participant found');
    }
    if (this.iUserId !== participant.iUserId) await this.oBoard.update({ nRepeatSix: 0 });

    const keys = await redis.client.keys(`${this.oBoard._id}:dummy:*`);
    if (keys.length > 0) {
      await redis.client.del(keys);
    }

    log.green('## passTurn called turn goes to :: ', participant.iUserId);
    // await _.delay(500);
    // await this.oBoard.aLogs.push(`## passTurn called turn goes to :: , ${participant.iUserId}`);
    // await this.oBoard.update({ aLogs: this.oBoard.aLogs });

    emitter.emit('takeTurn', { iBoardId: this.oBoard._id, iUserId: participant.iUserId });
  }

  async isWinner() {
    return this.aPawn.every(nLocalPosition => nLocalPosition === 57);
  }

  // getMovablePawns(nDice) {
  //   const aMovablePawns = [];
  //   for (let i = 0; i < this.aPawn.length; i += 1) {
  //     const isMovable = (nDice === 6 && this.aPawn[i] === 0) || (positions[this.oBoard.nMaxPlayer][this.nSeat][this.aPawn[i] + nDice] && this.aPawn[i] !== 0);
  //     if (isMovable) aMovablePawns.push(i);
  //   }
  //   // this.oBoard.aLogs.push('## getMovablePawns :: ', this.iUserId, ');

  //   return aMovablePawns;
  // }
  getMovablePawns(nDice) {
    const aMovablePawns = [];

    for (let i = 0; i < this.aPawn.length; i += 1) {
      const isMovable = (nDice === 6 && this.aPawn[i] === 0) || (positions[this.oBoard.nMaxPlayer][this.nSeat][this.aPawn[i] + nDice] && this.aPawn[i] !== 0);
      if (isMovable) aMovablePawns.push(i);
    }

    return aMovablePawns;
  }

  autoMovePawn() {
    const availablePawns = this.getMovablePawns(this.oBoard.nDice);
    if (!availablePawns.length) return this.passTurn();

    const nIndex = _.randomFromArray(availablePawns);
    this.movePawn({ nIndex }, () => {});
  }
}

module.exports = Participant;
