import { useState } from 'react';
import { useToast } from '../context/ToastContext';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  currentLat?: number;
  currentLng?: number;
}

export default function LocationPicker({ onLocationSelect, currentLat, currentLng }: LocationPickerProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast("La géolocalisation n'est pas supportée par votre navigateur", "error");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSelect(latitude, longitude);
        setLoading(false);
        showToast("Position récupérée. Enregistrez pour la conserver.");
      },
      (error) => {
        setLoading(false);
        let msg = "Erreur lors de la récupération de la position";
        if (error.code === 1) msg = "Veuillez autoriser l'accès à la localisation";
        showToast(msg, "error");
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={loading}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
          currentLat != null && currentLng != null
            ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
            : 'bg-gray-50 border-gray-300 text-gray-800 hover:border-green-600 hover:text-green-800'
        }`}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <span>Localisation en cours...</span>
          </>
        ) : (
          <>
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1116 0z" />
              <circle cx="12" cy="10" r="2.5" strokeWidth={2} />
            </svg>
            <span>{currentLat != null && currentLng != null ? 'Mettre à jour ma position GPS' : 'Ajouter ma position GPS'}</span>
          </>
        )}
      </button>
      {currentLat != null && currentLng != null && (
        <p className="mt-2 text-center text-sm text-gray-700">
          Coordonnées : {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
        </p>
      )}
    </div>
  );
}
