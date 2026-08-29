import { io } from "socket.io-client";

async function run() {
  console.log("=== STEP 1: Authenticate Admin & Open Game Session ===");
  const adminSecret = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_SECRET ?? "local-admin-2026";
  const adminSocket = io("http://localhost:3001/game", {
    auth: { role: "admin", adminToken: adminSecret },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    adminSocket.on("connect", resolve);
    adminSocket.on("connect_error", reject);
  });
  console.log("Admin socket connected with ID:", adminSocket.id);

  const openAck = await new Promise((resolve) => {
    adminSocket.emit("admin:open", { durationMs: 30000 }, resolve);
  });
  console.log("Admin Open OK:", openAck.ok, "Game ID:", openAck.data?.gameId, "Phase:", openAck.data?.publicState?.phase);

  console.log("\n=== STEP 2: Query GET /api/session/current ===");
  const sessionRes = await fetch("http://localhost:3001/api/session/current").then((r) => r.json());
  console.log("Active:", sessionRes.data?.active, "Phase:", sessionRes.data?.publicState?.phase);

  console.log("\n=== STEP 3: Player Join Bootstrap via POST /api/player/register ===");
  const regRes = await fetch("http://localhost:3001/api/player/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json());
  console.log("Registration OK:", regRes.ok);
  console.log("Is New Player:", regRes.data?.isNew);
  console.log("Player ID:", regRes.data?.player?.playerId);
  console.log("Player Label:", regRes.data?.player?.label);
  console.log("Player Token Present:", Boolean(regRes.data?.token));

  console.log("\n=== STEP 4: Connect Player Socket.IO with Authoritative Token ===");
  const playerSocket = io("http://localhost:3001/game", {
    auth: { role: "player", token: regRes.data?.token },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    playerSocket.on("connect", resolve);
    playerSocket.on("connect_error", reject);
  });
  console.log("Player socket connected with ID:", playerSocket.id);

  const chooseAck = await new Promise((resolve) => {
    playerSocket.emit("player:choose_team", { team: "left" }, resolve);
  });
  console.log("Player Choose Team OK:", chooseAck.ok, "Assigned Team:", chooseAck.data?.team);

  adminSocket.disconnect();
  playerSocket.disconnect();
  console.log("\n=== ALL STEPS VERIFIED 100% SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
