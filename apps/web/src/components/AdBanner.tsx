import { useAds } from '@lumoo/core';
import type { AdPosition } from '@lumoo/core';

export default function AdBanner({ position }: { position: AdPosition }) {
  const { ads, loading } = useAds();
  
  if (loading) return null;

  const activeAds = ads.filter(ad => ad.position === position && ad.active);
  if (activeAds.length === 0) return null;
  
  // Pick one random ad
  const ad = activeAds[Math.floor(Math.random() * activeAds.length)];

  return (
    <div className={`w-full overflow-hidden rounded-3xl shadow-sm border border-gray-100 bg-white group transition-all hover:shadow-md ${
      position === 'top' ? 'mb-8' : 'my-10'
    }`}>
      <div className="relative aspect-[16/6] sm:aspect-[21/6] w-full bg-gray-50 overflow-hidden">
        <img 
          src={ad.image_url} 
          alt={ad.title} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
        />
        {/* Overlay info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
          <p className="text-white text-sm font-black uppercase tracking-widest">{ad.title}</p>
        </div>
        {/* Link Button if exists */}
        {ad.link_url && (
          <a 
            href={ad.link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="absolute inset-0 z-10"
          />
        )}
        <div className="absolute top-3 right-3 bg-white/30 backdrop-blur-md text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter border border-white/20">
          Publicité
        </div>
      </div>
    </div>
  );
}
