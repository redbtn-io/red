'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  presets?: string[];
}

const DEFAULT_PRESETS = [
  '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
  '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316',
  '#ef4444', '#ec4899', '#d946ef', '#6b7280',
];

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  h = h / 360;
  s = s / 100;
  v = v / 100;

  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToHex(h: number): string {
  return hsvToHex(h, 100, 100);
}

export function ColorPicker({ value, onChange, disabled, presets = DEFAULT_PRESETS }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value || '#a855f7'));
  const [hexInput, setHexInput] = useState(value || '#a855f7');
  const [dropdownPosition, setDropdownPosition] = useState<{ top?: number; left?: number }>({});
  
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerWidth = Math.min(280, window.innerWidth - 32);
      const pickerHeight = 380; // Approximate height
      
      let left = rect.left;
      let top = rect.bottom + 8;
      
      // Ensure it doesn't go off right edge
      if (left + pickerWidth > window.innerWidth - 16) {
        left = window.innerWidth - pickerWidth - 16;
      }
      // Ensure it doesn't go off left edge
      if (left < 16) {
        left = 16;
      }
      // If it would go off bottom, position above
      if (top + pickerHeight > window.innerHeight - 16) {
        top = rect.top - pickerHeight - 8;
      }
      // Ensure it doesn't go off top
      if (top < 16) {
        top = 16;
      }
      
      setDropdownPosition({ top, left });
    }
  }, [isOpen]);

  // Update internal state when value prop changes
  useEffect(() => {
    if (value && value !== hsvToHex(hsv.h, hsv.s, hsv.v)) {
      setHsv(hexToHsv(value));
      setHexInput(value);
    }
  }, [value]);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const updateColor = useCallback((newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSaturationMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const updateFromEvent = (clientX: number, clientY: number) => {
      const rect = saturationRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      
      updateColor({ ...hsv, s: x * 100, v: (1 - y) * 100 });
    };
    
    updateFromEvent(e.clientX, e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => updateFromEvent(e.clientX, e.clientY);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    
    const updateFromEvent = (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      updateColor({ ...hsv, h: x * 360 });
    };
    
    updateFromEvent(e.clientX);
    
    const handleMouseMove = (e: MouseEvent) => updateFromEvent(e.clientX);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setHsv(hexToHsv(val));
      onChange(val.toLowerCase());
    }
  };

  const handlePresetClick = (preset: string) => {
    setHsv(hexToHsv(preset));
    setHexInput(preset);
    onChange(preset);
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-primary
          hover:border-border-hover transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div 
          className="w-6 h-6 rounded-md border border-white/20"
          style={{ backgroundColor: value }}
        />
        <span className="text-sm text-text-secondary font-mono">{value}</span>
      </button>

      {/* Picker dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-50 p-3 rounded-xl bg-bg-secondary border border-border shadow-xl shadow-black/50"
            style={{ 
              width: Math.min(280, window.innerWidth - 32),
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {/* Saturation/Value picker */}
            <div
              ref={saturationRef}
              className="relative w-full h-40 rounded-lg cursor-crosshair overflow-hidden"
              style={{ backgroundColor: hueToHex(hsv.h) }}
              onMouseDown={handleSaturationMouseDown}
            >
              {/* White gradient (saturation) */}
              <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
              {/* Black gradient (value) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
              {/* Picker handle */}
              <div
                className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  backgroundColor: value,
                }}
              />
            </div>

            {/* Hue slider */}
            <div
              ref={hueRef}
              className="relative w-full h-3 mt-3 rounded-full cursor-pointer overflow-hidden"
              style={{
                background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
              }}
              onMouseDown={handleHueMouseDown}
            >
              <div
                className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: hueToHex(hsv.h),
                }}
              />
            </div>

            {/* Hex input and preview */}
            <div className="flex items-center gap-2 mt-3">
              <div 
                className="w-10 h-10 rounded-lg border border-border flex-shrink-0"
                style={{ backgroundColor: value }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <Pipette className="w-3 h-3 text-text-muted" />
                  <span className="text-xs text-text-muted">HEX</span>
                </div>
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexChange}
                  className="w-full bg-bg-primary border border-border rounded px-2 py-1 text-sm text-text-primary font-mono uppercase focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Preset colors */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-text-muted mb-2">Presets</div>
              <div className="grid grid-cols-8 gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`
                      w-6 h-6 rounded transition-transform hover:scale-110
                      ${value === preset ? 'ring-2 ring-white ring-offset-1 ring-offset-bg-secondary' : ''}
                    `}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
