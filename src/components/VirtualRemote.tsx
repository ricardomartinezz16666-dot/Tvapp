import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Power,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Smartphone,
  Tv,
  List,
  Sliders,
  X,
} from 'lucide-react';

interface VirtualRemoteProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchMode?: () => void;
  isSmartTv?: boolean;
}

export const VirtualRemote: React.FC<VirtualRemoteProps> = ({
  isOpen,
  onClose,
  onSwitchMode,
  isSmartTv = false,
}) => {
  if (!isOpen) return null;

  // Dispatch real keyboard events to window so SmartTvView and browser handlers respond
  const sendKey = (key: string, keyCode: number) => {
    const event = new KeyboardEvent('keydown', {
      key,
      code: key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-center">
      {/* Remote Chassis */}
      <div className="bg-neutral-900/95 border-2 border-neutral-700/80 rounded-3xl p-4 shadow-2xl w-64 backdrop-blur-md flex flex-col items-center select-none text-neutral-200">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-300">
              Control Remoto TV
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Remote Action Keys (Power, Mode, Mute) */}
        <div className="grid grid-cols-3 gap-2 w-full my-3">
          <button
            onClick={() => sendKey('Power', 170)}
            className="py-2 bg-red-950/80 border border-red-800/80 text-red-400 hover:bg-red-900 rounded-lg flex items-center justify-center active:scale-95"
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={onSwitchMode}
            title="Cambiar Modo Móvil / Smart TV"
            className="py-2 bg-neutral-800 border border-neutral-700 text-amber-400 hover:bg-neutral-700 rounded-lg flex items-center justify-center text-xs font-bold active:scale-95"
          >
            {isSmartTv ? <Smartphone className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
          </button>
          <button
            onClick={() => sendKey('m', 77)}
            className="py-2 bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 rounded-lg flex items-center justify-center active:scale-95"
          >
            <VolumeX className="w-4 h-4" />
          </button>
        </div>

        {/* Circular D-Pad */}
        <div className="relative w-44 h-44 my-2 flex items-center justify-center">
          {/* Circular ring background */}
          <div className="absolute inset-0 rounded-full bg-neutral-950 border-2 border-neutral-700 shadow-inner" />

          {/* D-Pad Up */}
          <button
            onClick={() => sendKey('ArrowUp', 38)}
            className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-12 flex items-center justify-center text-neutral-300 hover:text-amber-400 active:scale-95 transition-all"
          >
            <ChevronUp className="w-6 h-6" />
          </button>

          {/* D-Pad Down */}
          <button
            onClick={() => sendKey('ArrowDown', 40)}
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-14 h-12 flex items-center justify-center text-neutral-300 hover:text-amber-400 active:scale-95 transition-all"
          >
            <ChevronDown className="w-6 h-6" />
          </button>

          {/* D-Pad Left */}
          <button
            onClick={() => sendKey('ArrowLeft', 37)}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-12 h-14 flex items-center justify-center text-neutral-300 hover:text-amber-400 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* D-Pad Right */}
          <button
            onClick={() => sendKey('ArrowRight', 39)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-12 h-14 flex items-center justify-center text-neutral-300 hover:text-amber-400 active:scale-95 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* OK / Enter Center Button */}
          <button
            onClick={() => sendKey('Enter', 13)}
            className="w-16 h-16 rounded-full bg-amber-400 text-black font-extrabold text-sm shadow-md hover:bg-amber-300 active:scale-90 transition-all z-10 flex items-center justify-center"
          >
            OK
          </button>
        </div>

        {/* Back and Home buttons */}
        <div className="grid grid-cols-2 gap-3 w-full my-2">
          <button
            onClick={() => sendKey('Escape', 27)}
            className="py-2 px-3 bg-neutral-800 border border-neutral-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:bg-neutral-700 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Atrás</span>
          </button>
          <button
            onClick={() => sendKey('Enter', 13)}
            className="py-2 px-3 bg-neutral-800 border border-neutral-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 hover:bg-neutral-700 active:scale-95"
          >
            <List className="w-3.5 h-3.5" />
            <span>Guía</span>
          </button>
        </div>

        {/* Channel & Volume Rockers */}
        <div className="grid grid-cols-2 gap-3 w-full my-2">
          {/* Vol +/- */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-1 flex flex-col items-center">
            <button
              onClick={() => sendKey('ArrowUp', 38)}
              className="w-full py-1.5 text-neutral-300 hover:text-white flex items-center justify-center active:scale-95 font-bold text-xs"
            >
              +
            </button>
            <span className="text-[10px] font-bold text-neutral-500 my-0.5">VOL</span>
            <button
              onClick={() => sendKey('ArrowDown', 40)}
              className="w-full py-1.5 text-neutral-300 hover:text-white flex items-center justify-center active:scale-95 font-bold text-xs"
            >
              -
            </button>
          </div>

          {/* CH +/- */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-1 flex flex-col items-center">
            <button
              onClick={() => sendKey('PageUp', 33)}
              className="w-full py-1.5 text-neutral-300 hover:text-white flex items-center justify-center active:scale-95 font-bold text-xs"
            >
              +
            </button>
            <span className="text-[10px] font-bold text-neutral-500 my-0.5">CH</span>
            <button
              onClick={() => sendKey('PageDown', 34)}
              className="w-full py-1.5 text-neutral-300 hover:text-white flex items-center justify-center active:scale-95 font-bold text-xs"
            >
              -
            </button>
          </div>
        </div>

        {/* Number Pad (0-9) */}
        <div className="grid grid-cols-3 gap-1.5 w-full mt-2 pt-2 border-t border-neutral-800">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
            <button
              key={num}
              onClick={() => sendKey(num.toString(), 48 + num)}
              className="py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800/80 rounded-md text-xs font-mono font-bold text-neutral-300 active:scale-95 transition-colors"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
