'use client';

import { useEffect, useRef } from 'react';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { type?: string; theme?: string; size?: string; width?: number; text?: string }
          ) => void;
        };
      };
    };
  }
}

/**
 * Google Identity Services — não signInWithPopup/signInWithRedirect do
 * Firebase. O redirect/popup do Firebase depende de um iframe
 * cross-origin trocando mensagens via postMessage, que o
 * particionamento de armazenamento de terceiros dos navegadores
 * modernos bloqueia estruturalmente (mesma causa raiz documentada no
 * projeto irmão SocialShelf). GIS entrega o ID token direto num
 * callback JS, sem esse canal. Ver _local-edr-policy-008 (amendment).
 */
function isDarkNow(): boolean {
  const stored = document.documentElement.getAttribute('data-theme');
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID ausente — botão do Google não pode ser inicializado.');
      return;
    }

    let cancelled = false;

    function renderButton() {
      if (!window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: isDarkNow() ? 'filled_black' : 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    }

    function init() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId as string,
        callback: (response) => onCredential(response.credential),
      });
      renderButton();
    }

    if (window.google) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!cancelled) init();
      };
      document.body.appendChild(script);
    }

    // Re-renderiza no tamanho/tema oficial do Google quando o usuário troca de tema
    // (o widget do GIS não observa mudança de tema sozinho).
    const observer = new MutationObserver(renderButton);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', renderButton);

    return () => {
      cancelled = true;
      observer.disconnect();
      media.removeEventListener('change', renderButton);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={buttonRef} />;
}
