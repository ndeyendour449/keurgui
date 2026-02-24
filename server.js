const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');  // Importer le modèle User
const Agent = require('./models/Agent');

const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');  // Pour hacher les mots de passe
const Joi = require('joi');  // Pour valider les données
const cors = require('cors');
const path = require('path');
const app = express();
// Middleware
app.use(express.json());  // Permet de traiter les requêtes avec un corps JSON
app.use(cors());  // Permet de gérer les problèmes de CORS (Cross-Origin Resource Sharing)
app.use('/assets', express.static('assets'));

// Connexion à la base de données MongoDB
const mongoURI = process.env.MONGODB_URL || "mongodb://localhost:27017/keurgui"; // Fallback en local

mongoose
  .connect(mongoURI, {
    
  })
  .then(() => console.log("✅ Connexion réussie à MongoDB"))
  .catch((err) => {
    console.error("❌ Erreur de connexion MongoDB :", err.message);
    process.exit(1); // Arrête l'application si la connexion échoue
  });
  const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    transactionType: { type: String, enum: ['sale', 'rent', 'buy'], required: true },
    productType: { 
      type: String, 
      enum: ['appartement', 'bureau_commerce', 'hotel_restaurant', 'immeuble', 'residence', 'studio_chambre', 'villa_maison', 'terrain'], 
      required: true 
    },
    propertyCategory: { type: String, enum: ['residential', 'commercial'], required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    status: { type: String, enum: ['available', 'sold', 'rented'], default: 'available' },
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
    images: { type: [String], required: true },
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
  }, { timestamps: true });
  
  // 📌 Ajout d'indexation pour améliorer la recherche
  productSchema.index({ coordinates: "2dsphere" });
  productSchema.index({ city: 1, price: 1, transactionType: 1 });
  
  // 📌 Création du modèle `Product` directement dans `server.js`
  const Product = mongoose.model('Product', productSchema);
  
// Validation des données de l'utilisateur
const validateUser = (user) => {
  const schema = Joi.object({
    firstname: Joi.string().min(2).max(30).required(),
    lastname: Joi.string().min(2).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmpassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Password confirmation does not match password',
    }),
  });
  return schema.validate(user);
};

// Middleware pour parser les requêtes JSON
app.use(bodyParser.json());
app.use(cors());
// Middleware pour vérifier si l'utilisateur est admin
app.post('/agents', async (req, res) => {
  try {
    const { email, password, agentName, nonAgence, territoire, langue, photoProfil, phoneNumber } = req.body;

    // Vérification que tous les champs sont fournis
    if (!email || !password || !agentName || !nonAgence || !territoire || !langue || !photoProfil || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    // Création d'un nouvel agent
    const newAgent = new Agent({
      email,
      password,
      agentName,
      nonAgence,
      territoire,
      langue,
      photoProfil,
      phoneNumber, // Nouveau champ ajouté
    });

    // Sauvegarde de l'agent dans la base de données
    await newAgent.save();

    // Réponse après succès
    res.status(201).json({ message: 'Agent créé avec succès', agent: newAgent });
  } catch (err) {
    console.error('Erreur lors de la création de l\'agent:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});
app.delete('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérification de l'existence de l'agent
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Suppression de l'agent
    await Agent.findByIdAndDelete(id);
    res.status(200).json({ message: 'Agent supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'agent:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});
app.put('/agents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Vérifier si l'agent existe
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Mise à jour des données de l'agent
    const updatedAgent = await Agent.findByIdAndUpdate(id, updates, {
      new: true, // Retourne les données mises à jour
      runValidators: true, // Valide les données mises à jour
    });

    res.status(200).json({ message: 'Agent mis à jour avec succès', agent: updatedAgent });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'agent :', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});
app.get('/agents', async (req, res) => {
  try {
    // Récupère tous les agents dans la base de données
    const agents = await Agent.find(); // Assurez-vous que "Agent" est bien défini comme modèle Mongoose

    // Vérifiez si des agents existent
    if (!agents || agents.length === 0) {
      return res.status(404).json({ message: 'Aucun agent trouvé.' });
    }

    // Retourne la liste des agents
    res.status(200).json(agents);
  } catch (err) {
    console.error('Erreur lors de la récupération des agents:', err);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});
app.get('/agents/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }
    res.status(200).json(agent);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'agent :', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

app.post('/admin', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Créer une nouvelle instance du modèle Admin
    const newAdmin = new Admin({ email, password, fullName });

    // Sauvegarder l'administrateur dans la base de données
    await newAdmin.save();

    res.status(201).json({ message: 'Admin created successfully!', admin: newAdmin });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create admin', details: err.message });
  }
});
app.post('/login', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    let user;
    if (role === 'user') {
      user = await User.findOne({ email });
    } else if (role === 'agent') {
      user = await Agent.findOne({ email });
    } else if (role === 'admin') {
      user = await Admin.findOne({ email });
    }

    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, 'secret_key', { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// app.post('/login', async (req, res) => {
//   const { email, password } = req.body;

//   try {
//       const user = await User.findOne({ email });
//       if (!user) return res.status(404).json({ message: 'User not found' });

//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

//       const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
//           expiresIn: '1d',
//       });

//       res.json({ token, role: user.role });
//   } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: 'Server error' });
//   }
// });

const validateRegister = (data) => {
  const schema = Joi.object({
    firstname: Joi.string().min(3).required(),
    lastname: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('user', 'admin').optional(),
  });

  return schema.validate(data);
};
// Route pour s'inscrire
app.post('/api/register', async (req, res) => {
  const { email, password, firstname, lastname } = req.body;

  try {
    // Vérifier si un utilisateur avec cet email existe déjà
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hacher le mot de passe avant de l'enregistrer
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer un nouvel utilisateur avec firstname et lastname
    const newUser = new User({
      email,
      password: hashedPassword,
      firstname,
      lastname,
    });

    // Enregistrer l'utilisateur dans la base de données
    await newUser.save();

    // Retourner une réponse de succès avec les informations de l'utilisateur
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        firstname: newUser.firstname,
        lastname: newUser.lastname,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'An error occurred' });
  }
});

app.get('/api/search-predictive', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Requête trop courte ou vide.' });
    }

    const results = await Product.find({
      $or: [
        { city: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } },
      ],
    })
      .limit(10) // Limiter le nombre de résultats
      .select('city address');

    // Préparation des suggestions
    const suggestions = Array.from(
      new Set(
        results.map((item) => item.city).concat(results.map((item) => item.address))
      )
    );

    res.json(suggestions);
  } catch (error) {
    console.error('Erreur dans la recherche prédictive : ', error);
    res.status(500).json({ error: 'Erreur du serveur.' });
  }
});
app.get('/search', async (req, res) => {
  try {
    const { query, transactionType, price } = req.query;

    console.log('Requête reçue:', req.query); // Log des paramètres reçus

    // Construire l'objet de recherche dynamiquement
    const searchCriteria = {};

    if (query) {
      // Recherche par ville, quartier, région ou adresse
      searchCriteria.$or = [
        { city: new RegExp(query, 'i') },
        { address: new RegExp(query, 'i') },
      ];
    }

    if (transactionType) {
      searchCriteria.transactionType = transactionType;
    }

    if (price) {
      searchCriteria.price = { $lte: Number(price) };
    }

    // Exécuter la requête
    const results = await Product.find(searchCriteria).limit(10);

    console.log('Résultats trouvés:', results); // Log des résultats trouvés
    res.status(200).json(results);
  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    res.status(500).json({ error: 'Erreur lors de la recherche.' });
  }
});


// Endpoint pour la connexion des utilisateurs
// Endpoint pour la connexion des utilisateurs, agents et admins
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Rechercher l'utilisateur, l'agent ou l'admin par email
    let user = await User.findOne({ email }) || await Agent.findOne({ email }) || await Admin.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Comparer les mots de passe (hashé et en clair)
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Si tout est bon, renvoyer les informations de l'utilisateur et son rôle
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        role: user.role || (user.agentName ? 'agent' : 'admin'), // Détecter le rôle (agent ou admin)
        fullName: user.fullName || user.firstname + ' ' + user.lastname,  // Nom complet si disponible
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'An error occurred' });
  }
});

app.get('/api/products/count', async (req, res) => {
  try {
    const total = await Product.countDocuments(); // Compte tous les documents
    res.json({ total });
  } catch (error) {
    console.error('Erreur lors de la récupération du total des produits:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du total des produits' });
  }
});
app.get("/api/sorts", async (req, res) => {
  const { sort } = req.query;
  let sortCriteria = {};

  switch (sort) {
    case "recent":
      sortCriteria = { createdAt: -1 }; // Tri par date de création décroissante
      break;
    case "price_asc":
      sortCriteria = { price: 1 }; // Tri par prix croissant
      break;
    case "price_desc":
      sortCriteria = { price: -1 }; // Tri par prix décroissant
      break;
    default:
      break;
  }

  try {
    const products = await Product.find().sort(sortCriteria); // Tri basé sur `sortCriteria`
    res.json(products); // Retourne les produits triés
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});



app.get('/api/product', async (req, res) => {
  const { search } = req.query;
  try {
    const results = await Product.find({
      $or: [
        { city: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ],
    }).limit(50); // Limite le nombre de résultats pour éviter les réponses trop volumineuses.

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get('/api/prix', async (req, res) => {
  try {
    const { minPrice, maxPrice, transactionType } = req.query;

    // Construire le filtre
    const filter = {};

    if (transactionType) {
      filter.transactionType = transactionType;
    }

    if (minPrice) {
      filter.price = { ...filter.price, $gte: Number(minPrice) };
    }

    if (maxPrice) {
      filter.price = { ...filter.price, $lte: Number(maxPrice) };
    }

    // Rechercher les produits
    const products = await Product.find(filter);

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits', error });
  }
});
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send('Produit non trouvé');
    }
    res.json(product);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
app.get('/api/products/:id/images', async (req, res) => {
  try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: 'Product not found' });

      // Assuming product.images is an array of image URLs or paths
      res.json(product.images);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});
// Routes pour les produits
app.get('/api/products', async (req, res) => {
  try {
    const { search } = req.query; // Récupération du paramètre `search` de la requête

    let query = {};
    if (search) {
      // Si une recherche est spécifiée, chercher dans plusieurs champs avec une correspondance partielle
      query = {
        $or: [
          { city: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const products = await Product.find(query).limit(50); // Limite à 50 résultats pour éviter une surcharge
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post('/api/products', async (req, res) => {
  try {
    const { 
      title, 
      price, 
      transactionType, 
      productType, 
      propertyCategory, // Nouveau champ
      status,           // Nouveau champ
      address, 
      city, 
      
      features, 
      images, // Une seule image
      buildingDetails, 
      isVirtualTourAvailable, 
      isOpenHouse, 
      lotSize, 
      description, 
      agentName, 
      moveInDate, 
      isForeclosure, 
      coordinates // Ajout des coordonnées
    } = req.body;

    // Validation des champs requis
    if (!title || !price || !transactionType || !productType || !address || !city || !agentName || !images) {
      return res.status(400).json({
        message: 'Certains champs requis sont manquants.',
      });
    }

    // Validation des coordonnées
    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        message: 'Les coordonnées sont requises (latitude et longitude).',
      });
    }
    // Création d'une nouvelle propriété
    const newProduct = new Product({
      title,
      price,
      transactionType,
      productType,
      propertyCategory, // Ajout du champ
      status: status || 'available', // Défaut à "available" si non spécifié
     
      address,
      city,
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
      features: {
        bedrooms: features?.bedrooms || 0,
        bathrooms: features?.bathrooms || 0,
        parkingSpaces: features?.parkingSpaces || 0,
        garages: features?.garages || 0,
        area: features?.area || null,
        lotSize: features?.lotSize || null,
        hasPool: features?.hasPool || false,
        isWheelchairAccessible: features?.isWheelchairAccessible || false,
        isWaterfront: features?.isWaterfront || false,
        hasNavigableWater: features?.hasNavigableWater || false,
        allowsPets: features?.allowsPets || false,
        allowsSmoking: features?.allowsSmoking || false,
      },
      images, // Ajout de l'image (une seule URL)
      buildingDetails: {
        yearBuilt: buildingDetails?.yearBuilt || null,
        isNewConstruction: buildingDetails?.isNewConstruction || false,
        isHistorical: buildingDetails?.isHistorical || false,
        structureType: buildingDetails?.structureType || 'Plain-pied',
      },
      isVirtualTourAvailable: isVirtualTourAvailable || false,
      isOpenHouse: isOpenHouse || false,
      lotSize,
      description,
      agentName,
      moveInDate: moveInDate || null,
      isForeclosure: isForeclosure || false,
    });

    // Sauvegarde dans MongoDB
    await newProduct.save();

    res.status(201).json({
      message: 'Propriété créée avec succès',
      product: newProduct,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Erreur lors de la création de la propriété',
      error: error.message,
    });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifiez si le produit existe
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Propriété non trouvée' });
    }

    // Supprimez le produit
    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: 'Propriété supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la propriété :', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifiez si l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID non valide' });
    }

    // Recherchez et mettez à jour le produit
    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true, // Retourne le document mis à jour
      runValidators: true, // Valide les données selon le schéma
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }

    res.status(200).json({
      message: 'Produit mis à jour avec succès',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit :', error);
    res.status(500).json({ message: 'Erreur serveur', error });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body); // Crée un nouveau produit avec les données du client
    await newProduct.save(); // Enregistre dans la base de données
    res.status(201).json({ message: 'Produit ajouté avec succès', product: newProduct });
  } catch (error) {
    console.error('Erreur lors de l’ajout du produit :', error);
    res.status(500).json({ message: 'Erreur serveur lors de l’ajout du produit', error });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find(); // Récupère tous les utilisateurs
    res.status(200).json(users); // Envoie la liste au client
  } catch (err) {
    console.error('Erreur lors de la récupération des utilisateurs :', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});
app.post('/new-users', async (req, res) => {
  try {
    const { email, password, firstname, lastname } = req.body;

    // Vérifiez que tous les champs requis sont fournis
    if (!email || !password || !firstname || !lastname) {
      return res.status(400).json({ message: 'Tous les champs sont obligatoires.' });
    }

    // Vérifiez si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet utilisateur existe déjà.' });
    }

    // Créez un nouvel utilisateur
    const newUser = new User({ email, password, firstname, lastname });
    await newUser.save();

    res.status(201).json({ message: 'Utilisateur créé avec succès.', user: newUser });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});
app.get('/new-users', async (req, res) => {
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsers = await User.find({ createdAt: { $gte: last24Hours } });
    res.status(200).json(newUsers);
  } catch (error) {
    console.error('Erreur lors de la récupération des nouveaux utilisateurs :', error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

app.get('/api/products', async (req, res) => {
  const { minPrice, maxPrice } = req.query;

  const query = {};

  if (minPrice) query.price = { ...query.price, $gte: parseInt(minPrice) };
  if (maxPrice) query.price = { ...query.price, $lte: parseInt(maxPrice) };

  try {
    const products = await Product.find(query);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération des produits.' });
  }
});

app.get('/api/fil', async (req, res) => {
  const { page = 1, limit = 10, address, minPrice, maxPrice } = req.query;
  const skip = (page - 1) * limit;

  // Définition des filtres
  const filters = { status: 'available' };
  if (address) filters.address = { $regex: address, $options: "i" }; // 🔹 Recherche insensible à la casse
  if (minPrice) filters.price = { ...filters.price, $gte: Number(minPrice) };
  if (maxPrice) filters.price = { ...filters.price, $lte: Number(maxPrice) };

  try {
    // Récupération des produits filtrés
    const products = await Product.find(filters)
      .select('title price coordinates images address') // 🔹 Sélection des champs utiles
      .skip(skip)
      .limit(parseInt(limit, 10));

    // Nombre total de produits correspondant aux filtres
    const total = await Product.countDocuments(filters);

    // Envoi des résultats
    res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des propriétés' });
  }
});


app.get("/api/filtre", async (req, res) => {
  const { transactionType, address, minPrice, maxPrice } = req.query;
  
  let query = {};
  if (transactionType) query.transactionType = transactionType;
  if (address) query.address = { $regex: address, $options: "i" }; // Filtrage insensible à la casse
  if (minPrice) query.price = { $gte: Number(minPrice) };
  if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };

  try {
    const products = await Product.find(query);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/apprt", async (req, res) => {
  const { productType } = req.query;

  const filter = {};
  if (productType) {
    filter.productType = { $in: Array.isArray(productType) ? productType : productType.split(",") };
  }

  console.log("Filtre appliqué :", filter);

  try {
    const products = await Product.find(filter);
    res.json(products);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits :", error);
    res.status(500).send("Erreur serveur");
  }
});

app.get("/api/checkbok", async (req, res) => {
  try {
    const { productType } = req.query;

    console.log("🔍 Requête API reçue !");
    console.log("👉 Paramètre productType :", productType);

    const filters = {};
    if (productType) {
      filters.productType = productType;
    }

    const results = await Product.find(filters);
    console.log("✅ Nombre de résultats trouvés :", results.length);
    console.log("📋 Résultats :", results); // Affiche les résultats dans la console

    res.status(200).json(results);
  } catch (error) {
    console.error("❌ Erreur backend :", error);
    res.status(500).json({ error: "Une erreur est survenue." });
  }
});

app.get("/propertyCount", async (req, res) => {
  try {
    const { types } = req.query;
    if (!types) {
      return res.json({ count: 0 });
    }

    const filters = { productType: { $in: types.split(",") } };
    const count = await Product.countDocuments(filters);

    res.json({ count });
  } catch (error) {
    console.error("Erreur API propertyCount :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

app.get("/api/results", async (req, res) => {
  try {
    const { types, structureTypes } = req.query;
    let filters = {};

    // Validation et formatage des filtres
    if (types && typeof types === "string") {
      const validProductTypes = [
        "appartement", "bureau_commerce", "hotel_restaurant",
        "immeuble", "residence", "studio_chambre", "villa_maison", "terrain"
      ];
      const requestedTypes = types.split(",").filter(type => validProductTypes.includes(type));
      if (requestedTypes.length > 0) {
        filters.productType = { $in: requestedTypes };
      }
    }

    if (structureTypes && typeof structureTypes === "string") {
      const validStructureTypes = [
        "Bord de l'eau", "Accès à l'eau", "Plan d'eau navigable", "Villégiature"
      ];
      const requestedStructureTypes = structureTypes.split(",").filter(type => validStructureTypes.includes(type));
      if (requestedStructureTypes.length > 0) {
        filters["buildingDetails.structureType"] = { $in: requestedStructureTypes };
      }
    }

    console.log("🟢 Filtres appliqués :", JSON.stringify(filters, null, 2));

    // Recherche des produits
    const results = await Product.find(filters);

    if (results.length === 0) {
      console.log("🔍 Aucun résultat trouvé.");
    } else {
      console.log(`🔍 ${results.length} résultat(s) trouvé(s).`);
    }

    res.json(results);
  } catch (error) {
    console.error("❌ Erreur API results :", error);
    res.status(500).json({ error: "Une erreur s'est produite lors de la récupération des résultats." });
  }
});

app.get("/api/ters", async (req, res) => {
  try {
    console.log("📥 Filtres API reçus :", req.query);

    const { minLotSize, maxLotSize, minDate } = req.query;
    let filters = {};

    // 🔹 Vérification : Si aucun filtre n'est appliqué, renvoyer une erreur
    if (!minLotSize && !maxLotSize && !minDate) {
      console.log("🟢 Filtres appliqués : {}", filters);
      return res.json([]); // 🔥 Retourne un tableau vide si aucun filtre
    }

    // 🔹 Superficie du terrain
    if (minLotSize || maxLotSize) {
      filters.lotSize = {};
      if (minLotSize) filters.lotSize.$gte = parseFloat(minLotSize);
      if (maxLotSize) filters.lotSize.$lte = parseFloat(maxLotSize);
    }

    // 🔹 Date d'ajout
    if (minDate) {
      const parsedDate = new Date(minDate);
      if (!isNaN(parsedDate)) {
        filters.createdAt = { $gte: parsedDate };
      } else {
        console.error("❌ Date invalide reçue :", minDate);
      }
    }

    console.log("🔍 Filtres appliqués :", JSON.stringify(filters, null, 2));

    const results = await Product.find(filters);
    console.log("✅ Nombre de résultats trouvés :", results.length);

    res.json(results);
  } catch (error) {
    console.error("❌ Erreur API filters :", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});




// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
