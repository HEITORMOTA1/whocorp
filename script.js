/* ===========================================================
   Who Corp — Consulta de CNPJ
   Fonte de dados: BrasilAPI (https://brasilapi.com.br)
   Base oficial: Receita Federal do Brasil
   =========================================================== */

const API_BASE = "https://brasilapi.com.br/api/cnpj/v1/";

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("cnpj-input"),
  hint: document.getElementById("form-hint"),
  statusArea: document.getElementById("status-area"),
  loading: document.getElementById("loading-state"),
  loadingText: document.getElementById("loading-text"),
  errorState: document.getElementById("error-state"),
  errorTitle: document.getElementById("error-title"),
  errorText: document.getElementById("error-text"),
  dossier: document.getElementById("dossier"),
  newSearchBtn: document.getElementById("new-search-btn"),
  copyBtn: document.getElementById("copy-cnpj-btn"),
  printBtn: document.getElementById("print-btn"),
};

/* ---------- Máscara de CNPJ ---------- */
function maskCNPJ(value) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  let out = digits;
  if (digits.length > 12) {
    out = digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
  } else if (digits.length > 8) {
    out = digits.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
  } else if (digits.length > 5) {
    out = digits.replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  } else if (digits.length > 2) {
    out = digits.replace(/(\d{2})(\d{0,3})/, "$1.$2");
  }
  return out;
}

els.input.addEventListener("input", (e) => {
  e.target.value = maskCNPJ(e.target.value);
  els.hint.textContent = "";
});

/* ---------- Validação do dígito verificador (algoritmo oficial) ---------- */
function isValidCNPJ(raw) {
  const cnpj = raw.replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos dígitos iguais

  const calc = (base) => {
    let weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base12 = cnpj.slice(0, 12);
  const d1 = calc(base12);
  const d2 = calc(base12 + d1);
  return cnpj === base12 + String(d1) + String(d2);
}

/* ---------- Helpers de formatação ---------- */
function formatCurrencyBRL(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function yearsSince(dateStr) {
  if (!dateStr) return "—";
  const start = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(start.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const hadAnniversary =
    now.getMonth() > start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!hadAnniversary) years -= 1;
  if (years < 1) {
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months -= 1;
    return `${Math.max(months, 0)} mes(es)`;
  }
  return `${years} ano(s)`;
}

function formatPhone(ddd, phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  const withDDD = ddd ? `(${ddd}) ` : "";
  if (digits.length >= 9) {
    return `${withDDD}${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return `${withDDD}${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function textOrDash(value) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function situacaoStampClass(descricao) {
  const d = (descricao || "").toUpperCase();
  if (d.includes("ATIVA")) return "stamp-green";
  if (d.includes("BAIXADA") || d.includes("INAPTA") || d.includes("SUSPENSA")) return "stamp-red";
  return "stamp-gray";
}

/* ---------- Estados de UI ---------- */
function resetUI() {
  els.statusArea.hidden = true;
  els.loading.hidden = true;
  els.errorState.hidden = true;
  els.dossier.hidden = true;
}

function showLoading() {
  resetUI();
  els.statusArea.hidden = false;
  els.loading.hidden = false;
  const phrases = [
    "abrindo processo…",
    "consultando a receita federal…",
    "cruzando registros…",
    "montando o dossiê…",
  ];
  let i = 0;
  els.loadingText.textContent = phrases[0];
  clearInterval(window.__loadingInterval);
  window.__loadingInterval = setInterval(() => {
    i = (i + 1) % phrases.length;
    els.loadingText.textContent = phrases[i];
  }, 900);
}

function showError(title, text) {
  clearInterval(window.__loadingInterval);
  resetUI();
  els.statusArea.hidden = false;
  els.errorState.hidden = false;
  els.errorTitle.textContent = title;
  els.errorText.textContent = text;
}

function showDossier() {
  clearInterval(window.__loadingInterval);
  resetUI();
  els.dossier.hidden = false;
  els.dossier.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Renderização do dossiê ---------- */
function renderDossier(data) {
  const cnpjFormatted = maskCNPJ(data.cnpj || "");

  document.getElementById("d-cnpj-tag").textContent = cnpjFormatted;
  document.getElementById("d-razao").textContent = textOrDash(data.razao_social);
  document.getElementById("d-fantasia").textContent = textOrDash(data.nome_fantasia) || "não informado";

  const stamp = document.getElementById("d-status-stamp");
  stamp.textContent = textOrDash(data.descricao_situacao_cadastral).toUpperCase();
  stamp.className = "stamp " + situacaoStampClass(data.descricao_situacao_cadastral);

  document.getElementById("f-cnpj").textContent = cnpjFormatted;
  document.getElementById("f-matriz").textContent = textOrDash(data.descricao_identificador_matriz_filial);
  document.getElementById("f-natureza").textContent =
    textOrDash(data.natureza_juridica || data.codigo_natureza_juridica);
  document.getElementById("f-porte").textContent = textOrDash(data.descricao_porte || data.porte);
  document.getElementById("f-abertura").textContent = formatDate(data.data_inicio_atividade);
  document.getElementById("f-idade").textContent = yearsSince(data.data_inicio_atividade);

  document.getElementById("f-situacao").textContent = textOrDash(data.descricao_situacao_cadastral);
  document.getElementById("f-situacao-data").textContent = formatDate(data.data_situacao_cadastral);
  document.getElementById("f-motivo").textContent = textOrDash(data.descricao_motivo_situacao_cadastral) || "sem motivo registrado";
  document.getElementById("f-simples").textContent = data.opcao_pelo_simples ? "Optante" : "Não optante";
  document.getElementById("f-mei").textContent = data.opcao_pelo_mei ? "Optante" : "Não optante";

  document.getElementById("f-capital").textContent = formatCurrencyBRL(data.capital_social);
  document.getElementById("f-porte2").textContent = textOrDash(data.descricao_porte || data.porte);
  document.getElementById("f-resp").textContent = textOrDash(data.qualificacao_do_responsavel);

  document.getElementById("f-cnae-cod").textContent = textOrDash(data.cnae_fiscal);
  document.getElementById("f-cnae-desc").textContent = textOrDash(data.cnae_fiscal_descricao);

  const secList = document.getElementById("f-cnae-sec");
  secList.innerHTML = "";
  const secundarios = data.cnaes_secundarios || [];
  if (secundarios.length === 0) {
    secList.innerHTML = `<li class="empty">Nenhuma atividade secundária registrada.</li>`;
  } else {
    secundarios.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.codigo} — ${c.descricao}`;
      secList.appendChild(li);
    });
  }

  const logradouro = [
    data.descricao_tipo_de_logradouro,
    data.logradouro,
    data.numero ? `nº ${data.numero}` : null,
    data.complemento || null,
  ].filter(Boolean).join(" ");
  document.getElementById("f-endereco").textContent = logradouro || "—";
  document.getElementById("f-bairro").textContent = textOrDash(data.bairro);
  document.getElementById("f-municipio").textContent =
    `${textOrDash(data.municipio)} / ${textOrDash(data.uf)}`;
  document.getElementById("f-cep").textContent = textOrDash(data.cep);

  document.getElementById("f-tel1").textContent =
    formatPhone(data.ddd_telefone_1?.slice(0, 2), data.ddd_telefone_1?.slice(2)) || "—";
  document.getElementById("f-tel2").textContent =
    formatPhone(data.ddd_telefone_2?.slice(0, 2), data.ddd_telefone_2?.slice(2)) || "—";
  document.getElementById("f-fax").textContent =
    formatPhone(data.ddd_fax?.slice(0, 2), data.ddd_fax?.slice(2)) || "—";

  // QSA — quadro de sócios e administradores
  const qsaGrid = document.getElementById("qsa-grid");
  const qsaCount = document.getElementById("qsa-count");
  qsaGrid.innerHTML = "";
  const qsa = data.qsa || [];
  qsaCount.textContent = `${qsa.length} ${qsa.length === 1 ? "pessoa" : "pessoas"}`;

  if (qsa.length === 0) {
    qsaGrid.innerHTML = `<p class="qsa-empty">Nenhum sócio ou administrador constando no quadro societário disponível.</p>`;
  } else {
    qsa.forEach((socio) => {
      const card = document.createElement("div");
      card.className = "qsa-card";
      card.innerHTML = `
        <p class="qsa-name">${textOrDash(socio.nome_socio)}</p>
        <p class="qsa-role">${textOrDash(socio.qualificacao_socio)}</p>
        <div class="qsa-meta">
          <span>Entrada na sociedade: ${formatDate(socio.data_entrada_sociedade)}</span>
          <span>Faixa etária: ${textOrDash(socio.faixa_etaria)}</span>
        </div>
      `;
      qsaGrid.appendChild(card);
    });
  }

  document.getElementById("copy-cnpj-btn").dataset.cnpj = cnpjFormatted;
}

/* ---------- Consulta à API ---------- */
async function consultarCNPJ(cnpjDigits) {
  showLoading();
  try {
    const res = await fetch(API_BASE + cnpjDigits);
    if (res.status === 404) {
      showError("Nenhum registro encontrado", "Não há dados públicos para este CNPJ na base da Receita Federal.");
      return;
    }
    if (!res.ok) {
      showError("Não foi possível concluir a consulta", "O serviço da Receita retornou um erro. Tente novamente em instantes.");
      return;
    }
    const data = await res.json();
    renderDossier(data);
    showDossier();
  } catch (err) {
    showError("Falha na investigação", "Não conseguimos falar com o serviço de consulta. Verifique sua conexão e tente novamente.");
  }
}

/* ---------- Eventos ---------- */
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const raw = els.input.value;
  const digits = raw.replace(/\D/g, "");

  if (digits.length !== 14) {
    els.hint.textContent = "Digite os 14 dígitos do CNPJ.";
    return;
  }
  if (!isValidCNPJ(digits)) {
    els.hint.textContent = "Este CNPJ não é válido — confira o número digitado.";
    return;
  }
  els.hint.textContent = "";
  consultarCNPJ(digits);
});

els.newSearchBtn.addEventListener("click", () => {
  resetUI();
  els.statusArea.hidden = true;
  els.input.value = "";
  els.input.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

els.copyBtn.addEventListener("click", async (e) => {
  const value = e.currentTarget.dataset.cnpj || "";
  try {
    await navigator.clipboard.writeText(value);
    const original = e.currentTarget.textContent;
    e.currentTarget.textContent = "Copiado!";
    setTimeout(() => (e.currentTarget.textContent = original), 1500);
  } catch {
    /* clipboard indisponível — falha silenciosa */
  }
});

els.printBtn.addEventListener("click", () => window.print());
