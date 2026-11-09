import React from 'react';
import { NavItem } from './NavItem';
import {
  Home,
  Printer,
  RefreshCw,
  Zap,
  HardDrive,
  Globe,
  Settings,
  Shield,
  Terminal,
  Package,
  History,
  Star
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'impressao', label: 'Impressão', icon: Printer },
  { id: 'atualizacao', label: 'Windows Update', icon: RefreshCw },
  { id: 'desempenho', label: 'Desempenho', icon: Zap },
  { id: 'disco', label: 'Disco', icon: HardDrive },
  { id: 'rede', label: 'Rede', icon: Globe },
  { id: 'sistema', label: 'Sistema', icon: Settings },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
  { id: 'avancado', label: 'Avançado', icon: Terminal },
  { id: 'programas', label: 'Programas', icon: Package }
];

const SECONDARY_ITEMS = [
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'favoritos', label: 'Favoritos', icon: Star }
];

export function Sidebar({ activeTab = 'inicio', onSelectTab }) {
  return (
    <aside className="tt-sidebar">
      <nav className="tt-sidebar-nav">
        {MENU_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => onSelectTab && onSelectTab(item.id)}
          />
        ))}

        <div className="tt-nav-divider" />

        {SECONDARY_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id}
            onClick={() => onSelectTab && onSelectTab(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
