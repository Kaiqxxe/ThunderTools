import React from 'react';

/**
 * Item de Navegação da Sidebar com suporte a ícones, estado ativo e brilho neon.
 */
export function NavItem({ icon: Icon, label, active = false, onClick }) {
  return (
    <button
      type="button"
      className={`tt-nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="tt-nav-icon">
        {Icon && <Icon size={17} />}
      </span>
      <span className="tt-nav-label">{label}</span>
    </button>
  );
}
