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
        showToast("Position GPS enregistrée ✅");
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
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all ${
          currentLat && currentLng 
            ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-600'
        }`}
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <span>Localisation en cours...</span>
          </>
        ) : (
          <>
            <span className="text-lg">📍</span>
            <span>{currentLat && currentLng ? 'Position GPS partagée ✅' : 'Partager ma position GPS'}</span>
          </>
        )}
      </button>
      {currentLat && currentLng && (
        <p className="text-[10px] text-gray-400 mt-1 text-center italic">
          Coordonnées : {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
        </p>
      )}
    </div>
  );
}
