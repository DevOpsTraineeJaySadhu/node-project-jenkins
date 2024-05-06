const mongoose = require('mongoose');

const BoardProtoType = mongoose.Schema(
  {
    nBoardFee: Number,
    sName: String,
    nMaxPlayer: {
      type: Number,
      enum: [2, 3, 4],
      default: 2,
    },
    nTurnTime: Number,
    aWinningAmount: [Number],
    eOpponent: {
      type: String,
      enum: ['bot', 'user', 'any'],
      default: 'any',
    },
    eBoardType: {
      type: String,
      enum: ['private', 'cash'],
      default: 'cash',
    },
    eGameType: {
      type: String,
      enum: ['classic', 'twoToken'],
      default: 'classic',
    },
    eStatus: {
      type: String,
      enum: ['y', 'd'],
      default: 'y',
    },
  },
  { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);

module.exports = mongoose.model('board-proto-type', BoardProtoType);
