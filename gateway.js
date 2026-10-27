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

setInterval(refreshCache, 2000);
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

    console.log(`[GATEWAY LOAD BALANCER] Merutekan ${serviceName} -> ${instance.instanceId} (${instance.url})`);
    return instance.url;
}

function createDynamicProxy(serviceName, pathPrefix) {
    return createProxyMiddleware({
        changeOrigin: true,
        pathRewrite: { [`^${pathPrefix}`]: '' },
        router: async () => {
            const target = await getServiceUrl(serviceName);
            if (!target) {
                throw new Error(`Semua instance ${serviceName} sedang offline di Service Registry`);
            }
            return target;
        },
        on: {
            proxyReq: fixRequestBody,
            error: (err, req, res) => {
                console.error(`[GATEWAY LB ERROR] Gagal menghubungi instance ${serviceName}: ${err.message}`);
                cache.delete(serviceName);
                if (!res.headersSent) {
                    res.status(503).json({
                        status: 'ERROR',
                        gateway: 'API Gateway Sistem Layanan Kesehatan',
                        loadBalancer: 'Native Round-Robin Load Balancer',
                        pesan: `Seluruh instance ${serviceName} sedang tidak tersedia atau gagal merespons.`,
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

    const clusterSummary = {};
    for (const [sName, sInstances] of Object.entries(registryData.services || {})) {
        clusterSummary[sName] = {
            totalInstances: sInstances.length,
            instances: sInstances.map(i => ({ instanceId: i.instanceId, port: i.port, status: i.status }))
        };
    }

    res.json({
        gateway: 'API Gateway Sistem Layanan Kesehatan',
        status: 'UP',
        port: PORT,
        loadBalancer: {
            algorithm: 'Round-Robin (Native / Zero-Library)',
            status: 'ACTIVE'
        },
        serviceDiscovery: {
            type: 'Eureka-like Service Registry',
            registryUrl: REGISTRY_URL
        },
        clusters: clusterSummary
    });
});

app.use('/api/prescription', createDynamicProxy('prescription-service', '/api/prescription'));
app.use('/api/pharmacy', createDynamicProxy('pharmacy-service', '/api/pharmacy'));
app.use('/api/cashier', createDynamicProxy('cashier-service', '/api/cashier'));
app.use('/api/medical-record', createDynamicProxy('medical-record-service', '/api/medical-record'));

app.listen(PORT, () => {
    console.log(`API Gateway berjalan di port ${PORT} (Native Round-Robin Load Balancer Aktif)`);
});
