export default {
  root: "web",
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  build: {
    outDir: "../dist/web",
    emptyOutDir: true
  }
};
