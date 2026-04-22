import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiClient.get('/stats');
                if (response.data.success) {
                    setStats(response.data.data);
                }
            } catch (error) {
                console.error("Failed fetching stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <AdminLayout title="Dashboard Principal">
            {loading || !stats ? (
                <p>Cargando estadísticas...</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    
                    <div>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Notificaciones</h3>
                        <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div className="card" style={{ borderLeft: '5px solid var(--action)' }}>
                                <h3>Total Procesadas</h3>
                                <span style={{ color: 'var(--primary)' }}>{stats.notifications.total}</span>
                            </div>
                            <div className="card green-accent">
                                <h3>Entregadas</h3>
                                <span>{stats.notifications.delivered}</span>
                            </div>
                            <div className="card" style={{ borderLeft: '5px solid #ef4444' }}>
                                <h3>Devueltas</h3>
                                <span style={{ color: '#ef4444' }}>{stats.notifications.returned}</span>
                            </div>
                            <div className="card gold-accent">
                                <h3>Huérfanas / Manual</h3>
                                <span>{stats.notifications.unassigned}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}>Equipo y Logística</h3>
                        <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div className="card" style={{ borderLeft: '5px solid #8b5cf6' }}>
                                <h3>Repartidores Activos</h3>
                                <span style={{ color: '#8b5cf6' }}>{stats.users.couriers}</span>
                            </div>
                            <div className="card" style={{ borderLeft: '5px solid #14b8a6' }}>
                                <h3>Total Usuarios</h3>
                                <span style={{ color: '#14b8a6' }}>{stats.users.total}</span>
                            </div>
                            <div className="card" style={{ borderLeft: '5px solid #f97316' }}>
                                <h3>Calles Registradas</h3>
                                <span style={{ color: '#f97316' }}>{stats.streets.total}</span>
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </AdminLayout>
    );
}
