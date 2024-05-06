// const mongoose = require('mongoose');

// const Transaction = new mongoose.Schema(
//     {
//         iUserId: mongoose.Schema.Types.ObjectId,
//         iDoneBy: mongoose.Schema.Types.ObjectId,
//         nAmount: Number,
//         sRejectReason: String,
//         sDescription: String,
//         nClosingBalance: Number,
//         iBoardId: mongoose.Schema.Types.ObjectId,
//         // oPromoCode: {},
//         oOrderResponse: {},
//         oPaymentResponse: {},
//         oPayoutOrderResponse: {},
//         oPayoutPaymentResponse: {},
//         eCategory: {
//             type: String,
//             enum: ['bank', 'admin'],
//             default: 'bank',
//         },
//         eType: {
//             type: String,
//             enum: ['debit', 'credit'],
//             default: 'credit',
//         },
//         eMode: {
//             type: String,
//             enum: ['admin', 'razorpay', 'user', 'game'],
//             default: 'game',
//         },
//         eStatus: {
//             type: String,
//             enum: ['failed', 'success', 'pending', 'rejected'],
//             default: 'pending',
//         },
//     },
//     { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
// );

// module.exports = mongoose.model('transaction', Transaction);

const mongoose = require('mongoose');

const Transaction = new mongoose.Schema(
    {
        iUserId: mongoose.Schema.Types.ObjectId,
        iDoneBy: mongoose.Schema.Types.ObjectId,
        nAmount: { type: Number, default: 0 },
        sDescription: String,
        eCategory: {
            type: String,
            enum: ['bank', 'game', 'admin'],
            default: 'bank',
        },
        eStatus: {
            type: String,
            enum: ['failed', 'success', 'pending', 'rejected'],
            default: 'pending',
        },
        eType: {
            type: String,
            enum: ['debit', 'credit'],
            default: 'credit',
        },
        eMode: {
            type: String,
            enum: ['admin', 'razorpay', 'user', 'game'],
            default: 'game',
        },
    },
    { timestamps: { createdAt: 'dCreatedDate', updatedAt: 'dUpdatedDate' } }
);

module.exports = mongoose.model('transaction', Transaction);
