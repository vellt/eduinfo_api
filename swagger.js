const swaggerAutogen = require('swagger-autogen')();
const path = require('path');

// A kimeneti fájl, ahol a Swagger dokumentációt tárolni fogjuk
const outputFile = path.join(__dirname, 'docs/swagger.json');

// Az útvonalak, amelyeket a swagger-autogen figyelembe vesz
const endpointsFiles = [
  './routes/authRoutes.js',
  './routes/adminRoutes.js',
  './routes/institutionRoutes.js',
  './routes/personRoutes.js',
];

// Swagger alapértelmezett konfiguráció
const doc = {
  info: {
    title: 'API Dokumentáció',
    description: 'Az API végpontok külön címkék alatt.',
  },
  host: 'localhost:3000', // API host
  basePath: '/',
  tags: [
    {
      name: 'auth',
      description: 'Autentikációval kapcsolatos végpontok',
    },
    {
      name: 'admin',
      description: 'Adminisztrációs végpontok',
    },
    {
      name: 'institution',
      description: 'Intézményekkel kapcsolatos végpontok',
    },
    {
      name: 'person',
      description: 'Felhasználói végpontok',
    },
  ],
};

// Swagger dokumentáció generálása
swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger dokumentáció generálva.');
});
