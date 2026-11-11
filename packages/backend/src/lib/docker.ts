import { DockerSocket } from "@hallmaster/docker.js";

const DEFAULT_SOCKET_PATH = "/var/run/docker.sock";

function socketPath(host = process.env.DOCKER_HOST) {
  if (!host) {
    return DEFAULT_SOCKET_PATH;
  }

  if (!host.startsWith("unix://")) {
    throw new Error(`Unsupported DOCKER_HOST "${host}", only unix:// sockets are supported`);
  }

  return host.slice("unix://".length);
}

const socket = new DockerSocket(socketPath());
await socket.init();

export default socket;
