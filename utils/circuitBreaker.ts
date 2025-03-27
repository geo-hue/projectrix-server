export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
      private readonly failureThreshold: number = 5,
      private readonly resetTimeout: number = 30000
    ) {}
    
    public async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'OPEN') {
        // Check if we've waited long enough to try again
        if (Date.now() - this.lastFailureTime > this.resetTimeout) {
          this.state = 'HALF_OPEN';
        } else {
          throw new Error('Circuit is open');
        }
      }
      
      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }
    
    private onSuccess(): void {
      this.failures = 0;
      this.state = 'CLOSED';
    }
    
    private onFailure(): void {
      this.failures += 1;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN';
      }
    }
  }
