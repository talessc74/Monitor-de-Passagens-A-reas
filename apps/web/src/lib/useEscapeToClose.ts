import { useEffect } from 'react';

/** Fecha um modal/overlay ao pressionar Esc — acessibilidade de teclado. */
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}
