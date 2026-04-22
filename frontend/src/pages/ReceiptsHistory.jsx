import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

export default function ReceiptsHistory() {
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/receipts/history');
            if (res.data.success) {
                setHistory(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching history', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (id) => {
        try {
            // Using blob response type to handle PDF binary securely with Axios JWT
            const response = await apiClient.get(`/receipts/${id}`, { responseType: 'blob' });
            
            // Artificial DOM download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download failed', error);
            alert('Error descargando el Acuse. Informe puede estar generándose aún, espere un momento.');
        }
    };

    const filtered = history.filter(item => 
        item.id.includes(search) || item.recipient_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AdminLayout title="Historial de Acuses de Recibo">
            <div className="search-filter" style={{ marginBottom: "20px" }}>
                <input 
                    type="text" 
                    placeholder="Buscar por ID o Nombre..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ padding: "12px", width: "100%", maxWidth: "400px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
            </div>

            <div className="data-table-container">
                {loading ? <p style={{padding:"20px"}}>Cargando registros...</p> : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID Notificación</th>
                                <th>Destinatario</th>
                                <th>Dirección</th>
                                <th>Estado Final</th>
                                <th>Acuse de Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.recipient_name}</td>
                                    <td>{item.full_address}</td>
                                    <td>
                                        <span className={`status-pill ${item.status === 'DELIVERED' ? 'delivered' : 'returned'}`}>
                                            {item.status === 'DELIVERED' ? 'Entregado' : 'Devuelto'}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn-primary" style={{margin:0, width:'auto'}} onClick={() => handleDownload(item.id)}>
                                            ↓ PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan="5" style={{textAlign:"center"}}>No hay acuses disponibles</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </AdminLayout>
    );
}
