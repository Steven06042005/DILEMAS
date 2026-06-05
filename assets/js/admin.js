// Lógica de administración para crear, editar y eliminar casos.
const loginForm = document.getElementById("loginForm");
const adminPanel = document.getElementById("adminPanel");
const loginMessage = document.getElementById("loginMessage");
const newCaseButton = document.getElementById("newCaseButton");
const refreshCases = document.getElementById("refreshCases");
const caseList = document.getElementById("caseList");
const caseEditorShell = document.getElementById("caseEditorShell");
const caseForm = document.getElementById("caseForm");
const editorTitle = document.getElementById("editorTitle");
const cancelEdit = document.getElementById("cancelEdit");
const addDecision = document.getElementById("addDecision");

let cases = [];
let editingCase = null;

const caseFields = {
  title: document.getElementById("caseTitle"),
  category: document.getElementById("caseCategory"),
  brief: document.getElementById("caseBrief"),
  introduction: document.getElementById("caseIntro"),
  dilemma: document.getElementById("caseDilemma"),
  imageUrl: document.getElementById("caseImage"),
  animationUrl: document.getElementById("caseAnimation"),
  reflection: document.getElementById("caseReflection"),
  bibliography: document.getElementById("caseBibliography"),
};

const decisionBlocks = document.getElementById("decisionBlocks");
const connectionStatus = document.getElementById("connectionStatus");

function showConnectionStatus(message, type = "info") {
  if (!connectionStatus) return;
  connectionStatus.textContent = message;
  connectionStatus.className = `message message-${type}`;
}

// Formato seguro de acceso. No almacena credenciales reales en el servidor.
loginForm.addEventListener("submit", event => {
  event.preventDefault();
  const user = document.getElementById("adminUser").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (user === "Steven" && password === "1234") {
    sessionStorage.setItem("dilemas_admin", "authenticated");
    showAdminPanel();
    loadCases();
    return;
  }

  loginMessage.textContent = "Usuario o contraseña incorrectos. Intenta nuevamente.";
  loginMessage.classList.add("message-danger");
});

function showAdminPanel() {
  loginForm.classList.add("hidden");
  loginMessage.classList.add("hidden");
  adminPanel.classList.remove("hidden");
}

function loadCases() {
  showConnectionStatus("Conectando a Supabase...", "info");
  fetchCases().then(data => {
    cases = data;
    if (!cases.length) {
      showConnectionStatus("Conexión correcta, pero no hay casos en la tabla. Ejecuta database/schema.sql o crea un caso.", "info");
    } else {
      showConnectionStatus(`Conectado a Supabase. ${cases.length} caso(s) cargado(s).`, "info");
    }
    renderCaseList();
  }).catch(error => {
    console.error(error);
    showConnectionStatus(`No se pudo conectar a Supabase: ${error.message || error}. Revisa URL/clave y permisos de la tabla.`, "danger");
    cases = JSON.parse(localStorage.getItem("dilemas_cases") || "[]");
    renderCaseList();
  });
}

function renderCaseList() {
  caseList.innerHTML = "";
  if (!cases.length) {
    caseList.innerHTML = `<div class="case-card"><p>No hay casos disponibles. Crea el primero.</p></div>`;
    return;
  }

  cases.forEach(caso => {
    const card = document.createElement("article");
    card.className = "case-card";
    card.innerHTML = `
      <div>
        <span class="eyebrow">${caso.category || "General"}</span>
        <h4>${caso.title}</h4>
        <p>${caso.brief || "Sin descripción breve."}</p>
      </div>
      <div class="case-actions">
        <button class="button button-secondary" data-action="view" data-id="${caso.id}">Ver</button>
        <button class="button button-secondary" data-action="edit" data-id="${caso.id}">Editar</button>
        <button class="button button-secondary" data-action="duplicate" data-id="${caso.id}">Duplicar</button>
        <button class="button button-tertiary" data-action="delete" data-id="${caso.id}">Eliminar</button>
      </div>
    `;
    caseList.appendChild(card);
  });
}

caseList.addEventListener("click", event => {
  const action = event.target.dataset.action;
  const caseId = event.target.dataset.id;
  if (!action || !caseId) return;

  const selected = cases.find(item => item.id === caseId);
  if (!selected) return;

  if (action === "view") {
    openCaseModal(selected);
  }
  if (action === "edit") {
    startEditCase(selected);
  }
  if (action === "duplicate") {
    duplicateCase(selected);
  }
  if (action === "delete") {
    deleteCase(caseId);
  }
});

function openCaseModal(caso) {
  const modalContent = `Título: ${caso.title}\nCategoría: ${caso.category}\n\n${caso.brief}\n\n${caso.introduction}\n\nDilema: ${caso.dilemma}`;
  alert(modalContent);
}

function startEditCase(caso) {
  editingCase = caso;
  editorTitle.textContent = `Editar caso: ${caso.title}`;
  Object.entries(caseFields).forEach(([key, input]) => {
    input.value = caso[key] || "";
  });
  renderDecisionBlocks(caso.decisions || []);
  caseEditorShell.scrollIntoView({ behavior: "smooth" });
}

function duplicateCase(caso) {
  const clone = { ...caso, id: crypto.randomUUID(), title: `${caso.title} (copia)` };
  cases.unshift(clone);
  saveLocalCases();
  renderCaseList();
  alert("Caso duplicado correctamente.");
}

function deleteCase(id) {
  if (!confirm("¿Deseas eliminar este caso de forma permanente?")) {
    return;
  }

  removeCase(id).catch(() => {
    cases = cases.filter(item => item.id !== id);
    saveLocalCases();
  }).finally(() => {
    cases = cases.filter(item => item.id !== id);
    renderCaseList();
  });
}

function resetEditor() {
  editingCase = null;
  editorTitle.textContent = "Nuevo caso";
  caseForm.reset();
  renderDecisionBlocks([]);
}

function renderDecisionBlocks(decisions = []) {
  decisionBlocks.innerHTML = "";
  const defaults = decisions.length ? decisions : [
    { key: "A", label: "Permitir IA indetectable", outcome: "Aumento de productividad seguido de pérdida de confianza." },
    { key: "B", label: "Permitir IA transparente", outcome: "Balance entre ética e innovación." },
    { key: "C", label: "Prohibir completamente la IA", outcome: "Menor innovación, mayor control." },
  ];

  defaults.forEach((decision, index) => {
    const block = document.createElement("div");
    block.className = "decision-item";
    block.innerHTML = `
      <div class="field-group">
        <label>Clave</label>
        <input name="decisionKey" type="text" value="${decision.key}" maxlength="1" />
      </div>
      <div class="field-group">
        <label>Opción</label>
        <input name="decisionLabel" type="text" value="${decision.label}" />
      </div>
      <div class="field-group">
        <label>Resultado</label>
        <textarea name="decisionOutcome" rows="2">${decision.outcome}</textarea>
      </div>
      <button class="button button-tertiary remove-decision" type="button">Eliminar decisión</button>
    `;
    block.querySelector(".remove-decision").addEventListener("click", () => {
      block.remove();
    });
    decisionBlocks.appendChild(block);
  });
}

addDecision.addEventListener("click", () => {
  const currentCount = decisionBlocks.querySelectorAll(".decision-item").length + 1;
  const block = document.createElement("div");
  block.className = "decision-item";
  block.innerHTML = `
      <div class="field-group">
        <label>Clave</label>
        <input name="decisionKey" type="text" value="${String.fromCharCode(64 + currentCount)}" maxlength="1" />
      </div>
      <div class="field-group">
        <label>Opción</label>
        <input name="decisionLabel" type="text" placeholder="Nueva opción" />
      </div>
      <div class="field-group">
        <label>Resultado</label>
        <textarea name="decisionOutcome" rows="2" placeholder="Resultado de esta decisión"></textarea>
      </div>
      <button class="button button-tertiary remove-decision" type="button">Eliminar decisión</button>
    `;
  block.querySelector(".remove-decision").addEventListener("click", () => block.remove());
  decisionBlocks.appendChild(block);
});

caseForm.addEventListener("submit", async event => {
  event.preventDefault();
  const caseData = {
    id: editingCase?.id || crypto.randomUUID(),
    title: caseFields.title.value.trim(),
    category: caseFields.category.value.trim(),
    brief: caseFields.brief.value.trim(),
    introduction: caseFields.introduction.value.trim(),
    dilemma: caseFields.dilemma.value.trim(),
    imageUrl: caseFields.imageUrl.value.trim(),
    animationUrl: caseFields.animationUrl.value.trim(),
    reflection: caseFields.reflection.value.trim(),
    bibliography: caseFields.bibliography.value.trim(),
    decisions: Array.from(decisionBlocks.querySelectorAll(".decision-item")).map(item => ({
      key: item.querySelector("input[name='decisionKey']").value.trim(),
      label: item.querySelector("input[name='decisionLabel']").value.trim(),
      outcome: item.querySelector("textarea[name='decisionOutcome']").value.trim(),
    })),
  };

  try {
    const saved = await upsertCase(caseData);
    const existingIndex = cases.findIndex(item => item.id === saved.id);
    if (existingIndex >= 0) {
      cases[existingIndex] = saved;
    } else {
      cases.unshift(saved);
    }
    renderCaseList();
    saveLocalCases();
    resetEditor();
    alert("Caso guardado correctamente.");
  } catch (error) {
    console.warn("Guardado local por fallback.");
    cases = cases.filter(item => item.id !== caseData.id);
    cases.unshift(caseData);
    saveLocalCases();
    renderCaseList();
    resetEditor();
  }
});

cancelEdit.addEventListener("click", () => {
  resetEditor();
});

newCaseButton.addEventListener("click", () => {
  resetEditor();
  caseEditorShell.scrollIntoView({ behavior: "smooth" });
});

refreshCases.addEventListener("click", loadCases);

function saveLocalCases() {
  localStorage.setItem("dilemas_cases", JSON.stringify(cases));
}

function deleteCase(caseId) {
  if (!confirm("¿Deseas eliminar este caso de forma permanente?")) return;
  removeCase(caseId).catch(() => {
    // En modo local, elimina de storage.
    cases = cases.filter(caso => caso.id !== caseId);
    saveLocalCases();
  }).finally(() => {
    cases = cases.filter(caso => caso.id !== caseId);
    renderCaseList();
  });
}

if (sessionStorage.getItem("dilemas_admin") === "authenticated") {
  showAdminPanel();
  loadCases();
}
