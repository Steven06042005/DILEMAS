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
const voteStatsSummary = document.getElementById("voteStatsSummary");
const voteStatsList = document.getElementById("voteStatsList");

let currentSession = null;
let availableCases = [];
let currentCase = null;
let participants = [];
let votes = [];
let sessionSubscription = null;
let participantsSubscription = null;
let participantsRefreshTimer = null;
let votesSubscription = null;
let votesRefreshTimer = null;

function formatUrl(code) {
  const pageDirectory = new URL(".", window.location.href);
  pageDirectory.hash = "";
  pageDirectory.search = "";
  return new URL(`student.html?room=${encodeURIComponent(code)}`, pageDirectory).href;
}

async function loadCasesToPicker() {
  const cases = await fetchCases();
  availableCases = cases;
  sessionCaseSelect.innerHTML = availableCases.length
    ? availableCases.map(caso => `<option value="${caso.id}">${caso.title}</option>`).join("")
    : `<option value="">No hay casos disponibles</option>`;
  startSessionBtn.disabled = availableCases.length === 0;
  currentCase = availableCases.find(caso => caso.id === sessionCaseSelect.value) || null;
  renderVoteStats();
}

function renderParticipants() {
  participantCount.textContent = participants.length.toString();
  participantList.innerHTML = participants.length ? participants.map(participant => `
    <article class="participant-item">
      <div>
        <strong>${participant.name}</strong>
        <span>${participant.student_code || "Código no enviado"}</span>
      </div>
      <span>${participant.connected ? "Conectado" : "Desconectado"}</span>
    </article>
  `).join("") : `<div class="message message-info">Aun no hay estudiantes en la lista de espera.</div>`;
}

function getLatestVotesByParticipant() {
  const latestVotes = new Map();
  votes.forEach(vote => {
    if (vote.participant_id) {
      latestVotes.set(vote.participant_id, vote);
    }
  });
  return Array.from(latestVotes.values());
}

function renderVoteStats() {
  if (!voteStatsSummary || !voteStatsList) return;

  const decisions = currentCase?.decisions || [];
  const latestVotes = getLatestVotesByParticipant();
  const total = latestVotes.length;
  voteStatsSummary.textContent = `${total} voto${total === 1 ? "" : "s"}`;

  if (!decisions.length) {
    voteStatsList.innerHTML = `<div class="message message-info">Selecciona un caso para ver sus opciones de decisión.</div>`;
    return;
  }

  voteStatsList.innerHTML = decisions.map(decision => {
    const count = latestVotes.filter(vote => vote.option_key === decision.key).length;
    const percent = total ? Math.round((count / total) * 100) : 0;

    return `
      <article class="stats-item">
        <div class="result-summary">
          <span><strong>${decision.key})</strong> ${decision.label}</span>
          <strong>${percent}%</strong>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
        <span>${count} voto${count === 1 ? "" : "s"}</span>
      </article>
    `;
  }).join("");
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
    currentCase = availableCases.find(caso => caso.id === selectedCaseId) || null;
    votes = [];
    renderVoteStats();
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
    supabaseClient.removeChannel(sessionSubscription);
  }
  if (participantsSubscription) {
    supabaseClient.removeChannel(participantsSubscription);
  }
  if (votesSubscription) {
    supabaseClient.removeChannel(votesSubscription);
  }
  if (participantsRefreshTimer) {
    clearInterval(participantsRefreshTimer);
  }
  if (votesRefreshTimer) {
    clearInterval(votesRefreshTimer);
  }

  sessionSubscription = subscribeSession(roomId, updated => {
    currentSession = updated;
    sessionState.textContent = capitalize(updated.current_step);
  });

  const refreshParticipants = async () => {
    participants = await fetchParticipants(roomId);
    renderParticipants();
  };

  const refreshVotes = async () => {
    votes = await fetchVotes(roomId);
    renderVoteStats();
  };

  participantsSubscription = subscribeParticipants(roomId, refreshParticipants);
  votesSubscription = subscribeVotes(roomId, refreshVotes);
  refreshParticipants();
  refreshVotes();
  participantsRefreshTimer = setInterval(refreshParticipants, 5000);
  votesRefreshTimer = setInterval(refreshVotes, 5000);
}

async function updateSessionStep(step) {
  if (!currentSession) return;
  const updated = await updateSession(currentSession.room_id, { current_step: step, state: step });
  currentSession = updated;
  sessionState.textContent = capitalize(step);
  votes = await fetchVotes(currentSession.room_id);
  renderVoteStats();
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
  if (participantsRefreshTimer) {
    clearInterval(participantsRefreshTimer);
    participantsRefreshTimer = null;
  }
  if (votesRefreshTimer) {
    clearInterval(votesRefreshTimer);
    votesRefreshTimer = null;
  }
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

sessionCaseSelect.addEventListener("change", () => {
  currentCase = availableCases.find(caso => caso.id === sessionCaseSelect.value) || null;
  votes = [];
  renderVoteStats();
});

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
