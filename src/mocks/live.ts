/**
 * Requests that always reach the real site, never recorded as mocks or blocked:
 * - authentication (logging in, refreshing tokens): blocking them logs the replay out;
 * - transports of real-time connections (socket.io's long polling, SignalR, Phoenix):
 *   a recorded answer belongs to another connection and would break it, and the
 *   WebSocket they upgrade to is never intercepted anyway.
 */
export function goesLive(address: string) {
  const url = new URL(address);

  return (
    url.searchParams.has("EIO") ||
    /\/(negotiate|longpoll)$/.test(url.pathname) ||
    /\/(auth|oauth2?|token|refresh|session|sessions|login|signin|logout)(\/|$)/i.test(
      url.pathname,
    ) ||
    /\/(token|refresh)[\w-]*$/i.test(url.pathname)
  );
}

/** Methods that only read; the rest change data and are never replayed for real. */
export const readMethods = ["GET", "HEAD", "OPTIONS"];
