'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface ThemedDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export default function ThemedDropdown({
  value,
  options,
  onChange,
  placeholder = 'Pilih opsi...',
  disabled = false,
  ariaLabel,
  size = 'md',
  className = '',
}: ThemedDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(260, Math.max(88, options.length * 36 + 16));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 180) - 8)),
      width: Math.max(rect.width, 168),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, options.length]);

  const sizeClasses =
    size === 'xs'
      ? 'rounded-lg px-2.5 py-1.5 text-xs'
      : size === 'sm'
      ? 'rounded-xl px-3 py-2 text-xs'
      : 'rounded-xl px-3.5 py-2.5 text-sm';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 border border-[#4A2E1B]/20 bg-[#FFFCF7] text-left font-medium text-[#241A13] shadow-2xs transition hover:border-[#4A2E1B]/45 focus:border-[#4A2E1B] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} ${
          open ? 'border-[#4A2E1B] ring-2 ring-[#4A2E1B]/12' : ''
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[#7A5230] transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={menuStyle}
            onMouseDown={(e) => e.stopPropagation()}
            className="orihour-scroll z-[130] max-h-64 overflow-y-auto rounded-2xl border border-[#D8C5AC] bg-[#FAF5EC] p-1.5 shadow-[0_20px_50px_-14px_rgba(36,26,19,0.34)]"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#8A7360]">Tidak ada pilihan</div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'bg-[#4A2E1B] font-semibold text-[#FAF5EC]'
                        : 'font-medium text-[#2E2017] hover:bg-[#EFE4D3]'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#E6C79C]" />}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}