const express = require("express");
const mongoose = require("mongoose");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require('express-validator');
const Agent = require("../models/Agent"); // Assurez-vous du bon chemin d'importation
const router = express.Router();
const multer = require("multer");
const path = require("path");
const QRCode = require('qrcode');
const crypto = require("crypto");
const nodemailer = require("nodemailer");
// Configuration du stockage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Crée ce dossier si pas encore créé
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.post('/registeragent', async (req, res) => {
    try {
        const { email, password, agentName, phoneNumber, territoire, langue, photoProfil, adresse, nonAgence, presentation, infosSupplementaires } = req.body;

        // Vérifier si l'email existe déjà
        const existingAgent = await Agent.findOne({ email });
        if (existingAgent) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }
  
        // Hacher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10); // Le "10" ici représente le nombre de tours de salage

        // Créer un nouvel agent
        const newAgent = new Agent({
            email,
            password: hashedPassword,
            agentName,
            phoneNumber,
            territoire,
            langue,
            photoProfil: photoProfil || "",
            adresse: adresse || "",
            nonAgence: nonAgence || "",
            presentation: presentation || "",
            infosSupplementaires: infosSupplementaires || ""
        });

        // Sauvegarder l'agent dans la base de données
        await newAgent.save();

        res.status(201).json({
            message: 'Agent enregistré avec succès !',
            agent: {
                id: newAgent._id,
                email: newAgent.email,
                agentName: newAgent.agentName,
                phoneNumber: newAgent.phoneNumber,
                territoire: newAgent.territoire,
                langue: newAgent.langue,
                photoProfil: newAgent.photoProfil,
                adresse: newAgent.adresse,
                nonAgence: newAgent.nonAgence,
                presentation: newAgent.presentation,
                infosSupplementaires: newAgent.infosSupplementaires,
                createdAt: newAgent.createdAt
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'inscription :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


router.post("/loginagent", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Vérifier si l'email existe
        const agent = await Agent.findOne({ email });
        if (!agent) {
            return res.status(400).json({ message: "Email introuvable." });
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, agent.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Mot de passe incorrect." });
        }

        // Répondre avec les infos de l'agent sans token
        res.status(200).json({
            message: "Connexion réussie !",
            agent: {
                id: agent._id,
                email: agent.email,
                agentName: agent.agentName || "",
                phoneNumber: agent.phoneNumber || "",
                territoire: agent.territoire || "",
                photoProfil: agent.photoProfil || "",
                langue: agent.langue || "",
                adresse: agent.adresse || "",
                nonAgence: agent.nonAgence || "",
                presentation: agent.presentation || "",
                infosSupplementaires: agent.infosSupplementaires || "",
                createdAt: agent.createdAt,
            }
        });

    } catch (error) {
        console.error("Erreur lors de la connexion :", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
})

router.put("/update-agent", async (req, res) => {
    const { agentId, agentName, email, phoneNumber, adresse, presentation, infosSupplementaires, currentPassword, newPassword } = req.body;
  
    try {
      const agent = await Agent.findById(agentId);
  
      if (!agent) {
        return res.status(404).json({ message: "Agent non trouvé." });
      }
  
      // Mettre à jour les informations de base
      agent.agentName = agentName || agent.agentName;
      agent.email = email || agent.email;
      agent.phoneNumber = phoneNumber || agent.phoneNumber;
      agent.adresse = adresse || agent.adresse;
      agent.presentation = presentation || agent.presentation;
      agent.infosSupplementaires = infosSupplementaires || agent.infosSupplementaires;
  
      // Mettre à jour le mot de passe si nécessaire
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Veuillez fournir le mot de passe actuel." });
        }
  
        const isMatch = await bcrypt.compare(currentPassword, agent.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Mot de passe actuel incorrect." });
        }
  
        const salt = await bcrypt.genSalt(10);
        agent.password = await bcrypt.hash(newPassword, salt);
      }
  
      await agent.save();
      res.status(200).json({ agent, message: "Profil mis à jour avec succès." });
    } catch (err) {
      res.status(500).json({ message: "Erreur lors de la mise à jour du profil." });
    }
  });

// Créer un nouvel agent
router.post("/agents", upload.single("photoProfil"), async (req, res) => {
    try {
      const {
        email,
        password,
        agentName,
        nonAgence,
        territoire,
        langue,
        phoneNumber,
        presentation,
        infosSupplementaires,
        adresse,
      } = req.body;
  
      const photoPath = req.file ? `/uploads/${req.file.filename}` : "";
  
      const newAgent = new Agent({
        email,
        password,
        agentName,
        nonAgence,
        territoire,
        langue,
        phoneNumber,
        photoProfil: photoPath,
        presentation,
        infosSupplementaires,
        adresse,
      });
  
      await newAgent.save();
      res.status(201).json({ message: "Agent ajouté avec succès", agent: newAgent });
    } catch (error) {
      console.error("Erreur backend :", error);
      res.status(500).json({ message: "Erreur serveur", error });
    }
  });

router.post("/forgot-password-agent", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("1. Email reçu:", email);
    
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    console.log("2. Recherche agent...");
    const agent = await Agent.findOne({ email });
    console.log("3. Agent trouvé:", agent ? "oui" : "non");

    if (!agent) {
      return res.status(404).json({ message: "Email introuvable" });
    }

    // Générer un token
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 3600000;

    agent.resetPasswordToken = token;
    agent.resetPasswordExpires = expires;
    await agent.save();
    console.log("4. Token sauvegardé");

    // Configuration explicite comme dans votre projet fonctionnel
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log("5. Transporter créé");
    console.log("6. EMAIL_USER défini:", !!process.env.EMAIL_USER);

    const resetUrl = `https://www.keurgui.sn/#/reset-password-agent/${token}`;
    
    console.log("7. Tentative d'envoi à:", agent.email);
    
    const info = await transporter.sendMail({
      from: `"Keurgui" <${process.env.EMAIL_USER}>`,
      to: agent.email,
      subject: "Réinitialisation du mot de passe",
      html: `
        <p>Bonjour ${agent.agentName}</p>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>Ce lien expire dans 1 heure.</p>
      `
    });

    console.log("8. Email envoyé:", info.messageId);

    res.json({
      message: "Lien de réinitialisation envoyé à votre email"
    });

  } catch (error) {
    console.error("ERREUR COMPLÈTE:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    
    res.status(500).json({
      message: "Erreur serveur",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
router.post("/reset-password-agent/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token et nouveau mot de passe requis",
      });
    }

    const agent = await Agent.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!agent) {
      return res.status(400).json({
        message: "Token invalide ou expiré",
      });
    }

    const salt = await bcrypt.genSalt(10);
    agent.password = await bcrypt.hash(password, salt);

    agent.resetPasswordToken = undefined;
    agent.resetPasswordExpires = undefined;

    await agent.save();

    res.json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

module.exports = router;
