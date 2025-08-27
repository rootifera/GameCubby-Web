// Health service to manage API health and authentication status
// This prevents multiple components from making duplicate health checks

interface HealthStatus {
    online: boolean;
    authed: boolean;
    lastCheck: number;
}

class HealthService {
    private status: HealthStatus | null = null;
    private checkPromise: Promise<HealthStatus> | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private subscribers: Set<(status: HealthStatus) => void> = new Set();

    constructor() {
        // Start periodic health checks
        this.startPeriodicChecks();
    }

    private async performHealthCheck(): Promise<HealthStatus> {
        try {
            const response = await fetch("/api/health", { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }

            const data = await response.json() as { online?: boolean; authed?: boolean };
            return {
                online: Boolean(data?.online),
                authed: Boolean(data?.authed),
                lastCheck: Date.now()
            };
        } catch (error) {
            console.warn("Health check error:", error);
            // Return last known status or default values
            return this.status || { online: false, authed: false, lastCheck: Date.now() };
        }
    }

    private async checkHealth(): Promise<HealthStatus> {
        // If we have recent data (less than 25 seconds old), use it
        if (this.status && Date.now() - this.status.lastCheck < 25000) {
            return this.status;
        }

        // If there's already a check in progress, wait for it
        if (this.checkPromise) {
            return this.checkPromise;
        }

        // Start a new health check
        this.checkPromise = this.performHealthCheck();
        
        try {
            const result = await this.checkPromise;
            this.status = result;
            // Notify all subscribers
            this.subscribers.forEach(callback => callback(result));
            return result;
        } finally {
            this.checkPromise = null;
        }
    }

    private startPeriodicChecks() {
        // Check every 30 seconds
        this.checkInterval = setInterval(() => {
            this.checkHealth();
        }, 30000);
    }

    public async getStatus(): Promise<HealthStatus> {
        return this.checkHealth();
    }

    public subscribe(callback: (status: HealthStatus) => void): () => void {
        this.subscribers.add(callback);
        
        // If we already have status, call the callback immediately
        if (this.status) {
            callback(this.status);
        }

        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    public destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.subscribers.clear();
    }
}

// Create a singleton instance
export const healthService = new HealthService();

// Export the service instance and types
export type { HealthStatus };
export { HealthService };
