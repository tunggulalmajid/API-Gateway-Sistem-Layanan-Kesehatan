const serviceCache = new Map();
const rrIndices = new Map();
const CACHE_TTL_MS = 3000;

function registerService({ serviceName, host, port, registryUrl = 'http://localhost:8761' }) {
    const instanceId = `${serviceName}-${port}-${Math.floor(Math.random() * 10000)}`;
    let heartbeatInterval = null;

    async function register() {
        try {
            const res = await fetch(`${registryUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceName, instanceId, host, port })
            });
            if (res.ok) {
                console.log(`[DISCOVERY] ${serviceName} (${instanceId}) terdaftar di ${registryUrl}`);
            }
        } catch (err) {
            console.error(`[DISCOVERY] Gagal mendaftar ke registry: ${err.message}`);
        }
    }

    async function sendHeartbeat() {
        try {
            await fetch(`${registryUrl}/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceName, instanceId })
            });
        } catch (err) {
            console.error(`[DISCOVERY] Gagal mengirim heartbeat: ${err.message}`);
        }
    }

    async function deregister() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        try {
            await fetch(`${registryUrl}/deregister/${serviceName}/${instanceId}`, {
                method: 'DELETE'
            });
            console.log(`[DISCOVERY] ${serviceName} (${instanceId}) telah di-deregister.`);
        } catch (err) {
            console.error(`[DISCOVERY] Gagal deregister: ${err.message}`);
        }
    }

    register().then(() => {
        heartbeatInterval = setInterval(sendHeartbeat, 5000);
    });

    process.on('SIGINT', async () => {
        await deregister();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await deregister();
        process.exit(0);
    });

    return { instanceId, deregister };
}

async function getInstances(serviceName, registryUrl = 'http://localhost:8761') {
    const cached = serviceCache.get(serviceName);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL_MS) && cached.instances.length > 0) {
        return cached.instances;
    }

    try {
        const res = await fetch(`${registryUrl}/services/${serviceName}`);
        if (!res.ok) {
            return [];
        }
        const data = await res.json();
        const instances = data.instances || [];

        serviceCache.set(serviceName, {
            instances: instances,
            timestamp: now
        });

        return instances;
    } catch (err) {
        console.error(`[DISCOVERY] Gagal mencari service ${serviceName}: ${err.message}`);
        return [];
    }
}

async function callService(serviceName, path, options = {}, registryUrl = 'http://localhost:8761') {
    const instances = await getInstances(serviceName, registryUrl);
    if (!instances || instances.length === 0) {
        return {
            sukses: false,
            error: `Service '${serviceName}' tidak ditemukan atau offline pada Service Registry.`
        };
    }

    const startIdx = (rrIndices.get(serviceName) || 0) % instances.length;
    rrIndices.set(serviceName, startIdx + 1);

    for (let i = 0; i < instances.length; i++) {
        const targetInstance = instances[(startIdx + i) % instances.length];
        const fullUrl = `${targetInstance.url}${path.startsWith('/') ? path : '/' + path}`;

        try {
            console.log(`[INTER-SERVICE LB] Menghubungi ${serviceName} di ${fullUrl} (${targetInstance.instanceId})`);
            const res = await fetch(fullUrl, options);
            const data = await res.json();
            return data;
        } catch (err) {
            console.warn(`[INTER-SERVICE FAILOVER] Gagal menghubungi ${fullUrl}, mencoba instance lain jika tersedia...`);
            serviceCache.delete(serviceName);
        }
    }

    return {
        sukses: false,
        error: `Semua instance ${serviceName} gagal dihubungi.`
    };
}

module.exports = { registerService, getInstances, callService };
