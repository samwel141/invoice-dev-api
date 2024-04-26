const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const pdf2json = require('pdf2json');
const { createWorker } = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');
// import PDFParser from "pdf2json";
const PDFParser = require('pdf2json')


const dotenv = require('dotenv');
dotenv.config();

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;








// Function to read PDF file
async function readPDF(filePath) {
    return new Promise((resolve, reject) => {
        // const pdfParser = new pdf2json.PdfParser();
        const pdfParser = new PDFParser();

        pdfParser.loadPDF(filePath);
        pdfParser.on('pdfParser_dataError', errData => reject(errData.parserError));
        pdfParser.on('pdfParser_dataReady', pdfData => {
            // fs.writeFile("./pdf2json/test/F1040EZ.json", JSON.stringify(pdfData));
            console.log(pdfData);

            const text = pdfData.Pages.reduce((acc, page) => {
                if (page.Texts) {
                    page.Texts.forEach(({ R }) => {
                        acc += R.map(({ T }) => Buffer.from(T, 'base64').toString('utf8')).join('');
                    });
                }
                return acc;
            }, '');

            // const txt = pdfParser.getRawTextContent()
            


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


async function getContent(filePath) {
    const fileType = filePath.split('.').pop().toLowerCase();
    let content = {};

    try {
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
    } catch (error) {
        // Terminate the function and return the error to the caller
        throw error;
    }
}


function validate(obj) {
    const fileType = (obj && obj.fileType) ? obj.fileType.toLowerCase() : "";
    if (fileType === "pdf" || fileType.endsWith("jpg") || fileType.endsWith("jpeg") || fileType.endsWith("png") || fileType.endsWith("gif")) {
        return "invalid";
    } else {
        return "valid";
    }
}


// Set up multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // specify the upload directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname) // specify unique filename
    }
})

const upload = multer({ storage: storage })

// Assuming extractContent and storeInvoice functions are defined as mentioned earlier

app.post('/api/invoices', upload.single('file'), async (req, res) => {
    try {
        // Assuming req.file contains the uploaded file
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = path.join(__dirname, file.path);
        const newData = {
            id: Date.now().toString(), // Generate unique ID
            name: file.originalname,
            info: await getContent(filePath)
        };

        // Store invoice in data.json
        const dataFilePath = path.join(__dirname, 'data.json');
        let data = [];
        try {
            data = JSON.parse(fs.readFileSync(dataFilePath));
            
            //Validation
            const validStatus = await validate(newData);
            // newData.info = data.info || {}; // Ensure info object exists
            newData.info.status = validStatus;

        } catch (error) {
            console.error('Error reading data from file:', error);
        }

        data.push(newData);
        fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 4));

        res.status(200).json({ message: 'File verified successfully', data: newData });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});







app.get('/api/invoices', async (req, res) => {
    try {
        const dataFilePath = path.join(__dirname, 'data.json');
        let data = [];
        try {
            data = JSON.parse(fs.readFileSync(dataFilePath));
        } catch (error) {
            console.error('Error reading data from file:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        res.status(200).json({ invoices: data });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
