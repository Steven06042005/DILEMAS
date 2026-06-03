// Lógica de interacción para estudiantes en sala.
const joinShell = document.getElementById("joinShell");
const studentShell = document.getElementById("studentShell");
const joinForm = document.getElementById("joinForm");
const studentRoomTitle = document.getElementById("studentRoomTitle");
const studentStatus = document.getElementById("studentStatus");
const studentState = document.getElementById("studentState");
const studentContent = document.getElementById("studentContent");
const resultsCard = document.getElementById("resultsCard");
const reflectionCard = document.getElementById("reflectionCard");

let roomId = null;
let participant = null;
let currentSession = null;
let currentCase = null;
let voteSubmitted = false;

const params = new URLSearchParams(location.search);
if (params.get("room")) {
  document.getElementById("studentCode").value = params.get("room");
}

joinForm.addEventListener("submit", async event => {
  event.preventDefault();
  roomId = document.getElementById("studentCode").value.trim();
  const name = document.getElementById("studentName").value.trim();
  const studentCode = document.getElementById("studentId").value.trim();

  if (!roomId || !name) {
    alert("Ingresa tu nombre y el código de sala.");
    return;
  }

  participant = await joinRoom(roomId, { name, studentCode });
  await enterRoom();
});

async function enterRoom() {
  joinShell.classList.add("hidden");
  studentShell.classList.remove("hidden");
  studentRoomTitle.textContent = `Sala ${roomId}`;
  studentStatus.textContent = "Conectado";
  studentState.textContent = "Esperando instrucciones del docente...";
  studentContent.innerHTML = "";
  resultsCard.classList.add("hidden");
  reflectionCard.classList.add("hidden");

  subscribeRoom(roomId);
  refreshState();
}

function subscribeRoom(roomId) {
  supabase
    .channel(`student:${roomId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `room_id=eq.${roomId}` }, async payload => {
      currentSession = payload.new;
      await refreshState();
    })
    .subscribe();
}

async function refreshState() {
  currentSession = await loadSession(roomId);
  if (!currentSession) {
    studentState.textContent = "Sala no encontrada. Verifica el código.";
    return;
  }
  const caseData = await fetchCases().then(items => items.find(item => item.id === currentSession.case_id));
  currentCase = caseData;
  renderCurrentStep(currentSession.current_step);
}

function renderCurrentStep(step) {
  if (!currentCase) {
    studentState.textContent = "Carga del caso en curso...";
    return;
  }

  const stateName = step === "case" ? "Presentando caso" : step === "dilemma" ? "Votación abierta" : step === "results" ? "Resultados" : step === "reflection" ? "Reflexión final" : "Esperando";
  studentState.textContent = stateName;

  if (step === "case") {
    showCaseView();
  } else if (step === "dilemma") {
    showDilemmaView();
  } else if (step === "results") {
    showResultsView();
  } else if (step === "reflection") {
    showReflectionView();
  }
}

function showCaseView() {
  studentContent.innerHTML = `
    <section class="vote-card">
      <span class="eyebrow">Caso</span>
      <h3>${currentCase.title}</h3>
      <p>${currentCase.brief}</p>
      <p><strong>Contexto:</strong> ${currentCase.introduction}</p>
      <div class="field-group">
        <label>Personajes involucrados</label>
        <p>${currentCase.brief}</p>
      </div>
      <div id="animationContainer" class="lottie-frame"></div>
    </section>
  `;
  resultsCard.classList.add("hidden");
  reflectionCard.classList.add("hidden");
  if (currentCase.animationUrl) {
    renderLottieAnimation(currentCase.animationUrl);
  }
}

function renderLottieAnimation(url) {
  const container = document.getElementById("animationContainer");
  container.innerHTML = "";
  if (!url || !window.lottie) return;

  lottie.loadAnimation({
    container,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: url,
  });
}

function showDilemmaView() {
  if (voteSubmitted) {
    studentContent.innerHTML = `<p>Tu voto fue registrado. Espera los resultados.</p>`;
    return;
  }

  const optionsHtml = currentCase.decisions.map(decision => `
    <article class="vote-option">
      <button type="button" data-key="${decision.key}">
        <strong>${decision.key}) ${decision.label}</strong>
        <span>${decision.outcome}</span>
      </button>
    </article>
  `).join("");

  studentContent.innerHTML = `
    <section class="vote-card">
      <span class="eyebrow">Dilema</span>
      <h3>${currentCase.dilemma}</h3>
      <div class="field-group">
        <p>Selecciona la decisión que consideras más apropiada.</p>
      </div>
      <div class="vote-list">${optionsHtml}</div>
    </section>
  `;

  studentContent.querySelectorAll(".vote-option button").forEach(button => {
    button.addEventListener("click", async () => {
      const key = button.dataset.key;
      await submitVote(roomId, participant.id, key);
      voteSubmitted = true;
      button.classList.add("selected");
      studentContent.innerHTML = `<p>Voto registrado: ${key}. Gracias por participar.</p>`;
    });
  });
}

async function showResultsView() {
  const votes = await fetchVotes(roomId);
  const counts = currentCase.decisions.map(decision => ({
    ...decision,
    count: votes.filter(v => v.option_key === decision.key).length,
  }));
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;

  resultsCard.innerHTML = `
    <h3>Resultados en vivo</h3>
    ${counts.map(item => `
      <div class="result-bar">
        <div class="result-summary"><span>${item.key}) ${item.label}</span><strong>${Math.round((item.count / total) * 100)}%</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width: ${Math.round((item.count / total) * 100)}%"></div></div>
        <span>${item.count} votos</span>
      </div>
    `).join("")}
  `;

  resultsCard.classList.remove("hidden");
  studentContent.innerHTML = "";
  reflectionCard.classList.add("hidden");
}

function showReflectionView() {
  reflectionCard.innerHTML = `
    <h3>Reflexión final</h3>
    <p>${currentCase.reflection || "Analiza las consecuencias de cada decisión y genera preguntas para el debate."}</p>
    <ul>
      ${currentCase.decisions.map(item => `<li><strong>${item.key})</strong> ${item.outcome}</li>`).join("")}
    </ul>
    <p><em>Bibliografía:</em> ${currentCase.bibliography || "No disponible."}</p>
  `;
  reflectionCard.classList.remove("hidden");
  studentContent.innerHTML = "";
  resultsCard.classList.add("hidden");
}
