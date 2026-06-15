export default function Testimonials() {
  const reviews = [
    {
      name: 'Aminata D.',
      city: 'Bamako',
      avatar: '👩🏽',
      rating: 5,
      text: 'Service excellent ! J\'ai reçu mes légumes frais en moins de 3 heures. La qualité est au rendez-vous.',
    },
    {
      name: 'Ibrahim K.',
      city: 'Sikasso',
      avatar: '👨🏾',
      rating: 5,
      text: 'Très pratique pour faire mes courses sans me déplacer. Le paiement par Orange Money est super facile.',
    },
    {
      name: 'Fatoumata S.',
      city: 'Bamako',
      avatar: '👩🏿',
      rating: 4,
      text: 'Les prix sont compétitifs et la livraison rapide. Je commande toutes les semaines maintenant !',
    },
    {
      name: 'Moussa T.',
      city: 'Ségou',
      avatar: '👨🏽',
      rating: 5,
      text: 'Le meilleur service de livraison au Mali. Produits de qualité et équipe très professionnelle.',
    },
  ];

  return (
    <section className="bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">
            Ce que disent nos clients
          </h2>
          <p className="text-sm text-gray-400">Plus de 500 clients satisfaits au Mali</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reviews.map((review, idx) => (
            <div
              key={idx}
              className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-200'}>
                    ★
                  </span>
                ))}
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                "{review.text}"
              </p>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">
                  {review.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{review.name}</p>
                  <p className="text-[10px] text-gray-400">📍 {review.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
