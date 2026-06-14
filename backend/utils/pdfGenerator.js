const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');

// Ensure directory exists
const RECEIPTS_DIR = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

const COMPANIES = {
    'ENERGIA_CEUTA': { name: 'Energía Ceuta XXI Comercializadora de Referencia, S.A.U.', cif: 'A51031920' },
    'ALUMBRADO_CEUTA': { name: 'Alumbrado Eléctrico de Ceuta Energía, S.L.', cif: 'B72775513' }
};

const generateReceiptPDF = async (notification_id, company) => {
    try {
        // Query full data
        const [notifRows] = await pool.query(`
            SELECT n.*, s.name as street_name 
            FROM notifications n 
            LEFT JOIN streets s ON n.street_id = s.id 
            WHERE n.id = ?
        `, [notification_id]);
        
        if (notifRows.length === 0) return;
        const notification = notifRows[0];

        const [attempts] = await pool.query(`
            SELECT da.*, u.name as courier_name 
            FROM delivery_attempts da 
            LEFT JOIN users u ON da.delivered_by = u.id 
            WHERE da.notification_id = ?
            ORDER BY da.attempt_number ASC
        `, [notification_id]);

        const doc = new PDFDocument({ margin: 50 });
        const filePath = path.join(RECEIPTS_DIR, `${notification_id}-${company}.pdf`);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        const logoPath = path.join(__dirname, '../assets/trinitas_logo.jpg');
        const startY = doc.y;
        
        // Logo on the top left (x: 50)
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, startY, { fit: [150, 75] });
        }
        
        // Trinitas details on the top right (x: 262)
        doc.fontSize(8).font('Helvetica').fillColor('#444444');
        const companyDetails = [
            'Calle Alcalde Manuel Olivencia, 5',
            '51001 Ceuta',
            'TEL: 956 512 861 · 956 516 598',
            'FAX: 956 512 125',
            'serviciosintegrales@trinitas.es'
        ].join('\n');
        
        doc.text(companyDetails, 262, startY + 10, {
            width: 300,
            align: 'right',
            lineGap: 2
        });
        
        doc.fillColor('#000000');
        const companyData = COMPANIES[notification.company] || { name: 'Trinitas', cif: '' };
        doc.fontSize(16).font('Helvetica-Bold').text(companyData.name, 50, startY + 90, {
            width: doc.page.width - 100,
            align: 'center'
        });
        if (companyData.cif) {
            doc.fontSize(10).font('Helvetica').text(`CIF: ${companyData.cif}`, {
                width: doc.page.width - 100,
                align: 'center'
            });
        }
        doc.moveDown(0.5);
        doc.fontSize(18).font('Helvetica-Bold').text('ACUSE DE RECIBO', {
            width: doc.page.width - 100,
            align: 'center'
        });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);

        // Notification Info
        doc.fontSize(14).font('Helvetica-Bold').text('Datos de la Notificación', { align: 'left' });
        doc.fontSize(12).font('Helvetica').text(`ID Notificación: ${notification.id_notificacion}`, { align: 'left' });
        doc.text(`Destinatario: ${notification.recipient_name}`, { align: 'left' });
        doc.text(`Dirección: ${notification.full_address}`, { align: 'left' });
        doc.text(`Calle Asignada: ${notification.street_name || 'Ninguna'}`, { align: 'left' });
        doc.text(`Estado Final: ${notification.status}`, { align: 'left' });
        doc.moveDown(2);

        // Attempts History
        doc.fontSize(14).font('Helvetica-Bold').text('Historial de Intentos', { align: 'left' });
        attempts.forEach(att => {
            doc.fontSize(12).font('Helvetica-Bold').text(`Intento #${att.attempt_number} - ${att.status_result}`, { underline: true, align: 'left' });
            doc.font('Helvetica').text(`Repartidor: ${att.courier_name || 'Desconocido'}`, { align: 'left' });
            doc.text(`Fecha Registrada: ${new Date(att.timestamp).toLocaleString()}`, { align: 'left' });
            
            if (att.notes) {
                doc.font('Helvetica-Oblique').text(`Observaciones: ${att.notes}`, { align: 'left' });
                doc.font('Helvetica');
            }

            if (att.status_result === 'ENTREGADA') {
                doc.text(`Receptor Oficial: ${att.receiver_name} (DNI: ${att.receiver_dni})`, { align: 'left' });
                if (att.signature_base64) {
                    doc.moveDown();
                    doc.text('Firma Capturada:', { align: 'left' });
                    try {
                        const base64Data = att.signature_base64.replace(/^data:image\/png;base64,/, "");
                        const imgBuffer = Buffer.from(base64Data, 'base64');
                        doc.image(imgBuffer, { width: 250, align: 'center' });
                    } catch (e) {
                        console.error('Error rendering signature', e);
                        doc.text('(Error al procesar formato de firma)', { align: 'left' });
                    }
                }
            } else {
                doc.text(`Motivo de Falla: ${att.status_result}`, { align: 'left' });
            }
            doc.moveDown();
        });

        // Finalize PDF
        doc.end();

        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(filePath));
            stream.on('error', reject);
        });

    } catch (error) {
        console.error('Failed PDF Generation for', notification_id, error);
    }
};

module.exports = { generateReceiptPDF };
