import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

const MODULES = [
    { key: 'dashboard', label: '📊 Dashboard / Info' },
    { key: 'upload', label: '📤 Subir Notificaciones' },
    { key: 'notifications', label: '📋 Notificaciones' },
    { key: 'reports', label: '📊 Relación de Carga' },
    { key: 'streets', label: '🛣️ Calles / BD' },
    { key: 'demarcations', label: '🗺️ Demarcaciones' },
    { key: 'receipts', label: '📄 Historial / Acuses' },
    { key: 'users', label: '👥 Gestión de Empleados' }
];

export default function UsersManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    const [formData, setFormData] = useState({ name: '', username: '', password: '', role: 'EMPLEADO', permissions: [] });
    const [editData, setEditData] = useState({ id: null, name: '', role: 'EMPLEADO', password: '', permissions: [] });

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
            const finalPermissions = formData.role === 'ADMINISTRADOR' 
                ? MODULES.map(m => m.key) 
                : formData.role === 'GERENTE' ? formData.permissions : [];

            const res = await apiClient.post('/users', { ...formData, permissions: finalPermissions });
            if (res.data.success) {
                setShowCreateModal(false);
                setFormData({ name: '', username: '', password: '', role: 'EMPLEADO', permissions: [] });
                fetchUsers();
            }
        } catch (error) {
            alert(error.response?.data?.error || 'Error creando usuario');
        }
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        try {
            const finalPermissions = editData.role === 'ADMINISTRADOR' 
                ? MODULES.map(m => m.key) 
                : editData.role === 'GERENTE' ? editData.permissions : [];

            const payload = {
                name: editData.name,
                role: editData.role,
                permissions: finalPermissions
            };

            if (editData.password && editData.password.trim() !== '') {
                payload.password = editData.password;
            }

            const res = await apiClient.put(`/users/${editData.id}`, payload);
            if (res.data.success) {
                setShowEditModal(false);
                fetchUsers();
            }
        } catch (error) {
            alert(error.response?.data?.error || 'Error actualizando usuario');
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
    };

    const togglePermission = (key, isEdit = false) => {
        if (isEdit) {
            const current = [...editData.permissions];
            if (current.includes(key)) {
                setEditData({ ...editData, permissions: current.filter(p => p !== key) });
            } else {
                setEditData({ ...editData, permissions: [...current, key] });
            }
        } else {
            const current = [...formData.permissions];
            if (current.includes(key)) {
                setFormData({ ...formData, permissions: current.filter(p => p !== key) });
            } else {
                setFormData({ ...formData, permissions: [...current, key] });
            }
        }
    };

    const openEditModal = (user) => {
        setEditData({
            id: user.id,
            name: user.name,
            role: user.role,
            password: '',
            permissions: user.permissions || []
        });
        setShowEditModal(true);
    };

    const getRoleClass = (role) => {
        if (role === 'ADMINISTRADOR' || role === 'ADMIN') return 'delivered';
        if (role === 'GERENTE') return 'pending';
        return 'returned';
    };

    return (
        <AdminLayout title="Gestión de Usuarios">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowCreateModal(true)}>+ Añadir Usuario</button>
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
                                <th>Permisos / Módulos</th>
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
                                        <span className={`status-pill ${getRoleClass(u.role)}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        {u.role === 'ADMINISTRADOR' || u.role === 'ADMIN' ? (
                                            <span style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>Todos los accesos</span>
                                        ) : u.role === 'EMPLEADO' ? (
                                            <span style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>Solo repartos (App Móvil)</span>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {(u.permissions || []).map(p => {
                                                    const matched = MODULES.find(m => m.key === p);
                                                    return (
                                                        <span key={p} style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                                                            {matched ? matched.label.split(' ').slice(1).join(' ') : p}
                                                        </span>
                                                    );
                                                })}
                                                {(u.permissions || []).length === 0 && (
                                                    <span style={{ fontSize: '0.8rem', color: '#999' }}>Ninguno</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-edit" style={{ margin: 0, padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => openEditModal(u)}>Editar</button>
                                            <button className="btn-delete" style={{ margin: 0, padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDelete(u.id)}>Eliminar</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
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
                                <select className="manual-select" style={{width:'100%'}} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value, permissions: []})}>
                                    <option value="EMPLEADO">Empleado (Repartidor / App Móvil)</option>
                                    <option value="GERENTE">Gerente (Dashboard con permisos limitados)</option>
                                    <option value="ADMINISTRADOR">Administrador (Dashboard con acceso total)</option>
                                </select>
                            </div>

                            {formData.role === 'GERENTE' && (
                                <div style={{ marginTop: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>Asignar Módulos Autorizados</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                        {MODULES.map(m => (
                                            <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={formData.permissions.includes(m.key)} 
                                                    onChange={() => togglePermission(m.key, false)}
                                                />
                                                {m.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="btn-edit" style={{flex: 1}} onClick={() => setShowCreateModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" style={{flex: 1, margin:0}}>Crear Usuario</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ color: 'var(--primary)', marginTop: 0 }}>Modificar Usuario</h3>
                        <form onSubmit={handleEditUser}>
                            <div className="input-group">
                                <label>Nombre Completo</label>
                                <input required value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Nueva Contraseña (dejar en blanco para conservar la actual)</label>
                                <input type="password" placeholder="Escribe nueva contraseña..." value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Rol del Sistema</label>
                                <select className="manual-select" style={{width:'100%'}} value={editData.role} onChange={e => setEditData({...editData, role: e.target.value, permissions: []})}>
                                    <option value="EMPLEADO">Empleado (Repartidor / App Móvil)</option>
                                    <option value="GERENTE">Gerente (Dashboard con permisos limitados)</option>
                                    <option value="ADMINISTRADOR">Administrador (Dashboard con acceso total)</option>
                                </select>
                            </div>

                            {editData.role === 'GERENTE' && (
                                <div style={{ marginTop: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>Modificar Módulos Autorizados</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                                        {MODULES.map(m => (
                                            <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={editData.permissions.includes(m.key)} 
                                                    onChange={() => togglePermission(m.key, true)}
                                                />
                                                {m.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button type="button" className="btn-edit" style={{flex: 1}} onClick={() => setShowEditModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" style={{flex: 1, margin:0}}>Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
