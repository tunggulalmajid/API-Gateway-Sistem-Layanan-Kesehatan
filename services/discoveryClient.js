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

module.exports = { registerService };
