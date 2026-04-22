import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function NotificationsList() {
    const [notifications, setNotifications] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [notifRes, usersRes] = await Promise.all([
                    apiClient.get('/notifications/list'),
                    apiClient.get('/users')
                ]);
                if (notifRes.data.success) setNotifications(notifRes.data.data);
                if (usersRes.data.success) setUsers(usersRes.data.data.filter(u => u.role === 'REPARTIDOR'));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleReassign = async (notificationId, newUserId) => {
        try {
            const res = await apiClient.put('/notifications/reassign', {
                notification_id: notificationId,
                user_id: newUserId || null
            });
            if (res.data.success) {
                setNotifications(prev => prev.map(n => {
                    if (n.id === notificationId) {
                        const user = users.find(u => u.id === parseInt(newUserId));
                        return { ...n, assigned_user_id: newUserId ? parseInt(newUserId) : null, assigned_user_name: user?.name || null };
                    }
                    return n;
                }));
            }
        } catch (err) {
            console.error(err);
            alert('Error al reasignar');
        }
    };

    const handleReassignAll = async () => {
        if (!window.confirm('¿Reasignar todas las notificaciones según las demarcaciones actuales?')) return;
        try {
            const res = await apiClient.post('/notifications/reassign-all');
            if (res.data.success) {
                alert(`Se actualizaron ${res.data.updated} de ${res.data.total} notificaciones.`);
                // Reload data
                setLoading(true);
                const notifRes = await apiClient.get('/notifications/list');
                if (notifRes.data.success) setNotifications(notifRes.data.data);
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            alert('Error al reasignar');
        }
    };

    const viewDetails = async (id) => {
        if (detailLoading) return;
        setDetailLoading(id); // Store ID of loading item
        try {
            const res = await apiClient.get(`/notifications/details/${id}`);
            if (res.data.success) {
                setSelectedDetail(res.data.data);
            }
        } catch (err) {
            console.error(err);
            alert('Error al cargar detalles');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDownloadPdf = async (id) => {
        try {
            const res = await apiClient.get(`/notifications/generate-pdf/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `acuse_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Error downloading PDF", err);
            alert('Error al descargar el PDF');
        }
    };

    const filtered = notifications.filter(n => {
        const matchesSearch = !search || 
            n.id.includes(search) ||
            n.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
            n.full_address.toLowerCase().includes(search.toLowerCase()) ||
            (n.street_name && n.street_name.toLowerCase().includes(search.toLowerCase()));
        const matchesUser = !filterUser || String(n.assigned_user_id) === filterUser;
        const matchesStatus = !filterStatus || n.status === filterStatus;
        return matchesSearch && matchesUser && matchesStatus;
    });

    const statusLabels = {
        'PENDING': { label: 'Pendiente', color: '#e67e22' },
        'ATTEMPT_1': { label: '1er Intento', color: '#3498db' },
        'DELIVERED': { label: 'Entregada', color: '#27ae60' },
        'RETURNED': { label: 'Devuelta', color: '#e74c3c' },
        'FAILED': { label: 'Fallida', color: '#95a5a6' },
    };

    // Group by user for summary
    const userSummary = {};
    notifications.forEach(n => {
        const key = n.assigned_user_name || 'Sin asignar';
        if (!userSummary[key]) userSummary[key] = 0;
        userSummary[key]++;
    });

    return (
        <AdminLayout title="Listado de Notificaciones">
            <style>{`
                .notif-list-filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-end; }
                .notif-list-filters .filter-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; }
                .notif-list-filters label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
                .notif-list-filters input, .notif-list-filters select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; }
                .notif-list-filters input:focus, .notif-list-filters select:focus { border-color: #1a6fb5; outline: none; box-shadow: 0 0 0 3px rgba(26,111,181,0.12); }

                .summary-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
                .summary-pill { background: #f8f9fa; border: 1px solid #e8e8e8; border-radius: 20px; padding: 6px 14px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; }
                .summary-pill .dot { width: 8px; height: 8px; border-radius: 50%; }
                .summary-pill .count { font-weight: 700; }                .notif-list-cards { display: flex; flex-direction: column; gap: 16px; }
                .notif-list-card { 
                    background: #fff; 
                    border: 1px solid #edf2f7; 
                    border-radius: 16px; 
                    padding: 20px 24px; 
                    display: grid; 
                    grid-template-columns: 80px 1.5fr 2fr 1.2fr 1.2fr 1fr; 
                    gap: 24px; 
                    align-items: center; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    border-left: 6px solid transparent;
                    position: relative;
                }
                .notif-list-card:hover { 
                    transform: translateY(-4px); 
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    border-color: #e2e8f0; 
                }
                .notif-list-card.border-warning { border-left-color: #f6ad55; background: #fffcf9; }
                .notif-list-card.border-expired { border-left-color: #fc8181; background: #fffafb; }
                
                .expiration-badge { 
                    margin-top: 5px; 
                    display: inline-flex; 
                    align-items: center;
                    padding: 2px 8px; 
                    border-radius: 4px; 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    letter-spacing: 0.025em; 
                }
                .expiration-badge.warning { background: #feebc8; color: #9c4221; }
                .expiration-badge.expired { background: #fed7d7; color: #9b2c2c; }

                .notif-list-card .col { display: flex; flex-direction: column; gap: 6px; }
                .status-button-wrapper { display: flex; align-items: center; gap: 16px; margin-top: 2px; }
                .status-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 120px; }
                
                .notif-list-card .fl { 
                    font-size: 0.65rem; 
                    color: #718096; 
                    text-transform: uppercase; 
                    letter-spacing: 0.05em; 
                    font-weight: 700; 
                }
                .notif-list-card .fv { 
                    font-size: 0.95rem; 
                    color: #1a202c; 
                    font-weight: 600; 
                    word-break: break-word; 
                    line-height: 1.4; 
                }
                .notif-list-card .fv.id-text { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em; }
                .notif-list-card .fv.muted { color: #a0aec0; font-style: italic; font-weight: 400; }

                .status-badge { 
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 12px; 
                    border-radius: 8px; 
                    font-size: 0.75rem; 
                    font-weight: 800; 
                    color: #fff; 
                    text-align: center;
                    width: 100%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                }

                .reassign-select { 
                    width: 100%; 
                    padding: 8px 12px; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 10px; 
                    font-size: 0.85rem; 
                    background: #f7fafc; 
                    cursor: pointer; 
                    color: #2d3748;
                    font-weight: 500;
                    transition: all 0.2s;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234A5568'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    background-size: 14px;
                }
                .reassign-select:hover { border-color: #cbd5e0; background-color: #fff; }
                .reassign-select:focus { border-color: #3182ce; background: #fff; outline: none; box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15); }

                .toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
                .btn-reassign-all { background: #3182ce; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(49, 130, 206, 0.3); }
                .btn-reassign-all:hover { background: #2b6cb0; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(49, 130, 206, 0.4); }

                .btn-view { 
                    background: #f1f5f9; 
                    color: #4a5568; 
                    border: 1px solid #e2e8f0; 
                    width: 36px; 
                    height: 36px; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 1rem;
                    user-select: none;
                }
                .btn-view:hover { background: #3182ce; color: #fff; border-color: #3182ce; }
                .btn-view:active { transform: translateY(1px); }
                .btn-view:disabled { background: #f7fafc; color: #cbd5e0; border-color: #edf2f7; cursor: not-allowed; }

                /* Modal Styles */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; backdrop-filter: blur(8px); }
                .modal-content { background: #fff; border-radius: 20px; width: 100%; max-width: 700px; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative; animation: modalAnim 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                @keyframes modalAnim { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                .modal-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; z-index: 20; }
                .modal-header h2 { margin: 0; font-size: 1.2rem; color: #1e293b; font-weight: 800; }
                .btn-close { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
                .btn-close:hover { background: #e2e8f0; color: #0f172a; }
                
                .btn-download-pdf { background: #10b981; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 6px rgba(16,185,129,0.2); }
                .btn-download-pdf:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 6px 12px rgba(16,185,129,0.3); }

                .modal-body { padding: 24px; }
                
                .detail-section { margin-bottom: 28px; }
                .detail-section h3 { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
                .detail-section h3::after { content: ''; flex: 1; height: 1px; background: #f1f5f9; }

                .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; }
                .detail-item label { display: block; font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
                .detail-item span { display: block; font-size: 0.95rem; color: #1e293b; font-weight: 600; line-height: 1.4; }

                .attempt-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #fff; }
                .attempt-card.delivered { border-left: 5px solid #10b981; background: #f0fdf4; }
                .attempt-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
                .attempt-number { font-weight: 800; color: #1a6fb5; font-size: 0.9rem; background: #eff6ff; padding: 4px 10px; border-radius: 6px; }
                .attempt-date { color: #64748b; font-size: 0.8rem; font-weight: 500; }
                .signature-img { width: 100%; max-width: 400px; height: auto; border: 2px solid #e2e8f0; border-radius: 12px; background: #fff; margin-top: 12px; display: block; }

                    .notif-list-card .card-actions-row-mobile { display: none; }
                }

                @media (max-width: 1200px) {
                    .notif-list-card { grid-template-columns: 80px 1.2fr 1.5fr 1fr 1fr 180px; }
                    .notif-list-card .hide-tablet { display: none; }
                }

                @media (max-width: 768px) {
                    .notif-list-card { 
                        grid-template-columns: 1fr; 
                        gap: 16px; 
                        padding: 20px; 
                    }
                    .notif-list-card > div.col { 
                        display: grid; 
                        grid-template-columns: 100px 1fr; 
                        align-items: center; 
                        gap: 12px;
                    }
                    .notif-list-card .status-button-wrapper { display: block; }
                    .notif-list-card .status-info { min-width: auto; }
                    .notif-list-card .btn-view.desktop-only { display: none; }
                    
                    .notif-list-card .hide-tablet { display: grid; }
                    
                    .notif-list-card .card-actions-row-mobile {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 8px;
                        padding-top: 16px;
                        border-top: 1px solid #edf2f7;
                    }
                    .status-badge { width: auto; padding: 6px 16px; }
                    .notif-list-filters .filter-group { min-width: 100%; }
                    .toolbar { flex-direction: column; align-items: stretch; }
                    .btn-reassign-all { width: 100%; justify-content: center; }
                }
            `}</style>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>Cargando notificaciones...</div>
            ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                    <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No hay notificaciones cargadas</p>
                    <p>Suba un archivo TXT desde la sección "Subir Notificaciones".</p>
                </div>
            ) : (
                <>
                    {/* Toolbar */}
                    <div className="toolbar">
                        <div className="summary-pills">
                            {Object.entries(userSummary).sort(([a],[b]) => a.localeCompare(b)).map(([name, count]) => (
                                <div key={name} className="summary-pill">
                                    <div className="dot" style={{ background: name === 'Sin asignar' ? '#e74c3c' : '#27ae60' }}></div>
                                    <span>{name}</span>
                                    <span className="count">{count}</span>
                                </div>
                            ))}
                        </div>
                        <button className="btn-reassign-all" onClick={handleReassignAll}>
                            🔄 Reasignar por Demarcaciones
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="notif-list-filters">
                        <div className="filter-group" style={{ flex: 2 }}>
                            <label>Buscar</label>
                            <input
                                type="text"
                                placeholder="ID, nombre, dirección, calle..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <label>Repartidor</label>
                            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="null">Sin asignar</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Estado</label>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">Todos</option>
                                {Object.entries(statusLabels).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="notif-count">
                        Mostrando <strong>{filtered.length}</strong> de {notifications.length} notificaciones
                    </div>

                    {/* List Cards */}
                    <div className="notif-list-cards">
                        {filtered.map(n => {
                            const isPending = ['PENDING', 'ATTEMPT_1'].includes(n.status);
                            let daysRemaining = null;
                            if (isPending && n.created_at) {
                                const daysElapsed = Math.floor((new Date() - new Date(n.created_at)) / (1000 * 60 * 60 * 24));
                                daysRemaining = 12 - daysElapsed;
                            }
                            const isWarning = daysRemaining !== null && daysRemaining <= 3 && daysRemaining >= 0;
                            const isExpired = daysRemaining !== null && daysRemaining < 0;

                            let cardClass = "notif-list-card";
                            if (isExpired) cardClass += " border-expired";
                            else if (isWarning) cardClass += " border-warning";

                            return (
                                <div key={n.id} className={cardClass}>
                                    <div className="col">
                                        <div className="fl">ID</div>
                                        <div className="fv id-text">{n.id}</div>
                                    </div>
                                    <div className="col">
                                        <div className="fl">Destinatario</div>
                                        <div className="fv">{n.recipient_name}</div>
                                    </div>
                                    <div className="col hide-tablet">
                                        <div className="fl">Dirección</div>
                                        <div className="fv">{n.full_address}</div>
                                    </div>
                                    <div className="col hide-tablet">
                                        <div className="fl">Calle Asignada</div>
                                        <div className={`fv ${!n.street_name ? 'muted' : ''}`}>{n.street_name || 'No vinculada'}</div>
                                    </div>
                                    <div className="col">
                                        <div className="fl">Repartidor</div>
                                        <select
                                            className="reassign-select"
                                            value={n.assigned_user_id || ''}
                                            onChange={e => handleReassign(n.id, e.target.value)}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <option value="">— Sin asignar —</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col">
                                        <div className="fl hide-tablet">Estado</div>
                                        <div className="status-button-wrapper">
                                            <div className="status-info">
                                                <span className="status-badge" style={{ background: statusLabels[n.status]?.color || '#999' }}>
                                                    {statusLabels[n.status]?.label || n.status}
                                                </span>
                                                {isExpired && <span className="expiration-badge expired">Expirada</span>}
                                                {isWarning && <span className="expiration-badge warning">Quedan {daysRemaining} días</span>}
                                            </div>
                                            
                                            {/* Desktop details button */}
                                            <button 
                                                className="btn-view desktop-only" 
                                                title="Ver detalles" 
                                                onClick={() => viewDetails(n.id)}
                                                disabled={detailLoading === n.id}
                                            >
                                                {detailLoading === n.id ? '⌛' : '🔎'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mobile details footer */}
                                    <div className="card-actions-row-mobile">
                                        <div>
                                            {/* Spacer for layout */}
                                        </div>
                                        <button 
                                            className="btn-view mobile-only" 
                                            title="Ver detalles" 
                                            onClick={() => viewDetails(n.id)}
                                            disabled={detailLoading === n.id}
                                        >
                                            {detailLoading === n.id ? '⌛' : '🔎'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Notification Details Modal */}
                    {selectedDetail && (
                        <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <h2>Detalles de Notificación #{selectedDetail.id}</h2>
                                        {['DELIVERED', 'RETURNED', 'FAILED'].includes(selectedDetail.status) && (
                                            <button className="btn-download-pdf" onClick={() => handleDownloadPdf(selectedDetail.id)}>
                                                📄 PDF
                                            </button>
                                        )}
                                    </div>
                                    <button className="btn-close" onClick={() => setSelectedDetail(null)}>&times;</button>
                                </div>
                                <div className="modal-body">
                                    <div className="detail-section">
                                        <h3>Información General</h3>
                                        <div className="detail-grid">
                                            <div className="detail-item">
                                                <label>Destinatario</label>
                                                <span>{selectedDetail.recipient_name}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Dirección</label>
                                                <span>{selectedDetail.full_address}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Calle Asignada</label>
                                                <span>{selectedDetail.street_name || 'No vinculada'}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Repartidor Asignado</label>
                                                <span>{selectedDetail.assigned_user_name || 'Sin asignar'}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Estado Actual</label>
                                                <span className="status-badge" style={{ background: statusLabels[selectedDetail.status]?.color || '#999', display: 'inline-block', marginTop: '4px' }}>
                                                    {statusLabels[selectedDetail.status]?.label || selectedDetail.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="detail-section">
                                        <h3>Historial de Intentos</h3>
                                        {selectedDetail.attempts && selectedDetail.attempts.length > 0 ? (
                                            selectedDetail.attempts.map((attempt) => (
                                                <div key={attempt.id} className={`attempt-card ${attempt.status_result === 'DELIVERED' ? 'delivered' : ''}`}>
                                                    <div className="attempt-header">
                                                        <span className="attempt-number">Intento {attempt.attempt_number}</span>
                                                        <span className="attempt-date">
                                                            📅 {new Date(attempt.timestamp).toLocaleDateString()} 
                                                            &nbsp; 🕒 {new Date(attempt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="detail-grid">
                                                        <div className="detail-item">
                                                            <label>Resultado</label>
                                                            <span>{statusLabels[attempt.status_result]?.label || attempt.status_result}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <label>Tramitado por</label>
                                                            <span>{attempt.delivered_by_name || 'Desconocido'}</span>
                                                        </div>
                                                    </div>

                                                    {attempt.status_result === 'DELIVERED' && (
                                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #eee' }}>
                                                            <div className="detail-grid">
                                                                <div className="detail-item">
                                                                    <label>Receptor</label>
                                                                    <span>{attempt.receiver_name}</span>
                                                                </div>
                                                                <div className="detail-item">
                                                                    <label>DNI</label>
                                                                    <span>{attempt.receiver_dni}</span>
                                                                </div>
                                                            </div>
                                                            {attempt.signature_base64 && (
                                                                <div className="detail-item" style={{ marginTop: '12px' }}>
                                                                    <label>Firma</label>
                                                                    <img src={attempt.signature_base64} alt="Firma" className="signature-img" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ color: '#999', fontStyle: 'italic', textAlign: 'center' }}>No hay intentos registrados aún.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AdminLayout>
    );
}
