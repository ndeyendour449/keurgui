const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

const agentSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  agentName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  nonAgence: { type: String, required: true },
  territoire: { type: String, required: true },
  langue: { type: String, required: true },
  photoProfil: { type: String, required: true },
  phoneNumber: { type: String, required: true }, // Nouveau champ pour le numéro de téléphone
    // Nouveau champ QR code
  qrcode: { type: String },
  // Champs supplémentaires
  presentation: { type: String, default: '' }, // Présentation de l'agent
  infosSupplementaires: { type: String, default: '' }, // Informations supplémentaires concernant l'agent
  adresse: { type: String, default: '' }, // Adresse de l'agent
  resetPasswordToken: { type: String }, // Champ pour stocker le token de réinitialisation
  resetPasswordExpires: { type: Date } , // Champ pour stocker la date d'expiration du token
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
});

agentSchema.pre('save', async function (next) {
  console.log('Hook PRE-SAVE déclenché pour :', this.email);

  if (this.isNew || this.isModified('email')) {
    try {
      console.log("Génération du QR code pour :", this.email);
      const qrCodeData = await QRCode.toDataURL(this.email);
      this.qrcode = qrCodeData;
      console.log("QR code généré avec succès !");
    } catch (error) {
      console.error("Erreur lors de la génération du QR code :", error);
    }
  } else {
    console.log("Aucune modification sur l'email, QR code non régénéré");
  }

  next();
});


// Fonction pour vérifier le mot de passe lors de la connexion
agentSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

const Agent = mongoose.model('Agent', agentSchema);
module.exports = Agent;
