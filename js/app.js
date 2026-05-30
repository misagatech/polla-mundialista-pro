import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { todosLosPartidos } from "./partidos.js";

// ======================================================
// ELEMENTOS DOM
// ======================================================
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const adminPanel = document.getElementById("adminPanel");
const gruposContainer = document.getElementById("gruposContainer");
const gruposCarousel = document.getElementById("gruposCarousel");
const scrollGruposLeft = document.getElementById("scrollGruposLeft");
const scrollGruposRight = document.getElementById("scrollGruposRight");
const userEmailSpan = document.getElementById("userEmail");
const miPosicionSpan = document.getElementById("miPosicion");
const misPuntosSpan = document.getElementById("misPuntos");
const proxLocalSpan = document.getElementById("proxLocal");
const proxVisitSpan = document.getElementById("proxVisit");
const proxFechaSpan = document.getElementById("proxFecha");
const totalParticipantesSpan = document.getElementById("totalParticipantes");
const totalAcumuladoSpan = document.getElementById("totalAcumulado");
const premioPlataformaSpan = document.getElementById("premioPlataforma");

// ======================================================
// VARIABLES GLOBALES
// ======================================================
let currentUser = null;
let currentUserRol = null;
let matchesUnsubscribe = null;
let rankingUnsubscribe = null;
let participantsUnsubscribe = null;
let adminParticipantsUnsubscribe = null;
let gruposData = {};
let clasificadosGlobales = {};
let bracket = {
  73: {},
  74: {},
  75: {},
  76: {},
  77: {},
  78: {},
  79: {},
  80: {},
  81: {},
  82: {},
  83: {},
  84: {},
  85: {},
  86: {},
  87: {},
  88: {},

  89: {},
  90: {},
  91: {},
  92: {},
  93: {},
  94: {},
  95: {},
  96: {},

  97: {},
  98: {},
  99: {},
  100: {},

  101: {},
  102: {},

  103: {},
  104: {}
};
let grupoActivo = "A";
let adminGrupoActivo = "A";

// ======================================================
// BANDERAS (códigos de país para flagcdn)
// ======================================================
function obtenerCodigoPais(nombre) {
  const paises = {
    "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "República Checa": "cz",
    "Canadá": "ca", "Bosnia y Herzegovina": "ba", "Qatar": "qa", "Suiza": "ch",
    "Brasil": "br", "Marruecos": "ma", "Haití": "ht", "Escocia": "gb-sct",
    "Estados Unidos": "us", "Paraguay": "py", "Australia": "au", "Turquía": "tr",
    "Alemania": "de", "Curazao": "cw", "Costa de Marfil": "ci", "Ecuador": "ec",
    "Países Bajos": "nl", "Japón": "jp", "Suecia": "se", "Túnez": "tn",
    "Bélgica": "be", "Egipto": "eg", "Irán": "ir", "Nueva Zelanda": "nz",
    "España": "es", "Cabo Verde": "cv", "Arabia Saudita": "sa", "Uruguay": "uy",
    "Francia": "fr", "Senegal": "sn", "Noruega": "no", "Irak": "iq",
    "Argentina": "ar", "Argelia": "dz", "Austria": "at", "Jordania": "jo",
    "Portugal": "pt", "RD Congo": "cd", "Uzbekistán": "uz", "Colombia": "co",
    "Inglaterra": "gb-eng", "Croacia": "hr", "Panamá": "pa", "Ghana": "gh"
  };
  return paises[nombre] || "un";
}
// ======================================================
// FECHAS Y HORAS DE PARTIDOS DE ELIMINATORIAS (hora Colombia UTC-5)
// ======================================================
function obtenerHoraPartidoKnockout(numeroPartido) {
  // Todas las horas son 15:00 (3:00 PM) hora Colombia (UTC-5)
  // Ajusta si algún partido tiene horario diferente
  const horaLocal = "15:00:00"; // puedes cambiar partido por partido si es necesario

  const fechas = {
    // Dieciseisavos (73 al 88)
    73: "2026-06-28", 74: "2026-06-29", 75: "2026-06-29", 76: "2026-06-29",
    77: "2026-06-30", 78: "2026-06-30", 79: "2026-06-30",
    80: "2026-07-01", 81: "2026-07-01", 82: "2026-07-01",
    83: "2026-07-02", 84: "2026-07-02", 85: "2026-07-02",
    86: "2026-07-03", 87: "2026-07-03", 88: "2026-07-03",
    // Octavos (89 al 96)
    89: "2026-07-04", 90: "2026-07-04",
    91: "2026-07-05", 92: "2026-07-05",
    93: "2026-07-06", 94: "2026-07-06",
    95: "2026-07-07", 96: "2026-07-07",
    // Cuartos (97 al 100)
    97: "2026-07-09", 98: "2026-07-10", 99: "2026-07-11", 100: "2026-07-11",
    // Semifinales (101,102)
    101: "2026-07-14", 102: "2026-07-15",
    // Tercer puesto (104) y Final (103)
    103: "2026-07-19", 104: "2026-07-18"
  };

  const fechaStr = fechas[numeroPartido];
  if (!fechaStr) return new Date(); // fallback: ahora

  // Crear fecha en UTC pero interpretando la hora local como Colombia (UTC-5)
  // Para que al mostrar en Colombia no se desplace
  const fechaLocal = new Date(`${fechaStr}T${horaLocal}`);
  // Firestore espera UTC, pero nosotros usaremos este objeto Date para comparar con new Date() que es UTC
  // Como la fecha está en UTC pero representa la hora local, necesitamos ajustarla a UTC real
  // Lo más sencillo: restar 5 horas (porque la hora local en Colombia es UTC-5)
  const fechaUTC = new Date(fechaLocal.getTime() + (5 * 60 * 60 * 1000));
  return fechaUTC;
}

// ======================================================
// CÓDIGOS FIFA (3 letras)
// ======================================================
const fifaCodes = {
  "México": "MEX", "Sudáfrica": "RSA", "Corea del Sur": "KOR", "República Checa": "CZE",
  "Canadá": "CAN", "Bosnia y Herzegovina": "BIH", "Qatar": "QAT", "Suiza": "SUI",
  "Brasil": "BRA", "Marruecos": "MAR", "Haití": "HAI", "Escocia": "SCO",
  "Estados Unidos": "USA", "Paraguay": "PAR", "Australia": "AUS", "Turquía": "TUR",
  "Alemania": "GER", "Curazao": "CUW", "Costa de Marfil": "CIV", "Ecuador": "ECU",
  "Países Bajos": "NED", "Japón": "JPN", "Suecia": "SWE", "Túnez": "TUN",
  "Bélgica": "BEL", "Egipto": "EGY", "Irán": "IRN", "Nueva Zelanda": "NZL",
  "España": "ESP", "Cabo Verde": "CPV", "Arabia Saudita": "KSA", "Uruguay": "URU",
  "Francia": "FRA", "Senegal": "SEN", "Noruega": "NOR", "Irak": "IRQ",
  "Argentina": "ARG", "Argelia": "ALG", "Austria": "AUT", "Jordania": "JOR",
  "Portugal": "POR", "RD Congo": "COD", "Uzbekistán": "UZB", "Colombia": "COL",
  "Inglaterra": "ENG", "Croacia": "CRO", "Panamá": "PAN", "Ghana": "GHA"
};

// ======================================================
// ZONA HORARIA COLOMBIA (UTC-5)
// ======================================================
function ajustarHoraColombia(fechaUTC) {
  // fechaUTC es un objeto Date (ya convertido desde Firestore)
  // Retorna un Date con la misma hora pero en zona horaria Colombia
  return new Date(fechaUTC.toLocaleString("en-US", { timeZone: "America/Bogota" }));
}

// ======================================================
// CALCULAR TIEMPO RESTANTE PARA CIERRE DE APUESTAS
// ======================================================
function formatearTiempoRestante(fechaCierre) {
  const ahora = new Date();
  const diff = fechaCierre - ahora; // milisegundos
  if (diff <= 0) return "🔒 Cerrado";
  const segundosTotales = Math.floor(diff / 1000);
  const dias = Math.floor(segundosTotales / 86400);
  const horas = Math.floor((segundosTotales % 86400) / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;

  let resultado = "";
  if (dias > 0) resultado += `${dias}d `;
  if (horas > 0 || dias > 0) resultado += `${horas}h `;
  resultado += `${minutos}m ${segundos}s`;
  return `⏳ ${resultado}`;
}

// ======================================================
// ACTUALIZAR TODOS LOS TEMPORIZADORES EN LA PÁGINA
// ======================================================
function actualizarTodosLosTimers() {
  document.querySelectorAll('[data-cierre]').forEach(el => {
    const cierre = new Date(el.dataset.cierre);
    el.innerText = formatearTiempoRestante(cierre);
    // Si el tiempo expiró y el botón no está deshabilitado, deshabilitamos inputs y botón
    if (cierre <= new Date()) {
      const card = el.closest('.knockout-card, .match-card');
      if (card) {
        const inputs = card.querySelectorAll('input.prediction-input');
        const buttons = card.querySelectorAll('.btn-guardar');
        inputs.forEach(inp => inp.disabled = true);
        buttons.forEach(btn => btn.disabled = true);
        if (el.innerText !== "🔒 Cerrado") el.innerText = "🔒 Cerrado";
      }
    }
  });
}
// ======================================================
// UTILIDADES
// ======================================================
function esFaseGrupos(match) {
  return match.fase === "grupos";
}

function agruparPartidos(partidos) {
  const grupos = {};
  partidos.forEach(match => {
    const grupo = match.grupo;
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(match);
  });
  for (const g in grupos) {
    grupos[g].sort((a, b) => a.hora_partido.toDate() - b.hora_partido.toDate());
  }
  return grupos;
}

// ======================================================
// RENDERIZAR GRUPOS (FASE DE GRUPOS - USUARIO NORMAL)
// ======================================================
function mostrarTodosLosGrupos() {
  const grupos = Object.keys(gruposData).sort();
  // Botones del carrusel
  let tabsHTML = "";
  grupos.forEach(grupo => {
    tabsHTML += `
      <button class="grupo-tab ${grupo === grupoActivo ? "active" : ""}" 
              onclick="window.cambiarGrupo('${grupo}')">
        Grupo ${grupo}
      </button>
    `;
  });
  gruposCarousel.innerHTML = tabsHTML;

  // Mostrar solo el grupo activo
  let html = "";
  const partidosGrupo = gruposData[grupoActivo] || [];
  if (partidosGrupo.length === 0) {
    gruposContainer.innerHTML = `<div class="text-center py-10">No hay partidos en este grupo</div>`;
    return;
  }

  html += `
    <div class="grupo-card">
      <div class="grupo-header">
        <h3 class="text-xl font-bold text-yellow-300">GRUPO ${grupoActivo}</h3>
      </div>
      <div class="matches-grid">
  `;
  partidosGrupo.forEach(match => {
    const matchId = match.id;
    const predLocal = match.userPred ? match.userPred.pred_local : "";
    const predVisit = match.userPred ? match.userPred.pred_visitante : "";
    const now = new Date();
    const start = match.hora_partido.toDate();

    const isStarted = now >= start;
    const hasPrediction = !!match.userPred;
    const fechaLocal = match.hora_partido.toDate().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    // Cierre de apuestas: 1 hora antes del partido
    const cierreApuestas = new Date(start.getTime() - 60 * 60 * 1000);
    const timerId = `timer_${matchId}`;
    const isClosed = new Date() >= cierreApuestas;
    const disabled = isStarted || isClosed;

    html += `
      <div class="match-card">
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(match.equipo_local)}.svg">
            <span>${match.equipo_local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(match.equipo_visitante)}.svg">
            <span>${match.equipo_visitante}</span>
          </div>
        </div>
        <div class="prediction-area">

  <input
    type="number"
    id="local_${matchId}"
    value="${predLocal}"
    placeholder="0"
    class="prediction-input"
    ${disabled ? "disabled" : ""}
  >

  <span class="score-separator">-</span>

  <input
    type="number"
    id="visit_${matchId}"
    value="${predVisit}"
    placeholder="0"
    class="prediction-input"
    ${disabled ? "disabled" : ""}
  >

</div>

${!disabled ? `
  <button
    class="btn-guardar"
    onclick="window.savePrediction('${matchId}')"
  >
    ${hasPrediction ? "Actualizar" : "Guardar"}
  </button>
` : `
  <button
    class="btn-guardar"
    disabled
  >
    🔒 ${isStarted ? "Partido iniciado" : "Apuestas cerradas"}
  </button>
`}
        <div class="match-timer" id="${timerId}" data-cierre="${cierreApuestas.toISOString()}" style="margin-top:8px; text-align:center; font-size:13px; background:#00000040; padding:6px; border-radius:20px;">
  ⏰ Resultados se bloquean en: ${formatearTiempoRestante(cierreApuestas)}
</div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
  });
  html += `</div></div>`;
  gruposContainer.innerHTML = html;
}

// ======================================================
// CAMBIAR GRUPO (desde carrusel)
// ======================================================
window.cambiarGrupo = (grupo) => {

  grupoActivo = grupo;

  mostrarTodosLosGrupos();

  generarTablaGrupos();

  generarOctavos();

  generarCuartos();

};

// ======================================================
// SCROLL DEL CARRUSEL
// ======================================================
if (scrollGruposLeft && scrollGruposRight) {
  scrollGruposLeft.addEventListener("click", () => {
    gruposCarousel.scrollBy({ left: -300, behavior: "smooth" });
  });
  scrollGruposRight.addEventListener("click", () => {
    gruposCarousel.scrollBy({ left: 300, behavior: "smooth" });
  });
}

// ======================================================
// CARGAR PARTIDOS Y PREDICCIONES (REALTIME)
// ======================================================
async function loadMatchesAndPredictions() {
  if (matchesUnsubscribe) matchesUnsubscribe();
  const q = query(collection(db, "matches"), orderBy("hora_partido"));
  matchesUnsubscribe = onSnapshot(q, async (snapshot) => {
    let matches = [];
    for (const matchDoc of snapshot.docs) {
      const match = { id: matchDoc.id, ...matchDoc.data() };
      const predQuery = query(
        collection(db, "predictions_groups"),
        where("uid", "==", currentUser.uid),
        where("match_id", "==", match.id)
      );
      const predSnap = await getDocs(predQuery);
      match.userPred = predSnap.empty ? null : predSnap.docs[0].data();

      matches.push(match);
    }
    const partidosGrupos = matches.filter(esFaseGrupos);
    gruposData = agruparPartidos(partidosGrupos);
    mostrarTodosLosGrupos();
    await generarTablaGrupos();
    

    // Próximo partido (el más cercano en el futuro)
    const ahora = new Date();
    const proximos = partidosGrupos
      .filter(m => m.hora_partido.toDate() > ahora)
      .sort((a, b) => a.hora_partido.toDate() - b.hora_partido.toDate());
    if (proximos.length > 0) {
      const p = proximos[0];
      proxLocalSpan.innerText = p.equipo_local;
      proxVisitSpan.innerText = p.equipo_visitante;
      proxFechaSpan.innerText = p.hora_partido.toDate().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    } else {
      proxLocalSpan.innerText = "---";
      proxVisitSpan.innerText = "---";
      proxFechaSpan.innerText = "No hay más partidos";
    }
  });
}

// ======================================================
// GUARDAR PREDICCIÓN (desde los inputs)
// ======================================================
window.savePrediction = async (matchId) => {

  try {

    if (!currentUser) {
      return alert("Debes iniciar sesión");
    }
    // =========================================
    // VALIDAR PARTICIPANTE
    // =========================================

    const participantRef =
      doc(db, "participants", currentUser.uid);

    const participantSnap =
      await getDoc(participantRef);

    if (!participantSnap.exists()) {

      return alert(
        "No estás registrado como participante"
      );

    }

    const participantData =
      participantSnap.data();

    // SIN PAGO

    if (!participantData.paid_groups) {

      return alert(
        "Debes realizar el pago para participar"
      );

    }

    // SIN ACCESO

    if (!participantData.enabled_groups) {

      return alert(
        "Tu acceso aún no ha sido habilitado"
      );

    }

    // =========================================
    // VALIDAR EXPULSADO
    // =========================================

    const userRef =
      doc(db, "users", currentUser.uid);

    const userSnap =
      await getDoc(userRef);

    if (userSnap.exists()) {

      const userData =
        userSnap.data();

      if (userData.expulsado === true) {

        return alert(
          "Tu cuenta fue bloqueada"
        );

      }

    }

    const localInput =
      document.getElementById(`local_${matchId}`);

    const visitInput =
      document.getElementById(`visit_${matchId}`);

    if (!localInput || !visitInput) {
      return alert("Inputs no encontrados");
    }

    const local =
      parseInt(localInput.value);

    const visit =
      parseInt(visitInput.value);

    if (isNaN(local) || isNaN(visit)) {
      return alert("Ingresa números válidos");
    }

    if (local < 0 || visit < 0) {
      return alert("No se permiten negativos");
    }

    // =========================================
    // VALIDAR DEADLINE GLOBAL
    // =========================================

    const settingsRef =
      doc(db, "settings", "config");

    const settingsSnap =
      await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return alert("Configuración no encontrada");
    }

    const settingsData =
      settingsSnap.data();

    const deadline =
      settingsData.groups_deadline.toDate();

    if (new Date() > deadline) {
      return alert(
        "La fase de grupos ya fue cerrada"
      );
    }

    // =========================================
    // VALIDAR PARTIDO
    // =========================================

    const matchRef =
      doc(db, "matches", matchId);

    const matchSnap =
      await getDoc(matchRef);

    if (!matchSnap.exists()) {
      return alert("Partido no encontrado");
    }

    const matchData =
      matchSnap.data();

    const horaPartido =
      matchData.hora_partido.toDate();

    if (new Date() >= horaPartido) {
      return alert(
        "Este partido ya comenzó"
      );
    }

    // =========================================
    // ID INTELIGENTE
    // =========================================

    const predictionId =
      `${currentUser.uid}_${matchId}`;

    // =========================================
    // GUARDAR PREDICCIÓN
    // =========================================

    await setDoc(
      doc(
        db,
        "predictions_groups",
        predictionId
      ),
      {
        uid: currentUser.uid,

        match_id: matchId,

        pred_local: local,

        pred_visitante: visit,

        submitted: false,

        locked: false,

        updated_at: serverTimestamp()
      },
      {
        merge: true
      }
    );

    alert("✅ Predicción guardada");

  } catch (error) {

    console.error(error);

    alert(error.message);

  }

};


// ======================================================
// GUARDAR PREDICCIÓN DIECISEISAVOS
// ======================================================

window.saveKnockoutPrediction = async (numeroPartido) => {

  try {

    if (!currentUser) {
      return alert("Debes iniciar sesión");
    }

    // =====================================
    // INPUTS
    // =====================================

    const localInput =
      document.getElementById(
        `ko_local_${numeroPartido}`
      );

    const visitInput =
      document.getElementById(
        `ko_visit_${numeroPartido}`
      );

    if (!localInput || !visitInput) {

      return alert(
        "Inputs no encontrados"
      );

    }

    const local =
      parseInt(localInput.value);

    const visit =
      parseInt(visitInput.value);

    if (isNaN(local) || isNaN(visit)) {

      return alert(
        "Ingresa marcadores válidos"
      );

    }

    // =====================================
    // OBTENER RADIO
    // =====================================

    const clasificadoSeleccionado =
      document.querySelector(
        `input[name="clasificado_${numeroPartido}"]:checked`
      );

    // =====================================
    // VALIDAR EMPATE
    // =====================================

    if (
      local === visit &&
      !clasificadoSeleccionado
    ) {

      return alert(
        "Debes elegir quién clasifica"
      );

    }

    // =====================================
    // CLASIFICADO
    // =====================================

    let clasificado = null;

    if (local > visit) {

      clasificado = "local";

    }

    else if (visit > local) {

      clasificado = "visitante";

    }

    else {

      clasificado =
        clasificadoSeleccionado.value;

    }

    // =====================================
    // ID
    // =====================================

    const predictionId =
      `${currentUser.uid}_KO_${numeroPartido}`;

    // =====================================
    // GUARDAR
    // =====================================

    await setDoc(

      doc(
        db,
        "predictions_knockout",
        predictionId
      ),

      {

        uid: currentUser.uid,

        partido: numeroPartido,

        pred_local: local,

        pred_visitante: visit,

        clasificado: clasificado,

        fase: "dieciseisavos",

        updated_at: serverTimestamp()

      },

      {
        merge: true
      }

    );

    alert(
      "✅ Predicción guardada"
    );

  } catch (error) {

    console.error(error);

    alert(error.message);

  }

};
// ======================================================
// GUARDAR PREDICCIÓN DE OCTAVOS
// ======================================================
window.saveOctavosPrediction = async (partidoNumero) => {
  try {
    if (!currentUser) return alert("Debes iniciar sesión");

    const localInput = document.getElementById(`oct_local_${partidoNumero}`);
    const visitInput = document.getElementById(`oct_visit_${partidoNumero}`);
    if (!localInput || !visitInput) return alert("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

    const card = document.querySelector(`[data-partido-octavos="${partidoNumero}"]`);
    if (!card) return alert("Partido no encontrado");
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) clasificado = equipoLocal;
    else if (visit > local) clasificado = equipoVisit;
    else {
      const selected = document.querySelector(`input[name="oct_clasificado_${partidoNumero}"]:checked`);
      if (!selected) return alert("Debes elegir quién clasifica");
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_OCT_${partidoNumero}`;
    await setDoc(doc(db, "predictions_octavos", predictionId), {
      uid: currentUser.uid,
      partido: partidoNumero,
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "octavos",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarCuartos(); // Refresca la vista de cuartos automáticamente
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// GUARDAR PREDICCIÓN DE CUARTOS
// ======================================================
window.saveCuartosPrediction = async (partidoNumero) => {
  try {
    if (!currentUser) return alert("Debes iniciar sesión");

    const localInput = document.getElementById(`cuartos_local_${partidoNumero}`);
    const visitInput = document.getElementById(`cuartos_visit_${partidoNumero}`);
    if (!localInput || !visitInput) return alert("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

    const card = document.querySelector(`[data-partido-cuartos="${partidoNumero}"]`);
    if (!card) return alert("Partido no encontrado");
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) clasificado = equipoLocal;
    else if (visit > local) clasificado = equipoVisit;
    else {
      const selected = document.querySelector(`input[name="cuartos_clasificado_${partidoNumero}"]:checked`);
      if (!selected) return alert("Debes elegir quién clasifica");
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_CUARTOS_${partidoNumero}`;
    await setDoc(doc(db, "predictions_cuartos", predictionId), {
      uid: currentUser.uid,
      partido: partidoNumero,
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "cuartos",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarSemifinales();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// GUARDAR PREDICCIÓN DE SEMIFINALES
// ======================================================
window.saveSemifinalPrediction = async (partidoNumero) => {
  try {
    if (!currentUser) return alert("Debes iniciar sesión");

    const localInput = document.getElementById(`semis_local_${partidoNumero}`);
    const visitInput = document.getElementById(`semis_visit_${partidoNumero}`);
    if (!localInput || !visitInput) return alert("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

    const card = document.querySelector(`[data-partido-semis="${partidoNumero}"]`);
    if (!card) return alert("Partido no encontrado");
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) clasificado = equipoLocal;
    else if (visit > local) clasificado = equipoVisit;
    else {
      const selected = document.querySelector(`input[name="semis_clasificado_${partidoNumero}"]:checked`);
      if (!selected) return alert("Debes elegir quién clasifica");
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_SEMIS_${partidoNumero}`;
    await setDoc(doc(db, "predictions_semifinales", predictionId), {
      uid: currentUser.uid,
      partido: partidoNumero,
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "semifinales",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    // Aquí luego llamarás a generarFinal() cuando la tengas
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// GENERAR FINAL
// ======================================================
async function generarFinal() {
  const container = document.getElementById("finalContainer");
  if (!container) return;

  // Obtener clasificados de semifinales (desde predictions_semifinales del usuario)
  const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
  const semisSnap = await getDocs(semisQuery);
  const clasificados = {};
  semisSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partido = { numero: 103, local: clasificados[101] || "Ganador 101", visitante: clasificados[102] || "Ganador 102" };

  const finalRef = doc(db, "predictions_final", `${currentUser.uid}_FINAL_103`);
  const finalSnap = await getDoc(finalRef);
  const pred = finalSnap.exists() ? finalSnap.data() : {};
  const predLocal = pred.pred_local ?? "";
  const predVisit = pred.pred_visitante ?? "";
  const clasifGuardado = pred.clasificado ?? "";

  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">🏆 GRAN FINAL</h3><div class="dieciseisavos-grid">`;
  html += `
    <div class="knockout-card" data-partido-final="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
      <div class="knockout-match-number">Partido ${partido.numero} - FINAL</div>
      <div class="prediction-side local-side">
        ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
        <span>${fifaCodes[partido.local] || partido.local}</span>
      </div>
      <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
        <input type="number" id="final_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;">
        <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
        <input type="number" id="final_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;">
      </div>
      <div class="prediction-side visit-side" style="margin-top:14px;">
        ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
        <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
      </div>
      <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
      <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
        ✔ Se valida el marcador en los 90 minutos<br>
        ✔ Puedes ganar puntos por marcador exacto<br>
        ✔ Y puntos extra por acertar el clasificado
      </div>
      <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
        <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? 'checked' : ''}> ${fifaCodes[partido.local] || partido.local}</label>
        <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? 'checked' : ''}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
      </div>
      <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveFinalPrediction('${partido.numero}')">Guardar</button>
    </div>
  `;
  html += `</div></div>`;
  container.innerHTML = html;
}

// ======================================================
// GENERAR TERCER PUESTO
// ======================================================
async function generarTercerPuesto() {
  const container = document.getElementById("thirdPlaceContainer");
  if (!container) return;

  const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
  const semisSnap = await getDocs(semisQuery);
  const clasificados = {};
  semisSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partido = { 
    numero: 104, 
    local: clasificados[101] ? `Perdedor ${clasificados[101]}` : "Perdedor 101", 
    visitante: clasificados[102] ? `Perdedor ${clasificados[102]}` : "Perdedor 102" 
  };

  const thirdRef = doc(db, "predictions_third", `${currentUser.uid}_THIRD_104`);
  const thirdSnap = await getDoc(thirdRef);
  const pred = thirdSnap.exists() ? thirdSnap.data() : {};
  const predLocal = pred.pred_local ?? "";
  const predVisit = pred.pred_visitante ?? "";
  const clasifGuardado = pred.clasificado ?? "";

  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">🥉 Tercer Puesto</h3><div class="dieciseisavos-grid">`;
  html += `
    <div class="knockout-card" data-partido-third="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
      <div class="knockout-match-number">Partido ${partido.numero}</div>
      <div class="prediction-side local-side">
        ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
        <span>${fifaCodes[partido.local] || partido.local}</span>
      </div>
      <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
        <input type="number" id="third_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;">
        <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
        <input type="number" id="third_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;">
      </div>
      <div class="prediction-side visit-side" style="margin-top:14px;">
        ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
        <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
      </div>
      <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
      <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
        ✔ Se valida el marcador en los 90 minutos<br>
        ✔ Puedes ganar puntos por marcador exacto<br>
        ✔ Y puntos extra por acertar el clasificado
      </div>
      <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
        <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? 'checked' : ''}> ${fifaCodes[partido.local] || partido.local}</label>
        <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? 'checked' : ''}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
      </div>
      <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveThirdPlacePrediction('${partido.numero}')">Guardar</button>
    </div>
  `;
  html += `</div></div>`;
  container.innerHTML = html;
}
// ======================================================
// RANKING EN TIEMPO REAL
// ======================================================

function loadRanking() {

  if (rankingUnsubscribe)
    rankingUnsubscribe();

  const rankingRef =
    collection(db, "ranking");

  rankingUnsubscribe =
    onSnapshot(

      query(
        rankingRef,
        orderBy("puntos", "desc")
      ),

      async (snapshot) => {

        let pos = 1;

        let encontrado = false;

        let rankingHTML = "";

        for (const docSnap of snapshot.docs) {

          const data =
            docSnap.data();
          if (!data.user_id) {
            console.log("⚠️ Ranking corrupto:", docSnap.id);
            continue;
          }

          // =====================================
          // DATOS USER
          // =====================================

          const userRef =
            doc(db, "users", data.user_id);

          const userSnap =
            await getDoc(userRef);

          let nombre =
            "Usuario";

          if (userSnap.exists()) {

            nombre =
              userSnap.data().nombre ||
              "Usuario";

          }

          // =====================================
          // MI POSICIÓN
          // =====================================

          if (
            data.user_id === currentUser.uid
          ) {

            miPosicionSpan.innerText =
              pos + "°";

            misPuntosSpan.innerText =
              data.puntos;

            encontrado = true;

          }

          // =====================================
          // MEDALLAS
          // =====================================

          let medalla = "";

          if (pos === 1)
            medalla = "🥇";

          else if (pos === 2)
            medalla = "🥈";

          else if (pos === 3)
            medalla = "🥉";

          // =====================================
          // HTML RANKING
          // =====================================

          rankingHTML += `

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                padding:10px 0;
                border-bottom:1px solid rgba(255,255,255,0.08);
                gap:10px;
              "
            >

              <div
                style="
                  display:flex;
                  align-items:center;
                  gap:10px;
                  min-width:0;
                "
              >

                <span>
                  ${medalla || "#" + pos}
                </span>

                <span
                  style="
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis;
                  "
                >
                  ${nombre}
                </span>

              </div>

              <strong>
                ${data.puntos} pts
              </strong>

            </div>

          `;

          pos++;

        }

        // =====================================
        // SIN RANKING
        // =====================================

        if (!encontrado) {

          miPosicionSpan.innerText =
            "-";

          misPuntosSpan.innerText =
            "0";

        }

        // =====================================
        // INSERTAR HTML
        // =====================================

        const rankingList =
          document.getElementById(
            "rankingList"
          );

        if (rankingList) {

          rankingList.innerHTML =
            rankingHTML || `
              <div style="margin-top:10px;">
                No hay ranking aún
              </div>
            `;

        }

      }

    );

}

// ======================================================
// PANEL ADMINISTRADOR (con grupos y filtro)
// ======================================================
async function loadAdminMatches() {
  const q = query(
    collection(db, "matches"),
    where("estado", "in", [
      "pendiente",
      "en_juego",
      "resultado_cargado",
      "finalizado"
    ])
  );
  const snapshot = await getDocs(q);
  const partidosPorGrupo = {};
  snapshot.forEach(docSnap => {
    const match = { id: docSnap.id, ...docSnap.data() };
    const grupo = match.grupo || "OTROS";
    if (!partidosPorGrupo[grupo]) partidosPorGrupo[grupo] = [];
    partidosPorGrupo[grupo].push(match);
  });

  const gruposOrdenados = Object.keys(partidosPorGrupo).sort();
  // Botones de grupos
  let tabsHTML = `<div class="admin-groups-tabs" style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 8px;">`;
  gruposOrdenados.forEach(grupo => {
    tabsHTML += `
      <button class="admin-grupo-tab ${adminGrupoActivo === grupo ? "active" : ""}" 
              data-grupo="${grupo}" 
              style="flex: none; padding: 8px 16px; border-radius: 30px; background: ${adminGrupoActivo === grupo ? "#facc15" : "#1e293b"}; color: ${adminGrupoActivo === grupo ? "black" : "white"}; border: none; cursor: pointer; font-weight: bold;">
        Grupo ${grupo}
      </button>
    `;
  });
  tabsHTML += `</div>`;

  // Mostrar solo el grupo activo
  const partidosGrupo = partidosPorGrupo[adminGrupoActivo] || [];
  let html = `<div class="admin-grid">`;
  partidosGrupo.forEach(match => {
    html += `
      <div class="admin-card">
        <div class="admin-teams">
          <div class="admin-team">
            <img class="flag-admin" src="https://flagcdn.com/${obtenerCodigoPais(match.equipo_local)}.svg">
            <span>${fifaCodes[match.equipo_local] || match.equipo_local}</span>
          </div>
          <div class="admin-vs">VS</div>
          <div class="admin-team">
            <img class="flag-admin" src="https://flagcdn.com/${obtenerCodigoPais(match.equipo_visitante)}.svg">
            <span>${fifaCodes[match.equipo_visitante] || match.equipo_visitante}</span>
          </div>
        </div>
        <div class="admin-score">
        <input
  type="number"
  id="res_local_${match.id}"
  placeholder="0"
  class="admin-input"
  value="${match.resultado_local ?? ""}"
  ${match.estado === "finalizado" ? "disabled" : ""}
>

<span>-</span>

<input
  type="number"
  id="res_vis_${match.id}"
  placeholder="0"
  class="admin-input"
  value="${match.resultado_visitante ?? ""}"
  ${match.estado === "finalizado" ? "disabled" : ""}
>
      
        </div>
      ${match.estado !== "finalizado" ? `

  <button 
    class="admin-btn"
    onclick="window.submitResult('${match.id}')">
    Guardar
  </button>

` : ""}

${match.estado === "resultado_cargado" ? `

  <button
    class="admin-btn finalizar-btn"
    onclick="window.finalizarPartido('${match.id}')">
    Finalizar
  </button>

` : ""}
${match.estado === "finalizado" ? `

  <button
    class="admin-btn reabrir-btn"
    onclick="window.reabrirPartido('${match.id}')">
    Reabrir
  </button>

` : ""}

      </div>
    `;
  });
  html += `</div>`;

  const adminMatchesList = document.getElementById("adminMatchesList");
  if (adminMatchesList) adminMatchesList.innerHTML = tabsHTML + html;

  // Asignar eventos a los botones de grupos (evitar múltiples listeners)
  document.querySelectorAll(".admin-grupo-tab").forEach(btn => {

    const handler = () => {
      adminGrupoActivo = btn.dataset.grupo;
      loadAdminMatches();
    };
    btn.addEventListener("click", handler);
    btn.adminGroupChangeHandler = handler; // guardar referencia
  });
}

// ======================================================
// CAMBIAR GRUPO EN ADMIN (desde los botones)
// ======================================================
window.cambiarGrupoAdmin = (grupo) => {
  adminGrupoActivo = grupo;
  loadAdminMatches();
};

// ======================================================
// SUBIR RESULTADOS (ADMIN)
// ======================================================

window.submitResult = async (matchId) => {

  const localInput =
    document.getElementById(`res_local_${matchId}`);

  const visitInput =
    document.getElementById(`res_vis_${matchId}`);

  if (!localInput || !visitInput) {

    return alert(
      "Error: No se encontraron los inputs"
    );

  }

  const local =
    parseInt(localInput.value);

  const visit =
    parseInt(visitInput.value);

  if (isNaN(local) || isNaN(visit)) {

    return alert(
      "Ingresa números válidos"
    );

  }

  const matchRef =
    doc(db, "matches", matchId);

  await updateDoc(matchRef, {
    resultado_local: Number(local),
    resultado_visitante: Number(visit),
    estado: "resultado_cargado"
  });

  alert("✅ Resultado guardado. Puedes corregirlo si es necesario");

  loadAdminMatches();

};
// ======================================================
// FINALIZAR PARTIDO (ADMIN)
// ======================================================

window.finalizarPartido = async (matchId) => {

  try {

    const matchRef =
      doc(db, "matches", matchId);

    const matchSnap =
      await getDoc(matchRef);

    if (!matchSnap.exists()) {

      return alert(
        "Partido no encontrado"
      );

    }

    const match =
      matchSnap.data();

    // VALIDAR RESULTADOS

    if (
      match.resultado_local === null ||
      match.resultado_visitante === null
    ) {

      return alert(
        "Debes guardar resultados primero"
      );

    }

    // EVITAR DOBLE FINALIZACIÓN

    if (match.estado === "finalizado") {

      return alert(
        "Este partido ya fue finalizado"
      );

    }

    // CAMBIAR ESTADO

    await updateDoc(matchRef, {

      estado: "finalizado"

    });

    // CALCULAR PUNTOS

    await calcularPuntos(matchId);

    alert(
      "✅ Partido finalizado y puntos calculados"
    );

    loadAdminMatches();

  } catch (error) {

    console.error(error);

    alert(
      "Error al finalizar partido"
    );

  }

};
// ======================================================
// REABRIR PARTIDO (ADMIN)
// ======================================================

window.reabrirPartido = async (matchId) => {

  try {

    const matchRef =
      doc(db, "matches", matchId);

    const matchSnap =
      await getDoc(matchRef);

    if (!matchSnap.exists()) {

      return alert(
        "Partido no encontrado"
      );

    }

    const match =
      matchSnap.data();

    // =====================================
    // VALIDAR FINALIZADO
    // =====================================

    if (match.estado !== "finalizado") {

      return alert(
        "Este partido no está finalizado"
      );

    }

    // =====================================
    // BUSCAR PREDICCIONES
    // =====================================

    const predictionsQuery =
      query(
        collection(db, "predictions_groups"),
        where("match_id", "==", matchId)
      );

    const predictionsSnap =
      await getDocs(predictionsQuery);

    // =====================================
    // RECORRER PREDICCIONES
    // =====================================

    for (const predDoc of predictionsSnap.docs) {

      const pred =
        predDoc.data();

      const predLocal =
        Number(pred.pred_local);

      const predVisit =
        Number(pred.pred_visitante);

      if (pred.points_assigned === true) {

        const puntosARestar =
          Number(pred.points || 0);

        // =================================
        // ACTUALIZAR RANKING
        // =================================

        const rankingRef =
          doc(db, "ranking", pred.uid);

        const rankingSnap =
          await getDoc(rankingRef);

        if (rankingSnap.exists()) {

          const rankingData =
            rankingSnap.data();

          await updateDoc(rankingRef, {

            puntos:
              Math.max(
                0,
                (rankingData.puntos || 0)
                - puntosARestar
              ),

            updated_at:
              serverTimestamp()

          });

        }

        // =================================
        // LIMPIAR PREDICCIÓN
        // =================================

        await updateDoc(predDoc.ref, {

          points_assigned: false,

          points: 0

        });

      }

    }

    // =====================================
    // REABRIR PARTIDO
    // =====================================

    await updateDoc(matchRef, {

      estado: "resultado_cargado",

      puntos_calculados: false

    });

    alert(
      "✅ Partido reabierto correctamente"
    );

    loadAdminMatches();

  } catch (error) {

    console.error(error);

    alert(
      "Error al reabrir partido"
    );

  }

};
// ======================================================
// CARGAR TODOS LOS PARTIDOS DESDE partidos.js (ADMIN)
// ======================================================
async function cargarTodosLosPartidos() {
  const existingMatches = await getDocs(collection(db, "matches"));
  const batchDelete = writeBatch(db);
  existingMatches.forEach(docItem => batchDelete.delete(docItem.ref));
  await batchDelete.commit();

  for (const p of todosLosPartidos) {
    await addDoc(collection(db, "matches"), {
      equipo_local: p.local,
      equipo_visitante: p.visitante,
      hora_partido: new Date(p.fechaUTC),
      fase: p.fase,
      grupo: p.grupo || null,
      estado: "pendiente",
      resultado_local: null,
      resultado_visitante: null,
      puntos_calculados: false
    });
  }
  console.log("✅ Partidos cargados");
}

function setupUploadButton() {
  const btn = document.getElementById("btnCargarPartidos");
  if (!btn) return;
  btn.onclick = async () => {
    if (confirm("¿Cargar partidos nuevamente? Se borrarán los existentes.")) {
      await cargarTodosLosPartidos();
      alert("✅ Partidos cargados. La página se recargará.");
      location.reload();
    }
  };
}
// ======================================================
// CALCULAR PUNTOS
// ======================================================

async function calcularPuntos(matchId) {

  const matchRef =
    doc(db, "matches", matchId);

  const matchSnap =
    await getDoc(matchRef);

  if (!matchSnap.exists()) return;

  const match =
    matchSnap.data();
  // =====================================
  // EVITAR RECALCULAR PARTIDO
  // =====================================

  if (match.puntos_calculados === true) {

    console.log(
      "⚠️ Este partido ya calculó puntos"
    );

    return;

  }

  const local =
    Number(match.resultado_local);

  const visit =
    Number(match.resultado_visitante);

  const predictionsQuery =
    query(
      collection(db, "predictions_groups"),
      where("match_id", "==", matchId)
    );

  const predictionsSnap =
    await getDocs(predictionsQuery);

  for (const predDoc of predictionsSnap.docs) {

    const pred =
      predDoc.data();

    const predLocal =
      Number(pred.pred_local);

    const predVisit =
      Number(pred.pred_visitante);

    // =====================================
    // EVITAR DUPLICAR PUNTOS
    // =====================================

    if (pred.points_assigned === true) {
      continue;
    }

    let puntos = 0;

    // =====================================
    // MARCADOR EXACTO
    // =====================================

    if (
      predLocal === local &&
      predVisit === visit
    ) {

      puntos = 3;

    }

    else {

      // =====================================
      // GANADOR O EMPATE
      // =====================================

      const real =
        local > visit
          ? "L"
          : local < visit
            ? "V"
            : "E";

      const usuario =
        predLocal > predVisit
          ? "L"
          : predLocal < predVisit
            ? "V"
            : "E";

      if (real === usuario) {

        puntos = 1;

      }


    }

    // =====================================
    // RANKING
    // =====================================

    const rankingRef =
      doc(db, "ranking", pred.uid);

    const rankingSnap =
      await getDoc(rankingRef);

    if (!rankingSnap.exists()) {

      await setDoc(rankingRef, {

        user_id: pred.uid,

        puntos: puntos,

        updated_at: serverTimestamp()

      });

    } else {

      const rankingData =
        rankingSnap.data();

      await updateDoc(rankingRef, {

        user_id: pred.uid,

        puntos:
          (rankingData.puntos || 0)
          + puntos,

        updated_at:
          serverTimestamp()

      });

    }

    // =====================================
    // MARCAR PUNTOS
    // =====================================

    await updateDoc(predDoc.ref, {

      points_assigned: true,

      points: puntos

    });

  }
  // =====================================
  // MARCAR PARTIDO CALCULADO
  // =====================================

  await updateDoc(matchRef, {

    puntos_calculados: true

  });
}
// ======================================================
// TABLA DE POSICIONES
// ======================================================

async function generarTablaGrupos() {

  const tablaContainer =
    document.getElementById(
      "tablaGruposContainer"
    );

  if (!tablaContainer) return;

  // =====================================
  // OBTENER PARTIDOS
  // =====================================

  const matchesSnap =
    await getDocs(
      collection(db, "matches")
    );

  const grupos = {};

  // =====================================
  // RECORRER PARTIDOS
  // =====================================

  matchesSnap.forEach(docSnap => {

    const match =
      docSnap.data();

    // SOLO FASE DE GRUPOS

    if (
      match.fase !== "grupos"
    ) return;

    const grupo =
      match.grupo;

    if (!grupos[grupo]) {

      grupos[grupo] = {};

    }

    // EQUIPOS

    const equipos = [
      match.equipo_local,
      match.equipo_visitante
    ];

    equipos.forEach(equipo => {

      if (!grupos[grupo][equipo]) {

        grupos[grupo][equipo] = {

          equipo,

          pj: 0,
          pg: 0,
          pe: 0,
          pp: 0,

          gf: 0,
          gc: 0,
          dg: 0,

          pts: 0

        };

      }

    });

    // =====================================
    // SOLO SI ESTÁ FINALIZADO
    // =====================================

    if (
      match.estado !== "finalizado"
    ) return;

    const local =
      grupos[grupo][
      match.equipo_local
      ];

    const visit =
      grupos[grupo][
      match.equipo_visitante
      ];

    const gl =
      Number(
        match.resultado_local
      );

    const gv =
      Number(
        match.resultado_visitante
      );

    // PJ

    local.pj++;
    visit.pj++;

    // GOLES

    local.gf += gl;
    local.gc += gv;

    visit.gf += gv;
    visit.gc += gl;

    // DIFERENCIA

    local.dg =
      local.gf - local.gc;

    visit.dg =
      visit.gf - visit.gc;

    // GANADOR

    if (gl > gv) {

      local.pg++;
      local.pts += 3;

      visit.pp++;

    }

    else if (gv > gl) {

      visit.pg++;
      visit.pts += 3;

      local.pp++;

    }

    else {

      local.pe++;
      visit.pe++;

      local.pts++;
      visit.pts++;

    }

  });

  // =====================================
  // GENERAR HTML
  // =====================================

  let html = "";

  const gruposOrdenados = [grupoActivo];

  gruposOrdenados.forEach(grupo => {

    const tabla =
      Object.values(
        grupos[grupo]
      );

    // =====================================
    // ORDENAR TABLA FIFA
    // =====================================

    tabla.sort((a, b) => {

      if (b.pts !== a.pts) {
        return b.pts - a.pts;
      }

      if (b.dg !== a.dg) {
        return b.dg - a.dg;
      }

      if (b.gf !== a.gf) {
        return b.gf - a.gf;
      }

      return a.equipo.localeCompare(
        b.equipo
      );

    });

    html += `

      <div class="tabla-grupo-card">

        <h3 class="tabla-title">
          Grupo ${grupo}
        </h3>

        <table class="tabla-posiciones">

          <thead>

            <tr>

              <th>#</th>
              <th>Equipo</th>
              <th>PTS</th>
              <th>PJ</th>
              <th>DG</th>

            </tr>

          </thead>

          <tbody>

    `;
    // =====================================
    // GUARDAR CLASIFICADOS
    // =====================================

    if (tabla[0]) {

      clasificadosGlobales[
        `1${grupo}`
      ] = tabla[0].equipo;

    }

    if (tabla[1]) {

      clasificadosGlobales[
        `2${grupo}`
      ] = tabla[1].equipo;

    }

    tabla.forEach((team, index) => {

      html += `

        <tr>

          <td>
            ${index + 1}
          </td>

          <td>

            <div
              style="
                display:flex;
                align-items:center;
                gap:8px;
              "
            >

              <img
                src="https://flagcdn.com/${obtenerCodigoPais(team.equipo)}.svg"
                width="22"
              >

              ${team.equipo}

            </div>

          </td>

          <td>
            <strong>
              ${team.pts}
            </strong>
          </td>

          <td>
            ${team.pj}
          </td>

          <td>
  ${team.dg > 0
          ? "+" + team.dg
          : team.dg}
</td>

        </tr>

      `;

    });

    html += `

          </tbody>

        </table>

      </div>

    `;

  });

  tablaContainer.innerHTML =
    html;
  generarDieciseisavos();

}
// ======================================================
// GENERAR DIECISEISAVOS
// ======================================================

async function generarDieciseisavos() {

  const container =
    document.getElementById(
      "bracketContainer"
    );

  if (!container) return;

  // =====================================
  // PARTIDOS OFICIALES FIFA
  // =====================================

  const partidos = [
    { numero: 73, local: clasificadosGlobales["2A"] || "2A", visitante: clasificadosGlobales["2B"] || "2B" },
    { numero: 74, local: clasificadosGlobales["1E"] || "1E", visitante: "3A/B/C/D/F" },
    { numero: 75, local: clasificadosGlobales["1F"] || "1F", visitante: clasificadosGlobales["2C"] || "2C" },
    { numero: 76, local: clasificadosGlobales["1C"] || "1C", visitante: clasificadosGlobales["2F"] || "2F" },
    { numero: 77, local: clasificadosGlobales["1I"] || "1I", visitante: "3C/D/F/G/H" },
    { numero: 78, local: clasificadosGlobales["2E"] || "2E", visitante: clasificadosGlobales["2I"] || "2I" },
    { numero: 79, local: clasificadosGlobales["1A"] || "1A", visitante: "3C/E/F/H/I" },
    { numero: 80, local: clasificadosGlobales["1L"] || "1L", visitante: "3E/H/I/J/K" },
    { numero: 81, local: clasificadosGlobales["1D"] || "1D", visitante: "3B/E/F/I/J" },
    { numero: 82, local: clasificadosGlobales["1G"] || "1G", visitante: "3A/E/H/I/J" },
    { numero: 83, local: clasificadosGlobales["2K"] || "2K", visitante: clasificadosGlobales["2L"] || "2L" },
    { numero: 84, local: clasificadosGlobales["1H"] || "1H", visitante: clasificadosGlobales["2J"] || "2J" },
    { numero: 85, local: clasificadosGlobales["1B"] || "1B", visitante: "3E/F/G/I/J" },
    { numero: 86, local: clasificadosGlobales["1J"] || "1J", visitante: clasificadosGlobales["2H"] || "2H" },
    { numero: 87, local: clasificadosGlobales["1K"] || "1K", visitante: "3D/E/I/J/L" },
    { numero: 88, local: clasificadosGlobales["2D"] || "2D", visitante: clasificadosGlobales["2G"] || "2G" }
  ];

  // =====================================
  // HTML
  // =====================================

  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">Dieciseisavos de Final</h3><div class="dieciseisavos-grid">`;

  for (const partido of partidos) {
    if (!partido.local || !partido.visitante) continue;

    // Obtener hora del partido desde la función de fechas
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const isClosed = new Date() >= cierreApuestas;
    const disabled = isClosed;

    // Cargar predicción guardada
    const predictionId = `${currentUser.uid}_KO_${partido.numero}`;
    const predictionRef = doc(db, "predictions_knockout", predictionId);
    const predictionSnap = await getDoc(predictionRef);
    let predLocal = "", predVisit = "", clasificadoGuardado = "";
    if (predictionSnap.exists()) {
      const data = predictionSnap.data();
      predLocal = data.pred_local ?? "";
      predVisit = data.pred_visitante ?? "";
      clasificadoGuardado = data.clasificado ?? "";
    }

    html += `
      <div class="knockout-card" data-partido="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="prediction-side local-side">
          ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : ''}
          <span>${fifaCodes[partido.local] || partido.local}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
          <input type="number" id="ko_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;" ${disabled ? "disabled" : ""}>
          <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
          <input type="number" id="ko_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;" ${disabled ? "disabled" : ""}>
        </div>
        <div class="prediction-side visit-side" style="margin-top:14px;">
          ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : ''}
          <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
        </div>
        <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
        <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
          ✔ Se valida el marcador en los 90 minutos<br>
          ✔ Puedes ganar puntos por marcador exacto<br>
          ✔ Y puntos extra por acertar el clasificado
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
          <label><input type="radio" name="clasificado_${partido.numero}" value="${partido.local}" ${clasificadoGuardado === partido.local ? 'checked' : ''} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="clasificado_${partido.numero}" value="${partido.visitante}" ${clasificadoGuardado === partido.visitante ? 'checked' : ''} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
       <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}" style="margin-top:8px; text-align:center; font-size:13px; background:#00000040; padding:6px; border-radius:20px;">
  ⏰ Resultados se bloquean en: ${formatearTiempoRestante(cierreApuestas)}
</div>
        <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveKnockoutPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
      </div>
    `;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}
// ======================================================
// GUARDAR PREDICCIÓN ELIMINATORIAS
// ======================================================

window.saveKnockoutPrediction = async (
  partidoNumero
) => {

  try {

    if (!currentUser) {

      return alert(
        "Debes iniciar sesión"
      );

    }

    // =====================================
    // INPUTS
    // =====================================

    const localInput =
      document.getElementById(
        `ko_local_${partidoNumero}`
      );

    const visitInput =
      document.getElementById(
        `ko_visit_${partidoNumero}`
      );

    if (!localInput || !visitInput) {

      return alert(
        "Inputs no encontrados"
      );

    }

    const local =
      parseInt(localInput.value);

    const visit =
      parseInt(visitInput.value);

    if (
      isNaN(local)
      ||
      isNaN(visit)
    ) {

      return alert(
        "Ingresa marcadores válidos"
      );

    }

    // =====================================
    // OBTENER PARTIDO
    // =====================================

    const card =
      document.querySelector(
        `[data-partido="${partidoNumero}"]`
      );

    if (!card) {

      return alert(
        "Partido no encontrado"
      );

    }

    const equipoLocal =
      card.dataset.local;

    const equipoVisit =
      card.dataset.visitante;

    // =====================================
    // CLASIFICADO
    // =====================================

    let clasificado = null;

    // GANA LOCAL

    if (local > visit) {

      clasificado =
        equipoLocal;

    }

    // GANA VISITA

    else if (visit > local) {

      clasificado =
        equipoVisit;

    }

    // EMPATE

    else {

      const selected =
        document.querySelector(
          `input[name="clasificado_${partidoNumero}"]:checked`
        );

      if (!selected) {

        return alert(
          "Debes elegir quién clasifica"
        );

      }

      clasificado =
        selected.value;

    }

    // =====================================
    // ID
    // =====================================

    const predictionId =
      `${currentUser.uid}_${partidoNumero}`;

    // =====================================
    // GUARDAR
    // =====================================

    await setDoc(

      doc(
        db,
        "predictions_knockout",
        predictionId
      ),

      {

        uid:
          currentUser.uid,

        partido:
          partidoNumero,

        pred_local:
          local,

        pred_visit:
          visit,

        clasificado,

        fase:
          "dieciseisavos",

        updated_at:
          serverTimestamp()

      },

      {
        merge: true
      }

    );

    alert(
      "✅ Predicción guardada"
    );
    generarOctavos();
    generarCuartos();


  }

  catch (error) {

    console.error(error);

    alert(error.message);

  }

};
// ======================================================
// GENERAR OCTAVOS AUTOMÁTICOS
// ======================================================
async function generarOctavos() {
  const container = document.getElementById("octavosContainer");
  if (!container) return;

  // 1. Obtener clasificados de dieciseisavos (desde predictions_knockout)
  const knockoutSnap = await getDocs(collection(db, "predictions_knockout"));
  const clasificados = {};
  knockoutSnap.forEach(doc => {
    const data = doc.data();
    if (data.uid === currentUser.uid) {
      clasificados[data.partido] = data.clasificado;
    }
  });

  // 2. Partidos de octavos
  const partidos = [
    { numero: 89, local: clasificados[74] || "Ganador 74", visitante: clasificados[77] || "Ganador 77" },
    { numero: 90, local: clasificados[73] || "Ganador 73", visitante: clasificados[75] || "Ganador 75" },
    { numero: 91, local: clasificados[76] || "Ganador 76", visitante: clasificados[78] || "Ganador 78" },
    { numero: 92, local: clasificados[79] || "Ganador 79", visitante: clasificados[80] || "Ganador 80" },
    { numero: 93, local: clasificados[83] || "Ganador 83", visitante: clasificados[84] || "Ganador 84" },
    { numero: 94, local: clasificados[81] || "Ganador 81", visitante: clasificados[82] || "Ganador 82" },
    { numero: 95, local: clasificados[86] || "Ganador 86", visitante: clasificados[88] || "Ganador 88" },
    { numero: 96, local: clasificados[85] || "Ganador 85", visitante: clasificados[87] || "Ganador 87" }
  ];

  // 3. Obtener predicciones guardadas del usuario para octavos
  const octavosQuery = query(collection(db, "predictions_octavos"), where("uid", "==", currentUser.uid));
  const octavosSnap = await getDocs(octavosQuery);
  const predicciones = {};
  octavosSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  // 4. Generar HTML
  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">Octavos de Final</h3><div class="dieciseisavos-grid">`;

  for (const partido of partidos) {
    // Obtener hora del partido desde la función de fechas
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const isClosed = new Date() >= cierreApuestas;
    const disabled = isClosed; // Si el partido ya empezó, también deberías bloquear, pero aquí solo usamos cierre

    const pred = predicciones[partido.numero] || {};
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    html += `
      <div class="knockout-card" data-partido-octavos="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="prediction-side local-side">
          ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.local] || partido.local}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
          <input type="number" id="oct_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;" ${disabled ? "disabled" : ""}>
          <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
          <input type="number" id="oct_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;" ${disabled ? "disabled" : ""}>
        </div>
        <div class="prediction-side visit-side" style="margin-top:14px;">
          ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
        </div>
        <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
        <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
          ✔ Se valida el marcador en los 90 minutos<br>
          ✔ Puedes ganar puntos por marcador exacto<br>
          ✔ Y puntos extra por acertar el clasificado
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
          <label><input type="radio" name="oct_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? 'checked' : ''} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="oct_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? 'checked' : ''} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}" style="margin-top:8px; text-align:center; font-size:13px; background:#00000040; padding:6px; border-radius:20px;">
  ⏰ Resultados se bloquean en: ${formatearTiempoRestante(cierreApuestas)}
</div>
        <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveOctavosPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
      </div>
    `;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}
 // ======================================================
// GENERAR CUARTOS AUTOMÁTICOS
// ======================================================
async function generarCuartos() {
  const container = document.getElementById("cuartosContainer");
  if (!container) return;

  // Obtener clasificados de octavos (desde predictions_octavos del usuario)
  const octavosQuery = query(collection(db, "predictions_octavos"), where("uid", "==", currentUser.uid));
  const octavosSnap = await getDocs(octavosQuery);
  const clasificados = {};
  octavosSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partidos = [
    { numero: 97, local: clasificados[89] || "Ganador 89", visitante: clasificados[90] || "Ganador 90" },
    { numero: 98, local: clasificados[91] || "Ganador 91", visitante: clasificados[92] || "Ganador 92" },
    { numero: 99, local: clasificados[93] || "Ganador 93", visitante: clasificados[94] || "Ganador 94" },
    { numero: 100, local: clasificados[95] || "Ganador 95", visitante: clasificados[96] || "Ganador 96" }
  ];

  // Obtener predicciones guardadas del usuario para cuartos
  const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
  const cuartosSnap = await getDocs(cuartosQuery);
  const predicciones = {};
  cuartosSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">Cuartos de Final</h3><div class="dieciseisavos-grid">`;

  for (const partido of partidos) {
    const pred = predicciones[partido.numero] || {};
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    html += `
      <div class="knockout-card" data-partido-cuartos="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="prediction-side local-side">
          ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.local] || partido.local}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
          <input type="number" id="cuartos_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;">
          <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
          <input type="number" id="cuartos_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;">
        </div>
        <div class="prediction-side visit-side" style="margin-top:14px;">
          ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
        </div>
        <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
        <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
          ✔ Se valida el marcador en los 90 minutos<br>
          ✔ Puedes ganar puntos por marcador exacto<br>
          ✔ Y puntos extra por acertar el clasificado
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
          <label><input type="radio" name="cuartos_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? 'checked' : ''}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="cuartos_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? 'checked' : ''}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveCuartosPrediction('${partido.numero}')">Guardar</button>
      </div>
    `;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}
// ======================================================
// GENERAR SEMIFINALES
// ======================================================
async function generarSemifinales() {
  const container = document.getElementById("semifinalContainer");
  if (!container) return;

  const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
  const cuartosSnap = await getDocs(cuartosQuery);
  const clasificados = {};
  cuartosSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partidos = [
    { numero: 101, local: clasificados[97] || "Ganador 97", visitante: clasificados[98] || "Ganador 98" },
    { numero: 102, local: clasificados[99] || "Ganador 99", visitante: clasificados[100] || "Ganador 100" }
  ];

  const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
  const semisSnap = await getDocs(semisQuery);
  const predicciones = {};
  semisSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  let html = `<div class="tabla-grupo-card"><h3 class="tabla-title">🏆 Semifinales</h3><div class="dieciseisavos-grid">`;

  for (const partido of partidos) {
    const pred = predicciones[partido.numero] || {};
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    html += `
      <div class="knockout-card" data-partido-semis="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Semifinal ${partido.numero}</div>
        <div class="prediction-side local-side">
          ${fifaCodes[partido.local] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.local] || partido.local}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:16px; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px;">
          <input type="number" id="semis_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="↑" min="0" style="width:70px; border:2px solid #3b82f6;">
          <span style="font-size:22px; font-weight:800; color:#facc15;">-</span>
          <input type="number" id="semis_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="↓" min="0" style="width:70px; border:2px solid #22c55e;">
        </div>
        <div class="prediction-side visit-side" style="margin-top:14px;">
          ${fifaCodes[partido.visitante] ? `<img src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" width="24">` : '<div style="width:24px; height:24px; background:#1e293b; border-radius:50%;"></div>'}
          <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
        </div>
        <div style="margin-top:16px; font-size:13px;">Si eliges empate, también debes elegir quién avanza:</div>
        <div style="font-size:12px; opacity:0.7; margin-top:6px; line-height:1.4;">
          ✔ Se valida el marcador en los 90 minutos<br>
          ✔ Puedes ganar puntos por marcador exacto<br>
          ✔ Y puntos extra por acertar el clasificado
        </div>
        <div style="display:flex; justify-content:center; gap:14px; margin-top:10px; flex-wrap:wrap;">
          <label><input type="radio" name="semis_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? 'checked' : ''}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="semis_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? 'checked' : ''}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        <button class="btn-guardar" style="margin-top:18px;" onclick="window.saveSemifinalPrediction('${partido.numero}')">Guardar</button>
      </div>
    `;
  }
  html += `</div></div>`;
  container.innerHTML = html;
}


// ======================================================
// LOGIN, REGISTRO, LOGOUT
// ======================================================
document.getElementById("btnLogin").onclick = async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch (error) {
    alert(error.message);
  }
};

document.getElementById("btnRegister").onclick = async () => {
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const pwd = document.getElementById("registerPassword").value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    await setDoc(
      doc(db, "users", cred.user.uid),
      {
        uid: cred.user.uid,

        nombre: name,

        email: email,

        rol: "user",

        expulsado: false,

        created_at: serverTimestamp()
      }
    );

    await setDoc(
      doc(db, "participants", cred.user.uid),
      {
        uid: cred.user.uid,

        paid_groups: false,

        amount_groups: 0,

        groups_status: "pending",

        enabled_groups: false,

        submitted_groups_at: null,

        created_at: serverTimestamp()
      }
    );
    alert("✅ Registro exitoso. Ahora inicia sesión.");
  } catch (error) {
    alert(error.message);
  }
};

document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
};
// ======================================================
// PREMIOS Y ACUMULADO EN TIEMPO REAL
// ======================================================

function loadPrizePoolRealtime() {

  if (participantsUnsubscribe) {
    participantsUnsubscribe();
  }

  const participantsRef =
    collection(db, "participants");

  participantsUnsubscribe =
    onSnapshot(participantsRef, (snapshot) => {

      let totalParticipantes = 0;

      let totalAcumulado = 0;

      snapshot.forEach(docSnap => {

        const data = docSnap.data();

        if (data.paid_groups === true) {

          totalParticipantes++;

          totalAcumulado +=
            Number(data.amount_groups || 0);

        }

      });

      document.getElementById("totalParticipantes").innerText =
        totalParticipantes;

      document.getElementById("totalAcumulado").innerText =
        formatearCOP(totalAcumulado);

      document.getElementById("premioPrimerLugar").innerText =
        formatearCOP(totalAcumulado * 0.7);

      document.getElementById("premioAdmin").innerText =
        formatearCOP(totalAcumulado * 0.2);
      document.getElementById("premioPlataforma").innerText =
        formatearCOP(totalAcumulado * 0.1);

    });
}

// ======================================================
// ADMIN PARTICIPANTES
// ======================================================

function loadAdminParticipants() {

  if (adminParticipantsUnsubscribe) {
    adminParticipantsUnsubscribe();
  }

  const participantsRef =
    collection(db, "participants");

  adminParticipantsUnsubscribe =
    onSnapshot(participantsRef, async (snapshot) => {

      const adminList =
        document.getElementById(
          "adminParticipantsList"
        );

      if (!adminList) return;

      let html =
        `<div class="admin-participants-grid">`;

      for (const docSnap of snapshot.docs) {

        const participant =
          docSnap.data();

        const uid =
          participant.uid;
        // =====================================
        // FUNCIONES ADMIN
        // =====================================

        window.togglePago = async (uid) => {

          const participantRef =
            doc(db, "participants", uid);

          const snap =
            await getDoc(participantRef);

          if (!snap.exists()) return;

          const data = snap.data();

          const nuevoEstado =
            !data.paid_groups;

          await updateDoc(participantRef, {

            paid_groups: nuevoEstado,

            amount_groups:
              nuevoEstado ? 55000 : 0,

            groups_status:
              nuevoEstado
                ? "approved"
                : "pending"

          });

        };

        window.toggleHabilitado =
          async (uid) => {

            const participantRef =
              doc(db, "participants", uid);

            const snap =
              await getDoc(participantRef);

            if (!snap.exists()) return;

            const data =
              snap.data();

            await updateDoc(participantRef, {

              enabled_groups:
                !data.enabled_groups

            });

          };

        window.toggleExpulsado =
          async (uid) => {

            const userRef =
              doc(db, "users", uid);

            const snap =
              await getDoc(userRef);

            if (!snap.exists()) return;

            const data =
              snap.data();

            const nuevoEstado =
              !data.expulsado;

            await updateDoc(userRef, {

              expulsado:
                nuevoEstado

            });

          };

        // =====================================
        // USER DATA
        // =====================================

        const userRef =
          doc(db, "users", uid);

        const userSnap =
          await getDoc(userRef);

        let nombre = "Sin nombre";
        let email = "Sin email";

        let expulsado = false;

        if (userSnap.exists()) {

          const userData =
            userSnap.data();

          nombre =
            userData.nombre || "Sin nombre";

          email =
            userData.email || "Sin email";

          expulsado =
            userData.expulsado || false;

        }

        // =====================================
        // BADGES
        // =====================================

        const paidBadge =
          participant.paid_groups
            ? `<span class="admin-badge badge-paid">PAGÓ</span>`
            : `<span class="admin-badge badge-pending">NO PAGÓ</span>`;

        const enabledBadge =
          participant.enabled_groups
            ? `<span class="admin-badge badge-enabled">HABILITADO</span>`
            : `<span class="admin-badge badge-disabled">BLOQUEADO</span>`;

        const expulsadoBadge =
          expulsado
            ? `<span class="admin-badge badge-pending">EXPULSADO</span>`
            : "";

        // =====================================
        // CARD
        // =====================================

        html += `

          <div class="admin-user-card">

            <div class="admin-user-top">

              <div>

                <div class="admin-user-name">
                  ${nombre}
                </div>

                <div class="admin-user-email">
                  ${email}
                </div>

              </div>

            </div>

            <div class="admin-user-status">

              ${paidBadge}

              ${enabledBadge}

              ${expulsadoBadge}

            </div>

            <div style="margin-top:14px;">

              💰 Pago:
              <strong>
                ${formatearCOP(
          participant.amount_groups || 0
        )}
              </strong>

            </div>

            <div style="margin-top:8px;">

              📋 Estado:
              <strong>
                ${participant.groups_status || "pending"}
              </strong>

            </div>
            <div
  style="
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    margin-top:16px;
  "
>

  <button
    class="admin-action-btn"
    onclick="window.togglePago('${uid}')"
  >
    💰 Pago
  </button>

  <button
    class="admin-action-btn"
    onclick="window.toggleHabilitado('${uid}')"
  >
    🔓 Acceso
  </button>

  <button
    class="admin-action-btn danger"
    onclick="window.toggleExpulsado('${uid}')"
  >
    🚫 Expulsar
  </button>

</div>

          </div>

        `;

      }

      html += `</div>`;

      adminList.innerHTML = html;

    });

}


// ======================================================
// FORMATEAR MONEDA COP
// ======================================================

function formatearCOP(valor) {

  return new Intl.NumberFormat(
    "es-CO",
    {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0
    }
  ).format(valor);

}
// ======================================================
// ESTADO DE AUTENTICACIÓN (CORAZÓN DE LA APP)
// ======================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const userRef = doc(db, "users", user.uid);

    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const userData = snap.data();
      // =========================================
      // VALIDAR EXPULSADO GLOBAL
      // =========================================

      if (userData.expulsado === true) {

        alert("Tu cuenta fue bloqueada");

        await signOut(auth);

        return;

      }
      currentUserRol = userData.rol || "user";
      console.log("ROL ACTUAL:", currentUserRol);
    } else {

      alert("Usuario no encontrado");

      await signOut(auth);

      return;

    }
    userEmailSpan.innerText = user.email;
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    if (currentUserRol === "admin") {
      adminPanel.classList.remove("hidden");
      loadAdminMatches();
      loadAdminParticipants();
      console.log("CARGANDO PARTICIPANTES ADMIN");
      setupUploadButton();
    } else {
      adminPanel.classList.add("hidden");
    }
    loadMatchesAndPredictions();
     // ======================================================
    // INICIAR TEMPORIZADORES GLOBALES (UNA SOLA VEZ)
    // ======================================================
    if (!window.timerInterval) {
      window.timerInterval = setInterval(actualizarTodosLosTimers, 1000);
    }
    loadRanking();
    loadPrizePoolRealtime();
    await generarOctavos();
    await generarCuartos();
    await generarSemifinales();
    await generarFinal();
    await generarTercerPuesto();
  } else {
    // Limpiar listeners
    if (matchesUnsubscribe) matchesUnsubscribe();
    if (rankingUnsubscribe) rankingUnsubscribe();
    if (participantsUnsubscribe) participantsUnsubscribe();
    if (adminParticipantsUnsubscribe) adminParticipantsUnsubscribe();
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
  }
});