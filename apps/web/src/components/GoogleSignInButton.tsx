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
export default function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID ausente — botão do Google não pode ser inicializado.');
      return;
    }

    function init() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId as string,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
      });
    }

    if (window.google) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={buttonRef} />;
}
