import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function AdminLayout({ children, title }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path ? 'active' : '';

    return (
        <div className="admin-layout">
            <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src="/logo.jpg" alt="Trinitas Logística" className="sidebar-logo-img" />
                </div>
                <nav className="nav-menu">
                    <ul>
                        <li>
                            <Link to="/" className={isActive('/')}>
                                <span className="icon">📊</span> Dashboard / Info
                            </Link>
                        </li>
                        <li>
                            <Link to="/upload" className={isActive('/upload')}>
                                <span className="icon">📤</span> Subir Notificaciones
                            </Link>
                        </li>
                        <li>
                            <Link to="/notifications" className={isActive('/notifications')}>
                                <span className="icon">📋</span> Notificaciones
                            </Link>
                        </li>
                        <li>
                            <Link to="/reports" className={isActive('/reports')}>
                                <span className="icon">📊</span> Relación de Carga
                            </Link>
                        </li>
                        <li>
                            <Link to="/streets" className={isActive('/streets')}>
                                <span className="icon">🛣️</span> Calles / BD
                            </Link>
                        </li>
                        <li>
                            <Link to="/demarcations" className={isActive('/demarcations')}>
                                <span className="icon">🗺️</span> Demarcaciones
                            </Link>
                        </li>
                        <li>
                            <Link to="/receipts" className={isActive('/receipts')}>
                                <span className="icon">📄</span> Historial / Acuses
                            </Link>
                        </li>
                        <li>
                            <Link to="/users" className={isActive('/users')}>
                                <span className="icon">👥</span> Empleados
                            </Link>
                        </li>
                    </ul>
                </nav>
                <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
                    {user && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>👤 {user.name}</div>}
                    <button onClick={handleLogout} style={{
                        width: '100%', padding: '10px', background: 'rgba(231,76,60,0.15)', color: '#e74c3c',
                        border: '1px solid rgba(231,76,60,0.3)', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(231,76,60,0.3)'; }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(231,76,60,0.15)'; }}
                    >
                        🚪 Cerrar Sesión
                    </button>
                </div>
            </aside>
            
            <div className="main-wrapper">
                <header className="mobile-topbar">
                    <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                        ☰
                    </button>
                    <h2>{title}</h2>
                </header>

                <main className="main-content">
                    <header className="desktop-topbar">
                        <h2>{title}</h2>
                    </header>
                    <div className="dashboard-content">
                        {children}
                    </div>
                </main>
            </div>

            {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}
        </div>
    );
}
