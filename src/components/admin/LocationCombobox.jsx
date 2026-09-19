import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Loader2 } from 'lucide-react';

/**
 * LocationCombobox
 *
 * Accessible, keyboard-navigable, searchable combobox designed for
 * Country -> State -> City cascading selection with dark/glassmorphic styling.
 */
export default function LocationCombobox({
  id,
  label,
  required = false,
  value = '',
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  disabledReason = '',
  loading = false,
  helperText = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.name && opt.name.toLowerCase().includes(q));
  }, [options, searchQuery]);

  // Cap DOM rendering to avoid rendering thousands of items into DOM at once
  const MAX_VISIBLE = 100;
  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, MAX_VISIBLE);
  }, [filteredOptions]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input and reset highlighted index on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[highlightedIndex];
      if (activeEl && activeEl.scrollIntoView) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const selectOption = (option) => {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSearchQuery('');
  };

  const handleKeyDown = (e) => {
    if (disabled || loading) return;

    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < visibleOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : visibleOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
        selectOption(visibleOptions[highlightedIndex]);
      }
    }
  };

  return (
    <div className={`relative ${isOpen ? 'z-30' : 'z-10'}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Label */}
      {label && (
        <label
          htmlFor={`${id}-trigger`}
          className="block text-xs font-semibold text-slate-300 mb-1.5"
        >
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={`${id}-trigger`}
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-disabled={disabled || loading}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between gap-2 ${
          disabled
            ? 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
            : isOpen
            ? 'bg-slate-800 border-amber-400 ring-1 ring-amber-400 text-white'
            : 'bg-slate-800/80 border-slate-700 hover:border-slate-600 text-white'
        }`}
      >
        <span className={`truncate flex-1 ${!value ? 'text-slate-500' : 'text-slate-200 font-medium'}`}>
          {loading ? 'Loading locations...' : value || placeholder}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {loading && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}

          {!loading && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e)}
              title="Clear selection"
              aria-label={`Clear ${label || 'selection'}`}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}

          {!loading && (
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-amber-400' : ''
              }`}
            />
          )}
        </div>
      </button>

      {/* Helper / Disabled explanation */}
      {disabled && disabledReason && (
        <p className="text-[10px] text-slate-500 mt-1">{disabledReason}</p>
      )}
      {!disabled && helperText && (
        <p className="text-[10px] text-slate-500 mt-1">{helperText}</p>
      )}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          id={`${id}-dropdown`}
          className="absolute left-0 right-0 z-[130] mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
        >
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={`Search ${label || 'options'}...`}
                className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          </div>

          {/* Listbox */}
          <ul
            id={`${id}-listbox`}
            ref={listboxRef}
            role="listbox"
            aria-labelledby={`${id}-trigger`}
            className="max-h-56 overflow-y-auto py-1 divide-y divide-slate-800/40"
          >
            {visibleOptions.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400 select-none">
                No locations found matching &ldquo;{searchQuery}&rdquo;
              </li>
            ) : (
              visibleOptions.map((opt, index) => {
                const isSelected = value === opt.name;
                const isHighlighted = highlightedIndex === index;
                return (
                  <li
                    key={opt.isoCode || opt.name || index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-amber-500/15 text-amber-300 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{opt.name}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Item count / Refinement helper if capped */}
          {filteredOptions.length > MAX_VISIBLE && (
            <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 text-center select-none">
              Showing top {MAX_VISIBLE} of {filteredOptions.length} matches. Type to refine.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
