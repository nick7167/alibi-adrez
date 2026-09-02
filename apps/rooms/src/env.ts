export interface Env {
  ROOMS_DO: DurableObjectNamespace;
  ROOM_CREATE_RATE_LIMITER: RateLimit;
  ROOM_ACCESS_RATE_LIMITER: RateLimit;
  /** Comma-separated browser origins allowed to call REST or open sockets. */
  ALLOWED_ORIGINS: string;
}
