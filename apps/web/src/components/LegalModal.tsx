import { getLegalDoc } from '@lumoo/core';

// Affiche un document légal (CGU/CGV/confidentialité/mentions) — source UNIQUE partagée
// avec le mobile : packages/core/src/legal/documents.ts. Modifier là -> web + mobile à jour.
export default function LegalModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const doc = getLegalDoc(slug);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 p-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-800">{doc?.title ?? 'Informations légales'}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {!doc ? (
            <p className="text-gray-500">Document introuvable.</p>
          ) : (
            <>
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs leading-5 text-amber-800">
                  ⚖️ Modèle à faire valider par un juriste. Les éléments entre crochets […] sont à compléter.
                </p>
              </div>

              {doc.intro && <p className="text-sm leading-6 text-gray-700">{doc.intro}</p>}

              {doc.sections.map((s) => (
                <div key={s.heading} className="mt-5">
                  <h3 className="text-base font-bold text-gray-800">{s.heading}</h3>
                  {s.paragraphs.map((para, i) => (
                    <p key={i} className="mt-1.5 text-sm leading-6 text-gray-700">{para}</p>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
