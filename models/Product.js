const mongoose = require('mongoose');

// Définition du schéma pour les produits
const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    transactionType: { type: String, enum: ['sale', 'rent', 'buy'], required: true },
    productType: { 
      type: String, 
      enum: ['appartement', 'bureau_commerce', 'hotel_restaurant', 'immeuble', 'residence', 'studio_chambre', 'villa_maison', 'terrain'], 
      required: true 
    },
    
    propertyCategory: {
      type: String,
      enum: ['residential', 'commercial'],
      required: true,
    },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    status: {
      type: String,
      enum: ['available', 'sold', 'rented'], // Statut du produit
      default: 'available', // Par défaut, le produit est disponible
    },
    address: { type: String, required: true },
    city: { type: String, required: true },
    features: {
      bedrooms: { type: Number, default: 0 },
      bathrooms: { type: Number, default: 0 }, 
      parkingSpaces: { type: Number, default: 0 },
      garages: { type: Number, default: 0 },
      area: { type: Number },
      hasPool: { type: Boolean, default: false },
      isWheelchairAccessible: { type: Boolean, default: false },
      isWaterfront: { type: Boolean, default: false },
      hasNavigableWater: { type: Boolean, default: false },
      allowsPets: { type: Boolean, default: false },
      allowsSmoking: { type: Boolean, default: false },
    },
    images: { 
      type: [String],
      required: true 
    },
    buildingDetails: {
      yearBuilt: { type: Number },
      isNewConstruction: { type: Boolean, default: false },
      isHistorical: { type: Boolean, default: false },
      structureType: { 
        type: [String], 
        enum: ['Bord de l\'eau', 'Accès à l\'eau', 'Plan d\'eau navigable', 'Villégiature'],
      },
    },
    isVirtualTourAvailable: { type: Boolean, default: false },
    isOpenHouse: { type: Boolean, default: false },
    lotSize: { type: Number },
    description: { type: String },
    agentName: { type: String, required: true },
    moveInDate: { type: Date },
    isForeclosure: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);
productSchema.index({ coordinates: "2dsphere" });


// Ajout d'un index pour les recherches fréquentes
productSchema.index({ city: 1, price: 1, transactionType: 1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
