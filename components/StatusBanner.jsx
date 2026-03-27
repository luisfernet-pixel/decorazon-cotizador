export default function StatusBanner({ connected }) {
  return (
    <div className="card" style={{ border: connected ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
      <div className="badge">Estado</div>
      <h3>{connected ? 'Supabase configurado' : 'Supabase pendiente'}</h3>
      <p style={{ color: '#64748b', marginBottom: 0 }}>
        {connected
          ? 'La app ya detecta variables de entorno y está lista para conectar datos reales.'
          : 'Falta pegar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el archivo .env.local.'}
      </p>
    </div>
  );
}
