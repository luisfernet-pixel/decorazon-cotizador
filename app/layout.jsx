import './globals.css';

export const metadata = {
  title: 'DecoraZon Cotizador',
  description: 'Cotizador con Supabase para DecoraZon',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
