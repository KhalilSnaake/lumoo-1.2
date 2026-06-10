import React from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function MaliPhoneInput({ value, onChange, placeholder = "77 99 68 58", className = "", required = false }: PhoneInputProps) {
  // Extract only the 8 digits
  const displayValue = value.replace('+223 ', '').replace(/\s/g, '').slice(0, 8);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, ''); // Keep only digits
    if (input.length > 8) input = input.slice(0, 8); // Limit to 8 digits
    
    // Always store full international format in state: +223 XXXXXXXX
    onChange(input ? `+223 ${input}` : '');
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Mali Flag + Prefix */}
      <div className="absolute left-0 h-full flex items-center pl-3 pointer-events-none">
        <div className="flex items-center gap-2 border-r border-gray-200 pr-2.5 h-6">
          {/* Custom SVG Mali Flag: Green-Yellow-Red */}
          <div className="flex w-6 h-4 rounded-sm overflow-hidden shadow-sm ring-1 ring-black/5">
            <div className="w-1/3 h-full bg-[#14B53A]"></div> {/* Green */}
            <div className="w-1/3 h-full bg-[#FCD116]"></div> {/* Yellow */}
            <div className="w-1/3 h-full bg-[#CE1126]"></div> {/* Red */}
          </div>
          <span className="text-sm font-black text-gray-500 tracking-tighter">+223</span>
        </div>
      </div>
      
      <input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        autoComplete="tel-national"
        className="w-full pl-20 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all"
      />
      
      {/* 8-digits indicator (optional visual hint) */}
      <div className="absolute right-3 text-[8px] font-bold text-gray-300 uppercase tracking-widest pointer-events-none">
        {displayValue.length}/8
      </div>
    </div>
  );
}
