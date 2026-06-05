// Lógica de gestión de sesión en vivo para el docente.
const sessionCaseSelect = document.getElementById("sessionCase");
const startSessionBtn = document.getElementById("startSessionBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const showCaseBtn = document.getElementById("showCaseBtn");
const showDilemmaBtn = document.getElementById("showDilemmaBtn");
const showResultsBtn = document.getElementById("showResultsBtn");
const showReflectionBtn = document.getElementById("showReflectionBtn");
const sessionCode = document.getElementById("sessionCode");
const participantCount = document.getElementById("participantCount");
const sessionState = document.getElementById("sessionState");
const sessionLink = document.getElementById("sessionLink");
const copySessionLink = document.getElementById("copySessionLink");
const participantList = document.getElementById("participantList");
const qrCanvas = document.getElementById("qrCanvas");

let currentSession = null;
let participants = [];
let sessionSubscription = null;
let participantsSubscription = null;

function formatUrl(code) {
  const pageDirectory = new URL(".", window.location.href);
  pageDirectory.hash = "";
  pageDirectory.search = "";
  return new URL(`student.html?room=${encodeURIComponent(code)}`, pageDirectory).href;
}

async function loadCasesToPicker() {
  const cases = await fetchCases();
  sessionCaseSelect.innerHTML = cases.length
    ? cases.map(caso => `<option value="${caso.id}">${caso.title}</option>`).join("")
    : `<option value="">No hay casos disponibles</option>`;
  startSessionBtn.disabled = cases.length === 0;
}

function renderParticipants() {
  participantCount.textContent = participants.length.toString();
  participantList.innerHTML = participants.map(participant => `
    <article class="participant-item">
      <div>
        <strong>${participant.name}</strong>
        <span>${participant.student_code || "Código no enviado"}</span>
      </div>
      <span>${participant.connected ? "Conectado" : "Desconectado"}</span>
    </article>
  `).join("");
}

function updateControlState() {
  const enabled = !!currentSession;
  endSessionBtn.disabled = !enabled;
  showCaseBtn.disabled = !enabled;
  showDilemmaBtn.disabled = !enabled;
  showResultsBtn.disabled = !enabled;
  showReflectionBtn.disabled = !enabled;
  sessionState.textContent = currentSession ? capitalize(currentSession.current_step || "iniciada") : "Inactiva";
}

function capitalize(value) {
  return value?.charAt(0).toUpperCase() + value?.slice(1);
}

async function createRoom() {
  const code = generateRoomCode();
  const selectedCaseId = sessionCaseSelect.value;
  const teacher = document.getElementById("sessionTeacher").value.trim() || "Docente";

  if (!selectedCaseId) {
    alert("Primero crea o selecciona un caso.");
    return;
  }

  const roomUrl = formatUrl(code);

  try {
    currentSession = await createSession(code, selectedCaseId, teacher);
    sessionCode.textContent = code;
    sessionLink.textContent = roomUrl;
    sessionLink.href = roomUrl;
    copySessionLink.disabled = false;
    generateQr(roomUrl);
    subscribeRoom(code);
    updateControlState();
  } catch (error) {
    alert("No se pudo crear la sala. Revisa la configuración de Supabase.");
  }
}

function generateQr(url) {
  if (!window.QRCode) {
    console.error("La libreria QRCode no esta disponible.");
    return;
  }

  QRCode.toCanvas(qrCanvas, url, { width: 260, margin: 1, color: { dark: "#07101d", light: "#ffffff" } }, error => {
    if (error) console.error(error);
  });
}

function subscribeRoom(roomId) {
  if (sessionSubscription) {
    supabase.removeChannel(sessionSubscription);
  }
  if (participantsSubscription) {
    supabase.removeChannel(participantsSubscription);
  }

  sessionSubscription = subscribeSession(roomId, updated => {
    currentSession = updated;
    sessionState.textContent = capitalize(updated.current_step);
  });

  participantsSubscription = subscribeParticipants(roomId, async () => {
    participants = await fetchParticipants(roomId);
    renderParticipants();
  });

  fetchParticipants(roomId).then(data => {
    participants = data;
    renderParticipants();
  });
}

async function updateSessionStep(step) {
  if (!currentSession) return;
  const updated = await updateSession(currentSession.room_id, { current_step: step, state: step });
  currentSession = updated;
  sessionState.textContent = capitalize(step);
}

startSessionBtn.addEventListener("click", async () => {
  await createRoom();
  startSessionBtn.disabled = true;
  endSessionBtn.disabled = false;
});

endSessionBtn.addEventListener("click", async () => {
  if (!currentSession) return;
  await updateSession(currentSession.room_id, { state: "finished", current_step: "finalizado" });
  sessionState.textContent = "Finalizada";
  startSessionBtn.disabled = false;
  endSessionBtn.disabled = true;
});

showCaseBtn.addEventListener("click", () => updateSessionStep("case"));
showDilemmaBtn.addEventListener("click", () => updateSessionStep("dilemma"));
showResultsBtn.addEventListener("click", () => updateSessionStep("results"));
showReflectionBtn.addEventListener("click", () => updateSessionStep("reflection"));

function downloadCsv(filename, rows) {
  const headers = Object.keys(rows[0] || {}).join(",");
  const csvContent = [headers, ...rows.map(row => Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportCsv() {
  if (!currentSession) return;
  const votes = await fetchVotes(currentSession.room_id);
  const rows = participants.map(participant => ({
    nombre: participant.name,
    codigo: participant.student_code || "",
    conectado: participant.connected,
    votado: votes.some(v => v.participant_id === participant.id),
  }));
  downloadCsv(`dilemas-sala-${currentSession.room_id}.csv`, rows);
}

document.getElementById("exportCsv").addEventListener("click", exportCsv);

copySessionLink.addEventListener("click", async () => {
  if (!currentSession || !sessionLink.href) return;
  try {
    await navigator.clipboard.writeText(sessionLink.href);
    copySessionLink.textContent = "Enlace copiado";
    setTimeout(() => {
      copySessionLink.textContent = "Copiar enlace";
    }, 1600);
  } catch (error) {
    console.error("No se pudo copiar el enlace:", error);
    alert("No se pudo copiar el enlace. Puedes abrirlo desde el texto bajo el QR.");
  }
});

loadCasesToPicker();
