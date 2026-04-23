const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pool = require('../db/connection');

// Ensure directory exists
const RECEIPTS_DIR = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(RECEIPTS_DIR)) {
    fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

const generateReceiptPDF = async (notification_id) => {
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
        const filePath = path.join(RECEIPTS_DIR, `${notification_id}.pdf`);
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('ACUSE DE RECIBO - TRINITAS', { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, 90).lineTo(550, 90).stroke();
        doc.moveDown(2);

        // Notification Info
        doc.fontSize(14).font('Helvetica-Bold').text('Datos de la Notificación');
        doc.fontSize(12).font('Helvetica').text(`ID Notificación: ${notification.id}`);
        doc.text(`Destinatario: ${notification.recipient_name}`);
        doc.text(`Dirección: ${notification.full_address}`);
        doc.text(`Calle Asignada: ${notification.street_name || 'Ninguna'}`);
        doc.text(`Estado Final: ${notification.status}`);
        doc.moveDown(2);

        // Attempts History
        doc.fontSize(14).font('Helvetica-Bold').text('Historial de Intentos');
        attempts.forEach(att => {
            doc.fontSize(12).font('Helvetica-Bold').text(`Intento #${att.attempt_number} - ${att.status_result}`, { underline: true });
            doc.font('Helvetica').text(`Repartidor: ${att.courier_name || 'Desconocido'}`);
            doc.text(`Fecha Registrada: ${new Date(att.created_at).toLocaleString()}`);
            
            if (att.status_result === 'DELIVERED') {
                doc.text(`Receptor Oficial: ${att.receiver_name} (DNI: ${att.receiver_dni})`);
                if (att.signature_base64) {
                    doc.moveDown();
                    doc.text('Firma Capturada:');
                    try {
                        const base64Data = att.signature_base64.replace(/^data:image\/png;base64,/, "");
                        const imgBuffer = Buffer.from(base64Data, 'base64');
                        doc.image(imgBuffer, { width: 250, align: 'center' });
                    } catch (e) {
                        console.error('Error rendering signature', e);
                        doc.text('(Error al procesar formato de firma)');
                    }
                }
            } else {
                doc.text(`Motivo de Falla: ${att.status_result}`);
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
