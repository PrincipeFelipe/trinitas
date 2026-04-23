import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function StreetsManagement() {
    const [streets, setStreets] = useState([]);
    const [users, setUsers] = useState([]);
    const [demarcations, setDemarcations] = useState([]);
    const [search, setSearch] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [newStreetName, setNewStreetName] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [importResults, setImportResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        try {
            const [strRes, usrRes, demRes] = await Promise.all([
                apiClient.get('/streets'),
                apiClient.get('/users'),
                apiClient.get('/demarcations')
            ]);
            
            if (strRes.data.success) setStreets(strRes.data.data);
            if (usrRes.data.success) setUsers(usrRes.data.data.filter(u => u.role === 'REPARTIDOR'));
            if (demRes.data.success) setDemarcations(demRes.data.data);
        } catch (error) {
            console.error("Failed fetching data", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAssignChange = async (streetId, previousDemarcationId, newUserId) => {
        try {
            if (previousDemarcationId) {
                await apiClient.delete(`/demarcations/${previousDemarcationId}`);
            }
            if (newUserId) {
                await apiClient.post('/demarcations', { user_id: newUserId, street_id: streetId });
            }
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Error al actualizar asignación");
        }
    };

    const handleCreateStreet = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/streets', { name: newStreetName });
            setNewStreetName('');
            setIsAddModalOpen(false);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Error al crear calle");
        }
    };

    const handleImportFile = async () => {
        if (!importFile) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', importFile);
        try {
            // Usamos el endpoint específico para solo extraer calles
            const res = await apiClient.post('/notifications/extract-streets', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setImportResults(res.data.newStreets);
            }
        } catch (error) {
            alert("Error al procesar archivo");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importResults?.length) return;
        try {
            const res = await apiClient.post('/notifications/add-streets', { streets: importResults });
            alert(`Se han añadido ${res.data.added} calles nuevas.`);
            setIsImportModalOpen(false);
            setImportResults(null);
            setImportFile(null);
            fetchData();
        } catch (error) {
            alert("Error al importar calles");
        }
    };

    const handleDeleteStreet = async (id) => {
        if (!window.confirm("¿Está seguro de eliminar esta calle?")) return;
        try {
            await apiClient.delete(`/streets/${id}`);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.error || "Error al eliminar calle");
        }
    };

    const filteredStreets = streets.filter(st => st.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <AdminLayout title="Gestión de Calles">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', gap: '10px' }}>
                <div className="search-filter" style={{ flex: 1 }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar calle por nombre..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: "12px", width: "100%", maxWidth: "400px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secondary" onClick={() => setIsImportModalOpen(true)}>📥 Importar desde Archivo</button>
                    <button className="btn-primary" style={{ width: 'auto', margin: 0 }} onClick={() => setIsAddModalOpen(true)}>+ Añadir Calle</button>
                </div>
            </div>

            {/* Modal Añadir Calle */}
            {isAddModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Añadir Nueva Calle</h3>
                        <form onSubmit={handleCreateStreet}>
                            <div className="form-group">
                                <label>Nombre de la Calle</label>
                                <input 
                                    className="form-input"
                                    type="text" 
                                    value={newStreetName} 
                                    onChange={(e) => setNewStreetName(e.target.value.toUpperCase())}
                                    placeholder="Ej: CALLE REAL"
                                    required
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">Guardar Calle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Importar Calles */}
            {isImportModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <h3>Importar Calles desde Archivo</h3>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
                            Suba el archivo de notificaciones para extraer automáticamente los nombres de las calles que no existen en el sistema.
                        </p>
                        
                        {!importResults ? (
                            <div className="import-box">
                                <input type="file" onChange={(e) => setImportFile(e.target.files[0])} style={{ marginBottom: '15px' }} />
                                <div className="modal-actions">
                                    <button className="btn-secondary" onClick={() => setIsImportModalOpen(false)}>Cancelar</button>
                                    <button className="btn-primary" onClick={handleImportFile} disabled={!importFile || loading}>
                                        {loading ? 'Procesando...' : 'Analizar Archivo'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="import-results">
                                <p>Se han detectado <strong>{importResults.length}</strong> calles nuevas:</p>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', margin: '10px 0', borderRadius: '4px', background: '#f9f9f9', fontSize: '0.85rem' }}>
                                    {importResults.length > 0 ? (
                                        importResults.map((s, i) => <div key={i} style={{ padding: '4px 0' }}>{s}</div>)
                                    ) : (
                                        <div style={{ color: '#888' }}>No se han detectado calles nuevas en este archivo.</div>
                                    )}
                                </div>
                                <div className="modal-actions">
                                    <button className="btn-secondary" onClick={() => setImportResults(null)}>Atrás</button>
                                    <button className="btn-primary" onClick={handleConfirmImport} disabled={importResults.length === 0}>
                                        Confirmar Importación
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content { background: white; padding: 30px; border-radius: 12px; width: 90%; maxWidth: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
                .modal-content h3 { margin-bottom: 20px; color: #1a1c2c; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
                .form-group { margin-bottom: 15px; }
                .form-group label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.9rem; }
            `}</style>
            <div className="data-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Repartidor Asignado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStreets.map(st => {
                            const currentDemarcation = demarcations.find(d => d.street_id === st.id);
                            
                            return (
                                <tr key={st.id}>
                                    <td>{st.id}</td>
                                    <td>{st.name}</td>
                                    <td>
                                        <select 
                                            className="form-input"
                                            style={{ padding: '6px', width: 'auto', minWidth: '200px' }}
                                            value={currentDemarcation ? currentDemarcation.user_id : ''}
                                            onChange={(e) => handleAssignChange(st.id, currentDemarcation?.id, e.target.value)}
                                        >
                                            <option value="">-- Sin Asignar --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.dni})</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <button className="btn-edit" onClick={() => alert("Función de edición en desarrollo")}>Editar</button>
                                        <button className="btn-delete" onClick={() => handleDeleteStreet(st.id)}>Eliminar</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredStreets.length === 0 && (
                            <tr><td colSpan="4" style={{textAlign:"center", padding: "20px"}}>No se encontraron calles</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
