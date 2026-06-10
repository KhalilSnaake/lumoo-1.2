export const OrangeMoneyLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} bg-black rounded-lg flex items-center justify-center p-1 shadow-sm border border-gray-800`}>
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Black background is handled by the parent div */}
      {/* White Arrow (Up-Left) */}
      <path 
        d="M20 50 L50 20 M50 20 L50 35 M50 20 L35 20" 
        stroke="white" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />
      <path 
        d="M20 50 Q20 20 50 20" 
        stroke="white" 
        strokeWidth="12" 
        strokeLinecap="round" 
        fill="none" 
      />
      
      {/* Orange Arrow (Down-Right) */}
      <path 
        d="M80 50 L50 80 M50 80 L50 65 M50 80 L65 80" 
        stroke="#FF7900" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="none" 
      />
      <path 
        d="M80 50 Q80 80 50 80" 
        stroke="#FF7900" 
        strokeWidth="12" 
        strokeLinecap="round" 
        fill="none" 
      />
    </svg>
  </div>
);

export const MoovMoneyLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} bg-[#005CA9] rounded-lg flex flex-col items-center justify-center p-0.5 shadow-sm border border-blue-400`}>
    <div className="text-[7px] font-black text-white italic -mb-1 tracking-tighter uppercase">Moov</div>
    <div className="text-[9px] font-black text-[#FF7900] uppercase">Money</div>
  </div>
);

export const WaveLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} bg-[#1DC1F2] rounded-lg flex items-center justify-center overflow-hidden shadow-sm border border-blue-300`}>
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Wave Penguin Style */}
      {/* Body */}
      <path d="M50 15 C35 15, 25 35, 25 60 C25 80, 35 90, 50 90 C65 90, 75 80, 75 60 C75 35, 65 15, 50 15" fill="black" />
      {/* Belly */}
      <ellipse cx="50" cy="65" rx="18" ry="22" fill="white" />
      {/* Eyes */}
      <circle cx="42" cy="35" r="4" fill="white" />
      <circle cx="58" cy="35" r="4" fill="white" />
      {/* Beak */}
      <path d="M45 42 L55 42 L50 50 Z" fill="#FF7900" />
      {/* Feet */}
      <circle cx="40" cy="88" r="8" fill="#FF7900" />
      <circle cx="60" cy="88" r="8" fill="#FF7900" />
      {/* Waving Hand */}
      <path d="M25 50 Q10 45, 15 30" stroke="black" strokeWidth="8" strokeLinecap="round" fill="none" />
    </svg>
  </div>
);

export const CashLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} bg-green-600 rounded-lg flex items-center justify-center p-1 shadow-sm border border-green-400`}>
    <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10h18v8H3v-8zm0-4h18v2H3V6zm0 14h18v2H3v-2z" opacity=".3"/>
      <path d="M12 11c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
      <path d="M2 4v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2zm18 16H4V4h16v16z"/>
    </svg>
  </div>
);
