const express = require('express');

const app = express();
const PORT = 8761;

app.use(express.json());

const registry = new Map();
const TTL_MS = 15000;

app.use((req, res, next) => {
    console.log(`[REGISTRY] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    const services = {};
    for (const [name, instances] of registry.entries()) {
        services[name] = Array.from(instances.values());
    }
    res.json({
        name: 'Service Registry (Eureka-like)',
        status: 'UP',
        port: PORT,
        totalServices: registry.size,
        services
    });
});

app.post('/register', (req, res) => {
    const { serviceName, instanceId, host, port } = req.body;

    if (!serviceName || !instanceId || !host || !port) {
        return res.status(400).json({ error: 'Data registrasi tidak lengkap' });
    }

    if (!registry.has(serviceName)) {
        registry.set(serviceName, new Map());
    }

    const instanceData = {
        instanceId,
        serviceName,
        host,
        port: Number(port),
        url: `http://${host}:${port}`,
        status: 'UP',
        lastHeartbeat: Date.now()
    };

    registry.get(serviceName).set(instanceId, instanceData);
    console.log(`[REGISTRY] Registered: ${serviceName} -> ${instanceId} (${instanceData.url})`);

    res.status(201).json({
        message: 'Instance berhasil terdaftar',
        instance: instanceData
    });
});

app.post('/heartbeat', (req, res) => {
    const { serviceName, instanceId } = req.body;

    if (!serviceName || !instanceId || !registry.has(serviceName)) {
        return res.status(404).json({ error: 'Service tidak ditemukan' });
    }

    const serviceMap = registry.get(serviceName);
    if (!serviceMap.has(instanceId)) {
        return res.status(404).json({ error: 'Instance tidak ditemukan' });
    }

    const instance = serviceMap.get(instanceId);
    instance.lastHeartbeat = Date.now();
    instance.status = 'UP';

    res.json({ status: 'UP', lastHeartbeat: instance.lastHeartbeat });
});

app.delete('/deregister/:serviceName/:instanceId', (req, res) => {
    const { serviceName, instanceId } = req.params;

    if (registry.has(serviceName)) {
        const serviceMap = registry.get(serviceName);
        serviceMap.delete(instanceId);
        if (serviceMap.size === 0) {
            registry.delete(serviceName);
        }
        console.log(`[REGISTRY] Deregistered: ${serviceName} -> ${instanceId}`);
        return res.json({ message: 'Instance berhasil di-deregister' });
    }

    res.status(404).json({ error: 'Service tidak ditemukan' });
});

app.get('/services', (req, res) => {
    const result = {};
    for (const [name, instances] of registry.entries()) {
        result[name] = Array.from(instances.values()).filter(i => i.status === 'UP');
    }
    res.json({ services: result });
});

app.get('/services/:serviceName', (req, res) => {
    const { serviceName } = req.params;
    if (!registry.has(serviceName)) {
        return res.status(404).json({ error: `Service ${serviceName} tidak ditemukan` });
    }

    const instances = Array.from(registry.get(serviceName).values()).filter(i => i.status === 'UP');
    res.json({ serviceName, instances });
});

setInterval(() => {
    const now = Date.now();
    for (const [serviceName, instances] of registry.entries()) {
        for (const [instanceId, instance] of instances.entries()) {
            if (now - instance.lastHeartbeat > TTL_MS) {
                console.warn(`[REGISTRY] EVICTED (TTL Expired): ${serviceName} -> ${instanceId}`);
                instances.delete(instanceId);
            }
        }
        if (instances.size === 0) {
            registry.delete(serviceName);
        }
    }
}, 5000);

app.listen(PORT, () => {
    console.log(`Service Registry berjalan di port ${PORT}`);
});
