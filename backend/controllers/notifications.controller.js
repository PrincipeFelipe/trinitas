const pool = require('../db/connection');
const PDFDocument = require('pdfkit');

const COMPANIES = {
    'ENERGIA_CEUTA': {
        name: 'Energía Ceuta XXI Comercializadora de Referencia, S.A.U.',
        cif: 'A51031920'
    },
    'ALUMBRADO_CEUTA': {
        name: 'Alumbrado Eléctrico de Ceuta Energía, S.L.',
        cif: 'B72775513'
    }
};

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
        
        const company = req.body.company;
        if (!company || !COMPANIES[company]) {
            return res.status(400).json({ success: false, error: 'Compañía inválida o no seleccionada' });
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

        // We no longer clear notifications automatically so multiple uploads (e.g. different companies) can coexist.
        // Use the manual clear script or a button if you need to start fresh.

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
                INSERT INTO notifications (id, recipient_name, full_address, street_id, assigned_user_id, status, company)
                VALUES (?, ?, ?, ?, ?, 'PENDIENTE', ?)
                ON DUPLICATE KEY UPDATE 
                    recipient_name = VALUES(recipient_name),
                    full_address = VALUES(full_address),
                    street_id = VALUES(street_id),
                    assigned_user_id = VALUES(assigned_user_id)
            `, [id, recipient_name, full_address, street_id, assigned_user_id, company]);
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

const extractStreetsOnly = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        let fileContent = req.file.buffer.toString('utf-8');
        if (fileContent.includes('\uFFFD')) {
            fileContent = req.file.buffer.toString('latin1');
        }
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

        const [streets] = await pool.query('SELECT * FROM streets');
        const streetNamesInDb = new Set(streets.map(s => s.name.toUpperCase().replace(/\s+/g, ' ').trim()));
        const newStreetsFound = new Set();

        for (const line of lines) {
            if (line.length < 45) continue;
            const full_address = line.substring(45).trim();
            const extractedStreet = extractStreetName(full_address);
            
            if (extractedStreet && !streetNamesInDb.has(extractedStreet)) {
                newStreetsFound.add(extractedStreet);
            }
        }

        res.json({
            success: true,
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
            const [result] = await pool.query('INSERT IGNORE INTO streets (name) VALUES (?)', [name]);
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
                    'UPDATE notifications SET street_id = ?, assigned_user_id = ? WHERE id = ? AND company = ?',
                    [lookup.id, lookup.user_id, item.notification_id, item.company]
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
        const { notification_id, street_id, company } = req.body;
        
        if (!notification_id || !street_id || !company) {
            return res.status(400).json({ success: false, error: 'Missing parameters (id, street, company)' });
        }

        const [demarcationRows] = await pool.query('SELECT user_id FROM demarcations WHERE street_id = ?', [street_id]);
        const user_id = demarcationRows.length > 0 ? demarcationRows[0].user_id : null;

        await pool.query(
            'UPDATE notifications SET street_id = ?, assigned_user_id = ? WHERE id = ? AND company = ?',
            [street_id, user_id, notification_id, company]
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
                n.company,
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
    const { notification_id, user_id, company } = req.body;
    if (!notification_id || !company) {
        return res.status(400).json({ success: false, error: 'Missing notification_id or company' });
    }

    // user_id can be null to unassign
    await pool.query(
        'UPDATE notifications SET assigned_user_id = ? WHERE id = ? AND company = ?',
        [user_id || null, notification_id, company]
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
        const [notifications] = await pool.query('SELECT id, street_id, assigned_user_id, company FROM notifications');

        let updated = 0;
        for (const n of notifications) {
            const newUserId = n.street_id ? (demMap.get(n.street_id) || null) : null;
            if (newUserId !== n.assigned_user_id) {
                await pool.query('UPDATE notifications SET assigned_user_id = ? WHERE id = ? AND company = ?', [newUserId, n.id, n.company]);
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
        const { company } = req.query;

        // Get notification main data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE n.id = ? AND n.company = ?
        `, [id, company]);

        if (notifRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
        }

        // Get attempts
        const [attemptRows] = await pool.query(`
            SELECT da.*, u.name as delivered_by_name
            FROM delivery_attempts da
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE da.notification_id = ? AND da.company = ?
            ORDER BY da.attempt_number ASC
        `, [id, company]);

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
        const { company } = req.query;

        // Get notification main data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE n.id = ? AND n.company = ?
        `, [id, company]);

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
        doc.moveDown(1);
        
        const companyInfo = COMPANIES[notification.company];
        if (companyInfo) {
            doc.fontSize(11).font('Helvetica-Bold').text('Empresa Emisora: ', { continued: true }).font('Helvetica').text(companyInfo.name);
            doc.font('Helvetica-Bold').text('CIF: ', { continued: true }).font('Helvetica').text(companyInfo.cif);
            doc.moveDown(1.5);
        } else {
            doc.moveDown(1);
        }

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
                
                if (attempt.status_result === 'ENTREGADA') {
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

const generateBulkPdf = async (req, res, next) => {
    try {
        const { pairs: pairsInput } = req.body;
        if (!pairsInput) {
            return res.status(400).json({ success: false, error: 'No se proporcionaron datos' });
        }

        // Si viene como string (formato antiguo o compatibilidad), lo parseamos. 
        // Si viene ya como array de arrays, lo usamos directamente.
        const pairs = typeof pairsInput === 'string' 
            ? pairsInput.split(',').map(p => p.split('|'))
            : pairsInput; 


        // Get all notifications data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE (n.id, n.company) IN (?)
            ORDER BY n.id ASC
        `, [pairs]);

        if (notifRows.length === 0) {
            return res.status(404).json({ success: false, error: 'No se encontraron notificaciones' });
        }

        // Get all attempts for these notifications
        const [attemptRows] = await pool.query(`
            SELECT da.*, u.name as delivered_by_name
            FROM delivery_attempts da
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE (da.notification_id, da.company) IN (?)
            ORDER BY da.notification_id ASC, da.attempt_number ASC
        `, [pairs]);

        // Map attempts to notifications for easy access
        const attemptsByNotif = {};
        attemptRows.forEach(att => {
            const key = `${att.notification_id}|${att.company}`;
            if (!attemptsByNotif[key]) attemptsByNotif[key] = [];
            attemptsByNotif[key].push(att);
        });

        const doc = new PDFDocument({ margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="export_notificaciones_${new Date().getTime()}.pdf"`);
        doc.pipe(res);

        // --- PAGE 1: SUMMARY LIST ---
        doc.fontSize(18).font('Helvetica-Bold').text('RESUMEN DE NOTIFICACIONES', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica').text(`Fecha de exportación: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(1);

        // Table Header
        const startX = 40;
        let currentY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('ID', startX, currentY, { width: 50 });
        doc.text('DESTINATARIO', startX + 60, currentY, { width: 150 });
        doc.text('EMPRESA', startX + 220, currentY, { width: 100 });
        doc.text('ESTADO', startX + 330, currentY, { width: 80 });
        doc.text('REPARTIDOR', startX + 420, currentY, { width: 100 });
        
        doc.moveTo(startX, currentY + 12).lineTo(550, currentY + 12).stroke();
        currentY += 20;

        // Table Rows
        doc.font('Helvetica');
        notifRows.forEach(n => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 40;
            }
            doc.text(n.id, startX, currentY, { width: 50 });
            doc.text(n.recipient_name, startX + 60, currentY, { width: 150, height: 12, ellipsis: true });
            doc.text(n.company.replace('_', ' '), startX + 220, currentY, { width: 100 });
            doc.text(n.status, startX + 330, currentY, { width: 80 });
            doc.text(n.assigned_user_name || '-', startX + 420, currentY, { width: 100 });
            currentY += 15;
        });

        // --- INDIVIDUAL RECEIPT PAGES ---
        notifRows.forEach(notification => {
            const key = `${notification.id}|${notification.company}`;
            const attempts = attemptsByNotif[key] || [];
            
            // Replicate the individual acuse logic for each notification
            doc.addPage();
            
            doc.fontSize(18).font('Helvetica-Bold').text('ACUSE DE RECIBO / NOTIFICACIÓN', { align: 'center' });
            doc.moveDown(1);
            
            const companyInfo = COMPANIES[notification.company];
            if (companyInfo) {
                doc.fontSize(11).font('Helvetica-Bold').text('Empresa Emisora: ', { continued: true }).font('Helvetica').text(companyInfo.name);
                doc.font('Helvetica-Bold').text('CIF: ', { continued: true }).font('Helvetica').text(companyInfo.cif);
                doc.moveDown(1.5);
            } else {
                doc.moveDown(1);
            }

            doc.fontSize(12).font('Helvetica-Bold').text('ID Notificación: ', { continued: true }).font('Helvetica').text(notification.id);
            doc.font('Helvetica-Bold').text('Destinatario: ', { continued: true }).font('Helvetica').text(notification.recipient_name);
            doc.font('Helvetica-Bold').text('Dirección: ', { continued: true }).font('Helvetica').text(notification.full_address);
            doc.font('Helvetica-Bold').text('Repartidor: ', { continued: true }).font('Helvetica').text(notification.assigned_user_name || 'Sin asignar');
            doc.font('Helvetica-Bold').text('Estado: ', { continued: true }).font('Helvetica').text(notification.status);
            
            doc.moveDown(2);
            doc.fontSize(14).font('Helvetica-Bold').text('Historial de Intentos');
            doc.moveDown(1);

            if (attempts.length === 0) {
                doc.fontSize(12).font('Helvetica').text('No hay intentos registrados.');
            } else {
                attempts.forEach(attempt => {
                    doc.fontSize(12).font('Helvetica-Bold').text(`Intento ${attempt.attempt_number} - ${attempt.status_result}`);
                    doc.font('Helvetica-Bold').text('Fecha/Hora: ', { continued: true }).font('Helvetica').text(new Date(attempt.timestamp).toLocaleString());
                    doc.font('Helvetica-Bold').text('Tramitado por: ', { continued: true }).font('Helvetica').text(attempt.delivered_by_name || 'N/A');
                    
                    if (attempt.status_result === 'ENTREGADA') {
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
        });

        doc.end();

    } catch (error) {
        if (!res.headersSent) {
            next(error);
        } else {
            console.error("Bulk PDF generation error: ", error);
            res.end();
        }
    }
};

const getUploadDates = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT DATE_FORMAT(created_at, "%Y-%m-%d") as upload_date FROM notifications ORDER BY upload_date DESC');
        res.json({ success: true, data: rows.map(r => r.upload_date) });
    } catch (error) {
        next(error);
    }
};

const getReportByDate = async (req, res, next) => {
    try {
        const { date } = req.params;
        const query = `
            SELECT 
                n.id, 
                n.recipient_name, 
                n.full_address, 
                n.status,
                n.company,
                n.created_at as upload_date,
                da1.timestamp as first_attempt_date,
                da2.timestamp as second_attempt_date,
                u.name as courier_name,
                da1.status_result as first_status,
                da2.status_result as second_status,
                da1.notes as first_notes,
                da2.notes as second_notes
            FROM notifications n
            LEFT JOIN delivery_attempts da1 ON n.id = da1.notification_id AND n.company = da1.company AND da1.attempt_number = 1
            LEFT JOIN delivery_attempts da2 ON n.id = da2.notification_id AND n.company = da2.company AND da2.attempt_number = 2
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE DATE(n.created_at) = ?
            ORDER BY n.id ASC
        `;
        const [rows] = await pool.query(query, [date]);
        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
};

module.exports = { 
    uploadNotifications, 
    extractStreetsOnly, 
    assignManual, 
    addNewStreets, 
    bulkAssignByStreet, 
    listNotifications, 
    reassignUser, 
    reassignAll, 
    getNotificationDetails, 
    generatePdf,
    generateBulkPdf,
    getUploadDates,
    getReportByDate
};
