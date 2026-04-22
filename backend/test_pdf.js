const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1);
const filePath = 'e:\\Proyectos\\Trinitas\\Documentos de trabajo\\CALLEJERO FISCAL 2014.pdf';

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    const rawText = pdfParser.getRawTextContent();
    fs.writeFileSync('./streets.txt', rawText);
    console.log("PDF parsed and saved to streets.txt. Length: " + rawText.length);
});

pdfParser.loadPDF(filePath);
