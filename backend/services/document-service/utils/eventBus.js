import { EventEmitter } from "events";

class EventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.redisClient = null;
    this.redisSubscriber = null;
    this.isRedisConnected = false;
  }

  async initializeRedis(redisUrlOrHost) {
    if (!redisUrlOrHost) {
      console.log("[EventBus] Redis configuration not found. Running in single-instance memory mode (EventEmitter).");
      return;
    }

    try {
      const redis = await import("redis");
      
      const config = redisUrlOrHost.startsWith("redis://") || redisUrlOrHost.startsWith("rediss://")
        ? { url: redisUrlOrHost }
        : { socket: { host: redisUrlOrHost, port: 6379 } };

      this.redisClient = redis.createClient(config);
      this.redisSubscriber = redis.createClient(config);

      this.redisClient.on("error", (err) => console.error("[EventBus] Redis Client Error:", err));
      this.redisSubscriber.on("error", (err) => console.error("[EventBus] Redis Subscriber Error:", err));

      await Promise.all([
        this.redisClient.connect(),
        this.redisSubscriber.connect()
      ]);

      this.isRedisConnected = true;
      console.log("[EventBus] Successfully connected to Redis. Multi-instance events enabled.");

      await this.redisSubscriber.subscribe("collabdocs-events", (message) => {
        try {
          const { event, data } = JSON.parse(message);
          this.emitter.emit(event, data);
        } catch (e) {
          console.error("[EventBus] Failed to parse Redis pub/sub message:", e);
        }
      });

    } catch (error) {
      console.warn("[EventBus] Redis initialization failed. Falling back to single-instance memory mode:", error.message);
      this.isRedisConnected = false;
    }
  }

  async publish(event, data) {
    console.log(`[EventBus] Publishing event: ${event}`, data);
    
    if (this.isRedisConnected && this.redisClient) {
      try {
        const payload = JSON.stringify({ event, data });
        await this.redisClient.publish("collabdocs-events", payload);
      } catch (err) {
        console.error(`[EventBus] Redis publish failed for event ${event}, falling back to local:`, err);
        this.emitter.emit(event, data);
      }
    } else {
      this.emitter.emit(event, data);
    }
  }

  subscribe(event, handler) {
    this.emitter.on(event, handler);
    console.log(`[EventBus] Registered subscriber for: ${event}`);
  }
}

const eventBus = new EventBus();

const redisTarget = process.env.REDIS_URL || process.env.REDIS_HOST;
eventBus.initializeRedis(redisTarget).catch(err => {
  console.error("[EventBus] Failed to run initializeRedis:", err);
});

export default eventBus;
