import React, { useRef } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function MaliPhoneInput({ value, onChange, id, placeholder = "84 00 72 00", className = "", required = false }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = value.replace(/^\+223\s*/, '').replace(/\D/g, '').slice(0, 8);
  const displayValue = digits.match(/.{1,2}/g)?.join(' ') ?? '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const input = rawValue.replace(/^\+223\s*/, '').replace(/\D/g, '').slice(0, 8);
    const digitsBeforeCursor = rawValue.slice(0, e.target.selectionStart ?? rawValue.length).replace(/\D/g, '').slice(0, 8).length;
    const formattedCursor = digitsBeforeCursor + Math.max(0, Math.ceil(digitsBeforeCursor / 2) - 1);

    onChange(input ? `+223 ${input}` : '');
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(formattedCursor, formattedCursor));
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
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        autoComplete="tel-national"
        maxLength={11}
        className="w-full min-h-11 pl-24 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-green-600 focus:bg-white outline-none transition-colors duration-200"
      />
      
      {/* 8-digits indicator (optional visual hint) */}
      <div aria-hidden="true" className="absolute right-3 text-xs font-semibold text-gray-600 pointer-events-none">
        {digits.length}/8
      </div>
    </div>
  );
}
