/*!
 * Sprint Chrono – Krono
 * © 2026 Ilyes ECHAOUI
 */

// ================== ÉLÉMENTS ==================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const timeDisplay = document.getElementById("time");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

const slider = document.getElementById("slider");
const goOffset = 200;

const markBtn = document.getElementById("mark");
const resultsTable = document.querySelector("#results tbody");

// Déplacement frames
const FRAME_STEP = 1;
const back1 = document.getElementById("back1");
const forward1 = document.getElementById("forward1");
const frameControls = document.getElementById("frameControls");

// Rôles
const roleDepartBtn = document.getElementById("roleDepart");
const roleArriveeBtn = document.getElementById("roleArrivee");
const roleSelect = document.getElementById("roleSelect");

// Audio unlock
const unlockBtn = document.getElementById("unlockAudio");
let audioUnlocked = false;

// ================== RÔLE ==================
let role = null; // "depart" | "arrivee"

// ================== AUDIO ==================
const soundReady = new Audio("ready.mp3");
const soundGo = new Audio("go.mp3");
soundGo.load();

// ================== ROOM ==================
let currentRoom = null;
let currentRoomPassword = null;

// ================== WEBSOCKET ==================
const socket = new WebSocket("wss://krono-ws-server.onrender.com");

socket.onopen = () => console.log("✅ WebSocket connecté");

socket.onmessage = async (event) => {
  try {
    const data = JSON.parse(event.data); // { type, payload }

    // Message pour notre room seulement
    if (!data.room || data.room !== currentRoom) return;

    // 🚦 Téléphone départ
    if (role === "depart" && data.type === "START_SEQUENCE" && audioUnlocked) {
      console.log("🔊 PRÊT");

      soundReady.currentTime = 0;
      soundReady.play().catch(()=>{});

      const delay = 1500 + Math.random() * 1000;
      setTimeout(() => {
        console.log("🔊 GO");
        soundGo.currentTime = 0;
        soundGo.play().catch(()=>{});
        sendToRoom("GO_NOW");
      }, delay);
    }

    // 🏁 Téléphone arrivée
    if (role === "arrivee" && data.type === "GO_NOW") {
      console.log("⏱️ GO → chrono");
      startTime = performance.now();
      timerInterval = setInterval(updateTime, 10);
      captureLoop = setInterval(captureFrame, 1000 / FPS);
    }

    // Gestion erreurs mot de passe
    if (data.type === "ERROR") alert(data.payload);

  } catch(e) { console.error("Erreur WS :", e); }
};

// Fonction pour envoyer un message JSON au serveur pour notre room
function sendToRoom(type, payload = null) {
  if (!currentRoom || !currentRoomPassword) return;
  socket.send(JSON.stringify({ room: currentRoom, password: currentRoomPassword, type, payload }));
}

// ================== CAMÉRA ==================
let stream = null;
let startTime = null;
let timerInterval = null;
let captureLoop = null;

const FPS = 60;
let frames = [];
let frameTimes = [];
let currentFrame = 0;
let results = [];

canvas.classList.add("hidden");

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", frameRate: FPS },
    audio: false
  });
  video.srcObject = stream;
  await waitForVideoReady();
}

function waitForVideoReady() {
  return new Promise(resolve => {
    if (video.readyState >= 2) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    } else {
      video.onloadeddata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    }
  });
}

// ================== CHRONO ==================
function updateTime() {
  const t = (performance.now() - startTime) / 1000;
  timeDisplay.textContent = t.toFixed(3);
}

function captureFrame() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  frameTimes.push((performance.now() - startTime) / 1000);
}

function showFrame() {
  if (!frames[currentFrame]) return;
  ctx.putImageData(frames[currentFrame], 0, 0);
  timeDisplay.textContent = frameTimes[currentFrame].toFixed(3);
  slider.value = currentFrame;
}

// ================== RÉSULTATS ==================
function renderResults() {
  resultsTable.innerHTML = "";

  results.forEach((res, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${res.time.toFixed(3)}</td>
      <td><input type="text" value="${res.name}" data-id="${res.id}"></td>
      <td><button data-id="${res.id}">❌</button></td>
    `;
    resultsTable.appendChild(row);
  });

  resultsTable.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      results = results.filter(r => r.id !== id);
      renderResults();
    };
  });

  resultsTable.querySelectorAll("input").forEach(input => {
    input.onchange = () => {
      const id = Number(input.dataset.id);
      const res = results.find(r => r.id === id);
      if (res) res.name = input.value;
    };
  });
}

// ================== RÔLES ==================
roleDepartBtn.onclick = () => {
  role = "depart";
  roleSelect.classList.add("hidden");
  unlockBtn.classList.remove("hidden");
  startBtn.disabled = true;
  stopBtn.disabled = true;
  timeDisplay.textContent = "📍 DÉPART";
};

roleArriveeBtn.onclick = async () => {
  role = "arrivee";
  roleSelect.classList.add("hidden");
  startBtn.disabled = false;
  showRole();

  if (!stream) {
    console.log("📹 Demande d'accès à la caméra...");
    await startCamera();
  }

  video.classList.remove("hidden");
  canvas.classList.add("hidden");
};

// ================== CREATE / JOIN ROOM ==================
const createRoomBtn = document.getElementById("createRoom");
const roomNameInput = document.getElementById("roomName");
const roomPasswordInput = document.getElementById("roomPassword");

createRoomBtn.onclick = () => {
  const name = roomNameInput.value.trim();
  const pass = roomPasswordInput.value.trim();

  if (!/^[a-zA-Z0-9]+$/.test(name)) return alert("Nom de room invalide (lettres et chiffres seulement)");
  if (!/^[a-zA-Z0-9]{4,}$/.test(pass)) return alert("Mot de passe invalide (min 4 caractères)");

  currentRoom = name;
  currentRoomPassword = pass;

  roleSelect.classList.add("hidden");
  console.log("📦 Room créée/rejointe :", currentRoom);
};

// ================== START ==================
startBtn.onclick = async () => {
  if (role !== "arrivee") return;

  results = [];
  resultsTable.innerHTML = "";

  video.classList.remove("hidden");
  canvas.classList.add("hidden");
  slider.classList.add("hidden");
  markBtn.classList.add("hidden");
  document.getElementById("results").classList.add("hidden");

  sendToRoom("START_SEQUENCE");
  console.log("📩 START_SEQUENCE envoyé au départ");
};

// ================== STOP ==================
stopBtn.onclick = () => {
  clearInterval(timerInterval);
  clearInterval(captureLoop);

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  video.classList.add("hidden");
  canvas.classList.remove("hidden");
  slider.classList.remove("hidden");
  markBtn.classList.remove("hidden");
  document.getElementById("results").classList.remove("hidden");

  slider.max = frames.length - 1;
  slider.value = 0;
  currentFrame = 0;

  if (frames.length > 0) showFrame();
  console.log("🛑 Chrono stoppé");
};

// ================== AUDIO UNLOCK ==================
unlockBtn.onclick = async () => {
  try {
    await soundReady.play(); soundReady.pause(); soundReady.currentTime = 0;
    await soundGo.play(); soundGo.pause(); soundGo.currentTime = 0;
    audioUnlocked = true;
    unlockBtn.textContent = "✅ Son activé";
    unlockBtn.disabled = true;
    console.log("🔓 Audio déverrouillé sur téléphone départ");
  } catch (e) {
    console.error("Erreur audio unlock", e);
  }
};

// ================== SLIDER ==================
slider.oninput = () => {
  currentFrame = Number(slider.value);
  showFrame();
};

// ================== MARQUAGE ==================
markBtn.onclick = () => {
  if (!frameTimes[currentFrame]) return;
  const time = frameTimes[currentFrame];

  results.push({
    id: Date.now(),
    time,
    name: "Athlète " + (results.length + 1)
  });
  renderResults();
};

// ================== DÉPLACEMENT FRAMES ==================
back1.onclick = () => { currentFrame = Math.max(0, currentFrame - FRAME_STEP); showFrame(); };
forward1.onclick = () => { currentFrame = Math.min(frames.length - 1, currentFrame + FRAME_STEP); showFrame(); };

function showRole() { timeDisplay.textContent = role === "depart" ? "📍 DÉPART" : "🏁 ARRIVÉE"; }
