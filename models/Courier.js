const mongoose = require('mongoose');
const courierSchema = new mongoose.Schema({
    name: { type: String, required: true },
    qbName: { type: String },
    radioCallNumber: { type: Number },
    radioFee: { type: Number },
    phone: { type: String },
    email: { type: String },
    depositPaid: { type: Boolean },
    status: { type: String },
    active: { type: Boolean },
    taxWithholding: { type: Number }
}, {
    timestamps: true
});

module.exports = mongoose.model('Courier', courierSchema);
