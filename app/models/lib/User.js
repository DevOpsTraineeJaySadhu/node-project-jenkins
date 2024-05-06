const mongoose = require('mongoose');
const KYC = require('./childSchema/KYC');
const Address = require('./childSchema/Address');

const User = mongoose.Schema(
  {
    aLudoBoard: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    sFullName: { type: String, default: '' },
    sUserName: { type: String, default: '' },
    sEmail: { type: String, default: '' },
    sMobile: { type: String, default: '' },
    sDeviceId: String,
    sPassword: { type: String },
    eUserType: {
      type: String,
      enum: ['user', 'admin', 'bot'],
      default: 'user',
    },
    eStatus: {
      type: String,
      enum: ['y', 'n', 'd'],
      default: 'y',
    },
    sToken: String,
    sVerifyToken: String,
    nChips: { type: Number, default: 10000 },
    isEmailVerified: { type: Boolean, default: true },
    isMobileVerified: { type: Boolean, default: true },
    bVibrationEnabled: { type: Boolean, default: true },
    bSoundEnabled: { type: Boolean, default: true },
    bMusicEnabled: { type: Boolean, default: true },
    eGender: {
      type: String,
      enum: ['male', 'female', 'unspecified'],
      default: 'unspecified',
    },
    oAddress: Address,
    dDob: Date,
    nWithdrawable: Number,
    oKYC: KYC,
    nGameWon: { type: Number, default: 0 },
    nGamePlayed: { type: Number, default: 0 },
    nGameLost: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);

module.exports = mongoose.model('users', User);
