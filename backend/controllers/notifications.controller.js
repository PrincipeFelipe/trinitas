const pool = require('../db/connection');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

function removeDoubleStreetType(streetPart) {
    for (const type of STREET_TYPES) {
        const doubleType = type + ' ' + type + ' ';
        if (streetPart.startsWith(doubleType)) {
            return streetPart.substring(type.length + 1);
        }
    }
    return streetPart;
}

function parseStreetFromAddress(fullAddress, sortedStreets, streetMap) {
    const normalizedAddress = fullAddress.toUpperCase().replace(/\s+/g, ' ').trim();

    // Helper function to match
    function tryMatch(addressStr, streetPartStr) {
        // A. Exact Match (if streetPartStr is provided)
        if (streetPartStr) {
            const lookup = streetMap.get(streetPartStr);
            if (lookup) {
                return {
                    street_id: lookup.id,
                    assigned_user_id: lookup.user_id || null,
                    extractedStreet: streetPartStr,
                    matched: true
                };
            }
        }

        // B. Prefix Match
        for (const s of sortedStreets) {
            const normalizedStreetName = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
            if (addressStr.startsWith(normalizedStreetName)) {
                if (addressStr.length === normalizedStreetName.length || 
                    !/^[A-ZÁÉÍÓÚÑÜ]/.test(addressStr.charAt(normalizedStreetName.length))) {
                    
                    const lookup = streetMap.get(normalizedStreetName);
                    return {
                        street_id: lookup.id,
                        assigned_user_id: lookup.user_id || null,
                        extractedStreet: normalizedStreetName,
                        matched: true
                    };
                }
            }
        }

        // C. Truncated Match
        for (const s of sortedStreets) {
            const normalizedStreetName = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
            if (addressStr.length >= 25 && normalizedStreetName.startsWith(addressStr)) {
                const lookup = streetMap.get(normalizedStreetName);
                return {
                    street_id: lookup.id,
                    assigned_user_id: lookup.user_id || null,
                    extractedStreet: normalizedStreetName,
                    matched: true
                };
            }
        }

        // D. Truncated Match for streetPartStr (if provided)
        if (streetPartStr && streetPartStr.length >= 25) {
            for (const s of sortedStreets) {
                const normalizedStreetName = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
                if (normalizedStreetName.startsWith(streetPartStr)) {
                    const lookup = streetMap.get(normalizedStreetName);
                    return {
                        street_id: lookup.id,
                        assigned_user_id: lookup.user_id || null,
                        extractedStreet: normalizedStreetName,
                        matched: true
                    };
                }
            }
        }

        return null;
    }

    // 1. First, try matching with the original address parts
    let doubleSpaceStreetPart = null;
    if (fullAddress.includes('  ')) {
        const parts = fullAddress.split('  ');
        doubleSpaceStreetPart = parts[0].toUpperCase().replace(/\s+/g, ' ').trim();
    }

    let match = tryMatch(normalizedAddress, doubleSpaceStreetPart);
    if (match) return match;

    // 2. If no match, try removing double street type (e.g. "GRUPO GRUPO ALFAU" -> "GRUPO ALFAU")
    const cleanAddress = removeDoubleStreetType(normalizedAddress);
    const cleanStreetPart = doubleSpaceStreetPart ? removeDoubleStreetType(doubleSpaceStreetPart) : null;

    if (cleanAddress !== normalizedAddress || cleanStreetPart !== doubleSpaceStreetPart) {
        match = tryMatch(cleanAddress, cleanStreetPart);
        if (match) return match;
    }

    // 3. Fallback: if double space split part existed but didn't match in DB, return it as new street found
    if (cleanStreetPart || doubleSpaceStreetPart) {
        return {
            street_id: null,
            assigned_user_id: null,
            extractedStreet: cleanStreetPart || doubleSpaceStreetPart,
            matched: false
        };
    }

    // 4. Legacy Fallback
    const legacyExtracted = extractStreetName(fullAddress);
    if (legacyExtracted) {
        const lookup = streetMap.get(legacyExtracted);
        if (lookup) {
            return {
                street_id: lookup.id,
                assigned_user_id: lookup.user_id || null,
                extractedStreet: legacyExtracted,
                matched: true
            };
        } else {
            return {
                street_id: null,
                assigned_user_id: null,
                extractedStreet: legacyExtracted,
                matched: false
            };
        }
    }

    // 5. Default
    return {
        street_id: null,
        assigned_user_id: null,
        extractedStreet: null,
        matched: false
    };
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

        const sortedStreets = [...streets].sort((a, b) => b.name.length - a.name.length);

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

        for (const line of lines) {
            if (line.length < 45) continue;

            const id = line.substring(0, 5).trim();
            const recipient_name = line.substring(5, 45).trim();
            const full_address = line.substring(45).trim();
            
            if (!id || !recipient_name || !full_address) continue;
            processed++;

            const match = parseStreetFromAddress(full_address, sortedStreets, streetMap);
            
            let street_id = match.street_id;
            let assigned_user_id = match.assigned_user_id;

            if (match.matched) {
                streetMatchedCount++;
                if (assigned_user_id) userAssignedCount++;
            } else if (match.extractedStreet) {
                newStreetsFound.add(match.extractedStreet);
            }

            const [insertResult] = await pool.query(`
                INSERT INTO notifications (id_notificacion, recipient_name, full_address, street_id, assigned_user_id, status, company)
                VALUES (?, ?, ?, ?, ?, 'PENDIENTE', ?)
            `, [id, recipient_name, full_address, street_id, assigned_user_id, company]);

            const dbId = insertResult.insertId;

            // Unassigned = no user assigned (either no street match or no demarcation)
            if (!assigned_user_id) {
                unassigned.push({ 
                    id: dbId, 
                    id_notificacion: id,
                    recipient_name, 
                    full_address, 
                    street_id, 
                    assigned_user_id, 
                    extracted_street: match.extractedStreet || null 
                });
            }
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
        const sortedStreets = [...streets].sort((a, b) => b.name.length - a.name.length);
        const streetMap = new Map();
        for (const s of streets) {
            const key = s.name.toUpperCase().replace(/\s+/g, ' ').trim();
            streetMap.set(key, { id: s.id, user_id: null });
        }
        
        const newStreetsFound = new Set();

        for (const line of lines) {
            if (line.length < 45) continue;
            const full_address = line.substring(45).trim();
            const match = parseStreetFromAddress(full_address, sortedStreets, streetMap);
            
            if (match.extractedStreet && !match.matched) {
                newStreetsFound.add(match.extractedStreet);
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
            return res.status(400).json({ success: false, error: 'Missing parameters (notification_id, street_id)' });
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
                n.id_notificacion,
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
        const logoPath = path.join(__dirname, '../assets/trinitas_logo.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, { fit: [150, 75], align: 'center' });
            doc.moveDown(1);
        }
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

        doc.fontSize(12).font('Helvetica-Bold').text('ID Notificación: ', { continued: true }).font('Helvetica').text(notification.id_notificacion);
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

        const ids = typeof pairsInput === 'string' 
            ? pairsInput.split(',').map(p => {
                const parts = p.split('|');
                return parseInt(parts[0]);
              })
            : pairsInput.map(p => {
                if (Array.isArray(p)) return parseInt(p[0]);
                return parseInt(p);
              });

        // Get all notifications data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name, u.name as assigned_user_name
            FROM notifications n
            LEFT JOIN streets s ON n.street_id = s.id
            LEFT JOIN users u ON n.assigned_user_id = u.id
            WHERE n.id IN (?)
            ORDER BY n.id ASC
        `, [ids]);

        if (notifRows.length === 0) {
            return res.status(404).json({ success: false, error: 'No se encontraron notificaciones' });
        }

        // Get all attempts for these notifications
        const [attemptRows] = await pool.query(`
            SELECT da.*, u.name as delivered_by_name
            FROM delivery_attempts da
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE da.notification_id IN (?)
            ORDER BY da.notification_id ASC, da.attempt_number ASC
        `, [ids]);

        // Map attempts to notifications for easy access
        const attemptsByNotif = {};
        attemptRows.forEach(att => {
            const key = att.notification_id;
            if (!attemptsByNotif[key]) attemptsByNotif[key] = [];
            attemptsByNotif[key].push(att);
        });

        const doc = new PDFDocument({ margin: 40, layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="export_notificaciones_${new Date().getTime()}.pdf"`);
        doc.pipe(res);

        // Helper to draw table header in landscape
        const drawHeader = (doc, startX, y) => {
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('ID', startX, y, { width: 40 });
            doc.text('DESTINATARIO', startX + 45, y, { width: 150 });
            doc.text('EMPRESA', startX + 200, y, { width: 130 });
            doc.text('ESTADO', startX + 335, y, { width: 60 });
            doc.text('REPARTIDOR', startX + 400, y, { width: 75 });
            doc.text('FECHA CARGA', startX + 480, y, { width: 60 });
            doc.text('INTENTO 1', startX + 545, y, { width: 105 });
            doc.text('INTENTO 2', startX + 655, y, { width: 105 });
            
            doc.moveTo(startX, y + 12).lineTo(800, y + 12).stroke();
        };

        // --- PAGE 1: SUMMARY LIST ---
        doc.fontSize(18).font('Helvetica-Bold').text('RESUMEN DE NOTIFICACIONES', { align: 'center' });
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica').text(`Fecha de exportación: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(1);

        // Table Header
        const startX = 40;
        let currentY = doc.y;
        
        drawHeader(doc, startX, currentY);
        currentY += 20;

        // Table Rows
        doc.font('Helvetica');
        notifRows.forEach(n => {
            const key = n.id;
            const attempts = attemptsByNotif[key] || [];

            const formatAttempt = (att) => {
                if (!att) return '-';
                const d = new Date(att.timestamp);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
            };

            const attempt1Str = formatAttempt(attempts[0]);
            const attempt2Str = formatAttempt(attempts[1]);

            const loadDateStr = n.created_at ? (() => {
                const d = new Date(n.created_at);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                return `${day}/${month}/${d.getFullYear()}`;
            })() : '-';

            const compName = COMPANIES[n.company]?.name || n.company;

            // Calculate dynamic row height based on cell wrappers in size 8
            doc.fontSize(8).font('Helvetica');
            const idHeight = doc.heightOfString(n.id_notificacion || '', { width: 40 });
            const nameHeight = doc.heightOfString(n.recipient_name || '', { width: 150 });
            const compHeight = doc.heightOfString(compName || '', { width: 130 });
            const statusHeight = doc.heightOfString(n.status || '', { width: 60 });
            const courierHeight = doc.heightOfString(n.assigned_user_name || 'Sin Asignar', { width: 75 });
            const loadHeight = doc.heightOfString(loadDateStr || '', { width: 60 });
            const att1Height = doc.heightOfString(attempt1Str || '', { width: 105 });
            const att2Height = doc.heightOfString(attempt2Str || '', { width: 105 });

            const rowHeight = Math.max(idHeight, nameHeight, compHeight, statusHeight, courierHeight, loadHeight, att1Height, att2Height, 15) + 6;

            // Check page boundary before drawing
            if (currentY + rowHeight > 540) {
                doc.addPage({ layout: 'landscape' });
                currentY = 40;
                drawHeader(doc, startX, currentY);
                currentY += 20;
            }

            doc.fontSize(8);
            doc.text(n.id_notificacion, startX, currentY, { width: 40 });
            doc.text(n.recipient_name, startX + 45, currentY, { width: 150 });
            doc.text(compName, startX + 200, currentY, { width: 130 });
            doc.text(n.status, startX + 335, currentY, { width: 60 });
            doc.text(n.assigned_user_name || 'Sin Asignar', startX + 400, currentY, { width: 75 });
            doc.text(loadDateStr, startX + 480, currentY, { width: 60 });
            doc.text(attempt1Str, startX + 545, currentY, { width: 105 });
            doc.text(attempt2Str, startX + 655, currentY, { width: 105 });
            currentY += rowHeight;
        });

        // --- INDIVIDUAL RECEIPT PAGES ---
        notifRows.forEach(notification => {
            const key = notification.id;
            const attempts = attemptsByNotif[key] || [];
            
            // Replicate the individual acuse logic for each notification
            doc.addPage({ layout: 'portrait', margin: 50 });
            
            const logoPath = path.join(__dirname, '../assets/trinitas_logo.jpg');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, { fit: [150, 75], align: 'center' });
                doc.moveDown(1);
            }
            
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

            doc.fontSize(12).font('Helvetica-Bold').text('ID Notificación: ', { continued: true }).font('Helvetica').text(notification.id_notificacion);
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
                n.id_notificacion,
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
            LEFT JOIN delivery_attempts da1 ON n.id = da1.notification_id AND da1.attempt_number = 1
            LEFT JOIN delivery_attempts da2 ON n.id = da2.notification_id AND da2.attempt_number = 2
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
