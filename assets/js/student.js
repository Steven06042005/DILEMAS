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
  document.getElementById("studentCode").value = params.get("room").trim().toUpperCase();
}

joinForm.addEventListener("submit", async event => {
  event.preventDefault();
  roomId = document.getElementById("studentCode").value.trim().toUpperCase();
  const name = document.getElementById("studentName").value.trim();
  const studentCode = document.getElementById("studentId").value.trim();

  if (!roomId || !name) {
    alert("Ingresa tu nombre y el código de sala.");
    return;
  }

  try {
    const session = await loadSession(roomId);
    if (!session) {
      alert("Sala no encontrada. Verifica el código.");
      return;
    }

    currentSession = session;
    participant = await joinRoom(roomId, { name, studentCode });
    await enterRoom();
  } catch (error) {
    console.error("No se pudo entrar a la sala:", error);
    alert("No se pudo entrar a la sala. Intenta nuevamente.");
  }
});

async function enterRoom() {
  joinShell.classList.add("hidden");
  studentShell.classList.remove("hidden");
  studentRoomTitle.textContent = `Sala ${roomId}`;
  showWaitingRoom();
  resultsCard.classList.add("hidden");
  reflectionCard.classList.add("hidden");

  subscribeRoom(roomId);
  refreshState();
}

function subscribeRoom(roomId) {
  supabaseClient
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
  } else {
    showWaitingRoom();
  }
}

function showWaitingRoom() {
  studentStatus.textContent = "En lista de espera";
  studentState.textContent = "Esperando instrucciones del docente...";
  studentContent.innerHTML = `
    <section class="vote-card">
      <span class="eyebrow">Lista de espera</span>
      <h3>Ya estas dentro de la sala</h3>
      <p>Tu registro fue enviado al profesor. Cuando inicie el caso, esta pantalla se actualizara automaticamente.</p>
    </section>
  `;
}

function showCaseView() {
  studentStatus.textContent = "Conectado";
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
  studentStatus.textContent = "Votación abierta";
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
      const selectedLabel = button.querySelector("strong")?.textContent || key;
      const buttons = Array.from(studentContent.querySelectorAll(".vote-option button"));

      buttons.forEach(option => {
        option.disabled = true;
        option.closest(".vote-option")?.classList.remove("selected");
      });
      button.closest(".vote-option")?.classList.add("selected");
      button.textContent = "Registrando tu decisión...";

      try {
        await submitVote(roomId, participant.id, key);
        voteSubmitted = true;
        studentContent.innerHTML = `
          <section class="vote-card vote-confirmation">
            <span class="eyebrow">Decisión registrada</span>
            <h3>${selectedLabel}</h3>
            <p>Tu voto fue guardado correctamente. Espera a que el profesor muestre los resultados.</p>
          </section>
        `;
      } catch (error) {
        console.error("No se pudo registrar el voto:", error);
        buttons.forEach(option => {
          option.disabled = false;
        });
        showDilemmaView();
        alert("No se pudo registrar tu decisión. Intenta nuevamente.");
      }
    });
  });
}

async function showResultsView() {
  studentStatus.textContent = "Resultados";
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
  studentStatus.textContent = "Reflexión final";
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
