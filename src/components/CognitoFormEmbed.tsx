import React, { useEffect } from 'react';

interface CognitoFormEmbedProps {
  src: string;
  height?: number | string;
  title?: string;
  allow?: string;
}

const CognitoFormEmbed: React.FC<CognitoFormEmbedProps> = ({
  src,
  height = 800,
  title = 'Cognito Form',
  allow = 'payment',
}) => {
  useEffect(() => {
    // Add the Cognito Forms iframe script once
    const scriptSrc = 'https://www.cognitoforms.com/f/iframe.js';
    const existing = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full">
      <iframe
        src={src}
        allow={allow}
        style={{ border: 0, width: '100%' }}
        height={String(height)}
        title={title}
      />
    </div>
  );
};

export default CognitoFormEmbed;
