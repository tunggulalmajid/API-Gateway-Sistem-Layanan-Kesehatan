const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const app = express();
const PORT = 8000;

app.use(express.json());

app.use((req, res, next) => {
    console.log(`[GATEWAY] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.json({
        gateway: 'API Gateway Sistem Layanan Kesehatan',
        status: 'UP',
        port: PORT,
        services: {
            prescription: {
                port: 8081,
                route: '/api/prescription'
            },
            pharmacy: {
                port: 8082,
                route: '/api/pharmacy'
            },
            cashier: {
                port: 8083,
                route: '/api/cashier'
            },
            medicalRecord: {
                port: 8084,
                route: '/api/medical-record'
            }
        }
    });
});

app.use(
    '/api/prescription',
    createProxyMiddleware({
        target: 'http://localhost:8081',
        changeOrigin: true,
        pathRewrite: { '^/api/prescription': '' },
        on: { proxyReq: fixRequestBody }
    })
);

app.use(
    '/api/pharmacy',
    createProxyMiddleware({
        target: 'http://localhost:8082',
        changeOrigin: true,
        pathRewrite: { '^/api/pharmacy': '' },
        on: { proxyReq: fixRequestBody }
    })
);

app.use(
    '/api/cashier',
    createProxyMiddleware({
        target: 'http://localhost:8083',
        changeOrigin: true,
        pathRewrite: { '^/api/cashier': '' },
        on: { proxyReq: fixRequestBody }
    })
);

app.use(
    '/api/medical-record',
    createProxyMiddleware({
        target: 'http://localhost:8084',
        changeOrigin: true,
        pathRewrite: { '^/api/medical-record': '' },
        on: { proxyReq: fixRequestBody }
    })
);

app.listen(PORT, () => {
    console.log(`API Gateway berjalan di port ${PORT}`);
});
