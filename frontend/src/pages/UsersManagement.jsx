import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function UsersManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'REPARTIDOR' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/users');
            if (response.data.success) {
                setUsers(response.data.data);
            }
        } catch (error) {
            console.error("Failed fetching users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const res = await apiClient.post('/users', formData);
            if (res.data.success) {
                setShowModal(false);
                setFormData({ name: '', username: '', password: '', role: 'REPARTIDOR' });
                fetchUsers();
            }
        } catch (error) {
            alert(error.response?.data?.error || 'Error creando usuario');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar usuario definitivamente?')) return;
        try {
            const res = await apiClient.delete(`/users/${id}`);
            if (res.data.success) fetchUsers();
        } catch(error) {
            alert('Error eliminando usuario');
        }
    }

    return (
        <AdminLayout title="Gestión de Usuarios">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>+ Añadir Usuario</button>
            </div>

            <div className="data-table-container">
                {loading ? <p style={{padding:"20px"}}>Cargando usuarios...</p> : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nombre</th>
                                <th>Username</th>
                                <th>Rol</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>{u.name}</td>
                                    <td>{u.username}</td>
                                    <td>
                                        <span className={`status-pill ${u.role === 'ADMIN' ? 'delivered' : 'returned'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-delete" onClick={() => handleDelete(u.id)}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
                        <h3 style={{ color: 'var(--primary)', marginTop: 0 }}>Nuevo Usuario</h3>
                        <form onSubmit={handleCreateUser}>
                            <div className="input-group">
                                <label>Nombre Completo</label>
                                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Username (Login)</label>
                                <input required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Contraseña</label>
                                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Rol del Sistema</label>
                                <select className="manual-select" style={{width:'100%'}} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                    <option value="REPARTIDOR">Repartidor (Mobile App)</option>
                                    <option value="ADMIN">Administrador (Dashboard)</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="btn-edit" style={{flex: 1}} onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" style={{flex: 1, margin:0}}>Crear Usuario</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
