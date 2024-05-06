const mongoose = require('mongoose');

const LudoGame = new mongoose.Schema(
  {
    iProtoId: String,
    iGameId: String,
    iWinnerId: String,
    nMaxPlayer: { type: Number, enum: [2, 3, 4] },
    aSafePosition: { type: Array, default: [] },
    eBoardType: {
      type: String,
      enum: ['private', 'cash'],
      default: 'cash',
    },
    aParticipant: [
      {
        _id: false,
        iUserId: String,
        // iUserId: mongoose.Schema.Types.ObjectId,
        nSeat: Number,
        aPawn: [Array],
        sUserName: String,
        nChips: Number,
        aPublicPosition: Array,
        aMovedPawn: Array,
        aAutoMovePawn: Array,
        sRootSocket: Array,
        eState: String,
        nTurnMissed: Number,
        nKills: Number,
        nDeath: Number,
        eUserType: String,
        nColor: Number,
        nRank: Number,
        nWinningAmount: Number,
        nScore: Number,
        bSound: Boolean,
        sReason: String,
      },
    ],
    aPlayer: [
      {
        _id: false,
        user_id: String,
        sUserName: String,
        image: String,
        sUserToken: String,
        sToken: Number,
      },
    ],
    eState: String,
    iUserTurn: String,
    nBoardFee: { type: Number, default: 0 },

    eGameType: {
      type: String,
      enum: ['classic', 'twoToken', 'threeToken', 'popular', 'quick'],
      default: 'classic',
    },

    iRoomId: {
      type: String,
      default: '',
    },
    isExit: {
      type: Boolean,
      default: true,
    },
    isValidLeave: {
      type: Boolean,
      default: true,
    },
    isEnvironment: {
      type: String,
      default: 'DEV',
    },
    bDiceRolled: {
      type: Boolean,
      default: true,
    },
    aLogs: {
      type: Array,
      default: [],
    },
    aAPIResponse: [
      {
        _id: false,
        nTimeApiCalled: { type: Number, default: 0 },
        sEndGameResponse: { type: String, default: '' },
      },
    ],
    bTurnSchedulerPresent: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);
//LudoGame.index({ dCreatedDate: 1 }, { expireAfterSeconds: 7200 }); // 259200 -> 2 Hours
LudoGame.index({ dCreatedDate: 1 }, { expireAfterSeconds: 10800 }); // 259200 -> 2 Hours

module.exports = mongoose.model('ludo_waiting_game', LudoGame);
