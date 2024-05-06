const mongoose = require('mongoose');

const ExistBoard = mongoose.Schema(
  {
    iGameId: { type: String },
    sDescription: { type: String },
    sCurrentBoardState: { type: String },
    eGameType: {
      type: String,
      enum: ['classic', 'twoToken', 'threeToken', 'popular', 'quick'],
      default: 'classic',
    },
  },
  { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);

module.exports = mongoose.model('exist_board', ExistBoard);
