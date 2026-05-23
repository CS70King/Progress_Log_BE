const startedAt = new Date();

let shuttingDown = false;

export const runtimeState = {
  startedAt,
  isShuttingDown() {
    return shuttingDown;
  },
  beginShutdown() {
    shuttingDown = true;
  }
};
