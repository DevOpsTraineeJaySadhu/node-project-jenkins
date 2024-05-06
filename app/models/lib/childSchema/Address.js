const mongoose = require('mongoose');

const Address = new mongoose.Schema({
    sAddressLine1: String,
    sAddressLine2: String,
    sLandMark: String,
    sState: String,
    eStatus: {
        type: String,
        enum: ['approved', 'pending', 'rejected'],
        default: 'pending',
    },
    sCity: String,
    nPinCode: Number,
});

module.exports = Address;
