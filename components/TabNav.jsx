import { Boxes, FileText, FolderKanban, History, Home, ListTree, LogOut, PackageSearch, Users } from 'lucide-react'

export default function TabNav({ tabs, activeTab, onTabChange }) {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://decorazon-sistema.vercel.app/";
  const compactTabStyle = {
    minWidth: 0,
    width: "100%",
    padding: "10px 8px",
    textAlign: "center",
  };
  const tabIcons = {
    inicio: Home,
    proyecto: FolderKanban,
    clientes: Users,
    items: Boxes,
    subitems: ListTree,
    recursos: PackageSearch,
    cotizacion: FileText,
    historial: History,
  }

  return (
    <div className="tabs">
      {tabs.map(([id, label]) => {
        const Icon = tabIcons[id] || Home
        return (
          <button
            key={id}
            className={`tab-btn tab-btn-${id} ${activeTab === id ? 'active' : ''}`}
            onClick={() => onTabChange(id)}
            type="button"
            style={compactTabStyle}
          >
            <span className="tab-btn-inner">
              <Icon size={16} />
              <span>{label}</span>
            </span>
          </button>
        )
      })}
      <a
        className="tab-btn tab-btn-exit"
        href={portalUrl}
        style={compactTabStyle}
      >
        <span className="tab-btn-inner">
          <LogOut size={16} />
          <span>Salir</span>
        </span>
      </a>
    </div>
  )
}
