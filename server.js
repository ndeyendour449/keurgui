require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Agent = require('./models/Agent');
const QRCode = require('qrcode');
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const agentRoute = require("./routes/agentRoute");

const app = express();

// ============================================
// 1. MIDDLEWARE DE BASE (toujours en premier)
// ============================================
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(bodyParser.json());

// ============================================
// 2. FICHIERS STATIQUES (avant toutes les routes)
// ============================================
// ✅ Les fichiers statiques DOIVENT être servis avant les middlewares qui modifient les headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static('assets'));

// ============================================
// 3. MIDDLEWARE DE LOG (optionnel, pour déboguer)
// ============================================
app.use('/uploads', (req, res, next) => {
  console.log('📸 Image demandée:', req.url);
  next();
});

// ============================================
// 4. ROUTES API (après les fichiers statiques)
// ============================================
app.use("/api", agentRoute);
app.use('/api', require('./routes/uploads'));

// ============================================
// 5. MIDDLEWARE DE CONTENT-TYPE (uniquement pour les routes HTML si nécessaire)
// ============================================
// ⚠️ Ce middleware a été MODIFIÉ pour ne pas interférer avec les images
// Il ne s'applique que si le type n'est pas déjà défini (optionnel)
app.use((req, res, next) => {
  // NE PAS forcer le Content-Type pour toutes les requêtes
  // On le fait seulement pour les routes qui DOIVENT être du HTML
  if (req.url.startsWith('/api') || req.url.startsWith('/uploads') || req.url.startsWith('/assets')) {
    return next();
  }
  // Pour les autres routes (comme les pages HTML si vous en avez)
  if (!res.getHeader('Content-Type')) {
    res.header('Content-Type', 'text/html; charset=utf-8');
  }
  next();
});

// ============================================
// 6. CONFIGURATION MULTER
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ============================================
// 7. CONNEXION MONGODB
// ============================================
const mongoURI = process.env.MONGODB_URL;

if (!mongoURI) {
  console.error("❌ Erreur : La variable d'environnement MONGODB_URL est introuvable.");
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Connexion réussie à MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Erreur de connexion MongoDB :", err.message);
    process.exit(1);
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
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    status: { type: String, enum: ['available', 'sold', 'rented'], default: 'available' },
    coduStatus: { type: String, enum: ['codu', 'noncodu'], required: true },
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
    
    moveInDate: { type: Date },
    isForeclosure: { type: Boolean, default: false },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent', required: true }, // Cette référence à l'agent
  }, { timestamps: true });
  // 📌 Ajout d'indexation pour améliorer la recherche
  productSchema.index({ coordinates: "2dsphere" });
  productSchema.index({ city: 1, price: 1, transactionType: 1 });
  
  // 📌 Création du modèle `Product` directement dans `server.js`
  const Product = mongoose.model('Product', productSchema);


// const AdSchema = new mongoose.Schema({d
//     title: String,
//     mediaType: { type: String, enum: ["image", "video"], required: true }, // Détermine le type de média
//     imageUrl: String,  // URL de l'image (si mediaType = "image")
//     videoUrl: String,  // URL de la vidéo (si mediaType = "video")
//     targetUrl: String, // Lien vers lequel rediriger en cliquant sur la pub
//     position: String,  // header, sidebar, footer...
//     active: Boolean,
//     startDate: Date,A
//     endDate: Date
// });

// const Ad = mongoose.model("Ad", AdSchema);

// Middleware pour parser les requêtes JSON


// Middleware pour vérifier si l'utilisateur est admin
app.post('/agents', upload.single('photoProfil'), async (req, res) => {
  const { email, password, phoneNumber, nonAgence, territoire, langue, presentation, infosSupplementaires, adresse } = req.body;
  const photoProfil = req.file ? req.file.path : null;  // Utilise le chemin du fichier téléchargé

  // Créer l'agent avec les données et l'image
  const newAgent = new Agent({
    email,
    password,
    phoneNumber,
    nonAgence,
    territoire,
    langue,
    photoProfil,  // Ajoute le chemin du fichier téléchargé
    presentation,
    infosSupplementaires,
    adresse,
  });

  await newAgent.save();
  res.status(201).json({ message: "Agent créé avec succès", agent: newAgent });
});
// async function fixAgentField() {
//   try {
//     // Met à jour tous les produits où agent est une string
//     const result = await Product.updateMany(
//       { agent: { $type: "string" } },
//       [ { $set: { agent: { $toObjectId: "$agent" } } } ]
//     );
//     console.log("Conversion terminée :", result);
//   } catch (err) {
//     console.error("Erreur pendant la conversion :", err);
//   }
// }

// // Appelle la fonction de migration UNE SEULE FOIS au démarrage
// mongoose.connection.once('open', async () => {
//   await fixAgentField();
//   // ... (le reste de ton démarrage serveur)
// });

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
app.put('/agents/:id', upload.single('photoProfil'), async (req, res) => {
  try {
    const { id } = req.params;

    const allowedFields = [
      'email',
      'agentName',
      'phoneNumber',
      'nonAgence',
      'territoire',
      'langue',
      'presentation',
      'infosSupplementaires',
      'adresse',
      'password'
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Hash du mot de passe
    if (updates.password) {
      const bcrypt = require("bcryptjs");
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    if (req.file) {
      updates.photoProfil = req.file.filename;
    }

    const updatedAgent = await Agent.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedAgent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    res.status(200).json({
      message: 'Agent mis à jour avec succès',
      agent: updatedAgent,
    });

  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'agent :", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
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
    const agentId = req.params.id;

    // Vérification si l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: 'ID d\'agent invalide' });
    }

    // Recherche de l'agent par son ID avec ses propriétés associées
    const agent = await Agent.findById(agentId)
      .populate('products');  // Remplir le champ 'products' avec les propriétés associées

    // Si l'agent n'est pas trouvé, retourner une erreur 404
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Retourner les détails de l'agent avec ses propriétés
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

  console.log("🔹 Requête reçue pour login:", { email, role });

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
      console.log("❌ Utilisateur non trouvé !");
      return res.status(400).json({ message: 'Utilisateur non trouvé.' });
    }

    console.log("🔹 Utilisateur trouvé :", user);

    // Vérifie que user.password existe
    if (!user.password) {
      console.error("🚨 ERREUR: L'utilisateur n'a pas de mot de passe enregistré !");
      return res.status(500).json({ message: "Erreur serveur: mot de passe introuvable." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Mot de passe incorrect !");
      return res.status(400).json({ message: 'Mot de passe incorrect.' });
    }

    console.log("✅ Mot de passe correct, génération du token...");
    const token = jwt.sign({ userId: user._id, role }, 'secret_key', { expiresIn: '1h' });

    res.json({ token, agent: user });

  } catch (err) {
    console.error("🚨 ERREUR SERVEUR :", err.message);
    console.error(err.stack); // Affiche le stack trace complet
    res.status(500).json({ message: 'Erreur serveur.', error: err.message });
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
    // Recherche du produit par son ID, en peuplant le champ "agent" pour inclure les données de l'agent associé
    const product = await Product.findById(req.params.id).populate('agent');
    
    // Si le produit n'existe pas
    if (!product) {
      return res.status(404).send('Produit non trouvé');
    }
    
    // Si le produit existe, mais qu'il n'a pas d'agent associé
    if (!product.agent) {
      return res.status(404).send('Agent non trouvé pour ce produit');
    }
    
    // Si tout est bon, retourner le produit avec les données de l'agent
    res.json(product);
  } catch (err) {
    // En cas d'erreur, renvoyer une erreur serveur
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
    const { search } = req.query;

    // Requête de base : uniquement les produits approuvés
    let query = { approvalStatus: 'approved' };

    if (search) {
      // Ajouter la recherche si le paramètre `search` est fourni
      query.$or = [
        { city: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query).limit(50);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.post('/api/products', async (req, res) => {
  try {
    // Récupérer les données envoyées dans le corps de la requête
    const {
      agentName,
      email,
      password,
      nonAgence,
      territoire,
      langue,
      photoProfil,
      phoneNumber,
      title,
      price,
      transactionType,
      productType,
      propertyCategory,
      coordinates,
      status,
      coduStatus,
      address,
      city,
      features,
      images,
      buildingDetails,
      isVirtualTourAvailable,
      isOpenHouse,
      lotSize,
      description,
      moveInDate,
      isForeclosure,
    } = req.body;

    // Valider les données pour l'agent
    if (!email || !password || !agentName || !nonAgence || !territoire || !langue || !photoProfil || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs obligatoires pour l\'agent doivent être remplis.' });
    }

    // Vérifier si l'email existe déjà dans la base de données
    const existingAgent = await Agent.findOne({ email });
    if (existingAgent) {
      return res.status(400).json({ message: 'Un agent avec cet email existe déjà.' });
    }

    // Créer l'agent
    const newAgent = new Agent({
      email,
      password,
      agentName,
      nonAgence,
      territoire,
      langue,
      photoProfil,
      phoneNumber,
      products: [] // Initialiser `products` comme un tableau vide
    });

    // Hacher le mot de passe de l'agent (si nécessaire)
    const salt = await bcrypt.genSalt(10);
    newAgent.password = await bcrypt.hash(password, salt);

    // Sauvegarder l'agent dans la base de données
    await newAgent.save();

    // Valider les données pour le produit
    if (!title || !price || !transactionType || !productType || !propertyCategory || !coordinates || !address || !city) {
      return res.status(400).json({ message: 'Tous les champs obligatoires pour le produit doivent être remplis.' });
    }

    // Créer la propriété (produit)
    const newProduct = new Product({
      title,
      price,
      transactionType,
      productType,
      propertyCategory,
      coordinates, // { latitude, longitude }
      status: status || 'available', // Par défaut, "available"
      coduStatus,
      address,
      city,
      features,
      images,
      buildingDetails,
      isVirtualTourAvailable: isVirtualTourAvailable || false,
      isOpenHouse: isOpenHouse || false,
      lotSize,
      description,
      moveInDate,
      isForeclosure: isForeclosure || false,
      agent: newAgent._id, // Référence à l'agent
    });

    // Sauvegarder le produit dans la base de données
    await newProduct.save();

    // Ajouter l'ID du produit dans le tableau `products` de l'agent
    newAgent.products.push(newProduct._id);

    // Sauvegarder l'agent avec le produit ajouté
    await newAgent.save();

    // Répondre avec un message de succès et les informations de l'agent et du produit créé
    res.status(201).json({
      message: 'Agent et propriété créés avec succès!',
      agent: newAgent,
      product: newProduct,
    });

  } catch (err) {
    console.error('Erreur:', err);  // Afficher l'erreur dans la console du serveur
    res.status(500).json({ message: 'Erreur serveur lors de la création de l\'agent et de la propriété.', error: err.message });
  }
});

app.post('/api/products/create-with-agent', async (req, res) => {  try {
    const {
      title,
      price,
      transactionType,
      productType,
      propertyCategory,
      coordinates,
      status,
      coduStatus,
      address,
      city,
      features,
      images,
      buildingDetails,
      isVirtualTourAvailable,
      isOpenHouse,
      lotSize,
      description,
      moveInDate,
      isForeclosure,
      agent, // <- ID de l'agent déjà existant
    } = req.body;

    // 🔒 Vérifie que l'agent existe
    const existingAgent = await Agent.findById(agent);
    if (!existingAgent) {
      return res.status(400).json({ message: 'Agent introuvable avec cet ID.' });
    }

    // 🔎 Validation des champs du produit
    if (!title || !price || !transactionType || !productType || !propertyCategory || !coordinates || !address || !city || !images.length) {
      return res.status(400).json({ message: 'Tous les champs obligatoires pour le produit doivent être remplis.' });
    }

    const newProduct = new Product({
      title,
      price,
      transactionType,
      productType,
      propertyCategory,
      coordinates,
      status: status || 'available',
      approvalStatus: "approved",
      coduStatus,
      address,
      city,
      features,
      images,
      buildingDetails,
      isVirtualTourAvailable: isVirtualTourAvailable || false,
      isOpenHouse: isOpenHouse || false,
      lotSize,
      description,
      moveInDate,
      isForeclosure: isForeclosure || false,
      agent: agent, // <- ID existant
    });

    await newProduct.save();

    // Ajoute le produit à l'agent existant
    existingAgent.products.push(newProduct._id);
    await existingAgent.save();

    res.status(201).json({
      message: 'Produit ajouté avec succès à l\'agent existant !',
      product: newProduct,
    });

  } catch (err) {
    console.error('Erreur:', err);
    res.status(500).json({ message: 'Erreur serveur lors de la création du produit.', error: err.message });
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
  try {
    const { transactionType, address, minPrice, maxPrice } = req.query;

    // Base query : seulement les produits approuvés
    let query = { approvalStatus: 'approved' };

    if (transactionType) query.transactionType = transactionType;
    if (address) query.address = { $regex: address, $options: "i" };
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };

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
    const { types, structureTypes, coduStatus } = req.query;
    let filters = {};

    // 🔹 Filtrage par type de produit
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

    // 🔹 Filtrage par type de structure
    if (structureTypes && typeof structureTypes === "string") {
      const validStructureTypes = [
        "Bord de l'eau", "Accès à l'eau", "Plan d'eau navigable", "Villégiature"
      ];
      const requestedStructureTypes = structureTypes.split(",").filter(type => validStructureTypes.includes(type));
      if (requestedStructureTypes.length > 0) {
        filters["buildingDetails.structureType"] = { $in: requestedStructureTypes };
      }
    }

    // 🔥 Ajout du filtre CODU
    if (coduStatus && ["codu", "noncodu"].includes(coduStatus)) {
      filters.coduStatus = coduStatus;
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

app.patch('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Mettre à jour le statut dans la base de données
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.get('/api/products/agent/:agentId', async (req, res) => {
  try {
    const agentId = req.params.agentId;
    console.log('ID de l\'agent reçu :', agentId); // Log l'ID reçu

    // Vérifiez si l'ID de l'agent est valide
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: 'ID de l\'agent invalide' });
    }

    // Convertir l'ID en ObjectId
    const agentObjectId = new mongoose.Types.ObjectId(agentId);

    // Recherchez les propriétés associées à l'agent
    const products = await Product.find({ agent: agentObjectId });
    console.log('Propriétés trouvées :', products); // Log les propriétés trouvées

    // Renvoyez les propriétés trouvées
    res.json({
      products,
      total: products.length,
      currentPage: 1,
      totalPages: 1,
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des propriétés de l\'agent :', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


// **Endpoint pour ajouter une publicité**
app.post("/ads", async (req, res) => {
  try {
    const { title, mediaType, imageUrl, videoUrl, targetUrl, position, active, startDate, endDate } = req.body;

    // Vérifier que le mediaType est correct
    if (!["image", "video"].includes(mediaType)) {
      return res.status(400).json({ error: "Le type de média doit être 'image' ou 'video'." });
    }

    // Vérifier que l'URL de l'image ou de la vidéo est bien fournie
    if (mediaType === "image" && !imageUrl) {
      return res.status(400).json({ error: "L'URL de l'image est requise pour les publicités avec une image." });
    }
    if (mediaType === "video" && !videoUrl) {
      return res.status(400).json({ error: "L'URL de la vidéo est requise pour les publicités avec une vidéo." });
    }

    const newAd = new Ad({
      title,
      mediaType,
      imageUrl: mediaType === "image" ? imageUrl : null,  // Stocker uniquement l'URL image si mediaType = "image"
      videoUrl: mediaType === "video" ? videoUrl : null,  // Stocker uniquement l'URL vidéo si mediaType = "video"
      targetUrl,
      position,
      active,
      startDate,
      endDate
    });

    await newAd.save();
    res.status(201).json({ message: "Publicité ajoutée avec succès !" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'ajout de la publicité." });
  }
});

// Récupérer toutes les publicités actives
app.get("/ads", async (req, res) => {
  try {
    const ads = await Ad.find({ active: true });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des publicités." });
  }
});



app.get('/api/agents/:id', async (req, res) => {
  try {
    const agentId = req.params.id;

    // Vérifiez si l'ID est valide
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ message: 'ID invalide' });
    }

    // Recherchez l'agent dans la base de données
    const agent = await Agent.findById(agentId);

    // Si l'agent n'est pas trouvé
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Renvoyez les informations de l'agent
    res.json(agent);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'agent :', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.get('/property/:id', async (req, res) => {
  try {
    const propertyId = req.params.id;

    // Récupérer la propriété par son ID
    const property = await Product.findById(propertyId).populate('agent');

    if (!property) {
      return res.status(404).json({ message: 'Propriété non trouvée' });
    }

    // Récupérer l'agent associé
    const agent = property.agent;

    // Afficher les détails de la propriété et de l'agent
    res.json({
      property: {
        title: property.title,
        price: property.price,
        transactionType: property.transactionType,
        productType: property.productType,
        propertyCategory: property.propertyCategory,
        coordinates: property.coordinates,
        status: property.status,
        coduStatus: property.coduStatus,
        address: property.address,
        city: property.city,
        features: property.features,
        images: property.images,
        buildingDetails: property.buildingDetails,
        isVirtualTourAvailable: property.isVirtualTourAvailable,
        isOpenHouse: property.isOpenHouse,
        lotSize: property.lotSize,
        description: property.description,
        moveInDate: property.moveInDate,
        isForeclosure: property.isForeclosure,
      },
      agent: {
        agentName: agent.agentName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        nonAgence: agent.nonAgence,
        territoire: agent.territoire,
        langue: agent.langue,
        photoProfil: agent.photoProfil,
        presentation: agent.presentation,
        infosSupplementaires: agent.infosSupplementaires,
        adresse: agent.adresse,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.get("/api/agent/:agentId/properties", async (req, res) => {
  const { agentId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 4;
  const { status } = req.query;

  if (!mongoose.Types.ObjectId.isValid(agentId)) {
    return res.status(400).json({ message: "ID d'agent invalide" });
  }
  if (page <= 0 || limit <= 0) {
    return res.status(400).json({ message: "La page et la limite doivent être des nombres positifs" });
  }

  try {
    // Filtres supplémentaires
    const filters = { agent: agentId };
    if (status) filters.status = status;

    // Pagination
    const skip = (page - 1) * limit;

    // Récupération des propriétés
    const properties = await Product.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .populate('agent', 'agentName email');

    const totalCount = await Product.countDocuments(filters);

    res.json({
      success: true,
      properties,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      totalProperties: totalCount
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des propriétés"
    });
  }
});

// Serveur Express
app.get('/api/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Récupérer le produit et son agent associé
    const product = await Product.findById(productId).populate('agent');
    
    if (!product) {
      return res.status(404).json({ message: 'Produit non trouvé.' });
    }

    // Répondre avec les données du produit et de l'agent
    res.status(200).json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération du produit.' });
  }
});
app.get('/api/products/studio-chambre', async (req, res) => {
  try {
    const products = await Product.find({ productType: 'studio_chambre' });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Dans votre fichier de routes
app.get("/api/agent/:agentId/products", async (req, res) => {
  const { agentId } = req.params;
  const { page = 1, limit = 4, status } = req.query;

  try {
    // Filtres
    const filters = { agent: agentId };
    if (status) filters.status = status;

    // Récupération avec pagination
    const products = await Product.find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalCount = await Product.countDocuments(filters);

    res.json({
      success: true,
      products,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: parseInt(page),
      totalProducts: totalCount
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Erreur serveur"
    });
  }
});
app.post('/register-admin', upload.single('profileImage'), async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const profileImage = req.file ? `/uploads/admins/${req.file.filename}` : '';

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Cet admin existe déjà." });
    }

    const newAdmin = new Admin({ email, password, fullName, profileImage });
    await newAdmin.save();

    res.status(201).json({ message: "Admin créé avec succès", admin: newAdmin });
  } catch (error) {
    console.error("Erreur création admin :", error.message);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});
app.post('/agent/soumission', async (req, res) => {

  try {

    const product = new Product({
      ...req.body,
      approvalStatus: "pending" // ⏳ attente validation admin
    });

    await product.save();

    res.status(201).json({
      message: "Propriété envoyée pour validation",
      product
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erreur création propriété",
      error: error.message
    });

  }

});
app.post('/api/productss', async (req, res) => {
  try {

    const { role, agent } = req.body;

    const approvalStatus = role === "agent" ? "pending" : "approved";

    const product = new Product({
      ...req.body,
      agent: agent,
      approvalStatus
    });

    const savedProduct = await product.save();

    res.status(201).json({
      message:
        role === "agent"
          ? "Produit créé en attente d'approbation"
          : "Produit publié directement",
      product: savedProduct
    });

  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la création du produit",
      error: error.message
    });
  }
});
// Backend GET

// Route GET : récupérer uniquement les produits approuvés
app.get('/api/productss', async (req, res) => {
  try {
    const approvedProducts = await Product.find({ approvalStatus: 'approved' }).lean();
    res.status(200).json(approvedProducts); // renvoie uniquement les produits approuvés
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la récupération des produits approuvés",
      error: error.message
    });
  }
});

// GET /api/products/pending
app.get('/pending', async (req, res) => {
  try {
    const pendingProducts = await Product.find({ approvalStatus: "pending" });
    res.json(pendingProducts);
  } catch (error) {
    console.error("Erreur lors de la récupération des produits en attente:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
app.patch('/products/:id/approve', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { approvalStatus: 'approved' }, { new: true });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
