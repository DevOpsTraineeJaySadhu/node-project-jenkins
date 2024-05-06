const mongoose = require('mongoose');

const KYC = new mongoose.Schema({
    eState: {
        type: String,
        enum: ['', 'approved', 'pending', 'rejected'],
        default: '',
    },
    sPanNumber: String,
    sPanCardLink: String,
    aDocuments: [String],
    sDocumentName: String,
    sRejectReason: {
        type: String,
        default: '',
    },
    dSubmittedDate: {
        type: Date,
        default: Date.now,
    },
});

module.exports = KYC;
