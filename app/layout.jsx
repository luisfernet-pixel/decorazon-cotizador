import './globals.css';

export const metadata = {
  title: 'DecoraZon Cotizador',
  description: 'Cotizador con Supabase para DecoraZon',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
