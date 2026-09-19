

// controllers/voeuController.js
const { Voeu, ModuleVoeu, Module } = require('../models');
const { Op } = require('sequelize');


async function validerChoixParSemestre(choixS1, choixS2) {
  if (!Array.isArray(choixS1) || !Array.isArray(choixS2)) {
    return { valide: false, message: "Les choix doivent être des tableaux." };
  }

  // ✅ Correction ici : minimum 3 modules
  if (choixS1.length < 3 || choixS2.length < 3) {
    return {
      valide: false,
      message: "Vous devez sélectionner **au moins** 3 modules pour chaque semestre.",
    };
  }

  const tousOK = [...choixS1, ...choixS2].every(
    c => c && c.moduleId && Array.isArray(c.type_enseignement)
  );
  if (!tousOK) {
    return {
      valide: false,
      message: "Chaque choix doit avoir `moduleId` et un tableau `type_enseignement`.",
    };
  }

  const moduleIds = [...choixS1, ...choixS2].map(c => c.moduleId);
  const modules = await Module.findAll({
    where: { id: { [Op.in]: moduleIds } },
    attributes: ['id', 'semestre'],
  });

  if (modules.length !== moduleIds.length) {
    return { valide: false, message: "Certains modules n’existent pas." };
  }

  const mapSem = Object.fromEntries(modules.map(m => [m.id, m.semestre]));
  const badS1 = choixS1.filter(c => mapSem[c.moduleId] !== 'S1');
  if (badS1.length) {
    return {
      valide: false,
      message: `Modules invalides en S1 : ${badS1.map(c => c.moduleId).join(', ')}`,
    };
  }
  const badS2 = choixS2.filter(c => mapSem[c.moduleId] !== 'S2');
  if (badS2.length) {
    return {
      valide: false,
      message: `Modules invalides en S2 : ${badS2.map(c => c.moduleId).join(', ')}`,
    };
  }

  return { valide: true };
}


exports.soumettreFicheVoeux = async (req, res) => {
  try {
    const utilisateurId = req.user.enseignantId || req.user.id;
    const {
      choixS1,  
      choixS2,
      nb_pfe_licence = 1,
      nb_pfe_master = 1,
      heures_sup = 0,
      commentaire = ''
    } = req.body;

    // 🔰 0. Presence check
    if (choixS1 === undefined || choixS2 === undefined) {
      return res.status(400).json({
        message: "Les champs `choixS1` et `choixS2` sont obligatoires."
      });
    }

    // 🔰 1. Valider les choix avant tout
    const { valide, message } = await validerChoixParSemestre(choixS1, choixS2);
    if (!valide) {
      return res.status(400).json({ message });  // **NE PAS OUBLIER** le return !
    }

    // 🔰 2. Vérifier PFE min
    if (nb_pfe_licence < 1 || nb_pfe_master < 1) {
      return res.status(400).json({
        message: "Le nombre de PFE Licence et Master doit être ≥ 1."
      });
    }

    // 🔍 3. Calcul année
    const today = new Date();
    const annee = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;

    // 🔒 4. Empêcher doublon
    const exist = await Voeu.findOne({
      where: { utilisateur_id: utilisateurId, annee }
    });
    if (exist) {
      return res.status(400).json({
        message: `⚠️ Fiche de l’année ${annee} déjà soumise.`
      });
    }

    // 🧾 5. Création de la fiche
    const voeu = await Voeu.create({
      utilisateur_id: utilisateurId,
      nb_pfe_licence,
      nb_pfe_master,
      heures_sup,
      commentaire,
      annee,
      date_soumission: today
    });

    // 📦 6. Préparation et bulk insert
    const voeuxModules = [];
[choixS1, choixS2].forEach((semestreChoix) => {
  semestreChoix.forEach((choix, choixIdx) => {
    const { moduleId, type_enseignement } = choix;
    type_enseignement.forEach(t => {
      t = ['cours','td','tp'].includes(t.toLowerCase()) ? t.toUpperCase() : t;
      voeuxModules.push({
        voeu_id: voeu.id,
        module_id: moduleId,
        type_enseignement: t,
        ordre: choixIdx + 1 // <-- ici choixIdx est bien défini
      });
    });
  });
});
    await ModuleVoeu.bulkCreate(voeuxModules);

    // ✅ Succès
    return res.status(201).json({
      message: `🎉 Fiche ${annee} créée (ID=${voeu.id}).`
    });

  } catch (err) {
    console.error("❌ Erreur soumission voeux:", err);
    return res.status(500).json({
      message: "Erreur serveur lors de la soumission."
    });
  }
};
/**
 * Récupère la dernière fiche de vœux de l'utilisateur
 */
exports.recupererDerniersVoeux = async (req, res) => {
  const utilisateurId = req.user.enseignantId || req.user.id;

  try {
    const dernierVoeu = await Voeu.findOne({
      where: { utilisateur_id: utilisateurId },
      order: [['date_soumission', 'DESC']],
      include: [{
        model: ModuleVoeu,
        as: 'modules_voeux',
        include: [{
          model: Module,
          as: 'Module',
          attributes: ['id', 'nom_module', 'niveau', 'specialite', 'semestre']
        }]
      }]
    });

    if (!dernierVoeu) {
      return res.status(404).json({ 
        message: "Vous n'avez pas encore soumis de fiche de vœux. Veuillez en créer une nouvelle."
      });
    }

    // Regroupement des modules avec fusion des types d'enseignement
    const voeuxMap = new Map();

    dernierVoeu.modules_voeux.forEach(mv => {
      const key = mv.Module.id;
      if (!voeuxMap.has(key)) {
        voeuxMap.set(key, {
          niveau: mv.Module.niveau,
          specialite: mv.Module.specialite,
          module: mv.Module.nom_module,
          semestre: mv.Module.semestre,
          cours: false,
          td: false,
          tp: false
        });
      }

      const moduleEntry = voeuxMap.get(key);
      if (mv.type_enseignement === 'Cours') moduleEntry.cours = true;
      if (mv.type_enseignement === 'TD') moduleEntry.td = true;
      if (mv.type_enseignement === 'TP') moduleEntry.tp = true;
    });

    const voeux = Array.from(voeuxMap.values());

    const response = {
      id: dernierVoeu.id,
      voeux,
      pfe: {
        master: dernierVoeu.nb_pfe_master.toString(),
        licence: dernierVoeu.nb_pfe_licence.toString()
      },
      heures_sup: dernierVoeu.heures_sup.toString(),
      commentaire: dernierVoeu.commentaire
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Erreur lors de la récupération:", error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des données." });
  }
};


/**
 * Modifie une fiche de vœux existante
 */
// Fichier controllers/voeuController.js
exports.modifierFicheVoeux = async (req, res) => {
  try {
    const voeuId = req.params.id;
    const { choixS1, choixS2, nb_pfe_licence, nb_pfe_master, heures_sup, commentaire } = req.body;

    // Validation simple
    if (!Array.isArray(choixS1) || !Array.isArray(choixS2)) {
      return res.status(400).json({
        message: "Les champs choixS1 et choixS2 doivent être des tableaux valides."
      });
    }

    // Validation existence du voeu
    const voeuExist = await Voeu.findByPk(voeuId);
    if (!voeuExist) {
      return res.status(404).json({ message: 'Vœu non trouvé.' });
    }

    // Mise à jour fiche
    const updatedVoeu = await voeuExist.update({
      nb_pfe_licence,
      nb_pfe_master,
      heures_sup,
      commentaire,
      date_soumission: new Date()
    });

    // Suppression anciens modules
    await ModuleVoeu.destroy({ where: { voeu_id: voeuId } });

    // Construction nouveaux modules
    const voeuxModules = [];

    const formaterModules = (choixSemestre) => {
      choixSemestre.forEach(( choix , choixIdx)=> {
        choix.type_enseignement.forEach(type => {
          let typeFormatted;
          switch (type.toLowerCase()) {
            case 'cours': typeFormatted = 'Cours'; break;
            case 'td': typeFormatted = 'TD'; break;
            case 'tp': typeFormatted = 'TP'; break;
            default: typeFormatted = type;
          }

          voeuxModules.push({
            voeu_id: updatedVoeu.id,
            module_id: choix.moduleId,
            type_enseignement: typeFormatted ,
            ordre: choixIdx + 1
          });
        });
      });
    };

    formaterModules(choixS1);
    formaterModules(choixS2);

    // Insertion
    await ModuleVoeu.bulkCreate(voeuxModules);

    // Réponse OK
    res.status(200).json({
      message: 'Fiche de vœux mise à jour avec succès.',
      voeuId: updatedVoeu.id
    });

  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour :", error);
    res.status(500).json({
      message: "Une erreur est survenue lors de la mise à jour de la fiche de vœux."
    });
  }
};

