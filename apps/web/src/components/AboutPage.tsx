import { getLegalDoc } from '@lumoo/core';
import { CheckCircle, MapPin, Phone, Clock, Heart } from 'lucide-react';

export default function AboutPage({ onClose }: { onClose: () => void }) {
  const doc = getLegalDoc('apropos');

  if (!doc) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 text-center">
          <p className="text-gray-500">Page introuvable.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header avec gradient Lumoo */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-3xl p-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">{doc.title}</h1>
            {doc.intro && <p className="text-green-100 text-sm">{doc.intro}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Mission */}
          {doc.sections[0] && (
            <section className="bg-green-50 rounded-2xl p-6 border border-green-100">
              <h2 className="text-2xl font-black text-green-900 mb-4 flex items-center gap-3">
                <Heart className="w-6 h-6 text-green-600" />
                {doc.sections[0].heading}
              </h2>
              {doc.sections[0].paragraphs.map((para, i) => (
                <p key={i} className="text-gray-700 leading-6 mb-2">
                  {para}
                </p>
              ))}
            </section>
          )}

          {/* Valeurs */}
          {doc.sections[1] && (
            <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4">{doc.sections[1].heading}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doc.sections[1].paragraphs.map((value, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-700">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Comment ça marche */}
          {doc.sections[2] && (
            <section className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
              <h2 className="text-2xl font-black text-gray-900 mb-4">{doc.sections[2].heading}</h2>
              <ol className="space-y-3">
                {doc.sections[2].paragraphs.map((step, i) => (
                  <li key={i} className="flex gap-4 items-start">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold text-sm shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-gray-700 leading-6 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Pourquoi Lumoo */}
          {doc.sections[3] && (
            <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4">{doc.sections[3].heading}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doc.sections[3].paragraphs.map((reason, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-green-600 text-lg shrink-0">✓</span>
                    <p className="text-sm text-gray-700">{reason}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Horaires */}
          {doc.sections[4] && (
            <section className="flex items-start gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <Clock className="w-6 h-6 text-blue-600 mt-1 shrink-0" />
              <div>
                <h2 className="text-lg font-black text-gray-900 mb-2">{doc.sections[4].heading}</h2>
                {doc.sections[4].paragraphs.map((line, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-6">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Contact */}
          {doc.sections[5] && (
            <section>
              <h2 className="text-2xl font-black text-gray-900 mb-4">{doc.sections[5].heading}</h2>
              <div className="space-y-3">
                {doc.sections[5].paragraphs.map((contact, i) => {
                  if (contact.startsWith('📞')) {
                    return (
                      <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                        <Phone className="w-5 h-5 text-green-600" />
                        <p className="text-gray-700 font-medium">{contact.replace('📞 ', '')}</p>
                      </div>
                    );
                  }
                  if (contact.startsWith('📧')) {
                    return (
                      <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-700 font-medium">{contact.replace('📧 ', '')}</p>
                      </div>
                    );
                  }
                  if (contact.startsWith('📍')) {
                    return (
                      <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <MapPin className="w-5 h-5 text-green-600" />
                        <p className="text-gray-700 font-medium">{contact.replace('📍 ', '')}</p>
                      </div>
                    );
                  }
                  return (
                    <p key={i} className="text-sm text-gray-700 leading-6">
                      {contact}
                    </p>
                  );
                })}
              </div>
            </section>
          )}

          {/* Équipe */}
          {doc.sections[6] && (
            <section className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl p-6 border border-green-300 text-center">
              <h2 className="text-2xl font-black text-gray-900 mb-3">{doc.sections[6].heading}</h2>
              {doc.sections[6].paragraphs.map((para, i) => (
                <p key={i} className="text-gray-700 leading-6">
                  {para}
                </p>
              ))}
            </section>
          )}

          {/* CTA Fermer */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
