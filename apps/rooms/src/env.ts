export interface Env {
  ROOMS_DO: DurableObjectNamespace;
  /** Comma-separated browser origins allowed to call REST or open sockets. */
  ALLOWED_ORIGINS: string;
}
