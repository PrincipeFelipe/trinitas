import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../api/client';
import AdminLayout from '../components/AdminLayout';

// ==========================================
// Mini Calendar Component
// ==========================================
function ActivityCalendar({ calendarData, view, onViewChange }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const dataMap = {};
    (calendarData || []).forEach(d => {
        dataMap[d.day] = { attempts: Number(d.attempts), delivered: Number(d.delivered) };
    });

    const fmt = (d) => d.toISOString().split('T')[0];

    const navigate = (dir) => {
        const d = new Date(currentDate);
        if (view === 'month') d.setMonth(d.getMonth() + dir);
        else if (view === 'week') d.setDate(d.getDate() + dir * 7);
        else d.setDate(d.getDate() + dir);
        setCurrentDate(d);
    };

    const getDayCell = (dateStr, label, isOtherMonth = false) => {
        const info = dataMap[dateStr];
        const isToday = dateStr === fmt(new Date());
        return (
            <div key={dateStr} className={`cal-day ${isToday ? 'cal-today' : ''} ${isOtherMonth ? 'cal-other-month' : ''}`}>
                <span className="cal-day-num">{label}</span>
                {info && info.attempts > 0 && (
                    <div className="cal-events">
                        {info.delivered > 0 && (
                            <span className="cal-chip cal-chip-deliver" title={`${info.delivered} entregadas`}>
                                ✅ {info.delivered}
                            </span>
                        )}
                        {(info.attempts - info.delivered) > 0 && (
                            <span className="cal-chip cal-chip-attempt" title={`${info.attempts - info.delivered} intentos`}>
                                🔄 {info.attempts - info.delivered}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const WEEK_DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

        const cells = [];
        // Prev month padding
        for (let i = firstDay - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, daysInPrev - i);
            cells.push(getDayCell(fmt(d), daysInPrev - i, true));
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            cells.push(getDayCell(fmt(date), d));
        }
        while (cells.length % 7 !== 0) {
            const extra = cells.length - (daysInMonth + firstDay) + 1;
            const d = new Date(year, month + 1, extra);
            cells.push(getDayCell(fmt(d), extra, true));
        }

        return (
            <>
                <div className="cal-grid cal-header-row">
                    {WEEK_DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
                </div>
                <div className="cal-grid">{cells}</div>
            </>
        );
    };

    const renderWeek = () => {
        const WEEK_DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
        const day = currentDate.getDay();
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - day);
        const cells = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            cells.push(getDayCell(fmt(d), `${WEEK_DAYS[i]} ${d.getDate()}`));
        }
        return <div className="cal-grid">{cells}</div>;
    };

    const renderDay = () => {
        const dateStr = fmt(currentDate);
        const info = dataMap[dateStr] || { attempts: 0, delivered: 0 };
        return (
            <div className="cal-day-single">
                <h4>{currentDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h4>
                <div className="day-stat-row">
                    <div className="day-stat green">
                        <span className="day-stat-num">{info.delivered}</span>
                        <span>Entregadas</span>
                    </div>
                    <div className="day-stat blue">
                        <span className="day-stat-num">{info.attempts - info.delivered || 0}</span>
                        <span>Solo Intentos</span>
                    </div>
                    <div className="day-stat gray">
                        <span className="day-stat-num">{info.attempts}</span>
                        <span>Total Visitas</span>
                    </div>
                </div>
            </div>
        );
    };

    const monthName = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const weekStart = (() => { const d = new Date(currentDate); d.setDate(d.getDate() - d.getDay()); return d; })();
    const weekEnd = (() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d; })();

    const headerLabel = view === 'month'
        ? monthName.charAt(0).toUpperCase() + monthName.slice(1)
        : view === 'week'
        ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekEnd.toLocaleString('es-ES', { month: 'short' })} ${weekEnd.getFullYear()}`
        : currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="cal-wrapper">
            <div className="cal-toolbar">
                <div className="cal-nav">
                    <button onClick={() => navigate(-1)}>‹</button>
                    <strong>{headerLabel}</strong>
                    <button onClick={() => navigate(1)}>›</button>
                </div>
                <div className="cal-view-btns">
                    {['month', 'week', 'day'].map(v => (
                        <button key={v} className={view === v ? 'active' : ''} onClick={() => onViewChange(v)}>
                            {v === 'month' ? 'Mes' : v === 'week' ? 'Semana' : 'Día'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="cal-body">
                {view === 'month' && renderMonth()}
                {view === 'week' && renderWeek()}
                {view === 'day' && renderDay()}
            </div>
        </div>
    );
}

// ==========================================
// Courier Bar Chart
// ==========================================
function CourierChart({ data }) {
    if (!data || data.length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Sin datos de repartidores.</p>;
    const max = Math.max(...data.map(d => Number(d.total_assigned) || 0), 1);
    return (
        <div className="courier-chart">
            {data.map((c, i) => {
                const total = Number(c.total_assigned) || 0;
                const delivered = Number(c.delivered) || 0;
                const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;
                return (
                    <div key={i} className="courier-row">
                        <span className="courier-name">{c.name}</span>
                        <div className="courier-bar-track">
                            <div className="courier-bar-fill" style={{ width: `${(total / max) * 100}%` }}>
                                <div className="courier-bar-delivered" style={{ width: `${rate}%` }} />
                            </div>
                        </div>
                        <span className="courier-stats">{delivered}/{total} · {rate}%</span>
                    </div>
                );
            })}
        </div>
    );
}

// ==========================================
// Main Dashboard
// ==========================================
export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calView, setCalView] = useState('month');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiClient.get('/stats');
                if (response.data.success) setStats(response.data.data);
            } catch (error) {
                console.error("Failed fetching stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading || !stats) return (
        <AdminLayout title="Dashboard Principal">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <p style={{ color: '#94a3b8' }}>Cargando estadísticas...</p>
            </div>
        </AdminLayout>
    );

    const { notifications: n, users, streets, calendar, unassignedNotifs, courierStats, urgency } = stats;

    return (
        <AdminLayout title="Dashboard Principal">
            <style>{`
                .dash-grid-top {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .kpi-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    border-left: 5px solid #e2e8f0;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
                .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
                .kpi-value { font-size: 2.2rem; font-weight: 800; color: #1a365d; line-height: 1.1; margin: 6px 0 4px; }
                .kpi-sub { font-size: 0.8rem; color: #64748b; }

                .kpi-blue { border-left-color: #3182ce; }
                .kpi-green { border-left-color: #10B981; }
                .kpi-green .kpi-value { color: #065f46; }
                .kpi-red { border-left-color: #ef4444; }
                .kpi-red .kpi-value { color: #991b1b; }
                .kpi-amber { border-left-color: #f59e0b; }
                .kpi-amber .kpi-value { color: #92400e; }
                .kpi-purple { border-left-color: #8b5cf6; }
                .kpi-purple .kpi-value { color: #5b21b6; }
                .kpi-teal { border-left-color: #14b8a6; }
                .kpi-teal .kpi-value { color: #0f766e; }
                .kpi-orange { border-left-color: #f97316; }
                .kpi-orange .kpi-value { color: #c2410c; }

                /* Delivery rate bar */
                .rate-track { height: 6px; background: #e2e8f0; border-radius: 3px; margin-top: 8px; }
                .rate-fill { height: 100%; border-radius: 3px; background: #10B981; transition: width 0.6s ease; }

                /* Urgency pills */
                .urgency-row { display: flex; gap: 8px; flex-wrap: wrap; }
                .urgency-pill { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; }
                .urgency-safe { background: #d1fae5; color: #065f46; }
                .urgency-warn { background: #fef3c7; color: #92400e; }
                .urgency-crit { background: #fee2e2; color: #991b1b; }

                /* Layout bottom section */
                .dash-bottom { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
                @media (max-width: 900px) { .dash-bottom { grid-template-columns: 1fr; } }

                .dash-card {
                    background: #fff;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    margin-bottom: 24px;
                }
                .dash-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .dash-card-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #1a365d;
                }

                /* Calendar */
                .cal-wrapper { }
                .cal-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .cal-nav { display: flex; align-items: center; gap: 12px; }
                .cal-nav button, .cal-view-btns button {
                    background: #f1f5f9;
                    border: none;
                    border-radius: 8px;
                    padding: 6px 12px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: #1a365d;
                    font-weight: 600;
                    transition: background 0.15s;
                }
                .cal-nav button:hover, .cal-view-btns button:hover { background: #e2e8f0; }
                .cal-view-btns { display: flex; gap: 4px; }
                .cal-view-btns button.active { background: #3182ce; color: white; }
                .cal-nav strong { min-width: 200px; text-align: center; color: #1a365d; }

                .cal-header-row, .cal-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }
                .cal-day-header {
                    text-align: center;
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                    padding: 4px 0;
                }
                .cal-day {
                    min-height: 60px;
                    border-radius: 8px;
                    padding: 4px 6px;
                    background: #f8fafc;
                    border: 1px solid #f1f5f9;
                    transition: background 0.15s;
                }
                .cal-day:hover { background: #eff6ff; }
                .cal-today { border: 2px solid #3182ce; background: #eff6ff; }
                .cal-other-month { opacity: 0.35; }
                .cal-day-num { font-size: 0.75rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 2px; }
                .cal-today .cal-day-num { color: #3182ce; }
                .cal-events { display: flex; flex-direction: column; gap: 2px; }
                .cal-chip {
                    font-size: 0.65rem;
                    border-radius: 4px;
                    padding: 1px 4px;
                    font-weight: 700;
                    line-height: 1.4;
                }
                .cal-chip-deliver { background: #d1fae5; color: #065f46; }
                .cal-chip-attempt { background: #dbeafe; color: #1e40af; }

                .cal-day-single { text-align: center; padding: 24px 0; }
                .cal-day-single h4 { color: #1a365d; text-transform: capitalize; margin-bottom: 24px; }
                .day-stat-row { display: flex; justify-content: center; gap: 32px; }
                .day-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .day-stat-num { font-size: 2.5rem; font-weight: 800; }
                .day-stat.green .day-stat-num { color: #10B981; }
                .day-stat.blue .day-stat-num { color: #3182ce; }
                .day-stat.gray .day-stat-num { color: #64748b; }
                .day-stat span:last-child { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }

                /* Courier chart */
                .courier-chart { display: flex; flex-direction: column; gap: 14px; }
                .courier-row { display: grid; grid-template-columns: 140px 1fr 80px; align-items: center; gap: 8px; }
                .courier-name { font-size: 0.85rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .courier-bar-track { height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
                .courier-bar-fill { height: 100%; background: #bfdbfe; border-radius: 6px; position: relative; min-width: 2px; }
                .courier-bar-delivered { position: absolute; left: 0; top: 0; height: 100%; background: #10B981; border-radius: 6px; }
                .courier-stats { font-size: 0.75rem; color: #64748b; text-align: right; }

                /* Unassigned list */
                .unassigned-list { max-height: 280px; overflow-y: auto; }
                .unassigned-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 10px 0;
                    border-bottom: 1px solid #f1f5f9;
                    gap: 8px;
                }
                .unassigned-item:last-child { border-bottom: none; }
                .unassigned-id { font-family: monospace; font-weight: 700; font-size: 0.8rem; color: #3182ce; flex-shrink: 0; }
                .unassigned-info { flex: 1; }
                .unassigned-info p { margin: 0; font-size: 0.85rem; color: #1e293b; font-weight: 600; }
                .unassigned-info small { color: #94a3b8; font-size: 0.75rem; }
                .unassigned-days { font-size: 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 6px; padding: 2px 8px; font-weight: 700; flex-shrink: 0; }
            `}</style>

            {/* KPI Cards Row */}
            <div className="dash-grid-top">
                <div className="kpi-card kpi-blue">
                    <div className="kpi-label">Total Notificaciones</div>
                    <div className="kpi-value">{n.total}</div>
                    <div className="kpi-sub">{n.pending} pendientes · {n.attempt1} en 1er intento</div>
                </div>
                <div className="kpi-card kpi-green">
                    <div className="kpi-label">Entregadas</div>
                    <div className="kpi-value">{n.delivered}</div>
                    <div className="kpi-sub">{n.deliveryRate}% tasa de éxito</div>
                    <div className="rate-track"><div className="rate-fill" style={{ width: `${n.deliveryRate}%` }} /></div>
                </div>
                <div className="kpi-card kpi-red">
                    <div className="kpi-label">Devueltas</div>
                    <div className="kpi-value">{n.returned}</div>
                    <div className="kpi-sub">2 intentos fallidos</div>
                </div>
                <div className="kpi-card kpi-amber">
                    <div className="kpi-label">Sin Asignar</div>
                    <div className="kpi-value">{n.unassigned}</div>
                    <div className="kpi-sub">Requieren demarcación</div>
                </div>
                <div className="kpi-card kpi-purple">
                    <div className="kpi-label">Repartidores</div>
                    <div className="kpi-value">{users.couriers}</div>
                    <div className="kpi-sub">de {users.total} usuarios</div>
                </div>
                <div className="kpi-card kpi-orange">
                    <div className="kpi-label">Calles</div>
                    <div className="kpi-value">{streets.total}</div>
                    <div className="kpi-sub">{streets.assigned} en demarcaciones</div>
                </div>
            </div>

            {/* Urgency Bar */}
            {(urgency.warning > 0 || urgency.critical > 0) && (
                <div className="dash-card" style={{ marginBottom: '24px' }}>
                    <div className="dash-card-header">
                        <span className="dash-card-title">⚠️ Alerta de Plazos</span>
                    </div>
                    <div className="urgency-row">
                        <span className="urgency-pill urgency-safe">✅ {urgency.safe || 0} en plazo</span>
                        <span className="urgency-pill urgency-warn">🟡 {urgency.warning} próximas a vencer</span>
                        <span className="urgency-pill urgency-crit">🔴 {urgency.critical} urgentes / vencidas</span>
                    </div>
                </div>
            )}

            {/* Calendar */}
            <div className="dash-card" style={{ marginBottom: '24px' }}>
                <div className="dash-card-header">
                    <span className="dash-card-title">📅 Actividad de Entregas</span>
                    <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Últimos 90 días</small>
                </div>
                <ActivityCalendar
                    calendarData={calendar}
                    view={calView}
                    onViewChange={setCalView}
                />
            </div>

            {/* Bottom Section */}
            <div className="dash-bottom">
                {/* Courier Performance */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <span className="dash-card-title">👥 Rendimiento por Repartidor</span>
                    </div>
                    <CourierChart data={courierStats} />
                </div>

                {/* Unassigned Notifications */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <span className="dash-card-title">⚠️ Sin Asignar</span>
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700 }}>
                            {n.unassigned} total
                        </span>
                    </div>
                    {unassignedNotifs && unassignedNotifs.length > 0 ? (
                        <div className="unassigned-list">
                            {unassignedNotifs.map(item => {
                                const days = Math.floor((new Date() - new Date(item.created_at)) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={item.id} className="unassigned-item">
                                        <span className="unassigned-id">#{item.id}</span>
                                        <div className="unassigned-info">
                                            <p>{item.recipient_name}</p>
                                            <small>{item.full_address}</small>
                                        </div>
                                        <span className="unassigned-days">{days}d</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            Todas las notificaciones están asignadas ✅
                        </p>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
