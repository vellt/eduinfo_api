const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const uploadDir = 'uploads/';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp|avif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Csak képfeltöltés engedélyezett (10MB max)'));
        }
    }
});

module.exports = { upload };
