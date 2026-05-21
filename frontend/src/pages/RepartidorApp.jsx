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
    const [selectedStreet, setSelectedStreet] = useState('ALL');
    const [streetSearchText, setStreetSearchText] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const dropdownRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Unique street names
    const uniqueStreets = Array.from(
        new Set(route.map(item => item.street_name).filter(Boolean))
    ).sort();

    // Filtered unique streets for search dropdown
    const filteredStreetsForSelect = uniqueStreets.filter(st =>
        st.toLowerCase().includes(streetSearchText.toLowerCase())
    );

    // Filter actual notifications list
    const filteredRoute = route.filter(item => {
        // 1. Street filter
        if (selectedStreet !== 'ALL') {
            if (item.street_name !== selectedStreet) return false;
        }

        // 2. Date range filter
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            
            const itemDate = new Date(item.created_at);
            if (itemDate < start) return false;
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            const itemDate = new Date(item.created_at);
            if (itemDate > end) return false;
        }

        return true;
    });

    const hasActiveFilters = selectedStreet !== 'ALL' || startDate !== '' || endDate !== '';
    
    const handleClearFilters = () => {
        setSelectedStreet('ALL');
        setStreetSearchText('');
        setStartDate('');
        setEndDate('');
        setIsDropdownOpen(false);
    };

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
                <p>Mi Ruta de Hoy: <strong>{filteredRoute.length} de {route.length} pendientes</strong></p>
            </header>

            <div className="mobile-filters-bar">
                <div className="filter-row">
                    <span className="filter-label">📍 Filtrar por Calle</span>
                    <div className="search-select-container" ref={dropdownRef}>
                        <button 
                            type="button" 
                            className="search-select-button" 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                                {selectedStreet === 'ALL' ? 'Todas las calles' : selectedStreet}
                            </span>
                            <span>{isDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {isDropdownOpen && (
                            <div className="search-select-dropdown">
                                <input 
                                    type="text" 
                                    className="search-select-search-input" 
                                    placeholder="Buscar calle..." 
                                    value={streetSearchText}
                                    onChange={e => setStreetSearchText(e.target.value)}
                                    autoFocus
                                />
                                <ul className="search-select-options-list">
                                    <li 
                                        className={`search-select-option ${selectedStreet === 'ALL' ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedStreet('ALL');
                                            setIsDropdownOpen(false);
                                            setStreetSearchText('');
                                        }}
                                    >
                                        Todas las calles
                                    </li>
                                    {filteredStreetsForSelect.length === 0 ? (
                                        <li className="search-select-option" style={{ color: '#999', cursor: 'default' }}>
                                            No se encontraron calles
                                        </li>
                                    ) : (
                                        filteredStreetsForSelect.map(st => (
                                            <li 
                                                key={st}
                                                className={`search-select-option ${selectedStreet === st ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedStreet(st);
                                                    setIsDropdownOpen(false);
                                                    setStreetSearchText('');
                                                }}
                                            >
                                                {st}
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div className="filter-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div className="date-filter-group">
                        <div className="date-input-wrapper">
                            <span className="filter-label">📅 Desde</span>
                            <input 
                                type="date" 
                                className="filter-input" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                            />
                        </div>
                        <div className="date-input-wrapper">
                            <span className="filter-label">📅 Hasta</span>
                            <input 
                                type="date" 
                                className="filter-input" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                            />
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <button 
                            type="button" 
                            className="btn-clear-filters"
                            onClick={handleClearFilters}
                            style={{ height: '34px' }}
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .mobile-card.border-safe { border-left: 5px solid #48bb78; }
                .mobile-card.border-warning { border-left: 5px solid #ed8936; }
                .mobile-card.border-expired { border-left: 5px solid #e53e3e; }
                
                .urgency-label { font-size: 0.7rem; font-weight: 700; margin-top: 4px; display: block; }
                .urgency-safe { color: #2f855a; }
                .urgency-warning { color: #c05621; }
                .urgency-expired { color: #c53030; }

                .mobile-filters-bar {
                    background: #ffffff;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 12px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .filter-row {
                    width: 100%;
                }
                .filter-label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 4px;
                }
                .filter-input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    color: var(--text-dark);
                    background: #f8fafc;
                    box-sizing: border-box;
                }
                .filter-input:focus {
                    outline: none;
                    border-color: var(--action);
                    background: #ffffff;
                }

                .search-select-container {
                    position: relative;
                    width: 100%;
                }
                .search-select-button {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    text-align: left;
                    color: var(--text-dark);
                    background: #f8fafc;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-sizing: border-box;
                }
                .search-select-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    margin-top: 4px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    z-index: 50;
                    max-height: 220px;
                    overflow-y: auto;
                    padding: 8px;
                    box-sizing: border-box;
                }
                .search-select-search-input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    margin-bottom: 8px;
                    box-sizing: border-box;
                }
                .search-select-search-input:focus {
                    outline: none;
                    border-color: var(--action);
                }
                .search-select-options-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    max-height: 140px;
                    overflow-y: auto;
                }
                .search-select-option {
                    padding: 6px 10px;
                    font-size: 0.8rem;
                    cursor: pointer;
                    border-radius: 6px;
                    color: var(--text-dark);
                    transition: background 0.15s;
                }
                .search-select-option:hover {
                    background: #f1f5f9;
                }
                .search-select-option.selected {
                    background: #e0f2fe;
                    color: #0369a1;
                    font-weight: 600;
                }
                .date-filter-group {
                    display: flex;
                    gap: 8px;
                    flex: 1;
                }
                .date-input-wrapper {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .btn-clear-filters {
                    background: #cbd5e1;
                    color: #475569;
                    border: none;
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-clear-filters:hover {
                    background: #94a3b8;
                    color: #1e293b;
                }
            `}</style>
            <div className="mobile-body">
                {route.length === 0 ? (
                    <p className="empty-state">No tienes notificaciones pendientes para hoy.</p>
                ) : filteredRoute.length === 0 ? (
                    <p className="empty-state" style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '40px 10px' }}>
                        No hay notificaciones que coincidan con los filtros aplicados.
                    </p>
                ) : (
                    filteredRoute.map(item => {
                        const daysElapsed = Math.floor((new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24));
                        const daysRemaining = 8 - daysElapsed;
                        
                        let urgency = 'safe';
                        if (daysRemaining <= 3) urgency = 'expired';
                        else if (daysRemaining < 6) urgency = 'warning';

                        const urgencyText = daysRemaining < 0 ? 'Expirada' : `Plazo: ${daysRemaining} días`;

                        return (
                            <div key={`${item.id}-${item.company}`} className={`mobile-card border-${urgency}`} onClick={() => onSelect(item)}>
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
    const [receiverName, setReceiverName] = useState(item.recipient_name || '');
    const [receiverDni, setReceiverDni] = useState('');
    const [notes, setNotes] = useState('');
    const canvasRef = useRef(null);
    const sigPadRef = useRef(null);
    const [submitting, setSubmitting] = useState(false);

    // Initialize SignaturePad when delivery form is shown
    useEffect(() => {
        if (action === 'ENTREGADA' && canvasRef.current) {
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
        if (status_result === 'ENTREGADA') {
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
                signature_base64,
                notes,
                company: item.company
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

    const getStatusLabel = (status) => {
        const labels = {
            'ENTREGADA': 'Entregada',
            'AUSENTE': 'Ausente',
            'REHUSADO': 'Rehusado',
            'DESCONOCIDO': 'Desconocido'
        };
        return labels[status] || status;
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
                        <div className="input-group" style={{ marginBottom: '16px' }}>
                            <label>Observaciones / Incidencias</label>
                            <textarea 
                                value={notes} 
                                onChange={e => setNotes(e.target.value)}
                                style={{ width: '100%', height: '80px', borderRadius: '8px', border: '1px solid #ddd', padding: '8px', fontSize: '0.9rem' }}
                                placeholder="Escribe aquí cualquier observación..."
                            />
                        </div>
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('AUSENTE')} disabled={submitting}>Ausente</button>
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('REHUSADO')} disabled={submitting}>Rehusado</button>
                        <button className="btn-huge btn-negative" onClick={() => handleSubmit('DESCONOCIDO')} disabled={submitting}>Desconocido</button>
                        <hr className="divider" />
                        <button className="btn-huge btn-positive" onClick={() => setAction('ENTREGADA')}>Entregado</button>
                    </div>
                )}

                {action === 'ENTREGADA' && (
                    <div className="delivery-form">
                        <div className="input-group">
                            <label>Nombre del Receptor</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={receiverName} onChange={e => setReceiverName(e.target.value)} style={{ flex: 1 }} />
                                <button type="button" onClick={() => setReceiverName('')} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#64748b', fontWeight: 'bold' }} title="Limpiar">
                                    ✕
                                </button>
                            </div>
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

                        <button className="btn-huge btn-positive" onClick={() => handleSubmit('ENTREGADA')} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Confirmar y Guardar Entrega'}
                        </button>
                        <button className="btn-huge btn-secondary mt-10" onClick={() => setAction(null)}>Cancelar</button>
                    </div>
                )}
            </div>
        </div>
    );
}
