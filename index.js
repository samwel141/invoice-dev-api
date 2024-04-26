const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
// const { PdfParser } = require('pdf2json');
// const getContent = require('./readFile.js');



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

            // const text = pdfData.formImage.Pages.reduce((acc, { Texts }) => {
            //     if (Texts) {
            //         Texts.forEach(({ R }) => {
            //             acc += R.map(({ T }) => Buffer.from(T, 'base64').toString('utf8')).join('');
            //         });
            //     }
            //     return acc;
            // }, '');


            // const text = pdfData.Pages.reduce((acc, page) => {
            //     if (page.Texts) {
            //         page.Texts.forEach(({ R }) => {
            //             acc += R.map(({ T }) => Buffer.from(T, 'base64').toString('utf8')).join('');
            //         });
            //     }
            //     return acc;
            // }, '');

            // const extractedText = pdfParser.getRawTextContent();

        // Write the extracted text content to a JSON file
        // fs.writeFile('./data/files.json', JSON.stringify({ content: extractedText }), (err) => {
        //     if (err) {
        //         console.error('Error writing file:', err);
        //     } else {
        //         console.log('File written successfully');
        //     }
        // });
            

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

// Function to read file and extract content
//   async function getContent(filePath) {
//     const fileType = filePath.split('.').pop().toLowerCase();
//     let content = {};

//     if (fileType === 'pdf') {
//         content.text = await readPDF(filePath);
//     } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
//         content.image = await readImage(filePath);
//     } else {
//         throw new Error('Unsupported file format');
//     }

//     // Add other properties as needed
//     content.fileType = fileType;

//     return content;
// }

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


// async function validate(data) {
//     // Assuming your validation logic is here
//     // For demonstration, let's pretend validation takes some time
//     return new Promise(resolve => {
//         setTimeout(() => {
//             const fileType = (data && data.fileType) ? data.fileType.toLowerCase() : "";
//             const isValid = (fileType === "pdf" || fileType.endsWith("jpg") || fileType.endsWith("jpeg") || fileType.endsWith("png") || fileType.endsWith("gif"));
//             resolve(isValid ? "valid" : "invalid");
//         }, 1000); // Simulating delay with setTimeout
//     });
// }
// // Example usage:
// const fileObject1 = {fileType: "pdf"};
// console.log(checkFileType(fileObject1));  // Output: valid

// const fileObject2 = {fileType: "jpg"};
// console.log(checkFileType(fileObject2));  // Output: valid

// const fileObject3 = {fileType: "txt"};
// console.log(checkFileType(fileObject3));  // Output: invalid








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

        res.status(200).json({ message: 'File uploaded successfully', data: newData });
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




// // Define path to JSON file
// // const dataFilePath = path.join(__dirname, 'data', 'data.json');

// // Function to read data from JSON file
// const readDataFromFile = () => {
//     try {
//         const data = fs.readFileSync(dataFilePath, 'utf8');
//         return JSON.parse(data);
//     } catch (error) {
//         console.error('Error reading data from file:', error);
//         return [];
//     }
// };

// // Function to write data to JSON file
// const writeDataToFile = (data) => {
//     try {
//         fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 4));
//         console.log('Data written to file successfully');
//     } catch (error) {
//         console.error('Error writing data to file:', error);
//     }
// };

// app.get('/', (req, res) => {
//     res.send('Welcome to Invoice validator!!');
// });

// // Route to get data from file
// app.get('/api/', (req, res) => {
//     const data = readDataFromFile();
//     res.json(data);
// });

// // Route to add data to file
// app.post('/api/invoices', (req, res) => {
//     const newData = req.body;
//     console.log(newData);


//     const data = readDataFromFile();
//     data.push(newData);
//     writeDataToFile(data);
//     res.json(newData);
// });





// // Function to store file and extracted information
// async function storeInvoice(filePath) {
//     try {
//         const id = uuidv4();
//         const name = filePath.split('/').pop();
//         const info = await getContent(filePath);

//         const invoice = {
//             id,
//             name,
//             info
//         };

//         // Store invoice in data (you can choose your own way to store it)
//         console.log('Invoice:', invoice);
//         // Example: You can write the invoice to a JSON file
//         // fs.writeFileSync('invoices.json', JSON.stringify(invoice));

//         return invoice;
//     } catch (error) {
//         console.error('Error:', error.message);
//     }
// }




app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
