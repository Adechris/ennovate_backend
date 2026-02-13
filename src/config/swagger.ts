import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Loan Application API',
            version: '1.0.0',
            description: 'API documentation for the Loan Management System',
            contact: {
                name: 'Engineering Team',
                email: 'Engineering@qeola.com',
            },
        },
        servers: [
            {
                url: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000',
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/modules/**/*.routes.ts', './src/app.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
