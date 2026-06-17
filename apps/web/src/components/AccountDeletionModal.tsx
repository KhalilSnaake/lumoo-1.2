// Page « Suppression de compte » accessible par URL publique (?delete-account).
// Requise par Google Play (et utile RGPD) : décrit comment supprimer son compte
// et quelles données sont supprimées / conservées. Contenu autonome (ne dépend
// pas de documents.ts).
export default function AccountDeletionModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 shadow-2xl animate-slide-up">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-extrabold text-gray-800">Suppression de compte</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>
            Vous pouvez supprimer votre compte Lumoo et les données associées à tout moment.
          </p>

          <p className="font-bold text-gray-800">Comment supprimer votre compte</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Dans l'application Lumoo : <b>Compte</b> → <b>Supprimer mon compte</b>.</li>
            <li>Sur le site lumoo.ml : ouvrez <b>Mon compte</b>, puis <b>Supprimer mon compte</b>.</li>
            <li>
              Ou écrivez à <a href="mailto:contact@lumoo.ml" className="text-green-600 font-semibold hover:underline">contact@lumoo.ml</a>{' '}
              depuis l'adresse e-mail de votre compte. Votre demande est traitée sous 30 jours.
            </li>
          </ul>

          <p className="font-bold text-gray-800 pt-1">Données concernées</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Supprimées :</b> votre profil (nom, e-mail, téléphone, adresse) et votre compte de connexion.</li>
            <li><b>Conservées de façon anonyme :</b> vos commandes passées sont dissociées de votre compte (obligations comptables) — sans donnée personnelle rattachée.</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
