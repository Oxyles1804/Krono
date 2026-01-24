/*!
 * Sprint Chrono – Krono
 * © 2026 Ilyes ECHAOUI
 * Tous droits réservés.
 */

// GROUPE ELEMENTS
const createGroupBtn = document.getElementById("createGroupBtn");
const joinGroupBtn = document.getElementById("joinGroupBtn");
const groupForm = document.getElementById("groupForm");
const groupIdInput = document.getElementById("groupId");
const groupPasswordInput = document.getElementById("groupPassword");
const submitGroupBtn = document.getElementById("submitGroup");
const cancelGroupBtn = document.getElementById("cancelGroup");

let currentAction = null; // "create" ou "join"



// ================== ÉLÉMENTS ==================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const timeDisplay = document.getElementById("time");
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");



////////////////////////////////////
const slider = document.getElementById("slider");
const goOffset = 200; // décalage en ms, positif = chrono démarre après le son, négatif = avant le son

const markBtn = document.getElementById("mark");
const resultsTable = document.querySelector("#results tbody");

// Pour les decalages frames
const FRAME_STEP = 1; // ← 1 frame
const back1 = document.getElementById("back1");
const forward1 = document.getElementById("forward1");
const frameControls = document.getElementById("frameControls");
////////////////////////////////////



const roleDepartBtn = document.getElementById("roleDepart");
const roleArriveeBtn = document.getElementById("roleArrivee");
const roleSelect = document.getElementById("roleSelect");

const unlockBtn = document.getElementById("unlockAudio");
let audioUnlocked = false;


// ================== RÔLE ==================
let role = null; // "depart" | "arrivee"

// ================== AUDIO ==================
const soundReady = new Audio("ready.mp3");
const soundGo = new Audio("go.mp3");
soundGo.load();

// ================== WEBSOCKET ==================
const socket = new WebSocket("wss://krono-ws-server.onrender.com"); // 🔴 CHANGE L'IP

socket.onopen = () => console.log("✅ WebSocket connecté");

socket.onmessage = async (event) => {
  let data;

  try {
    data = JSON.parse(event.data.toString());
  } catch {
    console.log("📨 WS reçu (raw) :", event.data, "| rôle =", role);

    // 🚦 Ancien comportement pour START_SEQUENCE / GO_NOW
    if (role === "depart" && event.data === "START_SEQUENCE" && audioUnlocked) {
      console.log("🔊 PRÊT");

      soundReady.currentTime = 0;
      soundReady.play().catch(()=>{});

      const delay = 1500 + Math.random() * 1000;

      setTimeout(() => {
        console.log("🔊 GO");
        soundGo.currentTime = 0;
        soundGo.play().catch(()=>{});
        socket.send("GO_NOW");
      }, delay);
    }

    if (role === "arrivee" && event.data === "GO_NOW") {
      console.log("⏱️ GO → chrono");

      startTime = performance.now();
      timerInterval = setInterval(updateTime, 10);
      captureLoop = setInterval(captureFrame, 1000 / FPS);
    }

    return; // on sort si ce n'est pas un JSON
  }

  // ================= Gestion JSON =================
  if (data.success) {
    console.log("✅", data.success);
    // cacher le formulaire si création/jointure de room OK
    groupForm.classList.add("hidden");

    // Afficher les boutons départ/arrivée pour continuer le chrono
    roleSelect.classList.remove("hidden");
  }

  if (data.error) {
    alert("❌ " + data.error);
  }
};



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

///////////////////////
//cacher le canvas au début
canvas.classList.add("hidden");


async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", frameRate: FPS },
    audio: false
  });
  video.srcObject = stream;
  await waitForVideoReady();
  ///////////////////////
}

// Attendre que la vidéo soit ready et ajuster le canvas
function waitForVideoReady() {
  return new Promise(resolve => {
    if (video.readyState >= 2) {
      // La vidéo est déjà prête, on ajuste le canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    } else {
      video.onloadeddata = () => {
        // Vidéo prête, on ajuste le canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve();
      };
    }
  });
}////////////////////////////////

function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
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

// ======== Affichage des frames ========
function showFrame() {
  if (!frames[currentFrame]) return;
  ctx.putImageData(frames[currentFrame], 0, 0);
  timeDisplay.textContent = frameTimes[currentFrame].toFixed(3);
  slider.value = currentFrame;
}


// ======== Rendu des resultats ========
function renderResults() {
  resultsTable.innerHTML = "";

  results.forEach((res, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${res.time.toFixed(3)}</td>
      <td>
        <input type="text" value="${res.name}" data-id="${res.id}">
      </td>
      <td>
        <button data-id="${res.id}">❌</button>
      </td>
    `;

    resultsTable.appendChild(row);
  });

  // Suppression
  resultsTable.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      results = results.filter(r => r.id !== id);
      renderResults();
    };
  });

  // Renommage
  resultsTable.querySelectorAll("input").forEach(input => {
    input.onchange = () => {
      const id = Number(input.dataset.id);
      const res = results.find(r => r.id === id);
      if (res) res.name = input.value;
    };
  });
}



// ================== RÔLES UI ==================
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
  console.log("🏁 Mode ARRIVÉE actif");
  // DEMANDE LA CAMERA IMMÉDIATEMENT
  if (!stream) {
    console.log("📹 Demande d'accès à la caméra...");
    await startCamera();
  }

  video.classList.remove("hidden");
  canvas.classList.add("hidden");
};


// ================== START ==================
startBtn.onclick = async () => {
  if (role !== "arrivee") {
    console.warn("⛔ START ignoré (pas ARRIVÉE)");
    return;
  }

  results = [];
  resultsTable.innerHTML = "";

  if (role === "arrivee") {    
    video.classList.remove("hidden");
    canvas.classList.add("hidden");
    slider.classList.add("hidden");
    markBtn.classList.add("hidden");
    document.getElementById("results").classList.add("hidden");

    // Envoyer signal au téléphone départ
    socket.send("START_SEQUENCE");
    console.log("📩 START_SEQUENCE envoyé au départ");
  }
};


// ================== STOP ==================
stopBtn.onclick = () => {
  clearInterval(timerInterval);
  clearInterval(captureLoop);

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  video.classList.add("hidden");
  canvas.classList.remove("hidden");
  slider.classList.remove("hidden");
  markBtn.classList.remove("hidden");
  document.getElementById("results").classList.remove("hidden");

  // Configurer slider
  slider.max = frames.length - 1;
  slider.value = 0;
  currentFrame = 0;

  if(frames.length>0) showFrame();

  console.log("🛑 Chrono stoppé");
};


function showRole() {
  timeDisplay.textContent =
    role === "depart" ? "📍 DÉPART" : "🏁 ARRIVÉE";
}


unlockBtn.onclick = async () => {
  try {
    await soundReady.play();
    soundReady.pause();
    soundReady.currentTime = 0;

    await soundGo.play();
    soundGo.pause();
    soundGo.currentTime = 0;

    audioUnlocked = true;
    unlockBtn.textContent = "✅ Son activé";
    unlockBtn.disabled = true;

    console.log("🔓 Audio déverrouillé sur téléphone départ");
  } catch (e) {
    console.error("Erreur audio unlock", e);
  }
};




// ======== Slider ========
slider.oninput = () => {
  currentFrame = Number(slider.value);
  showFrame();
};




// ======== Marquage des temps ========
markBtn.onclick = () => {
  if (!frameTimes[currentFrame]) return;

  const time = frameTimes[currentFrame];

  results.push({
    id: Date.now(),              // identifiant unique
    time: time,                  // temps exact
    name: "Athlète " + (results.length + 1)
  });

  renderResults();
};


// Bouton de decalage frames
back1.onclick = () => {
  currentFrame = Math.max(0, currentFrame - FRAME_STEP);
  showFrame();
};

forward1.onclick = () => {
  currentFrame = Math.min(frames.length - 1, currentFrame + FRAME_STEP);
  showFrame();
};



let currentRoom = null;

// Choisir ou créer la room
document.getElementById("joinRoom").onclick = () => {
  const roomInput = document.getElementById("roomName").value.trim();
  if (!roomInput) return alert("Entrez un nom de groupe");

  currentRoom = roomInput;
  document.getElementById("roomSelect").classList.add("hidden");
  console.log("📦 Rejoint la room:", currentRoom);
};


function sendWS(type, payload = {}) {
  if (!currentRoom) return console.warn("Room non définie");
  socket.send(JSON.stringify({ room: currentRoom, type, payload }));
}


createGroupBtn.onclick = () => {
  currentAction = "create";
  groupForm.classList.remove("hidden");
};

joinGroupBtn.onclick = () => {
  currentAction = "join";
  groupForm.classList.remove("hidden");
};

cancelGroupBtn.onclick = () => {
  groupForm.classList.add("hidden");
  groupIdInput.value = "";
  groupPasswordInput.value = "";
};


submitGroupBtn.onclick = () => {
  const roomId = groupIdInput.value.trim();
  const password = groupPasswordInput.value.trim();

  if (!roomId || !password) {
    alert("Veuillez remplir l'ID et le mot de passe !");
    return;
  }

  if (!/^\d+$/.test(password)) {
    alert("Le mot de passe doit contenir uniquement des chiffres !");
    return;
  }

  if (currentAction === "create") {
    socket.send(JSON.stringify({
      type: "CREATE_ROOM",
      roomId,
      password
    }));
  } else if (currentAction === "join") {
    socket.send(JSON.stringify({
      type: "JOIN_ROOM",
      roomId,
      password
    }));
  }
};



const showCreateRoomBtn = document.getElementById("showCreateRoom");
const showJoinRoomBtn = document.getElementById("showJoinRoom");
const createRoomForm = document.getElementById("createRoomForm");
const joinRoomForm = document.getElementById("joinRoomForm");

// Afficher le formulaire création
showCreateRoomBtn.onclick = () => {
  createRoomForm.classList.remove("hidden");
  joinRoomForm.classList.add("hidden");
  showCreateRoomBtn.classList.add("hidden");
  showJoinRoomBtn.classList.add("hidden");
};

// Afficher le formulaire rejoindre
showJoinRoomBtn.onclick = () => {
  joinRoomForm.classList.remove("hidden");
  createRoomForm.classList.add("hidden");
  showCreateRoomBtn.classList.add("hidden");
  showJoinRoomBtn.classList.add("hidden");
};

// Annuler création
document.getElementById("cancelCreateRoom").onclick = () => {
  createRoomForm.classList.add("hidden");
  showCreateRoomBtn.classList.remove("hidden");
  showJoinRoomBtn.classList.remove("hidden");
};

// Annuler rejoindre
document.getElementById("cancelJoinRoom").onclick = () => {
  joinRoomForm.classList.add("hidden");
  showCreateRoomBtn.classList.remove("hidden");
  showJoinRoomBtn.classList.remove("hidden");
};


