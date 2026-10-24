const Transaction = require('../models/Transaction');

/**
 * Logs a new transaction to the database
 * @param {Object} data - Transaction data
 */
async function logTransaction({
    user,
    type,
    amount,
    platformFee = 0,
    payee = null,
    paymentId,
    orderId = 'N/A',
    sourceModel,
    sourceId,
    description = '',
    metadata = {}
}) {
    try {
        const transaction = new Transaction({
            user,
            type,
            amount,
            platformFee,
            netAmount: amount - platformFee,
            payee,
            paymentId,
            orderId,
            status: 'success',
            payoutStatus: payee ? 'pending' : 'not_applicable',
            sourceModel,
            sourceId,
            description,
            metadata
        });

        await transaction.save();
        return { success: true, transaction };
    } catch (error) {
        console.error('Error logging transaction:', error);
        return { success: false, error };
    }
}

module.exports = { logTransaction };
