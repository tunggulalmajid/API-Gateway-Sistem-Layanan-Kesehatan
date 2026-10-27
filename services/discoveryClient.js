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

async function getServiceUrl(serviceName, registryUrl = 'http://localhost:8761') {
    const cached = serviceCache.get(serviceName);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL_MS) && cached.instances.length > 0) {
        const currentIdx = rrIndices.get(serviceName) || 0;
        const selected = cached.instances[currentIdx % cached.instances.length];
        rrIndices.set(serviceName, currentIdx + 1);
        return selected.url;
    }

    try {
        const res = await fetch(`${registryUrl}/services/${serviceName}`);
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        const instances = data.instances || [];

        if (instances.length === 0) {
            serviceCache.delete(serviceName);
            return null;
        }

        serviceCache.set(serviceName, {
            instances: instances,
            timestamp: now
        });

        const currentIdx = rrIndices.get(serviceName) || 0;
        const selected = instances[currentIdx % instances.length];
        rrIndices.set(serviceName, currentIdx + 1);
        return selected.url;
    } catch (err) {
        console.error(`[DISCOVERY] Gagal mencari service ${serviceName}: ${err.message}`);
        return null;
    }
}

async function callService(serviceName, path, options = {}, registryUrl = 'http://localhost:8761') {
    const baseUrl = await getServiceUrl(serviceName, registryUrl);
    if (!baseUrl) {
        return {
            sukses: false,
            error: `Service '${serviceName}' tidak ditemukan atau offline pada Service Registry.`
        };
    }

    const fullUrl = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    try {
        console.log(`[INTER-SERVICE] Menghubungi ${serviceName} di ${fullUrl}`);
        const res = await fetch(fullUrl, options);
        return await res.json();
    } catch (err) {
        console.error(`[INTER-SERVICE ERROR] Gagal memanggil ${fullUrl}: ${err.message}`);
        return {
            sukses: false,
            error: `Gagal memanggil ${serviceName} di ${fullUrl}: ${err.message}`
        };
    }
}

module.exports = { registerService, getServiceUrl, callService };
