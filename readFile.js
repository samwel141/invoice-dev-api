const fs = require('fs-extra');
const pdf2json = require('pdf2json');
const { createWorker } = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');

// Function to read PDF file
async function readPDF(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new pdf2json.PdfParser();

        pdfParser.loadPDF(filePath);
        pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', pdfData => {
            const text = pdfData.formImage.Pages.reduce((acc, { Texts }) => {
                if (Texts) {
                    Texts.forEach(({ R }) => {
                        acc += R.map(({ T }) => Buffer.from(T, 'base64').toString('utf8')).join('');
                    });
                }
                return acc;
            }, '');
            resolve(text);
        });
    });
}

// Function to read image file using Tesseract OCR
async function readImage(filePath) {
    const worker = createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    return text;
}

// Function to read file and extract content
  async function getContent(filePath) {
    const fileType = filePath.split('.').pop().toLowerCase();
    let content = {};

    if (fileType === 'pdf') {
        content.text = await readPDF(filePath);
    } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
        content.image = await readImage(filePath);
    } else {
        throw new Error('Unsupported file format');
    }

    // Add other properties as needed
    content.fileType = fileType;

    return content;
}


// // Example usage
// const filePath = 'path/to/your/file.pdf'; // Provide the path to your file
// storeInvoice(filePath);
