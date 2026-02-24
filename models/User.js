const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
},
{
  timestamps: true, // Cela ajoute automatiquement createdAt et updatedAt
}
);

const User = mongoose.model('User', userSchema);

module.exports = User;
