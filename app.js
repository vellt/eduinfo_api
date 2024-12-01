const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const path = require('path'); // Fájl útvonalak kezelése

const swaggerDocument = require('./docs/swagger.json');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const personRoutes = require('./routes/personRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware-k
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan('combined'));

// Swagger UI endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Static fájlok kiszolgálása
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Útvonalak
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/institution', institutionRoutes);
app.use('/person', personRoutes);

// Szerver indítása
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
