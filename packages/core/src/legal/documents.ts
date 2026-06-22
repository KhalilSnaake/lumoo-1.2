// Contenu légal partagé (mobile + web) — Lumoo, e-commerce Mali.
// Source unique : mobile et web importent ces données et les rendent avec leur propre UI.
//
// ⚠️ MODÈLE à faire valider par un juriste avant publication.
// Les éléments entre crochets [...] sont à compléter avec les infos réelles de la société.

export type LegalSection = { heading: string; paragraphs: string[] };

export interface LegalDoc {
  slug: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  cgu: {
    slug: "cgu",
    title: "Conditions Générales d'Utilisation",
    sections: [
      {
        heading: "1. Objet",
        paragraphs: [
          "Les présentes Conditions Générales d'Utilisation (CGU) encadrent l'accès et l'utilisation de l'application Lumoo, plateforme de mise en relation pour l'achat de produits au Mali. En créant un compte, tu acceptes ces conditions.",
        ],
      },
      {
        heading: "2. Compte",
        paragraphs: [
          "Tu t'engages à fournir des informations exactes (nom, téléphone, email) et à les tenir à jour.",
          "Tu es responsable de la confidentialité de ton mot de passe et de toute activité réalisée depuis ton compte.",
        ],
      },
      {
        heading: "3. Commandes via WhatsApp",
        paragraphs: [
          "Lumoo te permet de parcourir les produits et de préparer ta commande ; celle-ci est ensuite confirmée et finalisée avec le vendeur via WhatsApp.",
          "Les prix sont affichés en francs CFA (FCFA).",
        ],
      },
      {
        heading: "4. Utilisation acceptable",
        paragraphs: [
          "Tu t'engages à utiliser l'application de manière licite, sans fraude, usurpation d'identité, ni atteinte aux droits d'autrui.",
        ],
      },
      {
        heading: "5. Disponibilité du service",
        paragraphs: [
          "Lumoo s'efforce d'assurer la continuité du service mais ne garantit pas une disponibilité ininterrompue (maintenance, contraintes réseau).",
        ],
      },
      {
        heading: "6. Modification des CGU",
        paragraphs: [
          "Lumoo peut faire évoluer ces CGU. Les modifications s'appliquent dès leur publication dans l'application.",
        ],
      },
      {
        heading: "7. Droit applicable",
        paragraphs: [
          "Les présentes CGU sont régies par le droit malien. En cas de litige, compétence est attribuée aux tribunaux de [ville, ex. Bamako].",
        ],
      },
    ],
  },

  cgv: {
    slug: "cgv",
    title: "Conditions Générales de Vente",
    sections: [
      {
        heading: "1. Vendeur",
        paragraphs: [
          "[Raison sociale], [forme juridique], immatriculée au RCCM sous le n° [RCCM], NIF [NIF], dont le siège social est situé à [adresse], Bamako, Mali.",
        ],
      },
      {
        heading: "2. Produits et prix",
        paragraphs: [
          "Les produits sont décrits dans l'application. Les prix sont indiqués en FCFA, toutes taxes comprises, et peuvent évoluer. Le prix applicable est celui affiché au moment de la commande.",
        ],
      },
      {
        heading: "3. Commande",
        paragraphs: [
          "La commande est préparée dans l'application puis confirmée via WhatsApp. Elle devient ferme après confirmation par le vendeur.",
        ],
      },
      {
        heading: "4. Paiement",
        paragraphs: [
          "Moyens de paiement acceptés selon disponibilité : Orange Money, Moov Money, Wave, et espèces à la livraison.",
        ],
      },
      {
        heading: "5. Livraison",
        paragraphs: [
          "La livraison est assurée dans les zones desservies ([Bamako] et environs). Les délais et frais de livraison sont communiqués avant la validation de la commande.",
          "Un code de retrait t'est remis : il sert au suivi de la commande et à la remise au livreur.",
        ],
      },
      {
        heading: "6. Retour et remboursement",
        paragraphs: [
          "En cas de produit non conforme ou endommagé, contacte-nous sous [48] heures après réception. Les modalités de retour et de remboursement éventuel sont convenues avec le vendeur.",
        ],
      },
      {
        heading: "7. Réclamations",
        paragraphs: ["Pour toute réclamation : [email] — [téléphone / WhatsApp]."],
      },
      {
        heading: "8. Droit applicable",
        paragraphs: [
          "Les présentes CGV sont régies par le droit malien et les Actes uniformes de l'OHADA.",
        ],
      },
    ],
  },

  confidentialite: {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    intro:
      "Lumoo protège tes données personnelles conformément à la loi n°2013-015 du 21 mai 2013 portant protection des données à caractère personnel en République du Mali, sous le contrôle de l'APDP (Autorité de Protection des Données à caractère Personnel).",
    sections: [
      {
        heading: "1. Responsable du traitement",
        paragraphs: ["[Raison sociale], [adresse], Bamako, Mali. Contact : [email]."],
      },
      {
        heading: "2. Déclaration à l'APDP",
        paragraphs: [
          "Conformément à la loi n°2013-015, le traitement de tes données fait l'objet d'une déclaration préalable auprès de l'APDP, qui en délivre un récépissé (n° [à compléter]).",
        ],
      },
      {
        heading: "3. Données collectées",
        paragraphs: [
          "Nom, email, numéro de téléphone, adresse de livraison, localisation (si tu l'autorises) et historique de commandes.",
        ],
      },
      {
        heading: "4. Finalités",
        paragraphs: [
          "Création et gestion de ton compte, traitement et livraison des commandes, contact via WhatsApp, et amélioration du service.",
        ],
      },
      {
        heading: "5. Base légale",
        paragraphs: [
          "Le traitement repose sur ton consentement et sur l'exécution du contrat de vente, ainsi que sur le respect des obligations légales.",
        ],
      },
      {
        heading: "6. Partage et transferts",
        paragraphs: [
          "Tes données peuvent être communiquées aux livreurs et aux prestataires de paiement, uniquement pour exécuter ta commande. Elles ne sont jamais vendues.",
          "Tout transfert de données en dehors du Mali est encadré conformément à la loi n°2013-015.",
        ],
      },
      {
        heading: "7. Conservation",
        paragraphs: [
          "Tes données sont conservées [durée à préciser], le temps nécessaire à la gestion de ton compte et au respect des obligations légales, puis supprimées ou anonymisées.",
        ],
      },
      {
        heading: "8. Tes droits",
        paragraphs: [
          "Tu disposes d'un droit d'accès, de rectification, de suppression et d'opposition sur tes données. Pour les exercer : [email].",
        ],
      },
      {
        heading: "9. Réclamation auprès de l'APDP",
        paragraphs: [
          "Si tu estimes que tes droits ne sont pas respectés, tu peux saisir l'APDP — Autorité de Protection des Données à caractère Personnel (Mali), site : apdp.ml.",
        ],
      },
    ],
  },

  "mentions-legales": {
    slug: "mentions-legales",
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur",
        paragraphs: [
          "[Raison sociale], [forme juridique] au capital de [montant] FCFA.",
          "RCCM : [n°] — NIF : [n°].",
        ],
      },
      {
        heading: "Siège social",
        paragraphs: ["[adresse], Bamako, Mali."],
      },
      {
        heading: "Directeur de la publication",
        paragraphs: ["[Nom du responsable]."],
      },
      {
        heading: "Contact",
        paragraphs: ["Email : [email] — Téléphone / WhatsApp : [+223 ...]."],
      },
      {
        heading: "Hébergement",
        paragraphs: ["Application et données hébergées par [hébergeur], [pays]."],
      },
    ],
  },
};

/** Ordre + libellés des liens légaux (footer d'inscription, etc.) — partagé mobile/web. */
export const LEGAL_DOC_LINKS: { slug: string; label: string }[] = [
  { slug: "cgu", label: "CGU" },
  { slug: "cgv", label: "CGV" },
  { slug: "confidentialite", label: "Confidentialité" },
  { slug: "mentions-legales", label: "Mentions légales" },
];

export function getLegalDoc(slug: string | undefined): LegalDoc | null {
  if (!slug) return null;
  return LEGAL_DOCS[slug] ?? null;
}
