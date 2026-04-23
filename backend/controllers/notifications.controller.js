const pool = require('../db/connection');
const PDFDocument = require('pdfkit');

// ==========================================
// Street Name Extraction Engine
// ==========================================
const STREET_TYPES = [
    'URBANIZACIÓN', 'URBANIZACION',
    'ACUARTELAMIENTO',
    'TRANSVERSAL',
    'CARRETERA',
    'BARRIADA',
    'GLORIETA',
    'POLÍGONO', 'POLIGONO',
    'CONJUNTO',
    'ESCALERA',
    'AVENIDA',
    'COLONIA',
    'CAMINO',
    'CUESTA',
    'MUELLE',
    'PASAJE',
    'BARRIO',
    'ARROYO',
    'JARDÍN', 'JARDIN',
    'GRUPO',
    'MONTE',
    'PASEO',
    'PLAYA',
    'PLAZA',
    'CALLE',
    'LUGAR',
    'PATIO',
    'PUENTE',
    'FALDA',
    'LOMA',
    'ZONA',
];

function extractStreetName(fullAddress) {
    let addr = fullAddress.trim().toUpperCase();
    
    let matchedType = null;
    let restAfterType = '';
    
    for (const type of STREET_TYPES) {
        if (addr.startsWith(type)) {
            matchedType = type;
            restAfterType = addr.substring(type.length).trim();
            break;
        }
    }
    
    if (!matchedType) {
        // Non-typed streets: extract up to first number or apartment indicator
        const m = addr.match(/^([A-ZÁÉÍÓÚÑÜ\s.'-]+?)(?:\s+\d|\s+Nº|\s+BLQ|\s+PTL|\s*\()/i);
        if (m) {
            let name = m[1].replace(/\s+/g, ' ').trim();
            name = name.replace(/\s+(DE|DEL|LA|EL|LOS|LAS)\s*$/i, '').trim();
            if (name.length >= 3) return name;
        }
        const fb = addr.match(/^([A-ZÁÉÍÓÚÑÜ\s.'-]+)/i);
        if (fb) {
            let name = fb[1].replace(/\s+/g, ' ').trim();
            name = name.replace(/\s+(DE|DEL|LA|EL|LOS|LAS)\s*$/i, '').trim();
            if (name.length >= 3) return name;
        }
        return null;
    }
    
    // Remove ALL parenthetical content (barriadas, edificios, etc.)
    restAfterType = restAfterType.replace(/\s*\([^)]*\)/g, '').trim();
    // Also handle unmatched opening paren (truncated in fixed-width)
    restAfterType = restAfterType.replace(/\s*\([^)]*$/g, '').trim();
    
    // Extract name: stop at numbers, Nº, apartment/building indicators, or cross-reference street types
    const stopPattern = /(?:\s+\d|\s+Nº|\s+N[º°]?\d|\s+BLQ|\s+PTL|\s+BAJO|\s+PISO|\s+LOCAL|\s+ESC\d|\s+JTO|\s+NAVE|\s+F-|\s+P-|\s+PTA-|\s+CARRETERA\s|\s+CALLE\s|\s+AVENIDA\s)/i;
    const parts = restAfterType.split(stopPattern);
    let streetName = parts[0].replace(/\s+/g, ' ').trim();
    
    // Remove trailing short fragments / artifacts
    streetName = streetName.replace(/\s+(DE|DEL|LA|EL|LOS|LAS|P|N|FR|A|BL|NA|PT|PAR|JUNT|ESC\d*|F-\d*|P-\d*|CARRETERA|CTRA)\s*$/i, '').trim();
    streetName = streetName.replace(/\s+(DE|DEL|LA|EL|LOS|LAS)\s*$/i, '').trim();
    
    // Fix double type: e.g., rest = "GRUPO ALFAU" from main type "GRUPO"
    const typeUpper = matchedType.toUpperCase();
    if (streetName.startsWith(typeUpper + ' ')) {
        streetName = streetName.substring(typeUpper.length).trim();
    }
    
    if (!streetName || streetName.length < 2) return null;
    
    let normalizedType = typeUpper
        .replace('URBANIZACION', 'URBANIZACIÓN')
        .replace('POLIGONO', 'POLÍGONO')
        .replace('JARDIN', 'JARDÍN');
    
    return `${normalizedType} ${streetName}`.replace(/\s+/g, ' ').trim();
}

// ==========================================
// Controllers
// ==========================================

const uploadNotifications = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // Smart encoding detection
        let fileContent = req.file.buffer.toString('utf-8');
        if (fileContent.includes('\uFFFD')) {
            fileContent = req.file.buffer.toString('latin1');
        }
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

        // Load all streets and demarcations
        const [streets] = await pool.query('SELECT * FROM streets');
        const [demarcations] = await pool.query('SELECT * FROM demarcations');

        // Build lookup map: street name (uppercase) -> { id, user_id }
        const streetMap = new Map();
        for (const s of streets) {
            const key = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
            const dem = demarcations.find(d => d.street_id === s.id);
            streetMap.set(key, { id: s.id, user_id: dem ? dem.user_id : null });
        }

        let processed = 0;
        let streetMatchedCount = 0;  // Street found in DB
        let userAssignedCount = 0;   // Street + user (demarcation) found
        let unassigned = [];
        const newStreetsFound = new Set();

        // Clear old notifications before re-import
        await pool.query('DELETE FROM notifications');

        for (const line of lines) {
            if (line.length < 45) continue;

            const id = line.substring(0, 5).trim();
            const recipient_name = line.substring(5, 45).trim();
            const full_address = line.substring(45).trim();
            
            if (!id || !recipient_name || !full_address) continue;
            processed++;

            const extractedStreet = extractStreetName(full_address);
            
            let street_id = null;
            let assigned_user_id = null;

            if (extractedStreet) {
                const lookup = streetMap.get(extractedStreet);
                if (lookup) {
                    street_id = lookup.id;
                    streetMatchedCount++;
                    assigned_user_id = lookup.user_id;
                    if (assigned_user_id) userAssignedCount++;
                } else {
                    newStreetsFound.add(extractedStreet);
                }
            }

            // Unassigned = no user assigned (either no street match or no demarcation)
            if (!assigned_user_id) {
                unassigned.push({ id, recipient_name, full_address, street_id, assigned_user_id, extracted_street: extractedStreet || null });
            }

            await pool.query(`
                INSERT IGNORE INTO notifications (id, recipient_name, full_address, street_id, assigned_user_id, status)
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            `, [id, recipient_name, full_address, street_id, assigned_user_id]);
        }

        res.json({
            success: true,
            processed,
            streetMatched: streetMatchedCount,
            assigned: userAssignedCount,
            unassigned,
            newStreets: Array.from(newStreetsFound).sort()
        });

    } catch (error) {
        next(error);
    }
};

const addNewStreets = async (req, res, next) => {
    try {
        const { streets: streetNames } = req.body;
        if (!streetNames || !Array.isArray(streetNames) || streetNames.length === 0) {
            return res.status(400).json({ success: false, error: 'No streets provided' });
        }

        let added = 0;
        for (const name of streetNames) {
            const [result] = await pool.query('INSERT IGNORE INTO Streets (name) VALUES (?)', [name]);
            if (result.affectedRows > 0) added++;
        }

        res.json({ success: true, added });
    } catch (error) {
        next(error);
    }
};

const bulkAssignByStreet = async (req, res, next) => {
    try {
        const { items } = req.body; // Array of { notification_id, extracted_street }
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'No items provided' });
        }

        // Load streets and demarcations
        const [streets] = await pool.query('SELECT * FROM streets');
        const [demarcations] = await pool.query('SELECT * FROM demarcations');
        
        const streetMap = new Map();
        for (const s of streets) {
            const key = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
            const dem = demarcations.find(d => d.street_id === s.id);
            streetMap.set(key, { id: s.id, user_id: dem ? dem.user_id : null });
        }

        let assigned = 0;
        for (const item of items) {
            if (!item.extracted_street) continue;
            const lookup = streetMap.get(item.extracted_street.toUpperCase());
            if (lookup) {
                await pool.query(
                    'UPDATE notifications SET street_id = ?, assigned_user_id = ? WHERE id = ?',
                    [lookup.id, lookup.user_id, item.notification_id]
                );
                assigned++;
            }
        }

        res.json({ success: true, assigned });
    } catch (error) {
        next(error);
    }
};

const assignManual = async (req, res, next) => {
    try {
        const { notification_id, street_id } = req.body;
        
        if (!notification_id || !street_id) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        const [demarcationRows] = await pool.query('SELECT user_id FROM demarcations WHERE street_id = ?', [street_id]);
        const user_id = demarcationRows.length > 0 ? demarcationRows[0].user_id : null;

        await pool.query(
            'UPDATE notifications SET street_id = ?, assigned_user_id = ? WHERE id = ?',
            [street_id, user_id, notification_id]
        );

        res.json({ success: true, message: 'Notification manually assigned', assigned_user_id: user_id });
    } catch (error) {
        next(error);
    }
};

const listNotifications = async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                n.id,
                n.recipient_name,
                n.full_address,
                n.street_id,
                n.assigned_user_id,
                n.status,
                n.created_at,
                s.name AS street_name,
                u.name AS assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            ORDER BY n.id ASC
        `);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

const reassignUser = async (req, res, next) => {
    try {
        const { notification_id, user_id } = req.body;
        if (!notification_id) {
            return res.status(400).json({ success: false, error: 'Missing notification_id' });
        }

        // user_id can be null to unassign
        await pool.query(
            'UPDATE notifications SET assigned_user_id = ? WHERE id = ?',
            [user_id || null, notification_id]
        );

        res.json({ success: true, message: 'Repartidor actualizado' });
    } catch (error) {
        next(error);
    }
};

const reassignAll = async (req, res, next) => {
    try {
        // Load current demarcations: street_id -> user_id
        const [demarcations] = await pool.query('SELECT street_id, user_id FROM demarcations');
        const demMap = new Map();
        for (const d of demarcations) {
            demMap.set(d.street_id, d.user_id);
        }

        // Load all notifications
        const [notifications] = await pool.query('SELECT id, street_id, assigned_user_id FROM notifications');

        let updated = 0;
        for (const n of notifications) {
            const newUserId = n.street_id ? (demMap.get(n.street_id) || null) : null;
            if (newUserId !== n.assigned_user_id) {
                await pool.query('UPDATE notifications SET assigned_user_id = ? WHERE id = ?', [newUserId, n.id]);
                updated++;
            }
        }

        res.json({ success: true, updated, total: notifications.length });
    } catch (error) {
        next(error);
    }
};

const getNotificationDetails = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get notification main data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE n.id = ?
        `, [id]);

        if (notifRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
        }

        // Get attempts
        const [attemptRows] = await pool.query(`
            SELECT da.*, u.name as delivered_by_name
            FROM delivery_attempts da
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE da.notification_id = ?
            ORDER BY da.attempt_number ASC
        `, [id]);

        res.json({
            success: true,
            data: {
                ...notifRows[0],
                attempts: attemptRows
            }
        });
    } catch (error) {
        next(error);
    }
};

const generatePdf = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get notification main data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE n.id = ?
        `, [id]);

        if (notifRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
        }

        const notification = notifRows[0];

        // Get attempts
        const [attemptRows] = await pool.query(`
            SELECT da.*, u.name as delivered_by_name
            FROM delivery_attempts da
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE da.notification_id = ?
            ORDER BY da.attempt_number ASC
        `, [id]);

        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="acuse_${id}.pdf"`);
        doc.pipe(res);

        // Build the PDF content
        doc.fontSize(18).text('ACUSE DE RECIBO / NOTIFICACIÓN', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).font('Helvetica-Bold').text('ID Notificación: ', { continued: true }).font('Helvetica').text(notification.id);
        doc.font('Helvetica-Bold').text('Destinatario: ', { continued: true }).font('Helvetica').text(notification.recipient_name);
        doc.font('Helvetica-Bold').text('Dirección: ', { continued: true }).font('Helvetica').text(notification.full_address);
        doc.font('Helvetica-Bold').text('Repartidor: ', { continued: true }).font('Helvetica').text(notification.assigned_user_name || 'Sin asignar');
        doc.font('Helvetica-Bold').text('Estado: ', { continued: true }).font('Helvetica').text(notification.status);
        
        doc.moveDown(2);
        doc.fontSize(14).font('Helvetica-Bold').text('Historial de Intentos');
        doc.moveDown(1);

        if (attemptRows.length === 0) {
            doc.fontSize(12).font('Helvetica').text('No hay intentos registrados.');
        } else {
            attemptRows.forEach(attempt => {
                doc.fontSize(12).font('Helvetica-Bold').text(`Intento ${attempt.attempt_number} - ${attempt.status_result}`);
                doc.font('Helvetica-Bold').text('Fecha/Hora: ', { continued: true }).font('Helvetica').text(new Date(attempt.timestamp).toLocaleString());
                doc.font('Helvetica-Bold').text('Tramitado por: ', { continued: true }).font('Helvetica').text(attempt.delivered_by_name || 'N/A');
                
                if (attempt.status_result === 'DELIVERED') {
                    doc.font('Helvetica-Bold').text('Receptor: ', { continued: true }).font('Helvetica').text(attempt.receiver_name || '-');
                    doc.font('Helvetica-Bold').text('DNI: ', { continued: true }).font('Helvetica').text(attempt.receiver_dni || '-');
                    
                    if (attempt.signature_base64) {
                        doc.moveDown(1);
                        doc.font('Helvetica-Bold').text('Firma:');
                        try {
                            const base64Data = attempt.signature_base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
                            const imgBuffer = Buffer.from(base64Data, 'base64');
                            doc.image(imgBuffer, { fit: [200, 100] });
                        } catch (err) {
                            doc.font('Helvetica').text('(Error al cargar la imagen de la firma)');
                        }
                    }
                }
                doc.moveDown(1.5);
            });
        }

        doc.end();

    } catch (error) {
        if (!res.headersSent) {
            next(error);
        } else {
            console.error("PDF generation error: ", error);
            res.end();
        }
    }
};

module.exports = { uploadNotifications, assignManual, addNewStreets, bulkAssignByStreet, listNotifications, reassignUser, reassignAll, getNotificationDetails, generatePdf };
