import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';
import Swal from 'sweetalert2';

const COMPANIES = {
    'ENERGIA_CEUTA': { name: 'Energía Ceuta XXI Comercializadora de Referencia, S.A.U.', cif: 'A51031920' },
    'ALUMBRADO_CEUTA': { name: 'Alumbrado Eléctrico de Ceuta Energía, S.L.', cif: 'B72775513' }
};

const COMPANY_SHORT_NAMES = {
    'ENERGIA_CEUTA': 'Energía Ceuta',
    'ALUMBRADO_CEUTA': 'Alumbrado Eléctrico'
};

export default function NotificationsList() {
    const [notifications, setNotifications] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [notifRes, usersRes] = await Promise.all([
                    apiClient.get('/notifications/list'),
                    apiClient.get('/users')
                ]);
                if (notifRes.data.success) setNotifications(notifRes.data.data);
                if (usersRes.data.success) setUsers(usersRes.data.data.filter(u => u.role === 'EMPLEADO' || u.role === 'REPARTIDOR'));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleReassign = async (notificationId, newUserId, company) => {
        try {
            const res = await apiClient.put('/notifications/reassign', {
                notification_id: notificationId,
                user_id: newUserId || null,
                company: company
            });
            if (res.data.success) {
                setNotifications(prev => prev.map(n => {
                    if (n.id === notificationId && n.company === company) {
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

    const viewDetails = async (id, company) => {
        if (detailLoading) return;
        setDetailLoading(id); // Store ID of loading item
        try {
            const res = await apiClient.get(`/notifications/details/${id}?company=${company}`);
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

    const handleDownloadPdf = async (id, company) => {
        try {
            const token = localStorage.getItem('token');
            window.open(`${apiClient.defaults.baseURL}/notifications/generate-pdf/${id}?company=${company}&token=${token}`, '_blank');
        } catch (err) {
            console.error("Error downloading PDF", err);
            alert('Error al descargar el PDF');
        }
    };

    const handleDownloadBulkPdf = async () => {
        if (filtered.length === 0) {
            Swal.fire({
                title: 'Sin notificaciones',
                text: 'No hay notificaciones para exportar.',
                icon: 'info'
            });
            return;
        }

        // Snapshot inmediato: capturamos exactamente qué notificaciones se van a exportar
        // en este momento, antes de cualquier diálogo que pueda causar re-renders
        const exportSnapshot = [...filtered];
        const pairs = exportSnapshot.map(n => [n.id, n.company]);
        const idsToArchive = exportSnapshot.map(n => n.id);
        
        const proceed = async () => {
            Swal.fire({
                title: '¿Desea archivar las notificaciones al exportar?',
                text: `Se archivarán ${idsToArchive.length} notificaciones y no aparecerán en el listado activo.`,
                icon: 'question',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: 'Sí, archivar y exportar',
                denyButtonText: 'No, sólo exportar',
                cancelButtonText: 'Cancelar exportación',
                confirmButtonColor: '#10b981',
                denyButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280'
            }).then(async (result) => {
                if (result.isDismissed || result.dismiss === Swal.DismissReason.cancel) {
                    return; // User cancelled the entire export
                }

                const shouldArchive = result.isConfirmed;

                // Show loading spinner
                Swal.fire({
                    title: 'Generando PDF...',
                    html: 'Por favor, espere un momento.',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                try {
                    const response = await apiClient.post('/notifications/generate-bulk-pdf', { pairs }, {
                        responseType: 'blob'
                    });
                    
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `export_notificaciones_${new Date().getTime()}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    
                    Swal.close(); // Close spinner

                    if (shouldArchive) {
                        try {
                            const archiveRes = await apiClient.post('/notifications/bulk-archive', { ids: idsToArchive });
                            if (archiveRes.data.success) {
                                setNotifications(prev => prev.map(n => {
                                    if (idsToArchive.includes(n.id)) {
                                        return { ...n, is_archived: 1 };
                                    }
                                    return n;
                                }));
                                Swal.fire({
                                    title: '¡Éxito!',
                                    text: 'Notificaciones exportadas y archivadas correctamente.',
                                    icon: 'success',
                                    timer: 2000,
                                    showConfirmButton: false
                                });
                            }
                        } catch (archiveErr) {
                            console.error(archiveErr);
                            Swal.fire({
                                title: 'Error',
                                text: 'Se exportó el PDF, pero hubo un error al archivar las notificaciones.',
                                icon: 'error'
                            });
                        }
                    } else {
                        Swal.fire({
                            title: '¡Éxito!',
                            text: 'Notificaciones exportadas correctamente.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    }
                } catch (err) {
                    console.error(err);
                    Swal.fire({
                        title: 'Error',
                        text: 'Ocurrió un error al generar el PDF.',
                        icon: 'error'
                    });
                }
            });
        };

        if (exportSnapshot.length > 200) {
            Swal.fire({
                title: 'Exportación Grande',
                text: `Vas a exportar ${exportSnapshot.length} notificaciones. Esto puede tardar un poco. ¿Deseas continuar?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Continuar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280'
            }).then((result) => {
                if (result.isConfirmed) {
                    proceed();
                }
            });
        } else {
            proceed();
        }
    };

    const isPending = (status) => ['PENDIENTE', '1ER_INTENTO'].includes(status);

    const filtered = notifications.filter(n => {
        const matchesArchived = showArchived ? n.is_archived : !n.is_archived;
        if (!matchesArchived) return false;

        const companyName = n.company ? COMPANY_SHORT_NAMES[n.company] : '';
        const matchesSearch = !search || 
            n.id_notificacion.toLowerCase().includes(search.toLowerCase()) ||
            n.recipient_name.toLowerCase().includes(search.toLowerCase()) ||
            n.full_address.toLowerCase().includes(search.toLowerCase()) ||
            (n.street_name && n.street_name.toLowerCase().includes(search.toLowerCase())) ||
            companyName.toLowerCase().includes(search.toLowerCase());
        const matchesUser = !filterUser || String(n.assigned_user_id) === filterUser;
        let matchesStatus = !filterStatus || n.status === filterStatus;
        if (filterStatus === 'SOLO_GESTIONADOS') {
            matchesStatus = !isPending(n.status);
        }
        const matchesCompany = !filterCompany || n.company === filterCompany;

        let matchesDate = true;
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const itemDate = new Date(n.created_at);
            if (itemDate < start) matchesDate = false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            const itemDate = new Date(n.created_at);
            if (itemDate > end) matchesDate = false;
        }

        return matchesSearch && matchesUser && matchesStatus && matchesCompany && matchesDate;
    });

    const statusLabels = {
        'PENDIENTE': { label: 'Pendiente', color: '#e67e22' },
        '1ER_INTENTO': { label: '1er Intento', color: '#3498db' },
        'ENTREGADA': { label: 'Entregada', color: '#27ae60' },
        'DEVUELTA': { label: 'Devuelta', color: '#e74c3c' },
        'FALLIDA': { label: 'Fallida', color: '#95a5a6' },
        'AUSENTE': { label: 'Ausente', color: '#e67e22' },
        'REHUSADO': { label: 'Rehusado', color: '#e74c3c' },
        'DESCONOCIDO': { label: 'Desconocido', color: '#95a5a6' }
    };



    // Group by user for summary
    const userSummary = {};
    notifications.forEach(n => {
        if (showArchived ? !n.is_archived : n.is_archived) return; // Match the same filter as the list
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
                .summary-pill .count { font-weight: 700; }

                /* Desktop Table Styles */
                .notif-table-container-desktop {
                    width: 100%;
                    overflow-x: auto;
                    margin-bottom: 20px;
                    border: 1px solid #edf2f7;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                    background: #fff;
                }
                .notif-table-desktop {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .notif-table-desktop th {
                    background: #f7fafc;
                    color: #4a5568;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    padding: 12px 16px;
                    border-bottom: 2px solid #edf2f7;
                }
                .notif-table-desktop td {
                    padding: 10px 16px;
                    font-size: 0.85rem;
                    color: #2d3748;
                    border-bottom: 1px solid #edf2f7;
                    vertical-align: middle;
                }
                .notif-table-desktop tr:hover {
                    background: #fcfcfc;
                }
                .notif-table-desktop tr.border-safe { border-left: 4px solid #48bb78; }
                .notif-table-desktop tr.border-warning { border-left: 4px solid #ed8936; }
                .notif-table-desktop tr.border-expired { border-left: 4px solid #e53e3e; }

                /* Expiration Badges */
                .expiration-badge { 
                    display: inline-flex; 
                    align-items: center;
                    padding: 2px 8px; 
                    border-radius: 4px; 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    letter-spacing: 0.05em; 
                }
                .expiration-badge.safe { background: #c6f6d5; color: #22543d; }
                .expiration-badge.warning { background: #feebc8; color: #7b341e; }
                .expiration-badge.expired { background: #fed7d7; color: #822727; }

                /* Status Badges */
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
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                }

                .reassign-select { 
                    width: 100%; 
                    padding: 6px 10px; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 8px; 
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

                .btn-view, .btn-pdf { 
                    background: #f1f5f9; 
                    color: #4a5568; 
                    border: 1px solid #e2e8f0; 
                    width: 32px; 
                    height: 32px; 
                    border-radius: 6px; 
                    cursor: pointer; 
                    transition: all 0.2s; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 0.95rem;
                    user-select: none;
                }
                .btn-view:hover { background: #3182ce; color: #fff; border-color: #3182ce; }
                .btn-pdf:hover { background: #10b981; color: #fff; border-color: #10b981; }
                .btn-view:disabled { background: #f7fafc; color: #cbd5e0; border-color: #edf2f7; cursor: not-allowed; }

                /* Cards for Mobile */
                .notif-list-cards { display: none; flex-direction: column; gap: 16px; }
                .notif-list-card { 
                    background: #fff; 
                    border: 1px solid #edf2f7; 
                    border-radius: 16px; 
                    padding: 20px; 
                    display: grid; 
                    grid-template-columns: 1fr; 
                    gap: 14px; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    border-left: 6px solid transparent;
                }
                .notif-list-card.border-safe { border-left-color: #48bb78; }
                .notif-list-card.border-warning { border-left-color: #ed8936; }
                .notif-list-card.border-expired { border-left-color: #e53e3e; }
                .notif-list-card .col { display: flex; flex-direction: column; gap: 4px; }
                .notif-list-card .fl { font-size: 0.65rem; color: #718096; text-transform: uppercase; font-weight: 700; }
                .notif-list-card .fv { font-size: 0.9rem; color: #1a202c; font-weight: 600; }
                .notif-list-card .fv.id-text { font-family: 'JetBrains Mono', monospace; }
                .notif-list-card .fv.muted { color: #a0aec0; font-style: italic; font-weight: 400; }
                .notif-list-card .card-actions-row-mobile {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 8px;
                    margin-top: 8px;
                    padding-top: 12px;
                    border-top: 1px solid #edf2f7;
                }

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

                /* Responsive Visibility Toggles */
                .notif-table-container-desktop { display: block; }
                .notif-list-cards { display: none; }

                @media (max-width: 768px) {
                    .notif-table-container-desktop { display: none; }
                    .notif-list-cards { display: flex; }
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
                            <label>Empresa</label>
                            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                                <option value="">Todas</option>
                                {Object.entries(COMPANY_SHORT_NAMES).map(([key, name]) => (
                                    <option key={key} value={key}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Estado</label>
                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="SOLO_GESTIONADOS">Gestionados (Omitir pendientes)</option>
                                {Object.entries(statusLabels).map(([key, { label }]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-group">
                            <label>Fecha Desde</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <label>Fecha Hasta</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="filter-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', minWidth: '150px', height: '38px', paddingBottom: '2px' }}>
                            <input
                                id="showArchivedCheck"
                                type="checkbox"
                                checked={showArchived}
                                onChange={e => setShowArchived(e.target.checked)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                            />
                            <label htmlFor="showArchivedCheck" style={{ cursor: 'pointer', margin: 0, textTransform: 'none', fontSize: '0.85rem', fontWeight: 600, color: '#4a5568' }}>Mostrar archivadas</label>
                        </div>
                        {(search || filterUser || filterStatus || filterCompany || startDate || endDate || showArchived) && (
                            <button 
                                onClick={() => {
                                    setSearch('');
                                    setFilterUser('');
                                    setFilterStatus('');
                                    setFilterCompany('');
                                    setStartDate('');
                                    setEndDate('');
                                    setShowArchived(false);
                                }}
                                style={{
                                    background: '#fff5f5',
                                    color: '#e53e3e',
                                    border: '1px solid #fed7d7',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    height: '38px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    minWidth: '100px'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#fed7d7'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; }}
                            >
                                🧹 Limpiar
                            </button>
                        )}
                    </div>

                    <div className="notif-count" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Mostrando <strong>{filtered.length}</strong> de {notifications.length} notificaciones</span>
                        <button className="btn-bulk-pdf" onClick={handleDownloadBulkPdf} style={{ 
                            background: '#1a6fb5', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '8px 16px', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            📄 Exportar Listado PDF
                        </button>
                    </div>

                    {/* Table for Desktop */}
                    <div className="notif-table-container-desktop">
                        <table className="notif-table-desktop">
                            <thead>
                                <tr>
                                    <th style={{ width: '120px' }}>ID / Fecha</th>
                                    <th style={{ width: '150px' }}>Empresa</th>
                                    <th>Destinatario</th>
                                    <th>Dirección</th>
                                    <th>Calle Asignada</th>
                                    <th style={{ width: '180px' }}>Repartidor</th>
                                    <th style={{ width: '160px' }}>Estado</th>
                                    <th style={{ width: '90px' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(n => {
                                    const isPendingVal = ['PENDIENTE', '1ER_INTENTO'].includes(n.status);
                                    let daysRemaining = null;
                                    if (isPendingVal && n.created_at) {
                                        const daysElapsed = Math.floor((new Date() - new Date(n.created_at)) / (1000 * 60 * 60 * 24));
                                        daysRemaining = 8 - daysElapsed;
                                    }

                                    let urgency = 'safe';
                                    if (daysRemaining !== null) {
                                        if (daysRemaining <= 3) urgency = 'expired';
                                        else if (daysRemaining < 6) urgency = 'warning';
                                    }

                                    let rowClass = "";
                                    if (isPendingVal) rowClass = `border-${urgency}`;

                                    return (
                                        <tr key={`${n.id}-${n.company}`} className={rowClass}>
                                            <td>
                                                <div className="fv id-text" style={{ fontWeight: 600 }}>{n.id_notificacion}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span>📅</span>
                                                    <span>{n.created_at ? new Date(n.created_at).toLocaleDateString('es-ES') : '-'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: '0.8rem', color: '#1a6fb5', fontWeight: 600 }}>
                                                    {n.company ? COMPANY_SHORT_NAMES[n.company] : '-'}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{n.recipient_name}</td>
                                            <td style={{ fontSize: '0.8rem', color: '#4a5568' }}>{n.full_address}</td>
                                            <td style={{ fontSize: '0.8rem', color: n.street_name ? '#2d3748' : '#a0aec0', fontStyle: n.street_name ? 'normal' : 'italic' }}>
                                                {n.street_name || 'No vinculada'}
                                            </td>
                                            <td>
                                                <select
                                                    className="reassign-select"
                                                    value={n.assigned_user_id || ''}
                                                    onChange={e => handleReassign(n.id, e.target.value, n.company)}
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                >
                                                    <option value="">— Sin asignar —</option>
                                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span className="status-badge" style={{ background: statusLabels[n.status]?.color || '#999', padding: '4px 8px', fontSize: '0.7rem' }}>
                                                        {statusLabels[n.status]?.label || n.status}
                                                    </span>
                                                    {isPendingVal && daysRemaining !== null && (
                                                        <span className={`expiration-badge ${urgency}`} style={{ margin: 0, padding: '2px 6px', fontSize: '0.6rem', textAlign: 'center', justifyContent: 'center' }}>
                                                            {daysRemaining < 0 ? 'Expirada' : `Quedan: ${daysRemaining}d`}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button 
                                                        className="btn-pdf" 
                                                        style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        title="Descargar PDF" 
                                                        onClick={() => handleDownloadPdf(n.id, n.company)}
                                                    >
                                                        📄
                                                    </button>
                                                    <button 
                                                        className="btn-view" 
                                                        style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        title="Ver detalles" 
                                                        onClick={() => viewDetails(n.id, n.company)}
                                                        disabled={detailLoading === n.id}
                                                    >
                                                        {detailLoading === n.id ? '⌛' : '🔎'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* List Cards */}
                    <div className="notif-list-cards">
                        {filtered.map(n => {
                            const isPending = ['PENDIENTE', '1ER_INTENTO'].includes(n.status);
                            let daysRemaining = null;
                            if (isPending && n.created_at) {
                                const daysElapsed = Math.floor((new Date() - new Date(n.created_at)) / (1000 * 60 * 60 * 24));
                                daysRemaining = 8 - daysElapsed;
                            }

                            let urgency = 'safe'; // green
                            if (daysRemaining !== null) {
                                if (daysRemaining <= 3) urgency = 'expired'; // red
                                else if (daysRemaining < 6) urgency = 'warning'; // orange
                            }

                            let cardClass = "notif-list-card";
                            if (isPending) cardClass += ` border-${urgency}`;

                            return (
                                <div key={`${n.id}-${n.company}`} className={cardClass}>
                                     <div className="col">
                                         <div className="fl">ID</div>
                                         <div className="fv id-text">
                                             {n.id_notificacion}
                                             <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '3px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                 <span>📅</span>
                                                 <span>{n.created_at ? new Date(n.created_at).toLocaleDateString('es-ES') : '-'}</span>
                                             </div>
                                         </div>
                                     </div>
                                    <div className="col">
                                        <div className="fl">Empresa</div>
                                        <div className="fv" style={{ fontSize: '0.8rem', color: '#1a6fb5' }}>{n.company ? COMPANY_SHORT_NAMES[n.company] : '-'}</div>
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
                                            onChange={e => handleReassign(n.id, e.target.value, n.company)}
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
                                                {isPending && daysRemaining !== null && (
                                                    <span className={`expiration-badge ${urgency}`}>
                                                        {daysRemaining < 0 ? 'Expirada' : `Días restantes: ${daysRemaining}`}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Desktop details button */}
                                            <button 
                                                className="btn-pdf desktop-only" 
                                                title="Descargar PDF" 
                                                onClick={(e) => { e.stopPropagation(); handleDownloadPdf(n.id, n.company); }}
                                            >
                                                📄
                                            </button>
                                            <button 
                                                className="btn-view desktop-only" 
                                                title="Ver detalles" 
                                                onClick={() => viewDetails(n.id, n.company)}
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
                                            className="btn-pdf mobile-only" 
                                            title="Descargar PDF" 
                                            onClick={(e) => { e.stopPropagation(); handleDownloadPdf(n.id, n.company); }}
                                        >
                                            📄
                                        </button>
                                        <button 
                                            className="btn-view mobile-only" 
                                            title="Ver detalles" 
                                            onClick={() => viewDetails(n.id, n.company)}
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
                                        <h2>Detalles de Notificación #{selectedDetail.id_notificacion}</h2>
                                        {['ENTREGADA', 'DEVUELTA', 'FALLIDA'].includes(selectedDetail.status) && (
                                            <button className="btn-download-pdf" onClick={() => handleDownloadPdf(selectedDetail.id, selectedDetail.company)}>
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
                                                <label>Empresa Emisora</label>
                                                <span>{selectedDetail.company ? COMPANIES[selectedDetail.company]?.name : 'No especificada'}</span>
                                            </div>
                                            <div className="detail-item">
                                                <label>Fecha de Carga</label>
                                                <span>{selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleString('es-ES') : '-'}</span>
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
                                                <div key={attempt.id} className={`attempt-card ${attempt.status_result === 'ENTREGADA' ? 'delivered' : ''}`}>
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

                                                    {attempt.status_result === 'ENTREGADA' && (
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
