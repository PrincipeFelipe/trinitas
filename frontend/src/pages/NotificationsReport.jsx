import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';
import * as XLSX from 'xlsx';

export default function NotificationsReport() {
    const [uploadDates, setUploadDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [reportData, setReportData] = useState([]);
    const [loadingDates, setLoadingDates] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    
    // Modal state
    const [selectedItem, setSelectedItem] = useState(null);
    const [loadingItem, setLoadingItem] = useState(false);

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const res = await apiClient.get('/notifications/upload-dates');
                if (res.data.success) {
                    setUploadDates(res.data.data);
                    if (res.data.data.length > 0) {
                        setSelectedDate(res.data.data[0]);
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

    const handleRowClick = async (id) => {
        setLoadingItem(true);
        try {
            const res = await apiClient.get(`/notifications/details/${id}`);
            if (res.data.success) {
                setSelectedItem(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching notification details:', err);
            alert('Error al cargar detalles de la notificación');
        } finally {
            setLoadingItem(false);
        }
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) return;

        const dataToExport = reportData.map(row => ({
            'ID Notificación': row.id,
            'Destinatario': row.recipient_name,
            'Dirección': row.full_address,
            'Estado': getStatusLabel(row.status),
            'Fecha Carga': new Date(row.upload_date).toLocaleDateString(),
            '1er Intento': formatDate(row.first_attempt_date),
            'Resultado 1er Intento': row.first_status || '-',
            'Observaciones 1er Intento': row.first_notes || '-',
            '2do Intento': formatDate(row.second_attempt_date),
            'Resultado 2do Intento': row.second_status || '-',
            'Observaciones 2do Intento': row.second_notes || '-',
            'Entregada': row.status === 'DELIVERED' ? 'SÍ' : 'NO',
            'Repartidor': row.courier_name || 'Sin asignar'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-size columns (rough estimate)
        const columnWidths = Object.keys(dataToExport[0]).map(key => ({
            wch: Math.max(...dataToExport.map(row => row[key]?.toString().length || 0), key.length) + 2
        }));
        ws['!cols'] = columnWidths;

        XLSX.utils.book_append_sheet(wb, ws, "Relación de Carga");
        XLSX.writeFile(wb, `Relacion_Carga_${selectedDate}.xlsx`);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleString();
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
                .report-header-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    gap: 16px;
                }
                .report-controls {
                    background: #fff;
                    padding: 20px;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex: 1;
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
                .btn-export {
                    background: #10B981;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s;
                }
                .btn-export:hover {
                    background: #059669;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.15);
                }
                .btn-export:active {
                    transform: translateY(0);
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
                .report-table tbody tr {
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .report-table tbody tr:hover {
                    background: #f8fafc;
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
                .status-return { background: #fee2e2; color: #991b1b; }
                .status-other { background: #e2e8f0; color: #475569; }
                
                .notes-cell {
                    max-width: 200px;
                    font-size: 0.8rem;
                    color: #64748b;
                    font-style: italic;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: white;
                    width: 90%;
                    max-width: 800px;
                    max-height: 90vh;
                    border-radius: 20px;
                    padding: 32px;
                    overflow-y: auto;
                    position: relative;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 24px;
                    border-bottom: 1px solid #e2e8f0;
                    padding-bottom: 16px;
                }
                .modal-header h2 { margin: 0; color: #1a365d; font-size: 1.5rem; }
                .btn-close {
                    background: #f1f5f9;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 18px;
                    cursor: pointer;
                    font-size: 1.2rem;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-close:hover { background: #e2e8f0; color: #1e293b; }
                
                .detail-section { margin-bottom: 24px; }
                .detail-section h3 { 
                    font-size: 1rem; 
                    color: #64748b; 
                    text-transform: uppercase; 
                    letter-spacing: 0.05em;
                    margin-bottom: 12px;
                    border-left: 4px solid #3182ce;
                    padding-left: 12px;
                }
                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }
                .detail-item label { display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }
                .detail-item span { display: block; font-size: 1rem; color: #1e293b; font-weight: 600; margin-top: 4px; }
                
                .attempt-card {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 12px;
                    border: 1px solid #e2e8f0;
                }
                .attempt-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    font-weight: 700;
                }
                .signature-box {
                    margin-top: 16px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 12px;
                    text-align: center;
                }
                .signature-img {
                    max-width: 100%;
                    height: auto;
                    max-height: 150px;
                }
            `}</style>

            <div className="report-header-actions">
                <div className="report-controls">
                    <label>Fecha de Carga:</label>
                    {loadingDates ? (
                        <span>Cargando...</span>
                    ) : (
                        <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                            {uploadDates.map(date => (
                                <option key={date} value={date}>
                                    {new Date(date + 'T00:00:00').toLocaleDateString()}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <button className="btn-export" onClick={handleExportExcel} disabled={reportData.length === 0}>
                    <span>📊</span> Exportar a Excel
                </button>
            </div>

            <div className="report-table-wrapper">
                {loadingReport ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando datos...</div>
                ) : reportData.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No hay registros.</div>
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
                                <th>Obs.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.map(row => {
                                const isDelivered = row.status === 'DELIVERED';
                                return (
                                    <tr key={row.id} onClick={() => handleRowClick(row.id)}>
                                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{row.id}</td>
                                        <td>{row.recipient_name}</td>
                                        <td>
                                            <span className={`status-pill ${
                                                isDelivered ? 'status-delivered' : 
                                                row.status === 'PENDING' ? 'status-pending' :
                                                row.status === 'RETURNED' ? 'status-return' : 'status-other'
                                            }`}>
                                                {getStatusLabel(row.status)}
                                            </span>
                                        </td>
                                        <td>{formatDate(row.first_attempt_date)}</td>
                                        <td>{formatDate(row.second_attempt_date)}</td>
                                        <td style={{ textAlign: 'center' }}>{isDelivered ? '✅' : '❌'}</td>
                                        <td>{row.courier_name || '-'}</td>
                                        <td className="notes-cell" title={`${row.first_notes || ''} ${row.second_notes || ''}`}>
                                            {row.first_notes || row.second_notes || '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Notification Details Modal */}
            {selectedItem && (
                <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>Detalles de Notificación #{selectedItem.id}</h2>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                                    Cargada el {new Date(selectedItem.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <button className="btn-close" onClick={() => setSelectedItem(null)}>✕</button>
                        </div>

                        <div className="detail-section">
                            <h3>Información del Destinatario</h3>
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>Nombre Completo</label>
                                    <span>{selectedItem.recipient_name}</span>
                                </div>
                                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                    <label>Dirección</label>
                                    <span>{selectedItem.full_address}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Calle en BD</label>
                                    <span>{selectedItem.street_name || 'Sin vincular'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Estado Actual</label>
                                    <span className={`status-pill ${selectedItem.status === 'DELIVERED' ? 'status-delivered' : 'status-other'}`} style={{ display: 'inline-block', marginTop: '8px' }}>
                                        {getStatusLabel(selectedItem.status)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="detail-section">
                            <h3>Historial de Intentos</h3>
                            {selectedItem.attempts && selectedItem.attempts.length > 0 ? (
                                selectedItem.attempts.map((att, idx) => (
                                    <div key={idx} className="attempt-card">
                                        <div className="attempt-header">
                                            <span>Intento #{att.attempt_number} - {getStatusLabel(att.status_result)}</span>
                                            <span style={{ color: '#64748b', fontWeight: 400 }}>{new Date(att.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="detail-grid" style={{ marginBottom: '12px' }}>
                                            <div className="detail-item">
                                                <label>Gestionado por</label>
                                                <span>{att.delivered_by_name || 'N/A'}</span>
                                            </div>
                                            {att.status_result === 'DELIVERED' && (
                                                <>
                                                    <div className="detail-item">
                                                        <label>Recibido por</label>
                                                        <span>{att.receiver_name || '-'}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>DNI</label>
                                                        <span>{att.receiver_dni || '-'}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {att.notes && (
                                            <div className="detail-item" style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', marginTop: '12px' }}>
                                                <label>Observaciones del Repartidor</label>
                                                <span style={{ fontStyle: 'italic', color: '#4a5568' }}>"{att.notes}"</span>
                                            </div>
                                        )}
                                        {att.signature_base64 && (
                                            <div className="signature-box">
                                                <label style={{ textAlign: 'left' }}>Firma del Receptor</label>
                                                <img src={att.signature_base64} alt="Firma" className="signature-img" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin intentos registrados todavía.</p>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="btn-huge btn-secondary" onClick={() => setSelectedItem(null)} style={{ padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                                Cerrar Detalles
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
