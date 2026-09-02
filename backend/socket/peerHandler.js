const { ExpressPeerServer } = require("peer");

/**
 * @param {import("http").Server} server
 * @param {import("express").Express} app
 */
function initializePeer(server, app) {
  const peerServer = ExpressPeerServer(server, {
    path: "/",
    allow_discovery: true,
    proxied: process.env.NODE_ENV === "production",
    debug: process.env.NODE_ENV !== "production",
    ssl: {},
  });

  app.use("/peerjs-server", peerServer);

  peerServer.on("connection", (client) => {
    console.log(`PeerJS client connected: ${client.getId()}`);
  });

  peerServer.on("disconnect", (client) => {
    console.log(`PeerJS client disconnected: ${client.getId()}`);
  });

  peerServer.on("error", (error) => {
    console.error("PeerJS server error:", error);
  });

  console.log("PeerJS server initialized at /peerjs-server");

  return peerServer;
}

module.exports = { initializePeer };
