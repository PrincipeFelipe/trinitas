import React, { useState, useEffect, useRef, useContext } from 'react';
import apiClient from '../api/client';
import SignaturePad from 'signature_pad';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function RepartidorApp() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [route, setRoute] = useState([]);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [loading, setLoading] = useState(true);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        fetchRoute();
    }, []);

    const fetchRoute = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/deliveries/my-route');
            if (res.data.success) {
                setRoute(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching route:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="mobile-app"><div style={{textAlign:'center',padding:'60px 20px',color:'#999'}}>Cargando ruta...</div></div>;

    return (
        <div className="mobile-app">
            {!selectedNotification ? (
                <RouteList route={route} onSelect={setSelectedNotification} user={user} onLogout={handleLogout} />
            ) : (
                <DeliveryAction 
                    item={selectedNotification} 
                    onBack={() => { setSelectedNotification(null); fetchRoute(); }} 
                />
            )}
        </div>
    );
}

function RouteList({ route, onSelect, user, onLogout }) {
    return (
        <div className="mobile-view">
            <header className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>TRINITAS</h2>
                    <button onClick={onLogout} style={{
                        background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer'
                    }}>🚪 Salir</button>
                </div>
                {user && <p style={{ margin: '4px 0 2px', opacity: 0.85, fontSize: '0.9rem' }}>👤 {user.name}</p>}
                <p>Mi Ruta de Hoy: <strong>{route.length} pendientes</strong></p>
            </header>
            <style>{`
                .mobile-card.border-safe { border-left: 5px solid #48bb78; }
                .mobile-card.border-warning { border-left: 5px solid #ed8936; }
                .mobile-card.border-expired { border-left: 5px solid #e53e3e; }
                
                .urgency-label { font-size: 0.7rem; font-weight: 700; margin-top: 4px; display: block; }
                .urgency-safe { color: #2f855a; }
                .urgency-warning { color: #c05621; }
                .urgency-expired { color: #c53030; }
            `}</style>
            <div className="mobile-body">
                {route.length === 0 ? (
                    <p className="empty-state">No tienes notificaciones pendientes para hoy.</p>
                ) : (
                    route.map(item => {
                        const daysElapsed = Math.floor((new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24));
                        const daysRemaining = 8 - daysElapsed;
                        
                        let urgency = 'safe';
                        if (daysRemaining <= 3) urgency = 'expired';
                        else if (daysRemaining < 6) urgency = 'warning';

                        const urgencyText = daysRemaining < 0 ? 'Expirada' : `Plazo: ${daysRemaining} días`;

                        return (
                            <div key={item.id} className={`mobile-card border-${urgency}`} onClick={() => onSelect(item)}>
                                <div className="card-header">
                                    <span className="item-id">#{item.id}</span>
                                    <span className={`attempt-pill attempt-${item.current_attempt_number}`}>
                                        Intento {item.current_attempt_number}
                                    </span>
                                </div>
                                <h3 className="recipient-name">{item.recipient_name}</h3>
                                <p className="full-address">{item.full_address}</p>
                                <p className="street-name">Calle: {item.street_name || 'Sin asignar'}</p>
                                <span className={`urgency-label urgency-${urgency}`}>{urgencyText}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function DeliveryAction({ item, onBack }) {
    const [action, setAction] = useState(null);
    const [receiverName, setReceiverName] = useState('');
    const [receiverDni, setReceiverDni] = useState('');
    const canvasRef = useRef(null);
    const sigPadRef = useRef(null);
    const [submitting, setSubmitting] = useState(false);

    // Initialize SignaturePad when delivery form is shown
    useEffect(() => {
        if (action === 'DELIVERED' && canvasRef.current) {
            // Resize canvas to fill wrapper
            const canvas = canvasRef.current;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d').scale(ratio, ratio);

            sigPadRef.current = new SignaturePad(canvas, {
                penColor: '#1a3b6e',
                minWidth: 1.5,
                maxWidth: 3,
            });
        }
        return () => {
            if (sigPadRef.current) {
                sigPadRef.current.off();
            }
        };
    }, [action]);

    const handleSubmit = async (status_result) => {
        setSubmitting(true);

        let signature_base64 = null;
        if (status_result === 'DELIVERED') {
            if (!receiverName || !receiverDni) {
                alert('Por favor rellena Nombre y DNI del receptor.');
                setSubmitting(false);
                return;
            }
            if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
                alert('Por favor añade la firma del receptor.');
                setSubmitting(false);
                return;
            }
            signature_base64 = sigPadRef.current.toDataURL('image/png');
        }

        try {
            await apiClient.post(`/deliveries/attempt/${item.id}`, {
                status_result,
                receiver_name: receiverName,
                receiver_dni: receiverDni,
                signature_base64
            });
            alert('Operación registrada exitosamente');
            onBack();
        } catch (error) {
            console.error('Submission error', error);
            alert(error.response?.data?.error || 'Error al guardar estado');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mobile-view delivery-action">
            <header className="mobile-header">
                <button className="btn-back" onClick={onBack}>← Volver</button>
                <h2>Notificación #{item.id}</h2>
            </header>
            <div className="mobile-body">
                <div className="info-box">
                    <h3>{item.recipient_name}</h3>
                    <p>{item.full_address}</p>
                </div>

                {!action && (
                    <div className="action-buttons">
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('ABSENT')} disabled={submitting}>Ausente</button>
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('REFUSED')} disabled={submitting}>Rehusado</button>
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('UNKNOWN')} disabled={submitting}>Desconocido</button>
                        <hr className="divider" />
                        <button className="btn-huge btn-positive" onClick={() => setAction('DELIVERED')}>Entregado</button>
                    </div>
                )}

                {action === 'DELIVERED' && (
                    <div className="delivery-form">
                        <div className="input-group">
                            <label>Nombre del Receptor</label>
                            <input type="text" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>D.N.I. Receptor</label>
                            <input type="text" value={receiverDni} onChange={e => setReceiverDni(e.target.value)} />
                        </div>
                        <div className="input-group signature-box">
                            <label>Firma del Receptor</label>
                            <div className="canvas-wrapper" style={{ position: 'relative', border: '2px solid #ddd', borderRadius: '8px', background: '#fff', touchAction: 'none' }}>
                                <canvas
                                    ref={canvasRef}
                                    className="sigCanvas"
                                    style={{ width: '100%', height: '180px', display: 'block', borderRadius: '6px' }}
                                />
                            </div>
                            <button className="btn-clear" onClick={() => sigPadRef.current?.clear()}>Limpiar Firma</button>
                        </div>

                        <button className="btn-huge btn-positive" onClick={() => handleSubmit('DELIVERED')} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Confirmar y Guardar Entrega'}
                        </button>
                        <button className="btn-huge btn-secondary mt-10" onClick={() => setAction(null)}>Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
}
