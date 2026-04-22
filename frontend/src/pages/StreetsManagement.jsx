import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function StreetsManagement() {
    const [streets, setStreets] = useState([]);
    const [users, setUsers] = useState([]);
    const [demarcations, setDemarcations] = useState([]);
    const [search, setSearch] = useState('');

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

    const filteredStreets = streets.filter(st => st.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <AdminLayout title="Gestión de Calles">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                <div className="search-filter" style={{ flex: 1, marginRight: '20px' }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar calle por nombre..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ padding: "12px", width: "100%", maxWidth: "400px", borderRadius: "6px", border: "1px solid #ccc" }}
                    />
                </div>
                <button className="btn-primary" style={{ width: 'auto', margin: 0 }}>+ Añadir Calle</button>
            </div>
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
                                        <button className="btn-edit">Editar</button>
                                        <button className="btn-delete">Eliminar</button>
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
