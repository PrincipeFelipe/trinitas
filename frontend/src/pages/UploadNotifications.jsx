import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function UploadNotifications() {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [streets, setStreets] = useState([]);
    
    const fetchStreets = async () => {
        const res = await apiClient.get('/streets');
        if (res.data.success) setStreets(res.data.data);
    };

    useEffect(() => { fetchStreets(); }, []);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length > 0) setFile(e.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await apiClient.post('/notifications/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setResults(res.data);
                fetchStreets();
            }
        } catch (error) {
            console.error(error);
            alert('Error al subir el archivo');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewStreets = async () => {
        if (!results?.newStreets?.length) return;
        try {
            const res = await apiClient.post('/notifications/add-streets', { streets: results.newStreets });
            if (res.data.success) {
                alert(`Se añadieron ${res.data.added} calles nuevas. Vuelva a subir el archivo para reasignar.`);
                fetchStreets();
                setResults(prev => ({ ...prev, newStreets: [] }));
            }
        } catch (error) {
            alert('Error al añadir calles');
        }
    };

    const handleBulkAssign = async () => {
        if (!results?.unassigned?.length) return;
        const items = results.unassigned
            .filter(n => n.extracted_street)
            .map(n => ({ notification_id: n.id, extracted_street: n.extracted_street }));
        
        if (items.length === 0) return alert('No hay notificaciones con calle detectada para asignar.');
        
        try {
            const res = await apiClient.post('/notifications/bulk-assign', { items });
            if (res.data.success) {
                alert(`Se asignaron ${res.data.assigned} notificaciones a sus calles.`);
                // Remove assigned ones from unassigned list
                const assignedIds = new Set(items.map(i => i.notification_id));
                setResults(prev => ({
                    ...prev,
                    streetMatched: (prev.streetMatched || 0) + res.data.assigned,
                    unassigned: prev.unassigned.filter(n => !assignedIds.has(n.id))
                }));
            }
        } catch (error) {
            alert('Error al asignar en bloque');
        }
    };

    const handleManualAssign = async (notificationId, streetId) => {
        if (!streetId) return alert('Seleccione una calle');
        try {
            const res = await apiClient.post('/notifications/assign-manual', {
                notification_id: notificationId, street_id: streetId
            });
            if (res.data.success) {
                setResults(prev => ({
                    ...prev,
                    unassigned: prev.unassigned.filter(n => n.id !== notificationId)
                }));
            }
        } catch (error) {
            console.error('Error in manual assignment', error);
        }
    };

    return (
        <AdminLayout title="Subida de Notificaciones">
            <style>{`
                .upload-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
                .summary-stat { background: #fff; border-radius: 10px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
                .summary-stat h4 { margin: 0 0 8px; font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
                .summary-stat .value { font-size: 2rem; font-weight: 700; }
                .summary-stat.green .value { color: #2d8a4e; }
                .summary-stat.blue .value { color: #1a6fb5; }
                .summary-stat.gold .value { color: #c49000; }
                .summary-stat.red .value { color: #c0392b; }
                .summary-stat .bar { height: 4px; border-radius: 2px; margin-top: 8px; }
                .summary-stat.green .bar { background: #2d8a4e; }
                .summary-stat.blue .bar { background: #1a6fb5; }
                .summary-stat.gold .bar { background: #c49000; }
                .summary-stat.red .bar { background: #c0392b; }
                
                .new-streets-panel { background: linear-gradient(135deg, #fff9e6, #fff3cd); border: 1px solid #ffc107; border-radius: 10px; padding: 20px; margin-bottom: 24px; }
                .new-streets-panel h3 { margin: 0 0 8px; color: #856404; font-size: 1rem; }
                .new-streets-panel p { color: #856404; margin-bottom: 12px; font-size: 0.9rem; }
                .new-streets-list { max-height: 180px; overflow-y: auto; background: #fff; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
                .new-streets-list div { padding: 5px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
                
                .manual-section { margin-top: 24px; }
                .manual-section h3 { margin-bottom: 16px; }
                .manual-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
                
                .notif-cards { display: flex; flex-direction: column; gap: 12px; }
                .notif-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 10px; padding: 16px; display: grid; grid-template-columns: 60px 1fr 1fr 1.5fr auto; gap: 12px; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.05); transition: box-shadow 0.2s; }
                .notif-card:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.1); }
                .notif-card .field-label { font-size: 0.7rem; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 2px; }
                .notif-card .field-value { font-size: 0.85rem; color: #333; word-break: break-word; }
                .notif-card .detected { color: #2d8a4e; font-weight: 600; }
                
                .autocomplete-wrapper { position: relative; }
                .autocomplete-wrapper input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; }
                .autocomplete-wrapper input:focus { border-color: #1a6fb5; outline: none; box-shadow: 0 0 0 3px rgba(26,111,181,0.15); }
                .autocomplete-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: #fff; border: 1px solid #ddd; border-radius: 6px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
                .autocomplete-dropdown li { padding: 10px 14px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid #f5f5f5; list-style: none; transition: background 0.15s; }
                .autocomplete-dropdown li:hover { background: #f0f7ff; }
                
                .btn-accept-all { background: #2d8a4e; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-accept-all:hover { background: #238040; transform: translateY(-1px); }
                .btn-add-streets { background: #856404; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
                .btn-save { background: #1a6fb5; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
                .btn-save:hover { background: #155a94; }
                .btn-save:disabled { background: #ccc; cursor: not-allowed; }

                @media (max-width: 900px) {
                    .notif-card { grid-template-columns: 1fr 1fr; }
                    .notif-card > div:first-child { grid-column: 1 / -1; }
                }
                @media (max-width: 600px) {
                    .notif-card { grid-template-columns: 1fr; }
                    .upload-summary { grid-template-columns: 1fr 1fr; }
                }
            `}</style>

            <div className="upload-container">
                <header className="upload-header">
                    <p>Arrastre el informe diario delimitado (ancho fijo) con IDs, Nombres y Direcciones.</p>
                </header>

                {!results && (
                    <div 
                        className={`dropzone ${isDragging ? 'active' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <div className="dropzone-content">
                            {file ? <p>Archivo listo: <strong>{file.name}</strong></p> : <p>Arrastre el archivo .txt aquí o haga clic en seleccionar.</p>}
                            <input type="file" id="file" onChange={(e) => setFile(e.target.files[0])} hidden />
                            <label htmlFor="file" className="btn-secondary">Seleccionar Archivo</label>
                        </div>
                    </div>
                )}

                {file && !results && (
                    <div style={{ textAlign: "center" }}>
                        <button className="btn-primary upload-btn" onClick={handleUpload} disabled={loading}>
                            {loading ? 'Procesando...' : 'Confirmar Subida'}
                        </button>
                    </div>
                )}

                {results && (
                    <div className="results-container">
                        {/* Summary Cards */}
                        <div className="upload-summary">
                            <div className="summary-stat blue">
                                <h4>Procesadas</h4>
                                <div className="value">{results.processed}</div>
                                <div className="bar"></div>
                            </div>
                            <div className="summary-stat green">
                                <h4>Calle Identificada</h4>
                                <div className="value">{results.streetMatched || 0}</div>
                                <div className="bar"></div>
                            </div>
                            <div className="summary-stat gold">
                                <h4>Con Repartidor</h4>
                                <div className="value">{results.assigned}</div>
                                <div className="bar"></div>
                            </div>
                            <div className="summary-stat red">
                                <h4>Pendientes</h4>
                                <div className="value">{results.unassigned.length}</div>
                                <div className="bar"></div>
                            </div>
                        </div>

                        {/* New Streets Panel */}
                        {results.newStreets?.length > 0 && (
                            <div className="new-streets-panel">
                                <h3>⚠️ Calles Nuevas Detectadas ({results.newStreets.length})</h3>
                                <p>Estas calles aparecen en el archivo pero no están en la base de datos. Añádalas para mejorar la autoasignación.</p>
                                <div className="new-streets-list">
                                    {results.newStreets.map((s, i) => <div key={i}>{s}</div>)}
                                </div>
                                <button className="btn-add-streets" onClick={handleAddNewStreets}>
                                    ✅ Añadir Todas las Calles Nuevas
                                </button>
                            </div>
                        )}

                        {/* Manual Assignment Section */}
                        {results.unassigned.length > 0 && (
                            <div className="manual-section">
                                <div className="manual-header">
                                    <h3>Gestión Manual de Direcciones ({results.unassigned.length})</h3>
                                    <button className="btn-accept-all" onClick={handleBulkAssign}>
                                        ✓ Aceptar Todas las Calles Detectadas
                                    </button>
                                </div>
                                <div className="notif-cards">
                                    {results.unassigned.map(item => (
                                        <AssignmentCard 
                                            key={item.id} 
                                            item={item} 
                                            streets={streets} 
                                            onAssign={handleManualAssign} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function AssignmentCard({ item, streets, onAssign }) {
    const [search, setSearch] = useState('');
    const [selectedStreetId, setSelectedStreetId] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const filtered = search.length >= 2
        ? streets.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).slice(0, 12)
        : [];

    const handleSelect = (st) => {
        setSearch(st.name);
        setSelectedStreetId(st.id);
        setShowDropdown(false);
    };

    return (
        <div className="notif-card">
            <div>
                <div className="field-label">ID</div>
                <div className="field-value" style={{ fontWeight: 700 }}>{item.id}</div>
            </div>
            <div>
                <div className="field-label">Destinatario</div>
                <div className="field-value">{item.recipient_name}</div>
            </div>
            <div>
                <div className="field-label">Dirección Original</div>
                <div className="field-value">{item.full_address}</div>
            </div>
            <div>
                <div className="field-label">Calle Detectada</div>
                <div className="field-value detected">{item.extracted_street || '— No detectada —'}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="autocomplete-wrapper" style={{ minWidth: '220px', flex: 1 }}>
                    <div className="field-label">Buscar calle</div>
                    <input
                        type="text"
                        value={search}
                        placeholder="Escriba para buscar..."
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setSelectedStreetId('');
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    />
                    {showDropdown && filtered.length > 0 && (
                        <ul className="autocomplete-dropdown">
                            {filtered.map(st => (
                                <li key={st.id} onMouseDown={() => handleSelect(st)}>
                                    {st.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button
                    className="btn-save"
                    onClick={() => onAssign(item.id, selectedStreetId)}
                    disabled={!selectedStreetId}
                >
                    Guardar
                </button>
            </div>
        </div>
    );
}
