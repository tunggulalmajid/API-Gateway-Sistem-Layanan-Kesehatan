const express = require('express');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const app = express();
const PORT = 8000;
const REGISTRY_URL = 'http://localhost:8761';

app.use(express.json());

const cache = new Map();
const rrIndex = new Map();

async function refreshCache() {
    try {
        const res = await fetch(`${REGISTRY_URL}/services`);
        if (res.ok) {
            const data = await res.json();
            for (const [serviceName, instances] of Object.entries(data.services || {})) {
                cache.set(serviceName, instances);
            }
            for (const key of cache.keys()) {
                if (!data.services || !data.services[key]) {
                    cache.delete(key);
                }
            }
        }
    } catch (err) {
        console.error(`[GATEWAY] Gagal sinkronisasi dengan Service Registry: ${err.message}`);
    }
}

setInterval(refreshCache, 3000);
refreshCache();

async function getServiceUrl(serviceName) {
    let instances = cache.get(serviceName);
    if (!instances || instances.length === 0) {
        await refreshCache();
        instances = cache.get(serviceName);
    }

    if (!instances || instances.length === 0) {
        return null;
    }

    const currentIdx = rrIndex.get(serviceName) || 0;
    const instance = instances[currentIdx % instances.length];
    rrIndex.set(serviceName, currentIdx + 1);
    return instance.url;
    
}

function createDynamicProxy(serviceName, pathPrefix) {
    return createProxyMiddleware({
        changeOrigin: true,
        pathRewrite: { [`^${pathPrefix}`]: '' },
        router: async () => {
            const target = await getServiceUrl(serviceName);
            if (!target) {
                throw new Error(`Instance untuk ${serviceName} tidak ditemukan di Service Registry`);
            }
            return target;
        },
        on: {
            proxyReq: fixRequestBody,
            error: (err, req, res) => {
                console.error(`[GATEWAY ERROR] ${serviceName}: ${err.message}`);
                if (!res.headersSent) {
                    res.status(503).json({
                        status: 'ERROR',
                        gateway: 'API Gateway Sistem Layanan Kesehatan',
                        pesan: `Layanan ${serviceName} tidak dapat diakses atau belum terdaftar di Service Registry.`,
                        detail: err.message
                    });
                }
            }
        }
    });
}

app.use((req, res, next) => {
    console.log(`[GATEWAY] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', async (req, res) => {
    let registryData = {};
    try {
        const response = await fetch(`${REGISTRY_URL}/services`);
        if (response.ok) {
            registryData = await response.json();
        }
    } catch (e) {
        registryData = { error: 'Service Registry Offline' };
    }

    res.json({
        gateway: 'API Gateway Sistem Layanan Kesehatan',
        status: 'UP',
        port: PORT,
        mode: 'Dynamic Service Discovery (Eureka-like)',
        registryUrl: REGISTRY_URL,
        discoveredServices: registryData.services || registryData
    });
});

app.use('/api/prescription', createDynamicProxy('prescription-service', '/api/prescription'));
app.use('/api/pharmacy', createDynamicProxy('pharmacy-service', '/api/pharmacy'));
app.use('/api/cashier', createDynamicProxy('cashier-service', '/api/cashier'));
app.use('/api/medical-record', createDynamicProxy('medical-record-service', '/api/medical-record'));

app.listen(PORT, () => {
    console.log(`API Gateway berjalan di port ${PORT} (Dynamic Service Discovery via ${REGISTRY_URL})`);
});
