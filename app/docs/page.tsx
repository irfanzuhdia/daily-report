'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// SwaggerUI requires window, so we must dynamically import it
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="bg-white min-h-screen">
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
