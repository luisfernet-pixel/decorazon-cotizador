export default function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <div className="tabs">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          className={`tab-btn ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
          type="button"
        >
          {label}
        </button>
      ))}
      <a
        className="tab-btn"
        href="https://finanzasdecorazon.vercel.app/"
      >
        Salir
      </a>
    </div>
  )
}
