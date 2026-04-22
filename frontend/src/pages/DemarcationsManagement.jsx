import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function DemarcationsManagement() {
    const [demarcations, setDemarcations] = useState([]);
    const [users, setUsers] = useState([]);
    const [streets, setStreets] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({ user_id: '', street_id: '' });
    const [streetSearch, setStreetSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [demRes, userRes, streetRes] = await Promise.all([
                apiClient.get('/demarcations'),
                apiClient.get('/users'),
                apiClient.get('/streets')
            ]);
            if (demRes.data.success) setDemarcations(demRes.data.data);
            if (userRes.data.success) setUsers(userRes.data.data.filter(u => u.role === 'REPARTIDOR'));
            if (streetRes.data.success) setStreets(streetRes.data.data);
        } catch (error) {
            console.error('Error fetching demarcations data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (e, directStreetId = null) => {
        if (e) e.preventDefault();
        
        const payload = directStreetId 
            ? { user_id: form.user_id, street_id: directStreetId } 
            : form;

        if (!payload.user_id || !payload.street_id) {
            alert('Por favor selecciona primero un repartidor.');
            return;
        }

        try {
            const res = await apiClient.post('/demarcations', payload);
            if (res.data.success) {
                setForm(prev => ({ ...prev, street_id: '' }));
                setStreetSearch('');
                fetchData();
            }
        } catch (error) {
            alert(error.response?.data?.error || 'Error al asignar la calle');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar asignación de calle?')) return;
        try {
            const res = await apiClient.delete(`/demarcations/${id}`);
            if (res.data.success) fetchData();
        } catch(error) {
            alert('Error eliminando la demarcación');
        }
    };

    const allAssignedStreets = new Set(
        demarcations.map(d => d.street_id)
    );

    const filteredStreets = streets
        .filter(s => !allAssignedStreets.has(s.id))
        .filter(s => s.name.toLowerCase().includes(streetSearch.toLowerCase()));

    return (
        <AdminLayout title="Diseño de Demarcaciones">
            <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                
                <div style={{ flex: '1', minWidth: '300px', background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ marginTop: 0, color: 'var(--primary)' }}>Nueva Asignación</h3>
                    <p style={{ color: 'var(--text-light)', fontSize: '14px', marginBottom: '20px' }}>
                        Vincula una calle a un repartidor para enrutar las notificaciones automáticamente.
                    </p>
                    <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div className="input-group" style={{ margin: 0 }}>
                            <label>Repartidor</label>
                            <select 
                                required 
                                className="manual-select" 
                                style={{ width: '100%', padding: '10px' }}
                                value={form.user_id}
                                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                            >
                                <option value="">-- Seleccionar Repartidor --</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ margin: 0 }}>
                            <label>Calle (Buscador)</label>
                            <input 
                                type="text"
                                placeholder="🔍 Buscar por nombre..."
                                value={streetSearch}
                                onChange={(e) => setStreetSearch(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '8px' }}
                            />
                            <select 
                                required 
                                className="manual-select" 
                                style={{ width: '100%', padding: '10px' }}
                                size={5}
                                value={form.street_id}
                                onChange={(e) => setForm({ ...form, street_id: e.target.value })}
                            >
                                {filteredStreets.map(s => (
                                    <option 
                                        key={s.id} 
                                        value={s.id} 
                                        style={{ padding: '8px', cursor: 'pointer' }}
                                        onDoubleClick={(e) => handleAssign(null, s.id)}
                                        title="Haz doble clic para asignar directamente"
                                    >
                                        {s.name}
                                    </option>
                                ))}
                                {filteredStreets.length === 0 && <option value="" disabled>No hay coincidencias</option>}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary" style={{ margin: 0, marginTop: '10px' }}>Asignar Calle</button>
                    </form>
                </div>

                <div className="data-table-container" style={{ flex: '2', minWidth: '400px' }}>
                    {loading ? <p style={{padding:"20px"}}>Cargando demarcaciones...</p> : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Repartidor</th>
                                    <th>Calle Asignada</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {demarcations.map(dem => (
                                    <tr key={dem.id}>
                                        <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{dem.user_name}</td>
                                        <td>{dem.street_name}</td>
                                        <td>
                                            <button className="btn-delete" style={{ margin: 0 }} onClick={() => handleDelete(dem.id)}>
                                                Quitar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {demarcations.length === 0 && (
                                    <tr><td colSpan="3" style={{textAlign:"center"}}>No hay calles asignadas aún</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </AdminLayout>
    );
}
