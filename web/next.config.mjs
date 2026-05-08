import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot
};

export default nextConfig;
