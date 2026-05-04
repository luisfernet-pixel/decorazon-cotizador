export default function TabNav({ tabs, activeTab, onTabChange }) {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://decorazon-sistema.vercel.app/";
  const compactTabStyle = {
    minWidth: 0,
    width: "100%",
    padding: "10px 8px",
    textAlign: "center",
  };

  return (
    <div className="tabs">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          className={`tab-btn ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
          type="button"
          style={compactTabStyle}
        >
          {label}
        </button>
      ))}
      <a
        className="tab-btn tab-btn-exit"
        href={portalUrl}
        style={compactTabStyle}
      >
        Salir
      </a>
    </div>
  )
}
