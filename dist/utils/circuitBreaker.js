"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
class CircuitBreaker {
    constructor(failureThreshold = 5, resetTimeout = 30000) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'CLOSED';
    }
    async execute(fn) {
        if (this.state === 'OPEN') {
            // Check if we've waited long enough to try again
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit is open');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    onFailure() {
        this.failures += 1;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
