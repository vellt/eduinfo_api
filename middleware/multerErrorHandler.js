const multer = require('multer');

// Multer hiba kezelő middleware
const multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Minden Multer hiba
        console.log(err);
        return res.status(400).json({
            code: 400,
            message: 'Fájl feltöltési hiba',
            errors: [], 
            data: null
        });
    } else if (err) {
        // Minden más hiba
        console.log(err);
        return res.status(500).json({
            code: 500,
            message: err.message,
            errors: [],
            data: null
        });
    }
    next();
};

module.exports = { multerErrorHandler };