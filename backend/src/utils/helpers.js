const crypto = require('crypto');

function generateAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function addHours(date, hours) {
  return new Date(new Date(date).getTime() + hours * 60 * 60 * 1000);
}

module.exports = { generateAccessCode, hashPhone, formatCurrency, addHours };
