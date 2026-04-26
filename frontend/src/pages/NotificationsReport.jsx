import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

export default function NotificationsReport() {
    const [uploadDates, setUploadDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [reportData, setReportData] = useState([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const res = await apiClient.get('/notifications/upload-dates');
                if (res.data.success) {
                    setUploadDates(res.data.data);
                    if (res.data.data.length > 0) {
                        const firstDate = new Date(res.data.data[0]).toISOString().split('T')[0];
                        setSelectedDate(firstDate);
                    }
                }
            } catch (err) {
                console.error('Error fetching upload dates:', err);
            } finally {
                setLoadingDates(false);
            }
        };
        fetchDates();
    }, []);

    useEffect(() => {
        if (!selectedDate) return;

        const fetchReport = async () => {
            setLoadingReport(true);
            try {
                const res = await apiClient.get(`/notifications/report/${selectedDate}`);
                if (res.data.success) {
                    setReportData(res.data.data);
                }
            } catch (err) {
                console.error('Error fetching report:', err);
                alert('Error al cargar el reporte');
            } finally {
                setLoadingReport(false);
            }
        };
        fetchReport();
    }, [selectedDate]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    const getStatusLabel = (status) => {
        const labels = {
            'PENDING': 'Pendiente',
            'ATTEMPT_1': '1er Intento',
            'DELIVERED': 'Entregada',
            'RETURNED': 'Devuelta',
            'FAILED': 'Fallida'
        };
        return labels[status] || status;
    };

    return (
        <AdminLayout title="Relación de Notificaciones por Fecha de Carga">
            <style>{`
                .report-controls {
                    background: #fff;
                    padding: 20px;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .report-controls label {
                    font-weight: 700;
                    color: #4a5568;
                }
                .report-controls select {
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    font-size: 1rem;
                    min-width: 200px;
                }
                .report-table-wrapper {
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }
                .report-table th {
                    background: #f8fafc;
                    padding: 12px 16px;
                    text-align: left;
                    font-weight: 700;
                    color: #64748b;
                    border-bottom: 2px solid #e2e8f0;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                }
                .report-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #1e293b;
                }
                .report-table tr:hover {
                    background: #f1f5f9;
                }
                .status-pill {
                    padding: 4px 8px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .status-delivered { background: #d1fae5; color: #065f46; }
                .status-pending { background: #fef3c7; color: #92400e; }
                .status-returned { background: #fee2e2; color: #991b1b; }
                .status-other { background: #e2e8f0; color: #475569; }
                
                .notes-cell {
                    max-width: 200px;
                    font-size: 0.8rem;
                    color: #64748b;
                    font-style: italic;
                }
            `}</style>

            <div className="report-controls">
                <label>Seleccionar Fecha de Carga:</label>
                {loadingDates ? (
                    <span>Cargando fechas...</span>
                ) : (
                    <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                        {uploadDates.map(date => (
                            <option key={date} value={new Date(date).toISOString().split('T')[0]}>
                                {new Date(date).toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="report-table-wrapper">
                {loadingReport ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Generando informe detallado...</div>
                ) : reportData.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No hay datos para la fecha seleccionada.</div>
                ) : (
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Destinatario</th>
                                <th>Estado</th>
                                <th>1er Intento</th>
                                <th>2do Intento</th>
                                <th>Entregada</th>
                                <th>Repartidor</th>
                                <th>Observaciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(row => {
                                const isDelivered = row.status === 'DELIVERED';
                                return (
                                    <tr key={row.id}>
                                        <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{row.id}</td>
                                        <td>{row.recipient_name}</td>
                                        <td>
                                            <span className={`status-pill ${
                                                isDelivered ? 'status-delivered' : 
                                                row.status === 'PENDING' ? 'status-pending' :
                                                row.status === 'RETURNED' ? 'status-returned' : 'status-other'
                                            }`}>
                                                {getStatusLabel(row.status)}
                                            </span>
                                        </td>
                                        <td>{formatDate(row.first_attempt_date)}</td>
                                        <td>{formatDate(row.second_attempt_date)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isDelivered ? '✅ SÍ' : '❌ NO'}
                                        </td>
                                        <td>{row.courier_name || <span style={{ color: '#94a3b8' }}>Sin asignar</span>}</td>
                                        <td className="notes-cell">
                                            {row.first_notes && <div><strong>1º:</strong> {row.first_notes}</div>}
                                            {row.second_notes && <div><strong>2º:</strong> {row.second_notes}</div>}
                                            {!row.first_notes && !row.second_notes && '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </AdminLayout>
    );
}
