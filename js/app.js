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
  limit,          // ← AÑADE ESTO
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
let rankingUnsubscribeKO = null;
let participantsUnsubscribe = null;
let adminParticipantsUnsubscribe = null;
let rankingInterval = null;      // para el ranking global
let rankingIntervalKO = null;    // para el ranking knockout
let rankingKODisplayData = [];
let rankingKOFiltro = "";
let rankingGlobalData = [];
let rankingGlobalFiltro = "";
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
let clasificadosEnMemoria = {
  dieciseisavos: {},   // partido -> equipo ganador
  octavos: {},
  cuartos: {},
  semifinales: {},
  final: null,
  tercer_puesto: null
};
// ... después de let clasificadosEnMemoria ...
// ======================================================
// FUNCIONES AUXILIARES PARA REACTIVIDAD
// ======================================================
function calcularClasificadosDieciseisavos() {
  const clasificados = {};
  for (let i = 73; i <= 88; i++) {
    const localInput = document.getElementById(`ko_local_${i}`);
    const visitInput = document.getElementById(`ko_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) continue;
    const card = document.querySelector(`[data-partido="${i}"]`);
    if (!card) continue;
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;
    if (local > visit) clasificados[i] = equipoLocal;
    else if (visit > local) clasificados[i] = equipoVisit;
    else {
      const radioName = `clasificado_${i}`;
      const radioSelected = card.querySelector(`input[name="${radioName}"]:checked`);
      if (radioSelected) clasificados[i] = radioSelected.value;
    }
  }
  return clasificados;
}
let timeoutId = null;

function configurarReactividadDieciseisavos() {
  for (let i = 73; i <= 88; i++) {
    const localInput = document.getElementById(`ko_local_${i}`);
    const visitInput = document.getElementById(`ko_visit_${i}`);
    if (!localInput || !visitInput) continue;

    const updateHandler = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        // 1. Calcular clasificados actuales de dieciseisavos
        clasificadosEnMemoria.dieciseisavos = calcularClasificadosDieciseisavos();
        // 2. Regenerar octavos (y luego cuartos, semifinales, final, tercero)
        await generarOctavos(true);    // true = usar memoria
        await generarCuartos(true);
        await generarSemifinales(true);
        await generarFinal(true);
        await generarTercerPuesto(true);
        // 3. Opcional: también podrías regenerar dieciseisavos para refrescar los radios? No es necesario.
      }, 300); // debounce para no regenerar en cada tecla
    };

    localInput.addEventListener("input", updateHandler);
    visitInput.addEventListener("input", updateHandler);

    // También para los radios (cuando se selecciona en empate)
    const radiosDiv = document.getElementById(`radios_ko_${i}`);
    if (radiosDiv) {
      radiosDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener("change", updateHandler);
      });
    }
  }
}
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

function obtenerHoraPartidoKnockout(numeroPartido) {
  // Fechas (YYYY-MM-DD)
  const fechas = {
    73: "2026-06-28", 74: "2026-06-29", 75: "2026-06-29", 76: "2026-06-29",
    77: "2026-06-30", 78: "2026-06-30", 79: "2026-06-30",
    80: "2026-07-01", 81: "2026-07-01", 82: "2026-07-01",
    83: "2026-07-02", 84: "2026-07-02", 85: "2026-07-02",
    86: "2026-07-03", 87: "2026-07-03", 88: "2026-07-03",
    89: "2026-07-04", 90: "2026-07-04", 91: "2026-07-05", 92: "2026-07-05",
    93: "2026-07-06", 94: "2026-07-06", 95: "2026-07-07", 96: "2026-07-07",
    97: "2026-07-09", 98: "2026-07-10", 99: "2026-07-11", 100: "2026-07-11",
    101: "2026-07-14", 102: "2026-07-15",
    103: "2026-07-18",  // Tercer puesto
    104: "2026-07-19"   // Final
  };

  // Horarios en hora Colombia (UTC-5) en formato "HH:MM:SS"
  const horarios = {
    73: "14:00:00", 74: "15:30:00", 75: "20:00:00", 76: "12:00:00",
    77: "16:00:00", 78: "12:00:00", 79: "20:00:00", 80: "11:00:00",
    81: "19:00:00", 82: "15:00:00", 83: "18:00:00", 84: "14:00:00",
    85: "22:00:00", 86: "17:00:00", 87: "20:30:00", 88: "13:00:00",
    89: "16:00:00", 90: "12:00:00", 91: "15:00:00", 92: "19:00:00",
    93: "14:00:00", 94: "19:00:00", 95: "11:00:00", 96: "15:00:00",
    97: "15:00:00", 98: "14:00:00", 99: "16:00:00", 100: "20:00:00",
    101: "14:00:00", 102: "14:00:00",
    103: "16:00:00",  // Tercer puesto
    104: "14:00:00"   // Final
  };

  const fechaStr = fechas[numeroPartido];
  const horaStr = horarios[numeroPartido] || "12:00:00";
  if (!fechaStr) return new Date();

  const [year, month, day] = fechaStr.split('-');
  const [hour, minute, second] = horaStr.split(':');

  // Convertir hora local Colombia (UTC-5) a UTC sumando 5 horas
  const utcDate = new Date(Date.UTC(year, month - 1, day, parseInt(hour) + 5, parseInt(minute), parseInt(second)));
  return utcDate;
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
    // Buscar el span con clase timer-value dentro del mismo div
    const timerSpan = el.querySelector('.timer-value');
    if (timerSpan) {
      timerSpan.innerText = formatearTiempoRestante(cierre);
    } else {
      // Si por alguna razón no existe, fallback (no debería pasar)
      el.innerText = formatearTiempoRestante(cierre);
    }

    // Si el tiempo expiró, deshabilitar inputs y botón
    if (cierre <= new Date()) {
      const card = el.closest('.knockout-card, .match-card');
      if (card) {
        const inputs = card.querySelectorAll('input.prediction-input');
        const buttons = card.querySelectorAll('.btn-guardar');
        inputs.forEach(inp => inp.disabled = true);
        buttons.forEach(btn => btn.disabled = true);
        if (timerSpan && timerSpan.innerText !== "🔒 Cerrado") {
          timerSpan.innerText = "🔒 Cerrado";
        }
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
    const isFinalizado = match.estado === "finalizado";   // ← NUEVA LÍNEA
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
    <span>${fifaCodes[match.equipo_local] || match.equipo_local}</span>
  </div>
  <div class="vs-text">VS</div>
  <div class="team-row">
    <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(match.equipo_visitante)}.svg">
    <span>${fifaCodes[match.equipo_visitante] || match.equipo_visitante}</span>
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
    class="btn-guardar ${hasPrediction ? 'btn-actualizar' : ''}"
    onclick="window.savePrediction('${matchId}')"
  >
    ${hasPrediction ? "Actualizar" : "Guardar"}
  </button>
` : `
  <button class="btn-guardar" disabled>🔒 ${isFinalizado ? "Partido finalizado" : (isStarted ? "Partido iniciado" : "Apuestas cerradas")}</button>
`}
      <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}" style="margin-top:8px; text-align:center; font-size:13px; background: rgba(0,0,0,0.7); color: #facc15; padding:6px; border-radius:20px; white-space: normal; word-break: break-word;">
  ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
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
    if (matchData.estado === "finalizado") {
      return alert("Este partido ya fue finalizado. No puedes cambiar tu predicción.");
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

    // 👇 ACTUALIZAR DATOS LOCALMENTE
    // Buscar el partido en gruposData y actualizar su userPred
    for (const grupo in gruposData) {
      const partidoIndex = gruposData[grupo].findIndex(m => m.id === matchId);
      if (partidoIndex !== -1) {
        gruposData[grupo][partidoIndex].userPred = {
          pred_local: local,
          pred_visitante: visit,
          // otros campos necesarios (si los hay)
        };
        break;
      }
    }

    mostrarTodosLosGrupos();

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
      partido: Number(partidoNumero),
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "octavos",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarOctavos();    // 👈 actualiza octavos
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
      partido: Number(partidoNumero),
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "cuartos",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarCuartos();        // 👈 actualiza cuartos
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
      partido: Number(partidoNumero),
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "semifinales",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarSemifinales();   // 👈 actualiza semifinales
    // Aquí luego llamarás a generarFinal() cuando la tengas
    await generarFinal();
    await generarTercerPuesto();

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

// ======================================================
// GUARDAR PREDICCIÓN DE TERCER PUESTO
// ======================================================
window.saveThirdPlacePrediction = async (partidoNumero) => {
  try {
    if (!currentUser) return alert("Debes iniciar sesión");

    const localInput = document.getElementById(`third_local_${partidoNumero}`);
    const visitInput = document.getElementById(`third_visit_${partidoNumero}`);
    if (!localInput || !visitInput) return alert("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

    const card = document.querySelector(`[data-partido-third="${partidoNumero}"]`);
    if (!card) return alert("Partido no encontrado");
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) clasificado = equipoLocal;
    else if (visit > local) clasificado = equipoVisit;
    else {
      const selected = document.querySelector(`input[name="third_clasificado_${partidoNumero}"]:checked`);
      if (!selected) return alert("Debes elegir quién clasifica");
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_THIRD_${partidoNumero}`;
    await setDoc(doc(db, "predictions_third", predictionId), {
      uid: currentUser.uid,
      partido: Number(partidoNumero),
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "tercer_puesto",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    await generarTercerPuesto();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// GUARDAR PREDICCIÓN DE LA FINAL
// ======================================================
window.saveFinalPrediction = async (partidoNumero) => {
  try {
    if (!currentUser) return alert("Debes iniciar sesión");

    const localInput = document.getElementById(`final_local_${partidoNumero}`);
    const visitInput = document.getElementById(`final_visit_${partidoNumero}`);
    if (!localInput || !visitInput) return alert("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

    const card = document.querySelector(`[data-partido-final="${partidoNumero}"]`);
    if (!card) return alert("Partido no encontrado");
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) {
      clasificado = equipoLocal;
    } else if (visit > local) {
      clasificado = equipoVisit;
    } else {
      const selected = document.querySelector(`input[name="final_clasificado_${partidoNumero}"]:checked`);
      if (!selected) return alert("Debes elegir quién clasifica en caso de empate");
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_FINAL_${partidoNumero}`;
    await setDoc(doc(db, "predictions_final", predictionId), {
      uid: currentUser.uid,
      partido: Number(partidoNumero),
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "final",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
    // Refrescar la vista de la final para mostrar lo guardado
    await generarFinal();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// GENERAR FINAL (CARRUSEL HORIZONTAL) - VERSIÓN REACTIVA
// ======================================================
async function generarFinal(usarMemoria = false) {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("finalContainer");
  if (!container) return;

  // Guardar scroll
  let scrollPos = 0;
  const oldCarousel = document.getElementById("carouselFinal");
  if (oldCarousel) scrollPos = oldCarousel.scrollLeft;

  // Validar usuario logueado
  if (!currentUser) {
    container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">🔒 Inicia sesión para ver la Final.</div>`;
    return;
  }

  try {
    // Cargar resultados reales (para saber si está finalizado)
    let resultadosMap = {};
    try {
      const resultadosSnap = await getDocs(collection(db, "knockout_results"));
      resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });
    } catch (e) {
      console.warn("No se pudieron cargar knockout_results:", e);
    }

    // ========== OBTENER CLASIFICADOS DE SEMIFINALES ==========
    let clasificados = {};
    if (usarMemoria && Object.keys(clasificadosEnMemoria.semifinales).length > 0) {
      // Usar memoria (calculado en tiempo real)
      clasificados = clasificadosEnMemoria.semifinales;
    } else {
      // Cargar desde Firestore
      try {
        const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
        const semisSnap = await getDocs(semisQuery);
        semisSnap.forEach(doc => {
          const data = doc.data();
          clasificados[data.partido] = data.clasificado;
        });
      } catch (e) {
        console.error("Error al cargar predicciones de semifinales:", e);
      }
    }

    // Determinar los equipos finalistas
    const finalista1 = clasificados[101] || "Por definir";
    const finalista2 = clasificados[102] || "Por definir";
    const partido = {
      numero: 104,
      local: finalista1,
      visitante: finalista2
    };

    // DATOS DEL PARTIDO
    const horaPartido = obtenerHoraPartidoKnockout(104);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    // PREDICCIÓN GUARDADA DEL USUARIO
    let predLocal = "", predVisit = "", clasifGuardado = "";
    let hasPrediction = false;
    try {
      const finalRef = doc(db, "predictions_final", `${currentUser.uid}_FINAL_104`);
      const finalSnap = await getDoc(finalRef);
      if (finalSnap.exists()) {
        hasPrediction = true;
        const data = finalSnap.data();
        predLocal = data.pred_local ?? "";
        predVisit = data.pred_visitante ?? "";
        clasifGuardado = data.clasificado ?? "";
      }
    } catch (e) {
      console.error("Error al cargar predicción de la final:", e);
    }

    const radiosId = `radios_final_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    // CONSTRUIR HTML
    let html = `<div class="tabla-grupo-card">
      <h3 class="tabla-title">🏆 GRAN FINAL</h3>
      <div class="puntuacion-info">
        ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
        Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
        Aciertas solo quién gana → <strong>1 punto</strong>. 
        En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
        <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
      </div>
      <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
        <button id="scrollFinalLeft" class="scroll-btn" style="visibility: hidden;"><i class="fas fa-chevron-left"></i></button>
        <div id="carouselFinal" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px; justify-content: center;"></div>
        <button id="scrollFinalRight" class="scroll-btn" style="visibility: hidden;"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>`;

    container.innerHTML = html;
    const carousel = document.getElementById("carouselFinal");
    if (carousel && scrollPos > 0) carousel.scrollLeft = scrollPos;
    if (!carousel) return;

    const tarjetaHTML = `
      <div class="knockout-card" data-partido-final="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}" style="min-width: 340px;">
        <div class="knockout-match-number">Partido ${partido.numero} - FINAL</div>
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" onerror="this.src='assets/img/default-flag.png'">
            <span>${fifaCodes[partido.local] || partido.local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" onerror="this.src='assets/img/default-flag.png'">
            <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
          </div>
        </div>
        <div class="prediction-area">
          <input type="number" id="final_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
          <span class="score-separator">-</span>
          <input type="number" id="final_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
        </div>
        <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
          <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
          🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
        </div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);

    // Listeners para radios en caso de empate
    if (!disabled) {
      const localInput = document.getElementById(`final_local_${partido.numero}`);
      const visitInput = document.getElementById(`final_visit_${partido.numero}`);
      const radiosDiv = document.getElementById(radiosId);
      if (localInput && visitInput && radiosDiv) {
        const updateRadios = () => {
          const localVal = parseInt(localInput.value);
          const visitVal = parseInt(visitInput.value);
          if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
            radiosDiv.style.display = "flex";
          } else {
            radiosDiv.style.display = "none";
          }
        };
        localInput.addEventListener("input", updateRadios);
        visitInput.addEventListener("input", updateRadios);
        updateRadios();
      }
    }
  } catch (error) {
    console.error("Error grave en generarFinal:", error);
    container.innerHTML = `<div class="tabla-grupo-card" style="color:red; padding:20px;">❌ Error al cargar la Final: ${error.message}. Intenta recargar la página.</div>`;
  }
}
// ======================================================
// GENERAR TERCER PUESTO - VERSIÓN REACTIVA
// ======================================================
async function generarTercerPuesto(usarMemoria = false) {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("thirdPlaceContainer");
  if (!container) return;

  // Guardar posición del scroll
  let scrollPos = 0;
  const oldCarousel = document.getElementById("carouselThird");
  if (oldCarousel) scrollPos = oldCarousel.scrollLeft;

  if (!currentUser) {
    container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">🔒 Inicia sesión para ver el Tercer Puesto.</div>`;
    return;
  }

  try {
    // Obtener clasificados de cuartos (para saber quiénes jugaron semifinales) desde memoria o Firestore
    let clasificadosCuartos = {};
    if (usarMemoria && Object.keys(clasificadosEnMemoria.cuartos).length > 0) {
      clasificadosCuartos = clasificadosEnMemoria.cuartos;
    } else {
      try {
        const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
        const cuartosSnap = await getDocs(cuartosQuery);
        cuartosSnap.forEach(doc => {
          const data = doc.data();
          clasificadosCuartos[data.partido] = data.clasificado;
        });
      } catch (e) {
        console.error("Error cargando cuartos:", e);
      }
    }

    // Función para limpiar nombres
    const limpiarNombre = (nombre) => {
      if (!nombre) return "Por definir";
      if (nombre.startsWith("Ganador")) return "Por definir";
      if (nombre.startsWith("Perdedor")) return "Por definir";
      return nombre;
    };

    // Definir partidos de semifinales con nombres limpios
    const semi101 = {
      numero: 101,
      local: limpiarNombre(clasificadosCuartos[97]),
      visitante: limpiarNombre(clasificadosCuartos[98])
    };
    const semi102 = {
      numero: 102,
      local: limpiarNombre(clasificadosCuartos[99]),
      visitante: limpiarNombre(clasificadosCuartos[100])
    };

    // Obtener ganadores elegidos por el usuario en semifinales (desde memoria o Firestore)
    let ganadoresSemis = {};
    if (usarMemoria && Object.keys(clasificadosEnMemoria.semifinales).length > 0) {
      ganadoresSemis = clasificadosEnMemoria.semifinales;
    } else {
      try {
        const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
        const semisSnap = await getDocs(semisQuery);
        semisSnap.forEach(doc => {
          const data = doc.data();
          ganadoresSemis[data.partido] = data.clasificado;
        });
      } catch (e) {
        console.error("Error cargando semifinales:", e);
      }
    }

    // Determinar perdedores
    let perdedor1 = "Por definir";
    let perdedor2 = "Por definir";

    if (semi101.local !== "Por definir" && semi101.visitante !== "Por definir" && ganadoresSemis[101]) {
      const ganador = ganadoresSemis[101];
      perdedor1 = (ganador === semi101.local) ? semi101.visitante : semi101.local;
    }
    if (semi102.local !== "Por definir" && semi102.visitante !== "Por definir" && ganadoresSemis[102]) {
      const ganador = ganadoresSemis[102];
      perdedor2 = (ganador === semi102.local) ? semi102.visitante : semi102.local;
    }

    const partido = {
      numero: 103,
      local: perdedor1,
      visitante: perdedor2
    };

    // Resultados reales y datos del partido
    let resultadosMap = {};
    try {
      const resultadosSnap = await getDocs(collection(db, "knockout_results"));
      resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });
    } catch (e) { }

    const horaPartido = obtenerHoraPartidoKnockout(103);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    // Predicción guardada del usuario
    let predLocal = "", predVisit = "", clasifGuardado = "";
    let hasPrediction = false;
    try {
      const thirdRef = doc(db, "predictions_third", `${currentUser.uid}_THIRD_103`);
      const thirdSnap = await getDoc(thirdRef);
      if (thirdSnap.exists()) {
        hasPrediction = true;
        const data = thirdSnap.data();
        predLocal = data.pred_local ?? "";
        predVisit = data.pred_visitante ?? "";
        clasifGuardado = data.clasificado ?? "";
      }
    } catch (e) { }

    const radiosId = `radios_third_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    // HTML
    let html = `<div class="tabla-grupo-card">
      <h3 class="tabla-title">🥉 Tercer Puesto</h3>
      <div class="puntuacion-info">...</div>
      <div class="grupos-tabs-wrapper">
        <button id="scrollThirdLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
        <div id="carouselThird" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px; justify-content: center;"></div>
        <button id="scrollThirdRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>`;

    container.innerHTML = html;
    const carousel = document.getElementById("carouselThird");
    if (carousel && scrollPos > 0) carousel.scrollLeft = scrollPos;
    if (!carousel) return;

    const tarjetaHTML = `
      <div class="knockout-card" data-partido-third="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}" style="min-width: 340px;">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg" onerror="this.src='assets/img/default-flag.png'">
            <span>${partido.local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg" onerror="this.src='assets/img/default-flag.png'">
            <span>${partido.visitante}</span>
          </div>
        </div>
        <div class="prediction-area">
          <input type="number" id="third_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
          <span class="score-separator">-</span>
          <input type="number" id="third_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
        </div>
        <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
          <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${partido.local}</label>
          <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${partido.visitante}</label>
        </div>
        <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
          🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
        </div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);

    // Listeners de scroll
    const leftBtn = document.getElementById("scrollThirdLeft");
    const rightBtn = document.getElementById("scrollThirdRight");
    if (leftBtn && rightBtn) {
      leftBtn.onclick = () => carousel.scrollBy({ left: -340, behavior: "smooth" });
      rightBtn.onclick = () => carousel.scrollBy({ left: 340, behavior: "smooth" });
    }

    // Listeners para radios (empate)
    if (!disabled) {
      const localInput = document.getElementById(`third_local_${partido.numero}`);
      const visitInput = document.getElementById(`third_visit_${partido.numero}`);
      const radiosDiv = document.getElementById(radiosId);
      if (localInput && visitInput && radiosDiv) {
        const updateRadios = () => {
          const localVal = parseInt(localInput.value);
          const visitVal = parseInt(visitInput.value);
          if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
            radiosDiv.style.display = "flex";
          } else {
            radiosDiv.style.display = "none";
          }
        };
        localInput.addEventListener("input", updateRadios);
        visitInput.addEventListener("input", updateRadios);
        updateRadios();
      }
    }
  } catch (error) {
    console.error("Error grave en generarTercerPuesto:", error);
    container.innerHTML = `<div class="tabla-grupo-card" style="color:red; padding:20px;">❌ Error al cargar el Tercer Puesto.</div>`;
  }
}
// ======================================================
// RANKING EN TIEMPO REAL
// ======================================================

function loadRanking() {
  if (rankingInterval) clearInterval(rankingInterval); // Evita intervalos acumulados

  async function actualizarRanking() {
    const q = query(collection(db, "ranking"), orderBy("puntos", "desc"), limit(50));
    const snapshot = await getDocs(q);
    rankingGlobalData = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.user_id) continue;
      const userSnap = await getDoc(doc(db, "users", data.user_id));
      if (!userSnap.exists()) continue;
      const userData = userSnap.data();
      if (userData.rol === "admin") continue; // Excluir al administrador
      rankingGlobalData.push({
        uid: data.user_id,
        nombre: userData.nombre || "Usuario",
        puntos: data.puntos
      });
    }
    document.getElementById("totalRankingGlobal").innerText = rankingGlobalData.length;
    renderRankingGlobal();
  }

  actualizarRanking();                              // Carga inicial
  rankingInterval = setInterval(actualizarRanking, 60000); // Actualiza cada 60 segundos
}
function renderRankingGlobal() {
  const container = document.getElementById("rankingList");
  if (!container) return;

  let filtrados = rankingGlobalData;
  if (rankingGlobalFiltro.trim() !== "") {
    const term = rankingGlobalFiltro.toLowerCase();
    filtrados = rankingGlobalData.filter(item => item.nombre.toLowerCase().includes(term));
  }

  if (filtrados.length === 0) {
    container.innerHTML = "<div style='margin-top:10px;'>No hay resultados</div>";
    return;
  }

  let html = "";
  let pos = 1;
  let encontrado = false;

  for (const item of filtrados) {
    let medalla = "";
    if (pos === 1) medalla = "🥇";
    else if (pos === 2) medalla = "🥈";
    else if (pos === 3) medalla = "🥉";
    else medalla = `#${pos}`;

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08); gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <span>${medalla}</span>
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.nombre}</span>
        </div>
        <strong>${item.puntos} pts</strong>
      </div>
    `;
    if (item.uid === currentUser?.uid) {
      miPosicionSpan.innerText = pos + "°";
      misPuntosSpan.innerText = item.puntos;
      encontrado = true;
    }
    pos++;
  }

  if (!encontrado && currentUser) {
    // Buscar posición real del usuario en el ranking completo (no filtrado)
    const idx = rankingGlobalData.findIndex(u => u.uid === currentUser.uid);
    if (idx !== -1) {
      miPosicionSpan.innerText = (idx + 1) + "°";
      misPuntosSpan.innerText = rankingGlobalData[idx].puntos;
    } else {
      miPosicionSpan.innerText = "-";
      misPuntosSpan.innerText = "0";
    }
  }

  container.innerHTML = html;
}

// Evento para el buscador del ranking global
document.getElementById("buscarRankingGlobal")?.addEventListener("input", (e) => {
  rankingGlobalFiltro = e.target.value;
  renderRankingGlobal();
});
// ======================================================
// LOAD RANKING
// ======================================================

function loadRankingKnockout() {
  if (rankingIntervalKO) clearInterval(rankingIntervalKO);
  async function actualizarRankingKO() {
    const q = query(collection(db, "ranking_knockout"), orderBy("puntos", "desc"), limit(50));
    const snapshot = await getDocs(q);
    rankingKODisplayData = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", data.user_id));
      if (!userSnap.exists()) continue;
      const userData = userSnap.data();
      if (userData.rol === "admin") continue;
      rankingKODisplayData.push({
        uid: data.user_id,
        nombre: userData.nombre || "Usuario",
        puntos: data.puntos
      });
    }
    document.getElementById("totalRankingKO").innerText = rankingKODisplayData.length;
    renderRankingKnockout();
  }
  actualizarRankingKO();
  rankingIntervalKO = setInterval(actualizarRankingKO, 60000);
}

function renderRankingKnockout() {
  const container = document.getElementById("rankingKnockoutList");
  if (!container) return;

  let filtrados = rankingKODisplayData;
  if (rankingKOFiltro.trim() !== "") {
    const term = rankingKOFiltro.toLowerCase();
    filtrados = rankingKODisplayData.filter(item => item.nombre.toLowerCase().includes(term));
  }

  if (filtrados.length === 0) {
    container.innerHTML = "<div>No hay resultados</div>";
    return;
  }

  let html = "";
  let pos = 1;
  let encontrado = false;

  for (const item of filtrados) {
    let medalla = "";
    if (pos === 1) medalla = "🥇";
    else if (pos === 2) medalla = "🥈";
    else if (pos === 3) medalla = "🥉";
    else medalla = `#${pos}`;

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08); gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <span>${medalla}</span>
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.nombre}</span>
        </div>
        <strong>${item.puntos} pts</strong>
      </div>
    `;
    if (item.uid === currentUser?.uid) {
      document.getElementById("miPosicionKO").innerText = pos + "°";
      document.getElementById("misPuntosKO").innerText = item.puntos;
      encontrado = true;
    }
    pos++;
  }

  if (!encontrado && currentUser) {
    const idx = rankingKODisplayData.findIndex(u => u.uid === currentUser.uid);
    if (idx !== -1) {
      document.getElementById("miPosicionKO").innerText = (idx + 1) + "°";
      document.getElementById("misPuntosKO").innerText = rankingKODisplayData[idx].puntos;
    } else {
      document.getElementById("miPosicionKO").innerText = "-";
      document.getElementById("misPuntosKO").innerText = "0";
    }
  }

  container.innerHTML = html;
}

// Evento para el buscador del ranking knockout
document.getElementById("buscarRankingKO")?.addEventListener("input", (e) => {
  rankingKOFiltro = e.target.value;
  renderRankingKnockout();
});
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
    const matchRef = doc(db, "matches", matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
      return alert("Partido no encontrado");
    }
    const match = matchSnap.data();

    if (match.resultado_local === null || match.resultado_visitante === null) {
      return alert("Debes guardar resultados primero");
    }
    if (match.estado === "finalizado") {
      return alert("Este partido ya fue finalizado");
    }

    // Cambiar estado a finalizado
    await updateDoc(matchRef, { estado: "finalizado" });

    // CALCULAR PUNTOS (llamada a la función externa)
    await calcularPuntos(matchId);

    // REFRESCAR PUNTOS INMEDIATAMENTE
    await loadRanking();
    if (currentUser) {
      await cargarPuntosUsuarioSidebar();
    }

    // FORZAR REFRESCO DE VISTA DE GRUPOS
    if (matchesUnsubscribe) {
      loadMatchesAndPredictions();
    }

    alert("✅ Partido finalizado y puntos calculados");
    loadAdminMatches();
  } catch (error) {
    console.error(error);
    alert("Error al finalizar partido");
  }
};
// ======================================================
// REABRIR PARTIDO (ADMIN)
// ======================================================
window.reabrirPartido = async (matchId) => {
  try {
    const matchRef = doc(db, "matches", matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) return alert("Partido no encontrado");

    const match = matchSnap.data();
    if (match.estado !== "finalizado") return alert("Este partido no está finalizado");

    // Obtener predicciones
    const predictionsQuery = query(collection(db, "predictions_groups"), where("match_id", "==", matchId));
    const predictionsSnap = await getDocs(predictionsQuery);

    for (const predDoc of predictionsSnap.docs) {
      const pred = predDoc.data();
      if (pred.points_assigned === true) {
        const puntosARestar = Number(pred.points || 0);
        const rankingRef = doc(db, "ranking", pred.uid);
        const rankingSnap = await getDoc(rankingRef);
        if (rankingSnap.exists()) {
          const rankingData = rankingSnap.data();
          await updateDoc(rankingRef, {
            puntos: Math.max(0, (rankingData.puntos || 0) - puntosARestar),
            updated_at: serverTimestamp()
          });
        }
        await updateDoc(predDoc.ref, { points_assigned: false, points: 0 });
      }
    }

    // Reabrir: limpiar resultados y dejar en estado "resultado_cargado" (sin puntos calculados)
    await updateDoc(matchRef, {
      resultado_local: null,
      resultado_visitante: null,
      estado: "pendiente",           // Ahora el admin debe volver a guardar
      puntos_calculados: false
    });

    alert("✅ Partido reabierto correctamente. Debes ingresar nuevos resultados y finalizar de nuevo.");
    loadAdminMatches();
  } catch (error) {
    console.error(error);
    alert("Error al reabrir partido");
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
// CALCULAR PUNTOS (CON REINTENTOS)
// ======================================================
async function calcularPuntos(matchId) {
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  const match = matchSnap.data();
  if (match.puntos_calculados === true) {
    console.log("⚠️ Este partido ya calculó puntos");
    return;
  }

  const local = Number(match.resultado_local);
  const visit = Number(match.resultado_visitante);
  const predictionsQuery = query(
    collection(db, "predictions_groups"),
    where("match_id", "==", matchId)
  );
  const predictionsSnap = await getDocs(predictionsQuery);
  console.log(`📊 Procesando ${predictionsSnap.size} predicciones para partido ${matchId}`);

  // Función auxiliar con reintentos
  const actualizarRankingConReintentos = async (uid, puntosAGanar, esKnockout = false) => {
    const coleccion = esKnockout ? "ranking_knockout" : "ranking";
    const rankingRef = doc(db, coleccion, uid);
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const rankingSnap = await getDoc(rankingRef);
        if (!rankingSnap.exists()) {
          await setDoc(rankingRef, {
            user_id: uid,
            puntos: puntosAGanar,
            updated_at: serverTimestamp()
          });
        } else {
          const rankingData = rankingSnap.data();
          await updateDoc(rankingRef, {
            puntos: (rankingData.puntos || 0) + puntosAGanar,
            updated_at: serverTimestamp()
          });
        }
        return true; // éxito
      } catch (err) {
        console.warn(`Intento ${intento} fallido para usuario ${uid} en ranking ${coleccion}:`, err);
        if (intento === 3) {
          console.error(`❌ No se pudo actualizar ranking para ${uid} después de 3 intentos`);
          return false;
        }
        await new Promise(r => setTimeout(r, 1000 * intento)); // espera 1s, 2s, 3s
      }
    }
    return false;
  };

  let algunError = false;
  for (const predDoc of predictionsSnap.docs) {
    const pred = predDoc.data();
    if (pred.points_assigned === true) {
      console.log(`⏭️ Usuario ${pred.uid} ya tenía puntos asignados, saltando`);
      continue;
    }

    const predLocal = Number(pred.pred_local);
    const predVisit = Number(pred.pred_visitante);

    let puntos = 0;
    if (predLocal === local && predVisit === visit) {
      puntos = 3;
    } else {
      const real = local > visit ? "L" : local < visit ? "V" : "E";
      const usuario = predLocal > predVisit ? "L" : predLocal < predVisit ? "V" : "E";
      if (real === usuario) puntos = 1;
    }

    if (puntos > 0) {
      console.log(`🔹 Usuario ${pred.uid}: ganó ${puntos} puntos`);
      const ok = await actualizarRankingConReintentos(pred.uid, puntos, false);
      if (!ok) algunError = true;
    } else {
      console.log(`🔸 Usuario ${pred.uid}: 0 puntos`);
    }

    // Marcar predicción como procesada
    try {
      await updateDoc(predDoc.ref, {
        points_assigned: true,
        points: puntos
      });
    } catch (err) {
      console.error(`Error marcando points_assigned para ${pred.uid}:`, err);
      algunError = true;
    }
  }

  await updateDoc(matchRef, { puntos_calculados: true });
  if (algunError) {
    console.warn("⚠️ Algunas operaciones fallaron, pero el partido se marcó como calculado.");
  } else {
    console.log("✅ Puntos calculados correctamente para todos los usuarios.");
  }
}
// ======================================================
// TABLA DE POSICIONES
// ======================================================

async function generarTablaGrupos() {
  const tablaContainer = document.getElementById("tablaGruposContainer");
  if (!tablaContainer) return;

  // Obtener todos los partidos de grupos
  const matchesSnap = await getDocs(collection(db, "matches"));
  const grupos = {};

  // Inicializar estructura para todos los grupos (A a L)
  const letrasGrupos = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const letra of letrasGrupos) {
    grupos[letra] = {};
  }

  // Procesar cada partido
  matchesSnap.forEach(docSnap => {
    const match = docSnap.data();
    if (match.fase !== "grupos") return;
    const grupo = match.grupo;
    if (!grupos[grupo]) return;

    const equipos = [match.equipo_local, match.equipo_visitante];
    equipos.forEach(e => {
      if (!grupos[grupo][e]) {
        grupos[grupo][e] = {
          equipo: e,
          pj: 0, pg: 0, pe: 0, pp: 0,
          gf: 0, gc: 0, dg: 0, pts: 0
        };
      }
    });

    // Solo si el partido está finalizado, se suman estadísticas
    if (match.estado !== "finalizado") return;

    const local = grupos[grupo][match.equipo_local];
    const visit = grupos[grupo][match.equipo_visitante];
    const gl = Number(match.resultado_local);
    const gv = Number(match.resultado_visitante);

    local.pj++; visit.pj++;
    local.gf += gl; local.gc += gv;
    visit.gf += gv; visit.gc += gl;
    local.dg = local.gf - local.gc;
    visit.dg = visit.gf - visit.gc;

    if (gl > gv) {
      local.pg++; local.pts += 3;
      visit.pp++;
    } else if (gv > gl) {
      visit.pg++; visit.pts += 3;
      local.pp++;
    } else {
      local.pe++; visit.pe++;
      local.pts++; visit.pts++;
    }
  });

  // Ordenar cada grupo y guardar clasificados globales
  for (const grupo of letrasGrupos) {
    const tabla = Object.values(grupos[grupo]);
    tabla.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
    if (tabla[0]) clasificadosGlobales[`1${grupo}`] = tabla[0].equipo;
    if (tabla[1]) clasificadosGlobales[`2${grupo}`] = tabla[1].equipo;
  }

  // Mostrar SOLO la tabla del grupo activo (para el usuario)
  const grupoActivoTabla = grupos[grupoActivo];
  const tablaActiva = Object.values(grupoActivoTabla);
  tablaActiva.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Grupo ${grupoActivo}</h3>
    <table class="tabla-posiciones">
      <thead><tr><th>#</th><th>Equipo</th><th>PTS</th><th>PJ</th><th>DG</th></tr></thead>
      <tbody>`;
  tablaActiva.forEach((team, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><div style="display:flex; align-items:center; gap:8px;"><img src="https://flagcdn.com/${obtenerCodigoPais(team.equipo)}.svg" width="22"> ${team.equipo}</div></td>
        <td><strong>${team.pts}</strong></td>
        <td>${team.pj}</td>
        <td>${team.dg > 0 ? "+" + team.dg : team.dg}</td>
      </tr>`;
  });
  html += `</tbody></table></div>`;
  tablaContainer.innerHTML = html;

  // Actualizar los dieciseisavos (bracket) porque ahora los clasificados globales están completos
  generarDieciseisavos();
}
// ======================================================
// GENERAR DIECISEISAVOS
// ======================================================
async function generarDieciseisavos() {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("bracketContainer");
  if (!container) return;

  // 👇 Guardar la posición actual del scroll (si existe el carrusel)
  let scrollPos = 0;
  const oldCarousel = document.getElementById("knockoutCarousel");
  if (oldCarousel) {
    scrollPos = oldCarousel.scrollLeft;
  }

  // ==========================================

  // Cargar resultados de knockout (para saber si un partido está finalizado)
  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });

  // Obtener asignación de terceros guardada por el admin
  let tercerosMap = {};
  try {
    const asignacionDoc = await getDoc(doc(db, "settings", "terceros_asignacion"));
    if (asignacionDoc.exists()) {
      tercerosMap = asignacionDoc.data();
    }
  } catch (e) { console.error("Error al cargar terceros", e); }

  const partidos = [
    { numero: 73, local: clasificadosGlobales["2A"] || "2A", visitante: clasificadosGlobales["2B"] || "2B" },
    { numero: 74, local: clasificadosGlobales["1E"] || "1E", visitante: tercerosMap[74] || "Tercero por definir" },
    { numero: 75, local: clasificadosGlobales["1F"] || "1F", visitante: clasificadosGlobales["2C"] || "2C" },
    { numero: 76, local: clasificadosGlobales["1C"] || "1C", visitante: clasificadosGlobales["2F"] || "2F" },
    { numero: 77, local: clasificadosGlobales["1I"] || "1I", visitante: tercerosMap[77] || "Tercero por definir" },
    { numero: 78, local: clasificadosGlobales["2E"] || "2E", visitante: clasificadosGlobales["2I"] || "2I" },
    { numero: 79, local: clasificadosGlobales["1A"] || "1A", visitante: tercerosMap[79] || "Tercero por definir" },
    { numero: 80, local: clasificadosGlobales["1L"] || "1L", visitante: tercerosMap[80] || "Tercero por definir" },
    { numero: 81, local: clasificadosGlobales["1D"] || "1D", visitante: tercerosMap[81] || "Tercero por definir" },
    { numero: 82, local: clasificadosGlobales["1G"] || "1G", visitante: tercerosMap[82] || "Tercero por definir" },
    { numero: 83, local: clasificadosGlobales["2K"] || "2K", visitante: clasificadosGlobales["2L"] || "2L" },
    { numero: 84, local: clasificadosGlobales["1H"] || "1H", visitante: clasificadosGlobales["2J"] || "2J" },
    { numero: 85, local: clasificadosGlobales["1B"] || "1B", visitante: tercerosMap[85] || "Tercero por definir" },
    { numero: 86, local: clasificadosGlobales["1J"] || "1J", visitante: clasificadosGlobales["2H"] || "2H" },
    { numero: 87, local: clasificadosGlobales["1K"] || "1K", visitante: tercerosMap[87] || "Tercero por definir" },
    { numero: 88, local: clasificadosGlobales["2D"] || "2D", visitante: clasificadosGlobales["2G"] || "2G" }
  ];
  // 👇 NUEVO BLOQUE (justo aquí)
  let misPrediccionesKO = {};
  if (currentUser) {
    try {
      const qPreds = query(collection(db, "predictions_knockout"), where("uid", "==", currentUser.uid));
      const predsSnap = await getDocs(qPreds);
      predsSnap.forEach(doc => {
        const data = doc.data();
        misPrediccionesKO[data.partido] = data;
      });
    } catch (e) {
      console.error("Error al cargar predicciones KO:", e);
    }
  }

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Dieciseisavos de Final</h3>
    <div class="puntuacion-info">
      ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
      Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
      Aciertas solo quién gana → <strong>1 punto</strong>. 
      En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
      <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
    </div>
    <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
      <button id="scrollKnockoutLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
      <div id="knockoutCarousel" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px;"></div>
      <button id="scrollKnockoutRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;

  container.innerHTML = html;
  const carousel = document.getElementById("knockoutCarousel");


  for (const partido of partidos) {
    if (!partido.local || !partido.visitante) continue;

    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    //const isClosed = new Date() >= cierreApuestas;
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const predData = misPrediccionesKO[partido.numero];
    let predLocal = "", predVisit = "", clasifGuardado = "";
    let hasPrediction = false;
    if (predData) {
      hasPrediction = true;
      predLocal = predData.pred_local ?? "";
      predVisit = predData.pred_visitante ?? "";
      clasifGuardado = predData.clasificado ?? "";
    }

    const radiosId = `radios_ko_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    const tarjetaHTML = `
      <div class="knockout-card" data-partido="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg">
            <span>${fifaCodes[partido.local] || partido.local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg">
            <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
          </div>
        </div>
        <div class="prediction-area">
          <input type="number" id="ko_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
          <span class="score-separator">-</span>
          <input type="number" id="ko_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
        </div>
        <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
          <label><input type="radio" name="clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
       
        <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
  🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
</div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);
  }

  // Botones de scroll
  const leftBtn = document.getElementById("scrollKnockoutLeft");
  const rightBtn = document.getElementById("scrollKnockoutRight");
  if (leftBtn && rightBtn) {
    leftBtn.onclick = () => carousel.scrollBy({ left: -340, behavior: "smooth" });
    rightBtn.onclick = () => carousel.scrollBy({ left: 340, behavior: "smooth" });
  }

    // Listeners para mostrar radios en empate
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;
    if (isKnockoutClosed) continue;

    const localInput = document.getElementById(`ko_local_${partido.numero}`);
    const visitInput = document.getElementById(`ko_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_ko_${partido.numero}`);
    if (localInput && visitInput && radiosDiv) {
      const updateRadios = () => {
        const localVal = parseInt(localInput.value);
        const visitVal = parseInt(visitInput.value);
        if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
          radiosDiv.style.display = "flex";
        } else {
          radiosDiv.style.display = "none";
        }
      };
      localInput.addEventListener("input", updateRadios);
      visitInput.addEventListener("input", updateRadios);
      updateRadios();
    }
  }

    // 👇 AQUÍ DEBES AGREGAR LA LLAMADA
  configurarReactividadDieciseisavos();

  // Restaurar scroll
  if (carousel && scrollPos > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carousel.scrollLeft = scrollPos;
      });
    });
  }
} // <-- Esta es la única llave que cierra la función (no debe haber otra después)
// ======================================================
// GUARDAR PREDICCIÓN ELIMINATORIAS
// ======================================================
// ======================================================
// GUARDAR PREDICCIÓN ELIMINATORIAS
// ======================================================

window.saveKnockoutPrediction = async (partidoNumero) => {
  try {
    if (!currentUser) {
      return alert("Debes iniciar sesión");
    }

    const localInput = document.getElementById(`ko_local_${partidoNumero}`);
    const visitInput = document.getElementById(`ko_visit_${partidoNumero}`);
    if (!localInput || !visitInput) {
      return alert("Inputs no encontrados");
    }

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) {
      return alert("Ingresa marcadores válidos");
    }

    const card = document.querySelector(`[data-partido="${partidoNumero}"]`);
    if (!card) {
      return alert("Partido no encontrado");
    }

    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;

    let clasificado = null;
    if (local > visit) {
      clasificado = equipoLocal;
    } else if (visit > local) {
      clasificado = equipoVisit;
    } else {
      const selected = document.querySelector(`input[name="clasificado_${partidoNumero}"]:checked`);
      if (!selected) {
        return alert("Debes elegir quién clasifica");
      }
      clasificado = selected.value;
    }

    const predictionId = `${currentUser.uid}_${partidoNumero}`;

    await setDoc(
      doc(db, "predictions_knockout", predictionId),
      {
        uid: currentUser.uid,
        partido: Number(partidoNumero),
        pred_local: local,
        pred_visitante: visit,
        clasificado,
        fase: "dieciseisavos",
        updated_at: serverTimestamp()
      },
      { merge: true }
    );

    alert("✅ Predicción guardada");

    // 1. Actualizar SOLO la tarjeta actual (sin regenerar el carrusel)
    if (card) {
      // Actualizar inputs
      const localInputCard = card.querySelector(`#ko_local_${partidoNumero}`);
      const visitInputCard = card.querySelector(`#ko_visit_${partidoNumero}`);
      if (localInputCard && visitInputCard) {
        localInputCard.value = local;
        visitInputCard.value = visit;
      }
      // Actualizar botón
      const btn = card.querySelector(".btn-guardar");
      if (btn && !btn.disabled) {
        btn.innerText = "Actualizar";
        btn.classList.add("btn-actualizar");
      }
      // Actualizar radios (si hay empate)
      const radiosDiv = card.querySelector(`#radios_ko_${partidoNumero}`);
      if (radiosDiv) {
        const radioLocal = radiosDiv.querySelector(`input[value="${equipoLocal}"]`);
        const radioVisit = radiosDiv.querySelector(`input[value="${equipoVisit}"]`);
        if (radioLocal && radioVisit) {
          if (local === visit) {
            radiosDiv.style.display = "flex";
            radioLocal.checked = (clasificado === equipoLocal);
            radioVisit.checked = (clasificado === equipoVisit);
          } else {
            radiosDiv.style.display = "none";
          }
        }
      }
    }

    // 2. Regenerar solo las fases siguientes (octavos y cuartos)
    //    Ya tienen restauración de scroll, apenas se notará.
    await generarOctavos();
    await generarCuartos();

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};
// ======================================================
// REACTIVIDAD PARA OCTAVOS
// ======================================================
let timeoutIdOct = null;

function calcularClasificadosOctavos() {
  const clasificados = {};
  for (let i = 89; i <= 96; i++) {
    const localInput = document.getElementById(`oct_local_${i}`);
    const visitInput = document.getElementById(`oct_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) continue;
    const card = document.querySelector(`[data-partido-octavos="${i}"]`);
    if (!card) continue;
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;
    if (local > visit) clasificados[i] = equipoLocal;
    else if (visit > local) clasificados[i] = equipoVisit;
    else {
      const radioName = `oct_clasificado_${i}`;
      const radioSelected = card.querySelector(`input[name="${radioName}"]:checked`);
      if (radioSelected) clasificados[i] = radioSelected.value;
    }
  }
  return clasificados;
}

function configurarReactividadOctavos() {
  for (let i = 89; i <= 96; i++) {
    const localInput = document.getElementById(`oct_local_${i}`);
    const visitInput = document.getElementById(`oct_visit_${i}`);
    if (!localInput || !visitInput) continue;

    const updateHandler = () => {
      if (timeoutIdOct) clearTimeout(timeoutIdOct);
      timeoutIdOct = setTimeout(async () => {
        clasificadosEnMemoria.octavos = calcularClasificadosOctavos();
        await generarCuartos(true);
        await generarSemifinales(true);
        await generarFinal(true);
        await generarTercerPuesto(true);
      }, 300);
    };

    localInput.addEventListener("input", updateHandler);
    visitInput.addEventListener("input", updateHandler);

    const radiosDiv = document.getElementById(`radios_oct_${i}`);
    if (radiosDiv) {
      radiosDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener("change", updateHandler);
      });
    }
  }
}
// ======================================================
// GENERAR OCTAVOS AUTOMÁTICOS
// ======================================================
async function generarOctavos(usarMemoria = false) {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("octavosContainer");
  if (!container) return;

  let scrollPos = 0;
  const oldCarousel = document.getElementById("octavosCarousel");
  if (oldCarousel) scrollPos = oldCarousel.scrollLeft;

  // Cargar resultados de knockout (para saber finalizados)
  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });

  // Obtener clasificados de dieciseisavos
  let clasificados = {};
  if (usarMemoria && Object.keys(clasificadosEnMemoria.dieciseisavos).length > 0) {
    clasificados = clasificadosEnMemoria.dieciseisavos;
  } else {
    const knockoutSnap = await getDocs(collection(db, "predictions_knockout"));
    knockoutSnap.forEach(doc => {
      const data = doc.data();
      if (data.uid === currentUser.uid) {
        clasificados[data.partido] = data.clasificado;
      }
    });
  }

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

  // Obtener predicciones guardadas del usuario para octavos
  const octavosQuery = query(collection(db, "predictions_octavos"), where("uid", "==", currentUser.uid));
  const octavosSnap = await getDocs(octavosQuery);
  const predicciones = {};
  octavosSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  // HTML base
  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Octavos de Final</h3>
    <div class="puntuacion-info">
      ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
      Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
      Aciertas solo quién gana → <strong>1 punto</strong>. 
      En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
      <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
    </div>
    <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
      <button id="scrollOctavosLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
      <div id="octavosCarousel" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px;"></div>
      <button id="scrollOctavosRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;

  container.innerHTML = html;
  const carousel = document.getElementById("octavosCarousel");

  // Generar tarjetas
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
    const hasPrediction = !!pred.pred_local;
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    const radiosId = `radios_oct_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    const tarjetaHTML = `
      <div class="knockout-card" data-partido-octavos="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Partido ${partido.numero}</div>
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg">
            <span>${fifaCodes[partido.local] || partido.local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg">
            <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
          </div>
        </div>
        <div class="prediction-area">
          <input type="number" id="oct_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
          <span class="score-separator">-</span>
          <input type="number" id="oct_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
        </div>
        <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
          <label><input type="radio" name="oct_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="oct_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
          🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
        </div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);
  }

  // Botones de scroll
  const leftBtn = document.getElementById("scrollOctavosLeft");
  const rightBtn = document.getElementById("scrollOctavosRight");
  if (leftBtn && rightBtn) {
    leftBtn.onclick = () => carousel.scrollBy({ left: -340, behavior: "smooth" });
    rightBtn.onclick = () => carousel.scrollBy({ left: 340, behavior: "smooth" });
  }

  // Listeners para radios en empate (octavos)
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    if (isKnockoutClosed) continue;
    const localInput = document.getElementById(`oct_local_${partido.numero}`);
    const visitInput = document.getElementById(`oct_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_oct_${partido.numero}`);
    if (localInput && visitInput && radiosDiv) {
      const updateRadios = () => {
        const localVal = parseInt(localInput.value);
        const visitVal = parseInt(visitInput.value);
        if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
          radiosDiv.style.display = "flex";
        } else {
          radiosDiv.style.display = "none";
        }
      };
      localInput.addEventListener("input", updateRadios);
      visitInput.addEventListener("input", updateRadios);
      updateRadios();
    }
  }

  // ======================================================
  // REACTIVIDAD: cuando cambien los inputs de octavos, actualizar cuartos, semifinales, final, tercero
  // ======================================================
  // Función para calcular clasificados de octavos (debe estar definida antes)
  if (typeof calcularClasificadosOctavos === 'function') {
    // Definimos los handlers aquí mismo (para evitar dependencia externa)
    // En realidad, llamamos a una función externa que debe existir.
    configurarReactividadOctavos();
  } else {
    console.warn("La función calcularClasificadosOctavos o configurarReactividadOctavos no está definida. La reactividad de octavos no funcionará.");
  }

  // Restaurar scroll
  if (carousel && scrollPos > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carousel.scrollLeft = scrollPos;
      });
    });
  }
}
let timeoutIdCuart = null;

function calcularClasificadosCuartos() {
  const clasificados = {};
  for (let i = 97; i <= 100; i++) {
    const localInput = document.getElementById(`cuartos_local_${i}`);
    const visitInput = document.getElementById(`cuartos_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) continue;
    const card = document.querySelector(`[data-partido-cuartos="${i}"]`);
    if (!card) continue;
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;
    if (local > visit) clasificados[i] = equipoLocal;
    else if (visit > local) clasificados[i] = equipoVisit;
    else {
      const radioName = `cuartos_clasificado_${i}`;
      const radioSelected = card.querySelector(`input[name="${radioName}"]:checked`);
      if (radioSelected) clasificados[i] = radioSelected.value;
    }
  }
  return clasificados;
}

function configurarReactividadCuartos() {
  for (let i = 97; i <= 100; i++) {
    const localInput = document.getElementById(`cuartos_local_${i}`);
    const visitInput = document.getElementById(`cuartos_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const updateHandler = () => {
      if (timeoutIdCuart) clearTimeout(timeoutIdCuart);
      timeoutIdCuart = setTimeout(async () => {
        clasificadosEnMemoria.cuartos = calcularClasificadosCuartos();
        await generarSemifinales(true);
        await generarFinal(true);
        await generarTercerPuesto(true);
      }, 300);
    };
    localInput.addEventListener("input", updateHandler);
    visitInput.addEventListener("input", updateHandler);
    const radiosDiv = document.getElementById(`radios_cuartos_${i}`);
    if (radiosDiv) {
      radiosDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener("change", updateHandler);
      });
    }
  }
}
// ======================================================
// GENERAR CUARTOS AUTOMÁTICOS (CARRUSEL HORIZONTAL)
// ======================================================
async function generarCuartos(usarMemoria = false) {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("cuartosContainer");
  if (!container) return;

  let scrollPos = 0;
  const oldCarousel = document.getElementById("carouselCuartos");
  if (oldCarousel) scrollPos = oldCarousel.scrollLeft;

  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });

  let clasificados = {};
  if (usarMemoria && Object.keys(clasificadosEnMemoria.octavos).length > 0) {
    clasificados = clasificadosEnMemoria.octavos;
  } else {
    const octavosQuery = query(collection(db, "predictions_octavos"), where("uid", "==", currentUser.uid));
    const octavosSnap = await getDocs(octavosQuery);
    octavosSnap.forEach(doc => {
      const data = doc.data();
      clasificados[data.partido] = data.clasificado;
    });
  }

  const partidos = [
    { numero: 97, local: clasificados[89] || "Ganador 89", visitante: clasificados[90] || "Ganador 90" },
    { numero: 98, local: clasificados[91] || "Ganador 91", visitante: clasificados[92] || "Ganador 92" },
    { numero: 99, local: clasificados[93] || "Ganador 93", visitante: clasificados[94] || "Ganador 94" },
    { numero: 100, local: clasificados[95] || "Ganador 95", visitante: clasificados[96] || "Ganador 96" }
  ];

  const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
  const cuartosSnap = await getDocs(cuartosQuery);
  const predicciones = {};
  cuartosSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Cuartos de Final</h3>
    <div class="puntuacion-info">...</div>
    <div class="grupos-tabs-wrapper">
      <button id="scrollCuartosLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
      <div id="carouselCuartos" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px;"></div>
      <button id="scrollCuartosRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;

  container.innerHTML = html;
  const carousel = document.getElementById("carouselCuartos");

  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
    const hasPrediction = !!pred.pred_local;
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    const radiosId = `radios_cuartos_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    const tarjetaHTML = `
  <div class="knockout-card" data-partido-cuartos="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
    <div class="knockout-match-number">Partido ${partido.numero}</div>
    <div class="match-teams">
      <div class="team-row">
        <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg">
        <span>${fifaCodes[partido.local] || partido.local}</span>
      </div>
      <div class="vs-text">VS</div>
      <div class="team-row">
        <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg">
        <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
      </div>
    </div>
    <div class="prediction-area">
      <input type="number" id="cuartos_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
      <span class="score-separator">-</span>
      <input type="number" id="cuartos_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
    </div>
    <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
      <label><input type="radio" name="cuartos_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
      <label><input type="radio" name="cuartos_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
    </div>
    <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
      🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
    </div>
    <div class="match-date">📅 ${fechaLocal}</div>
  </div>
`;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);
  }

    // Botones de scroll
  const leftBtn = document.getElementById("scrollCuartosLeft");
  const rightBtn = document.getElementById("scrollCuartosRight");
  if (leftBtn && rightBtn) {
    leftBtn.onclick = () => carousel.scrollBy({ left: -340, behavior: "smooth" });
    rightBtn.onclick = () => carousel.scrollBy({ left: 340, behavior: "smooth" });
  }

  // 👇 NUEVO: Listeners para mostrar radios en empate (CUARTOS)
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    if (isKnockoutClosed) continue;
    
    const localInput = document.getElementById(`cuartos_local_${partido.numero}`);
    const visitInput = document.getElementById(`cuartos_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_cuartos_${partido.numero}`);
    
    if (localInput && visitInput && radiosDiv) {
      const updateRadios = () => {
        const localVal = parseInt(localInput.value);
        const visitVal = parseInt(visitInput.value);
        if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
          radiosDiv.style.display = "flex";
        } else {
          radiosDiv.style.display = "none";
        }
      };
      localInput.addEventListener("input", updateRadios);
      visitInput.addEventListener("input", updateRadios);
      updateRadios(); // Ejecutar inmediatamente para mostrar si ya hay empate
    }
  }

  // Reactividad para cuartos -> semifinales, final, tercero
  if (typeof configurarReactividadCuartos === 'function') {
    configurarReactividadCuartos();
  } else {
    console.warn("configurarReactividadCuartos no definida. La reactividad de cuartos no funcionará.");
  }

  // Restaurar scroll
  if (carousel && scrollPos > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carousel.scrollLeft = scrollPos;
      });
    });
  }
}

let timeoutIdSemis = null;

function calcularClasificadosSemifinales() {
  const clasificados = {};
  for (let i = 101; i <= 102; i++) {
    const localInput = document.getElementById(`semis_local_${i}`);
    const visitInput = document.getElementById(`semis_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) continue;
    const card = document.querySelector(`[data-partido-semis="${i}"]`);
    if (!card) continue;
    const equipoLocal = card.dataset.local;
    const equipoVisit = card.dataset.visitante;
    if (local > visit) clasificados[i] = equipoLocal;
    else if (visit > local) clasificados[i] = equipoVisit;
    else {
      const radioName = `semis_clasificado_${i}`;
      const radioSelected = card.querySelector(`input[name="${radioName}"]:checked`);
      if (radioSelected) clasificados[i] = radioSelected.value;
    }
  }
  return clasificados;
}

function configurarReactividadSemifinales() {
  for (let i = 101; i <= 102; i++) {
    const localInput = document.getElementById(`semis_local_${i}`);
    const visitInput = document.getElementById(`semis_visit_${i}`);
    if (!localInput || !visitInput) continue;
    const updateHandler = () => {
      if (timeoutIdSemis) clearTimeout(timeoutIdSemis);
      timeoutIdSemis = setTimeout(async () => {
        clasificadosEnMemoria.semifinales = calcularClasificadosSemifinales();
        await generarFinal(true);
        await generarTercerPuesto(true);
      }, 300);
    };
    localInput.addEventListener("input", updateHandler);
    visitInput.addEventListener("input", updateHandler);
    const radiosDiv = document.getElementById(`radios_semis_${i}`);
    if (radiosDiv) {
      radiosDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener("change", updateHandler);
      });
    }
  }
}
// ======================================================
// GENERAR SEMIFINALES (CARRUSEL HORIZONTAL)
// ======================================================
async function generarSemifinales(usarMemoria = false) {
  await actualizarEstadoCierreEliminatorias();
  const container = document.getElementById("semifinalContainer");
  if (!container) return;
  // 👇 Guardar scroll
  let scrollPos = 0;
  const oldCarousel = document.getElementById("carouselSemis");
  if (oldCarousel) scrollPos = oldCarousel.scrollLeft;

  // ==========================================

  // Cargar resultados de knockout
  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => { resultadosMap[doc.data().numero] = doc.data(); });

  // Obtener clasificados de cuartos
  let clasificados = {};
  if (usarMemoria && Object.keys(clasificadosEnMemoria.cuartos).length > 0) {
    clasificados = clasificadosEnMemoria.cuartos;
  } else {
    const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
    const cuartosSnap = await getDocs(cuartosQuery);
    cuartosSnap.forEach(doc => {
      clasificados[doc.data().partido] = doc.data().clasificado;
    });
  }

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

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Semifinales</h3>
    <div class="puntuacion-info">
      ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
      Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
      Aciertas solo quién gana → <strong>1 punto</strong>. 
      En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
      <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
    </div>
    <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
      <button id="scrollSemisLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
      <div id="carouselSemis" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px;"></div>
      <button id="scrollSemisRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;

  container.innerHTML = html;
  const carousel = document.getElementById("carouselSemis");

  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    //const isClosed = new Date() >= cierreApuestas;
    const isFinalizado = resultadosMap[partido.numero]?.finalizado === true;
    const disabled = isKnockoutClosed || isFinalizado;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
    const hasPrediction = !!pred.pred_local;
    const predLocal = pred.pred_local ?? "";
    const predVisit = pred.pred_visitante ?? "";
    const clasifGuardado = pred.clasificado ?? "";

    const radiosId = `radios_semis_${partido.numero}`;
    const showRadios = (predLocal === predVisit && predLocal !== "");

    const tarjetaHTML = `
      <div class="knockout-card" data-partido-semis="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}">
        <div class="knockout-match-number">Semifinal ${partido.numero}</div>
        <div class="match-teams">
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg">
            <span>${fifaCodes[partido.local] || partido.local}</span>
          </div>
          <div class="vs-text">VS</div>
          <div class="team-row">
            <img class="flag-icon" src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg">
            <span>${fifaCodes[partido.visitante] || partido.visitante}</span>
          </div>
        </div>
        <div class="prediction-area">
          <input type="number" id="semis_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
          <span class="score-separator">-</span>
          <input type="number" id="semis_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
        </div>
        <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
          <label><input type="radio" name="semis_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
          <label><input type="radio" name="semis_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
        </div>
        
        <div class="match-timer" data-cierre="${horaPartido.toISOString()}">
  🕒 Partido comienza en: <span class="timer-value">${formatearTiempoRestante(horaPartido)}</span>
</div>
        <div class="match-date">📅 ${fechaLocal}</div>
      </div>
    `;
    carousel.insertAdjacentHTML('beforeend', tarjetaHTML);
  }

  const leftBtn = document.getElementById("scrollSemisLeft");
  const rightBtn = document.getElementById("scrollSemisRight");
  if (leftBtn && rightBtn) {
    leftBtn.onclick = () => carousel.scrollBy({ left: -340, behavior: "smooth" });
    rightBtn.onclick = () => carousel.scrollBy({ left: 340, behavior: "smooth" });
  }

   // Listeners para radios en empate (semifinales)
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    if (isKnockoutClosed) continue;

    const localInput = document.getElementById(`semis_local_${partido.numero}`);
    const visitInput = document.getElementById(`semis_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_semis_${partido.numero}`);
    if (localInput && visitInput && radiosDiv) {
      const updateRadios = () => {
        const localVal = parseInt(localInput.value);
        const visitVal = parseInt(visitInput.value);
        if (!isNaN(localVal) && !isNaN(visitVal) && localVal === visitVal) {
          radiosDiv.style.display = "flex";
        } else {
          radiosDiv.style.display = "none";
        }
      };
      localInput.addEventListener("input", updateRadios);
      visitInput.addEventListener("input", updateRadios);
      updateRadios();
    }
  }
  // Reactividad para semifinales -> final y tercer puesto
if (typeof configurarReactividadSemifinales === 'function') {
  configurarReactividadSemifinales();
} else {
  console.warn("configurarReactividadSemifinales no definida. La reactividad de semifinales no funcionará.");
}

  // Restaurar scroll
  if (carousel && scrollPos > 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carousel.scrollLeft = scrollPos;
      });
    });
  }
} // <-- Una sola llave
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

    const fechaInicioMundial = new Date("2026-06-11T00:00:00-05:00");
    const now = new Date();
    const registeredAfterGroups = now > fechaInicioMundial;

    await setDoc(
      doc(db, "participants", cred.user.uid),
      {
        uid: cred.user.uid,
        // Grupos
        paid_groups: false,
        amount_groups: 0,
        groups_status: "pending",
        enabled_groups: false,
        submitted_groups_at: null,
        // Knockout
        paid_knockout: false,
        amount_knockout: 0,
        knockout_status: "pending",
        enabled_knockout: false,
        // Metadato
        registered_after_groups: registeredAfterGroups,
        created_at: serverTimestamp()
      }
    );
    // 👇 NUEVO CÓDIGO: Crear documentos en rankings con 0 puntos
    const rankingRef = doc(db, "ranking", cred.user.uid);
    await setDoc(rankingRef, {
      user_id: cred.user.uid,
      puntos: 0,
      updated_at: serverTimestamp()
    });

    const rankingKORef = doc(db, "ranking_knockout", cred.user.uid);
    await setDoc(rankingKORef, {
      user_id: cred.user.uid,
      puntos: 0,
      updated_at: serverTimestamp()
    });
    // 👆 FIN NUEVO CÓDIGO

    alert("✅ Registro exitoso. Ahora inicia sesión.");
  } catch (error) {
    alert(error.message);
  }
};

document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
};
// ======================================================
// PREMIOS Y ACUMULADO EN TIEMPO REAL (excluyendo admin y duplicados)
// ======================================================
function loadPrizePoolRealtime() {
  if (participantsUnsubscribe) participantsUnsubscribe();

  const participantsRef = collection(db, "participants");

  participantsUnsubscribe = onSnapshot(participantsRef, async (snapshot) => {
    // Usamos Map para evitar duplicados por uid
    const participantesUnicos = new Map(); // key = uid, value = datos del participant

    for (const docSnap of snapshot.docs) {
      const participant = docSnap.data();
      const uid = participant.uid;
      if (!uid) continue;

      // Obtener rol del usuario (solo una vez por uid)
      let userRol = null;
      try {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) userRol = userSnap.data().rol;
      } catch (e) {
        console.warn(`Error al obtener rol de ${uid}:`, e);
      }

      // Excluir administradores
      if (userRol === "admin") continue;

      // Si ya tenemos este uid en el Map, no lo agregamos de nuevo (evita duplicados)
      if (!participantesUnicos.has(uid)) {
        participantesUnicos.set(uid, participant);
      }
    }

    // Ahora recorremos los participantes únicos y no admin
    let totalGrupos = 0, acumuladoGrupos = 0;
    let totalKO = 0, acumuladoKO = 0;

    for (const participant of participantesUnicos.values()) {
      if (participant.paid_groups === true) {
        totalGrupos++;
        acumuladoGrupos += Number(participant.amount_groups || 0);
      }
      if (participant.paid_knockout === true) {
        totalKO++;
        acumuladoKO += Number(participant.amount_knockout || 0);
      }
    }

    // Actualizar elementos de grupos
    const gruposTotal = document.getElementById("totalParticipantesGrupos");
    const gruposAcumulado = document.getElementById("totalAcumuladoGrupos");
    const gruposPrimer = document.getElementById("premioGruposPrimer");
    const gruposAdmin = document.getElementById("premioGruposAdmin");
    const gruposPlataforma = document.getElementById("premioGruposPlataforma");

    if (gruposTotal) gruposTotal.innerText = totalGrupos;
    if (gruposAcumulado) gruposAcumulado.innerText = formatearCOP(acumuladoGrupos);
    if (gruposPrimer) gruposPrimer.innerText = formatearCOP(acumuladoGrupos * 0.75);
    if (gruposAdmin) gruposAdmin.innerText = formatearCOP(acumuladoGrupos * 0.15);
    if (gruposPlataforma) gruposPlataforma.innerText = formatearCOP(acumuladoGrupos * 0.1);

    // Actualizar elementos de knockout
    const koTotal = document.getElementById("totalParticipantesKO");
    const koAcumulado = document.getElementById("totalAcumuladoKO");
    const koPrimer = document.getElementById("premioKOPrimer");
    const koAdmin = document.getElementById("premioKOAdmin");
    const koPlataforma = document.getElementById("premioKOPlataforma");

    if (koTotal) koTotal.innerText = totalKO;
    if (koAcumulado) koAcumulado.innerText = formatearCOP(acumuladoKO);
    if (koPrimer) koPrimer.innerText = formatearCOP(acumuladoKO * 0.75);
    if (koAdmin) koAdmin.innerText = formatearCOP(acumuladoKO * 0.15);
    if (koPlataforma) koPlataforma.innerText = formatearCOP(acumuladoKO * 0.1);
  });
}
// ======================================================
// ADMIN PARTICIPANTES (con filtro y dos pollas)
// ======================================================

// Función auxiliar para escapar HTML
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ======================================================
// FUNCIONES ADMIN PARA GRUPOS (originales)
// ======================================================
window.togglePago = async (uid) => {
  const participantRef = doc(db, "participants", uid);
  const snap = await getDoc(participantRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const nuevoEstado = !data.paid_groups;
  await updateDoc(participantRef, {
    paid_groups: nuevoEstado,
    amount_groups: nuevoEstado ? 35000 : 0,
    groups_status: nuevoEstado ? "approved" : "pending"
  });
};

window.toggleHabilitado = async (uid) => {
  const participantRef = doc(db, "participants", uid);
  const snap = await getDoc(participantRef);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(participantRef, {
    enabled_groups: !data.enabled_groups
  });
};

window.toggleExpulsado = async (uid) => {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(userRef, {
    expulsado: !data.expulsado
  });
};

// ======================================================
// FUNCIONES ADMIN PARA KNOCKOUT
// ======================================================
window.togglePagoKO = async (uid) => {
  const participantRef = doc(db, "participants", uid);
  const snap = await getDoc(participantRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const nuevoEstado = !data.paid_knockout;
  await updateDoc(participantRef, {
    paid_knockout: nuevoEstado,
    amount_knockout: nuevoEstado ? 35000 : 0,
    knockout_status: nuevoEstado ? "approved" : "pending"
  });
};

window.toggleHabilitadoKO = async (uid) => {
  const participantRef = doc(db, "participants", uid);
  const snap = await getDoc(participantRef);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(participantRef, {
    enabled_knockout: !data.enabled_knockout
  });
};


/// ======================================================
// RESET DE PRUEBAS PARA KNOCKOUT (CON REINICIO DE PUNTOS)
// ======================================================
window.resetearPruebasKnockout = async () => {
  if (!confirm("⚠️ ¿Eliminar TODAS las predicciones de knockout y reiniciar resultados reales? Esta acción no se puede deshacer.")) return;

  // 1. Borrar predicciones de knockout (todas las fases)
  const colecciones = [
    "predictions_knockout",
    "predictions_octavos",
    "predictions_cuartos",
    "predictions_semifinales",
    "predictions_final",
    "predictions_third"
  ];

  for (const col of colecciones) {
    try {
      const snapshot = await getDocs(collection(db, col));
      if (snapshot.empty) continue;
      const batch = writeBatch(db);
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (error) {
      console.error(`Error eliminando documentos de ${col}:`, error);
    }
  }

  // 2. Reiniciar resultados reales de knockout
  const resultadosRef = collection(db, "knockout_results");
  try {
    const resultadosSnapshot = await getDocs(resultadosRef);
    if (!resultadosSnapshot.empty) {
      const batchResults = writeBatch(db);
      resultadosSnapshot.forEach(doc => {
        batchResults.update(doc.ref, {
          resultado_local: null,
          resultado_visitante: null,
          clasificado_real: null,
          finalizado: false
        });
      });
      await batchResults.commit();
    }
  } catch (error) {
    console.warn("No se pudo acceder a knockout_results", error);
  }

  // 3. 👇 NUEVO: Reiniciar puntos en ranking_knockout a cero
  const rankingKOSnap = await getDocs(collection(db, "ranking_knockout"));
  const batchKO = writeBatch(db);
  rankingKOSnap.forEach(doc => {
    batchKO.update(doc.ref, { puntos: 0, updated_at: serverTimestamp() });
  });
  await batchKO.commit();

  alert("✅ Predicciones de knockout eliminadas, resultados reales reiniciados y puntos KO a cero.");
  location.reload();
};
// ======================================================
// RESET DE PRUEBAS PARA GRUPOS
// ======================================================
window.resetearPruebasGrupos = async () => {
  if (!confirm("⚠️ ¿Eliminar TODAS las predicciones de grupos y reiniciar resultados reales? Esta acción no se puede deshacer.")) return;

  const snapshot = await getDocs(collection(db, "predictions_groups"));
  const batch = writeBatch(db);
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  const matchesSnap = await getDocs(query(collection(db, "matches"), where("fase", "==", "grupos")));
  const batchMatches = writeBatch(db);
  matchesSnap.forEach(doc => {
    batchMatches.update(doc.ref, {
      resultado_local: null,
      resultado_visitante: null,
      estado: "pendiente",
      puntos_calculados: false
    });
  });
  await batchMatches.commit();
  // 3. 👇 NUEVO: Reiniciar puntos en ranking global a cero
  const rankingSnap = await getDocs(collection(db, "ranking"));
  const batchRanking = writeBatch(db);
  rankingSnap.forEach(doc => {
    batchRanking.update(doc.ref, { puntos: 0, updated_at: serverTimestamp() });
  });
  await batchRanking.commit();

  alert("✅ Predicciones de grupos eliminadas y resultados reiniciados.");
  location.reload();
};

//MODAL
async function cargarPuntosUsuarioSidebar() {
  const contenedorGrupos = document.getElementById("contenedorGruposPuntos");
  const contenedorElim = document.getElementById("contenedorElimPuntos");
  const tabGrupos = document.getElementById("tabGruposPuntos");
  const tabElim = document.getElementById("tabElimPuntos");
  const subpestanasDiv = document.getElementById("subpestanasGrupos");
  const tablaGruposDiv = document.getElementById("tablaGruposPuntos");
  const tablaElimDiv = document.getElementById("tablaElimPuntos");
  if (!contenedorGrupos) return;

  tablaGruposDiv.innerHTML = "<p>Cargando...</p>";
  tablaElimDiv.innerHTML = "<p>Cargando...</p>";

  try {
    // ---- GRUPOS ----
    const groupsSnap = await getDocs(query(collection(db, "predictions_groups"), where("uid", "==", currentUser.uid)));
    const partidosPorGrupo = {};
    for (const docSnap of groupsSnap.docs) {
      const pred = docSnap.data();
      const matchDoc = await getDoc(doc(db, "matches", pred.match_id));
      if (!matchDoc.exists()) continue;
      const match = matchDoc.data();
      if (match.estado !== "finalizado") continue;
      const grupo = match.grupo;
      if (!partidosPorGrupo[grupo]) partidosPorGrupo[grupo] = [];
      partidosPorGrupo[grupo].push({
        local: match.equipo_local,
        visitante: match.equipo_visitante,
        predLocal: pred.pred_local,
        predVisit: pred.pred_visitante,
        realLocal: match.resultado_local,
        realVisit: match.resultado_visitante,
        puntos: pred.points || 0
      });
    }
    const gruposOrdenados = Object.keys(partidosPorGrupo).sort();
    subpestanasDiv.innerHTML = '';
    gruposOrdenados.forEach(grupo => {
      const btn = document.createElement('button');
      btn.textContent = `Grupo ${grupo}`;
      btn.className = 'subpestana-grupo';
      btn.dataset.grupo = grupo;
      btn.onclick = () => mostrarTablaGrupo(grupo, partidosPorGrupo[grupo]);
      subpestanasDiv.appendChild(btn);
    });
    if (gruposOrdenados.length > 0) mostrarTablaGrupo(gruposOrdenados[0], partidosPorGrupo[gruposOrdenados[0]]);

    function mostrarTablaGrupo(grupo, partidos) {
      let html = `<table class="tabla-puntos-compacta"><thead><tr><th>Partido</th><th>Pred</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
      for (const p of partidos) {
        const localCode = fifaCodes[p.local] || p.local.substring(0, 3);
        const visitCode = fifaCodes[p.visitante] || p.visitante.substring(0, 3);
        const localFlag = obtenerCodigoPais(p.local);
        const visitFlag = obtenerCodigoPais(p.visitante);
        html += `<tr>
          <td><img class="flag-mini" src="https://flagcdn.com/${localFlag}.svg"> ${localCode} vs <img class="flag-mini" src="https://flagcdn.com/${visitFlag}.svg"> ${visitCode}</td>
          <td>${p.predLocal}-${p.predVisit}</td>
          <td>${p.realLocal}-${p.realVisit}</td>
          <td class="punto-badge">${p.puntos}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
      tablaGruposDiv.innerHTML = html;
      document.querySelectorAll('.subpestana-grupo').forEach(btn => {
        if (btn.dataset.grupo === grupo) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    // ---- ELIMINATORIAS ----
    let htmlElim = `<table class="tabla-puntos-compacta"><thead><tr><th>Fase</th><th>Partido</th><th>Pred</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
    const fasesKO = [
      { col: "predictions_knockout", nombre: "16" },
      { col: "predictions_octavos", nombre: "8" },
      { col: "predictions_cuartos", nombre: "4" },
      { col: "predictions_semifinales", nombre: "2" },
      { col: "predictions_final", nombre: "F" },
      { col: "predictions_third", nombre: "3º" }
    ];
    for (const fase of fasesKO) {
      const snap = await getDocs(query(collection(db, fase.col), where("uid", "==", currentUser.uid)));
      for (const docSnap of snap.docs) {
        const pred = docSnap.data();
        const realDoc = await getDoc(doc(db, "knockout_results", pred.partido.toString()));
        if (!realDoc.exists()) continue;
        const real = realDoc.data();
        if (!real.finalizado) continue;
        htmlElim += `<tr>
          <td>${fase.nombre}</td>
          <td>P${pred.partido}</td>
          <td>${pred.pred_local}-${pred.pred_visitante}</td>
          <td>${real.resultado_local}-${real.resultado_visitante}</td>
          <td class="punto-badge">${pred.points || 0}</td>
        </tr>`;
      }
    }
    htmlElim += `</tbody></table>`;
    tablaElimDiv.innerHTML = htmlElim || "<p>Sin partidos de eliminatorias finalizados.</p>";

    // Cambio de pestañas
    tabGrupos.onclick = () => {
      tabGrupos.classList.add('active');
      tabElim.classList.remove('active');
      contenedorGrupos.style.display = 'block';
      contenedorElim.style.display = 'none';
    };
    tabElim.onclick = () => {
      tabElim.classList.add('active');
      tabGrupos.classList.remove('active');
      contenedorElim.style.display = 'block';
      contenedorGrupos.style.display = 'none';
    };
    contenedorGrupos.style.display = 'block';
    contenedorElim.style.display = 'none';
  } catch (error) {
    console.error(error);
    tablaGruposDiv.innerHTML = "<p>Error al cargar puntos.</p>";
  }
}
// ======================================================
// NUEVA AUDITORÍA PARA ADMIN (con pestañas como usuario)
// ======================================================
async function cargarUsuariosParaAuditoriaAdmin() {
  const select = document.getElementById("selectUserAuditAdmin");
  if (!select) return;
  const usersSnap = await getDocs(collection(db, "users"));
  select.innerHTML = '<option value="">-- Seleccione un usuario --</option>';
  usersSnap.forEach(doc => {
    const user = doc.data();
    // Excluir al administrador (rol "admin")
    if (user.rol !== "admin") {
      select.innerHTML += `<option value="${user.uid}">${user.nombre} (${user.email})</option>`;
    }
  });
}

async function cargarPuntosAuditoriaAdmin(uid) {
  const contenedorGrupos = document.getElementById("contenedorGruposAuditoria");
  const contenedorElim = document.getElementById("contenedorElimAuditoria");
  const tabGrupos = document.getElementById("tabGruposAuditoria");
  const tabElim = document.getElementById("tabElimAuditoria");
  const subpestanasDiv = document.getElementById("subpestanasGruposAuditoria");
  const tablaGruposDiv = document.getElementById("tablaGruposAuditoria");
  const tablaElimDiv = document.getElementById("tablaElimAuditoria");

  if (!contenedorGrupos || !tablaGruposDiv) return;

  tablaGruposDiv.innerHTML = "<p>Cargando puntos del usuario...</p>";
  tablaElimDiv.innerHTML = "<p>Cargando...</p>";

  try {
    // ---- GRUPOS ----
    const groupsSnap = await getDocs(query(collection(db, "predictions_groups"), where("uid", "==", uid)));
    const partidosPorGrupo = {};
    for (const docSnap of groupsSnap.docs) {
      const pred = docSnap.data();
      const matchDoc = await getDoc(doc(db, "matches", pred.match_id));
      if (!matchDoc.exists()) continue;
      const match = matchDoc.data();
      if (match.estado !== "finalizado") continue;
      const grupo = match.grupo;
      if (!partidosPorGrupo[grupo]) partidosPorGrupo[grupo] = [];
      partidosPorGrupo[grupo].push({
        local: match.equipo_local,
        visitante: match.equipo_visitante,
        predLocal: pred.pred_local,
        predVisit: pred.pred_visitante,
        realLocal: match.resultado_local,
        realVisit: match.resultado_visitante,
        puntos: pred.points || 0
      });
    }
    const gruposOrdenados = Object.keys(partidosPorGrupo).sort();
    subpestanasDiv.innerHTML = '';
    gruposOrdenados.forEach(grupo => {
      const btn = document.createElement('button');
      btn.textContent = `Grupo ${grupo}`;
      btn.className = 'subpestana-grupo';
      btn.dataset.grupo = grupo;
      btn.onclick = () => mostrarTablaGrupo(grupo, partidosPorGrupo[grupo]);
      subpestanasDiv.appendChild(btn);
    });
    if (gruposOrdenados.length > 0) mostrarTablaGrupo(gruposOrdenados[0], partidosPorGrupo[gruposOrdenados[0]]);

    function mostrarTablaGrupo(grupo, partidos) {
      let html = `<table class="tabla-puntos-compacta"><thead><tr><th>Partido</th><th>Pred</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
      for (const p of partidos) {
        const localCode = fifaCodes[p.local] || p.local.substring(0, 3);
        const visitCode = fifaCodes[p.visitante] || p.visitante.substring(0, 3);
        const localFlag = obtenerCodigoPais(p.local);
        const visitFlag = obtenerCodigoPais(p.visitante);
        html += `<tr>
          <td><img class="flag-mini" src="https://flagcdn.com/${localFlag}.svg"> ${localCode} vs <img class="flag-mini" src="https://flagcdn.com/${visitFlag}.svg"> ${visitCode}</td>
          <td>${p.predLocal}-${p.predVisit}</td>
          <td>${p.realLocal}-${p.realVisit}</td>
          <td class="punto-badge">${p.puntos}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
      tablaGruposDiv.innerHTML = html;
      document.querySelectorAll('#subpestanasGruposAuditoria .subpestana-grupo').forEach(btn => {
        if (btn.dataset.grupo === grupo) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    // ---- ELIMINATORIAS ----
    let htmlElim = `<table class="tabla-puntos-compacta"><thead><tr><th>Fase</th><th>Partido</th><th>Pred</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
    const fasesKO = [
      { col: "predictions_knockout", nombre: "16" },
      { col: "predictions_octavos", nombre: "8" },
      { col: "predictions_cuartos", nombre: "4" },
      { col: "predictions_semifinales", nombre: "2" },
      { col: "predictions_final", nombre: "F" },
      { col: "predictions_third", nombre: "3º" }
    ];
    for (const fase of fasesKO) {
      const snap = await getDocs(query(collection(db, fase.col), where("uid", "==", uid)));
      for (const docSnap of snap.docs) {
        const pred = docSnap.data();
        const realDoc = await getDoc(doc(db, "knockout_results", pred.partido.toString()));
        if (!realDoc.exists()) continue;
        const real = realDoc.data();
        if (!real.finalizado) continue;
        htmlElim += `<tr>
          <td>${fase.nombre}</td>
          <td>P${pred.partido}</td>
          <td>${pred.pred_local}-${pred.pred_visitante}</td>
          <td>${real.resultado_local}-${real.resultado_visitante}</td>
          <td class="punto-badge">${pred.points || 0}</td>
        </tr>`;
      }
    }
    htmlElim += `</tbody></table>`;
    tablaElimDiv.innerHTML = htmlElim || "<p>Sin partidos de eliminatorias finalizados.</p>";

    // Cambio de pestañas
    if (tabGrupos && tabElim) {
      tabGrupos.onclick = () => {
        tabGrupos.classList.add('active');
        tabElim.classList.remove('active');
        contenedorGrupos.style.display = 'block';
        contenedorElim.style.display = 'none';
      };
      tabElim.onclick = () => {
        tabElim.classList.add('active');
        tabGrupos.classList.remove('active');
        contenedorElim.style.display = 'block';
        contenedorGrupos.style.display = 'none';
      };
    }
    contenedorGrupos.style.display = 'block';
    contenedorElim.style.display = 'none';
  } catch (error) {
    console.error(error);
    tablaGruposDiv.innerHTML = "<p>Error al cargar puntos.</p>";
  }
}

async function inicializarAuditoriaAdmin() {
  const select = document.getElementById("selectUserAuditAdmin");
  if (!select) return;
  await cargarUsuariosParaAuditoriaAdmin();
  select.addEventListener("change", (e) => {
    const uid = e.target.value;
    if (uid) {
      cargarPuntosAuditoriaAdmin(uid);
    } else {
      document.getElementById("tablaGruposAuditoria").innerHTML = "<p>Seleccione un usuario para ver sus puntos.</p>";
      document.getElementById("tablaElimAuditoria").innerHTML = "";
    }
  });
}
// ======================================================
// AGREGAR BOTONES DE RESET (GRUPOS Y KNOCKOUT) EN EL PANEL ADMIN
// ======================================================
function agregarBotonesReset() {
  setTimeout(() => {
    const adminBottom = document.querySelector(".admin-bottom-actions");
    if (!adminBottom) return;

    // Botón reset grupos
    if (!document.getElementById("btnResetGrupos")) {
      const btnGrupos = document.createElement("button");
      btnGrupos.id = "btnResetGrupos";
      btnGrupos.textContent = "🧹 Resetear pruebas GRUPOS";
      btnGrupos.className = "admin-load-btn";
      btnGrupos.style.background = "linear-gradient(90deg, #dc2626, #b91c1c)";
      btnGrupos.onclick = window.resetearPruebasGrupos;
      adminBottom.appendChild(btnGrupos);
    }

    // Botón reset knockout
    if (!document.getElementById("btnResetKnockout")) {
      const btnKnockout = document.createElement("button");
      btnKnockout.id = "btnResetKnockout";
      btnKnockout.textContent = "🧹 Resetear pruebas KO";
      btnKnockout.className = "admin-load-btn";
      btnKnockout.style.background = "linear-gradient(90deg, #dc2626, #b91c1c)";
      btnKnockout.onclick = window.resetearPruebasKnockout;
      adminBottom.appendChild(btnKnockout);
    }
  }, 500);
}

// ======================================================
// RENDERIZADO DE LISTA DE PARTICIPANTES (con buscador dual)
// ======================================================
let participantesGlobal = []; // almacenar participantes actualizados
let gridContainer = null;
let searchInput = null;

function loadAdminParticipants() {
  if (adminParticipantsUnsubscribe) adminParticipantsUnsubscribe();

  const adminList = document.getElementById("adminParticipantsList");
  if (!adminList) return;

  // Construir la estructura base solo una vez
  if (!gridContainer) {
    adminList.innerHTML = `<div class="admin-search-bar" style="margin-bottom: 20px;">
      <input type="text" id="searchParticipante" placeholder="🔍 Buscar por nombre o email..." style="width: 100%; padding: 12px; border-radius: 30px; border: none; background: #1e293b; color: white;">
    </div>`;
    searchInput = document.getElementById("searchParticipante");
    gridContainer = document.createElement("div");
    gridContainer.className = "admin-participants-grid";
    adminList.appendChild(gridContainer);
  }

  // Función para renderizar la grid según filtro
  const renderGrid = (filtro = "") => {
    const filtroLower = filtro.toLowerCase();
    const filtrados = participantesGlobal.filter(p =>
      p.nombre.toLowerCase().includes(filtroLower) ||
      p.email.toLowerCase().includes(filtroLower)
    );
    let html = "";
    for (const p of filtrados) {
      const paidGroupsBadge = p.participant.paid_groups ? `<span class="admin-badge badge-paid">PAGÓ GRUPOS</span>` : `<span class="admin-badge badge-pending">NO PAGÓ GRUPOS</span>`;
      const enabledGroupsBadge = p.participant.enabled_groups ? `<span class="admin-badge badge-enabled">HABILITADO GRUPOS</span>` : `<span class="admin-badge badge-disabled">BLOQUEADO GRUPOS</span>`;
      const paidKOBadge = p.paid_knockout ? `<span class="admin-badge badge-paid">PAGÓ KO</span>` : `<span class="admin-badge badge-pending">NO PAGÓ KO</span>`;
      const enabledKOBadge = p.enabled_knockout ? `<span class="admin-badge badge-enabled">HABILITADO KO</span>` : `<span class="admin-badge badge-disabled">BLOQUEADO KO</span>`;
      const expulsadoBadge = p.expulsado ? `<span class="admin-badge badge-pending">EXPULSADO</span>` : "";

      html += `
        <div class="admin-user-card" data-uid="${p.uid}">
          <div class="admin-user-top">
            <div>
              <div class="admin-user-name">${escapeHtml(p.nombre)}</div>
              <div class="admin-user-email">${escapeHtml(p.email)}</div>
            </div>
          </div>
          <div class="admin-user-status">
            ${paidGroupsBadge}
            ${enabledGroupsBadge}
            ${paidKOBadge}
            ${enabledKOBadge}
            ${expulsadoBadge}
          </div>
          <div style="margin-top:14px;">💰 Pago Grupos: <strong>${formatearCOP(p.participant.amount_groups || 0)}</strong></div>
          <div style="margin-top:8px;">📋 Estado Grupos: <strong>${p.participant.groups_status || "pending"}</strong></div>
          <div style="margin-top:8px;">💰 Pago KO: <strong>${formatearCOP(p.amount_knockout)}</strong></div>
          <div style="margin-top:8px;">📋 Estado KO: <strong>${p.knockout_status}</strong></div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
            <button class="admin-action-btn" onclick="window.togglePago('${p.uid}')">💰 Pago Grupos</button>
            <button class="admin-action-btn" onclick="window.toggleHabilitado('${p.uid}')">🔓 Acceso Grupos</button>
            <button class="admin-action-btn" onclick="window.togglePagoKO('${p.uid}')">💰 Pago KO</button>
            <button class="admin-action-btn" onclick="window.toggleHabilitadoKO('${p.uid}')">🔓 Acceso KO</button>
            <button class="admin-action-btn danger" onclick="window.toggleExpulsado('${p.uid}')">🚫 Expulsar</button>
          </div>
        </div>
      `;
    }
    gridContainer.innerHTML = html;
  };

  // Suscripción a cambios en participantes (solo actualiza participantesGlobal y vuelve a renderizar con el filtro actual)
  const participantsRef = collection(db, "participants");
  adminParticipantsUnsubscribe = onSnapshot(participantsRef, async (snapshot) => {
    participantesGlobal = [];
    for (const docSnap of snapshot.docs) {
      const participant = docSnap.data();
      const uid = participant.uid;
      const userSnap = await getDoc(doc(db, "users", uid));
      let nombre = "Sin nombre", email = "Sin email", expulsado = false;
      if (userSnap.exists()) {
        nombre = userSnap.data().nombre || "Sin nombre";
        email = userSnap.data().email || "Sin email";
        expulsado = userSnap.data().expulsado || false;
      }
      const paid_knockout = participant.paid_knockout === true;
      const enabled_knockout = participant.enabled_knockout === true;
      const knockout_status = participant.knockout_status || "pending";
      const amount_knockout = participant.amount_knockout || 0;
      participantesGlobal.push({
        uid, participant, nombre, email, expulsado,
        paid_knockout, enabled_knockout, knockout_status, amount_knockout
      });
    }
    // Re-renderizar con el filtro actual (si searchInput tiene valor, úsalo)
    const filtroActual = searchInput ? searchInput.value : "";
    renderGrid(filtroActual);
  });

  // Vincular evento del buscador una sola vez
  if (searchInput && !searchInput.hasListener) {
    searchInput.addEventListener("input", (e) => renderGrid(e.target.value));
    searchInput.hasListener = true;
  }
}
// ======================================================
// FORMATEAR MONEDA COP
// ======================================================
function formatearCOP(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(valor);
}

// ======================================================
// GESTIÓN DE MEJORES TERCEROS (MANUAL)
// ======================================================

// Obtiene la tabla de terceros de todos los grupos basada en resultados reales finalizados
async function obtenerTercerosConEstadisticas() {
  const matchesSnap = await getDocs(collection(db, "matches"));
  const grupos = { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, H: {}, I: {}, J: {}, K: {}, L: {} };

  // Inicializar
  for (let g of Object.keys(grupos)) {
    grupos[g] = {};
  }

  // Acumular estadísticas
  matchesSnap.forEach(docSnap => {
    const match = docSnap.data();
    if (match.fase !== "grupos") return;
    const grupo = match.grupo;
    if (!grupos[grupo]) return;
    const equipos = [match.equipo_local, match.equipo_visitante];
    equipos.forEach(e => {
      if (!grupos[grupo][e]) {
        grupos[grupo][e] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
      }
    });
    if (match.estado !== "finalizado") return;
    const local = grupos[grupo][match.equipo_local];
    const visit = grupos[grupo][match.equipo_visitante];
    const gl = Number(match.resultado_local);
    const gv = Number(match.resultado_visitante);
    local.pj++; visit.pj++;
    local.gf += gl; local.gc += gv;
    visit.gf += gv; visit.gc += gl;
    local.dg = local.gf - local.gc;
    visit.dg = visit.gf - visit.gc;
    if (gl > gv) {
      local.pg++; local.pts += 3;
      visit.pp++;
    } else if (gv > gl) {
      visit.pg++; visit.pts += 3;
      local.pp++;
    } else {
      local.pe++; visit.pe++;
      local.pts++; visit.pts++;
    }
  });

  // Extraer terceros (posición 3) de cada grupo
  const terceros = [];
  for (let grupo in grupos) {
    const tabla = Object.values(grupos[grupo]);
    tabla.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
    if (tabla[2]) {
      terceros.push({
        grupo,
        equipo: tabla[2].equipo,
        pts: tabla[2].pts,
        dg: tabla[2].dg,
        gf: tabla[2].gf
      });
    }
  }
  return terceros;
}

// Cargar y renderizar el panel de administración de terceros
async function cargarAdminTerceros() {
  const container = document.getElementById("tercerosAdminContainer");
  if (!container) return;

  // Obtener lista de terceros con estadísticas
  const tercerosList = await obtenerTercerosConEstadisticas();
  // Obtener asignación guardada previamente
  const asignacionDoc = await getDoc(doc(db, "settings", "terceros_asignacion"));
  let asignacion = asignacionDoc.exists() ? asignacionDoc.data() : {};

  // Los partidos que necesitan un tercero
  const partidosTerceros = [
    { numero: 74, label: "Partido 74 (1E vs ?)" },
    { numero: 77, label: "Partido 77 (1I vs ?)" },
    { numero: 79, label: "Partido 79 (1A vs ?)" },
    { numero: 80, label: "Partido 80 (1L vs ?)" },
    { numero: 81, label: "Partido 81 (1D vs ?)" },
    { numero: 82, label: "Partido 82 (1G vs ?)" },
    { numero: 85, label: "Partido 85 (1B vs ?)" },
    { numero: 87, label: "Partido 87 (1K vs ?)" }
  ];

  // Tabla de equipos terceros (para selección)
  let html = `<div class="admin-terceros-controls" style="margin-bottom: 20px;">
    <h4>📌 Selecciona los 8 equipos que pasan (máximo 8)</h4>
    <div style="overflow-x: auto;">
    <table class="tabla-posiciones" style="width:100%;">
      <thead>
        <tr><th>Grupo</th><th>Equipo</th><th>PTS</th><th>DG</th><th>GF</th><th>Seleccionar</th></tr>
      </thead>
      <tbody>`;

  const seleccionadosPrev = asignacion.equiposSeleccionados || [];
  for (const t of tercerosList) {
    const checked = seleccionadosPrev.includes(t.equipo) ? "checked" : "";
    const nombreCorto = fifaCodes[t.equipo] || t.equipo.substring(0, 3).toUpperCase();
    html += `
      <tr>
        <td>${t.grupo}</td>
        <td>${nombreCorto}</td>
        <td>${t.pts}</td>
        <td>${t.dg}</td>
        <td>${t.gf}</td>
        <td><input type="checkbox" class="tercero-checkbox" value="${t.equipo}" ${checked}></td>
      </tr>`;
  }
  html += `</tbody></table>
    </div>`;

  // Sección de asignación a partidos
  html += `<div style="margin-top: 30px;">
    <h4>🎯 Asignar los equipos seleccionados a cada partido</h4>
    <p class="terceros-info" style="color:#facc15;">Selecciona primero los 8 equipos arriba, luego elige para cada partido qué equipo jugará como tercero.</p>
    <div class="admin-terceros-partidos" style="display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-top: 15px;">`;

  for (const p of partidosTerceros) {
    const valorActual = asignacion[p.numero] || "";
    html += `
      <div>
        <label>${p.label}</label>
        <select id="tercero_partido_${p.numero}" class="admin-select" style="width:100%; padding:6px; border-radius:12px; background:#1e293b; color:white;">
          <option value="">-- Ninguno / Pendiente --</option>
          ${tercerosList.map(t => {
      const nombreCorto = fifaCodes[t.equipo] || t.equipo.substring(0, 3).toUpperCase();
      return `<option value="${t.equipo}" ${valorActual === t.equipo ? "selected" : ""}>${nombreCorto}</option>`;
    }).join('')}
        </select>
      </div>`;
  }
  html += `</div></div>
    <div style="margin-top: 20px; display: flex; gap: 12px;">
      <button id="btnGuardarAsignacionTerceros" class="admin-load-btn" style="background: #15803d;">💾 Guardar asignación</button>
    </div>
  </div>`;
  container.innerHTML = html;

  // Lógica para limitar checkboxes a 8 selecciones
  const checkboxes = document.querySelectorAll(".tercero-checkbox");
  const updateSelectOptions = () => {
    const seleccionados = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    // Actualizar los dropdowns para mostrar solo los equipos seleccionados
    for (const p of partidosTerceros) {
      const select = document.getElementById(`tercero_partido_${p.numero}`);
      if (select) {
        const valorActual = select.value;
        // Limpiar opciones excepto la primera
        while (select.options.length > 1) select.remove(1);
        for (const eq of seleccionados) {
          const option = document.createElement("option");
          option.value = eq;
          option.textContent = eq;
          if (eq === valorActual) option.selected = true;
          select.appendChild(option);
        }
      }
    }
  };

  const updateLimit = () => {
    const checked = document.querySelectorAll(".tercero-checkbox:checked");
    if (checked.length >= 8) {
      checkboxes.forEach(cb => { if (!cb.checked) cb.disabled = true; });
    } else {
      checkboxes.forEach(cb => cb.disabled = false);
    }
    updateSelectOptions();
  };

  checkboxes.forEach(cb => cb.addEventListener("change", updateLimit));
  updateLimit();

  // Botón guardar asignación
  const btnGuardar = document.getElementById("btnGuardarAsignacionTerceros");
  if (btnGuardar) {
    btnGuardar.onclick = async () => {
      const seleccionados = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      if (seleccionados.length !== 8) {
        alert("Debes seleccionar exactamente 8 equipos.");
        return;
      }
      const asignacionMap = {};
      for (const p of partidosTerceros) {
        const select = document.getElementById(`tercero_partido_${p.numero}`);
        if (select && select.value) {
          asignacionMap[p.numero] = select.value;
        } else {
          alert(`Debes asignar un equipo al ${p.label}`);
          return;
        }
      }
      await setDoc(doc(db, "settings", "terceros_asignacion"), {
        equiposSeleccionados: seleccionados,
        ...asignacionMap,
        actualizado: serverTimestamp()
      });
      alert("✅ Asignación de terceros guardada. Los dieciseisavos se actualizarán.");
      generarDieciseisavos(); // Refrescar bracket
    };
  }
}


// ======================================================
// ADMIN PANEL: RESULTADOS REALES DE KNOCKOUT (VERSIÓN COMPLETA)
// ======================================================
async function loadAdminKnockoutMatches() {
  const container = document.getElementById("adminKnockoutMatchesList");
  if (!container) return;

  // Asegurar que los clasificados de grupos estén listos
  if (Object.keys(clasificadosGlobales).length === 0) {
    await generarTablaGrupos();
  }

  // Obtener resultados reales
  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => {
    const data = doc.data();
    resultadosMap[data.numero] = data;
  });

  // Obtener asignación de terceros
  let tercerosMap = {};
  try {
    const asignacionDoc = await getDoc(doc(db, "settings", "terceros_asignacion"));
    if (asignacionDoc.exists()) tercerosMap = asignacionDoc.data();
  } catch (e) { }

  // Definir partidos de dieciseisavos (igual que en generarDieciseisavos)
  const partidosDieciseisavos = [
    { num: 73, local: clasificadosGlobales["2A"] || "2A", visit: clasificadosGlobales["2B"] || "2B" },
    { num: 74, local: clasificadosGlobales["1E"] || "1E", visit: tercerosMap[74] || "Tercero" },
    { num: 75, local: clasificadosGlobales["1F"] || "1F", visit: clasificadosGlobales["2C"] || "2C" },
    { num: 76, local: clasificadosGlobales["1C"] || "1C", visit: clasificadosGlobales["2F"] || "2F" },
    { num: 77, local: clasificadosGlobales["1I"] || "1I", visit: tercerosMap[77] || "Tercero" },
    { num: 78, local: clasificadosGlobales["2E"] || "2E", visit: clasificadosGlobales["2I"] || "2I" },
    { num: 79, local: clasificadosGlobales["1A"] || "1A", visit: tercerosMap[79] || "Tercero" },
    { num: 80, local: clasificadosGlobales["1L"] || "1L", visit: tercerosMap[80] || "Tercero" },
    { num: 81, local: clasificadosGlobales["1D"] || "1D", visit: tercerosMap[81] || "Tercero" },
    { num: 82, local: clasificadosGlobales["1G"] || "1G", visit: tercerosMap[82] || "Tercero" },
    { num: 83, local: clasificadosGlobales["2K"] || "2K", visit: clasificadosGlobales["2L"] || "2L" },
    { num: 84, local: clasificadosGlobales["1H"] || "1H", visit: clasificadosGlobales["2J"] || "2J" },
    { num: 85, local: clasificadosGlobales["1B"] || "1B", visit: tercerosMap[85] || "Tercero" },
    { num: 86, local: clasificadosGlobales["1J"] || "1J", visit: clasificadosGlobales["2H"] || "2H" },
    { num: 87, local: clasificadosGlobales["1K"] || "1K", visit: tercerosMap[87] || "Tercero" },
    { num: 88, local: clasificadosGlobales["2D"] || "2D", visit: clasificadosGlobales["2G"] || "2G" }
  ];

  // Mapa estático de enfrentamientos para fases superiores
  const mapaPartidos = {
    89: { local: "Ganador 74", visit: "Ganador 77" },
    90: { local: "Ganador 73", visit: "Ganador 75" },
    91: { local: "Ganador 76", visit: "Ganador 78" },
    92: { local: "Ganador 79", visit: "Ganador 80" },
    93: { local: "Ganador 83", visit: "Ganador 84" },
    94: { local: "Ganador 81", visit: "Ganador 82" },
    95: { local: "Ganador 86", visit: "Ganador 88" },
    96: { local: "Ganador 85", visit: "Ganador 87" },
    97: { local: "Ganador 89", visit: "Ganador 90" },
    98: { local: "Ganador 91", visit: "Ganador 92" },
    99: { local: "Ganador 93", visit: "Ganador 94" },
    100: { local: "Ganador 95", visit: "Ganador 96" },
    101: { local: "Ganador 97", visit: "Ganador 98" },
    102: { local: "Ganador 99", visit: "Ganador 100" },
    104: { local: "Ganador 101", visit: "Ganador 102" },
    103: { local: "Perdedor 101", visit: "Perdedor 102" }
  };

  // Función recursiva para obtener el nombre real del equipo que avanzó
  const obtenerGanadorReal = (numPartido) => {
    const res = resultadosMap[numPartido];
    if (!res) return `Ganador ${numPartido}`;
    let avanza = null;
    if (res.finalizado && res.clasificado_real) {
      avanza = res.clasificado_real;
    } else if (res.resultado_local !== null && res.resultado_visitante !== null) {
      if (res.resultado_local > res.resultado_visitante) avanza = "local";
      else if (res.resultado_visitante > res.resultado_local) avanza = "visitante";
      else if (res.clasificado_real) avanza = res.clasificado_real;
    }
    if (!avanza) return `Ganador ${numPartido}`;

    let local = null, visit = null;
    let partidoBase = partidosDieciseisavos.find(p => p.num === numPartido);
    if (!partidoBase) {
      partidoBase = mapaPartidos[numPartido];
      if (!partidoBase) return `Ganador ${numPartido}`;
      local = partidoBase.local;
      visit = partidoBase.visit;
    } else {
      local = partidoBase.local;
      visit = partidoBase.visit;
    }

    const resolver = (nombre) => {
      if (!nombre) return "???";
      if (nombre.startsWith("Ganador")) {
        const num = parseInt(nombre.split(" ")[1]);
        return obtenerGanadorReal(num);
      }
      if (nombre.startsWith("Perdedor")) {
        const num = parseInt(nombre.split(" ")[1]);
        const ganador = obtenerGanadorReal(num);
        const partidoOrig = partidosDieciseisavos.find(p => p.num === num) || mapaPartidos[num];
        if (partidoOrig) {
          const otro = (ganador === partidoOrig.local) ? partidoOrig.visit : partidoOrig.local;
          return otro;
        }
        return `Perdedor ${num}`;
      }
      return nombre;
    };

    const localReal = resolver(local);
    const visitReal = resolver(visit);
    return avanza === "local" ? localReal : visitReal;
  };
  // Función para obtener el nombre real del equipo que PERDIÓ (para tercer puesto)
  const obtenerPerdedorReal = (numPartido) => {
    const res = resultadosMap[numPartido];
    if (!res) return `Por definir`;
    let avanza = null;
    if (res.finalizado && res.clasificado_real) {
      avanza = res.clasificado_real;
    } else if (res.resultado_local !== null && res.resultado_visitante !== null) {
      if (res.resultado_local > res.resultado_visitante) avanza = "local";
      else if (res.resultado_visitante > res.resultado_local) avanza = "visitante";
      else if (res.clasificado_real) avanza = res.clasificado_real;
    }
    if (!avanza) return `Por definir`;

    // Obtener los equipos que jugaron ese partido
    let local = null, visit = null;
    let partidoBase = partidosDieciseisavos.find(p => p.num === numPartido);
    if (!partidoBase) {
      partidoBase = mapaPartidos[numPartido];
      if (!partidoBase) return `Por definir`;
      local = partidoBase.local;
      visit = partidoBase.visit;
    } else {
      local = partidoBase.local;
      visit = partidoBase.visit;
    }
    // Resolver nombres reales (por si son "Ganador X")
    const resolver = (nombre) => {
      if (!nombre) return "???";
      if (nombre.startsWith("Ganador")) {
        const num = parseInt(nombre.split(" ")[1]);
        return obtenerGanadorReal(num);
      }
      if (nombre.startsWith("Perdedor")) {
        const num = parseInt(nombre.split(" ")[1]);
        const ganador = obtenerGanadorReal(num);
        const partidoOrig = partidosDieciseisavos.find(p => p.num === num) || mapaPartidos[num];
        if (partidoOrig) {
          const otro = (ganador === partidoOrig.local) ? partidoOrig.visit : partidoOrig.local;
          return otro;
        }
        return `Por definir`;
      }
      return nombre;
    };
    const localReal = resolver(local);
    const visitReal = resolver(visit);
    // El perdedor es el que NO avanzó
    return avanza === "local" ? visitReal : localReal;
  };

  // Construir todas las fases
  const partidosOctavos = [
    { num: 89, local: obtenerGanadorReal(74), visit: obtenerGanadorReal(77) },
    { num: 90, local: obtenerGanadorReal(73), visit: obtenerGanadorReal(75) },
    { num: 91, local: obtenerGanadorReal(76), visit: obtenerGanadorReal(78) },
    { num: 92, local: obtenerGanadorReal(79), visit: obtenerGanadorReal(80) },
    { num: 93, local: obtenerGanadorReal(83), visit: obtenerGanadorReal(84) },
    { num: 94, local: obtenerGanadorReal(81), visit: obtenerGanadorReal(82) },
    { num: 95, local: obtenerGanadorReal(86), visit: obtenerGanadorReal(88) },
    { num: 96, local: obtenerGanadorReal(85), visit: obtenerGanadorReal(87) }
  ];

  const partidosCuartos = [
    { num: 97, local: obtenerGanadorReal(89), visit: obtenerGanadorReal(90) },
    { num: 98, local: obtenerGanadorReal(91), visit: obtenerGanadorReal(92) },
    { num: 99, local: obtenerGanadorReal(93), visit: obtenerGanadorReal(94) },
    { num: 100, local: obtenerGanadorReal(95), visit: obtenerGanadorReal(96) }
  ];

  const partidosSemis = [
    { num: 101, local: obtenerGanadorReal(97), visit: obtenerGanadorReal(98) },
    { num: 102, local: obtenerGanadorReal(99), visit: obtenerGanadorReal(100) }
  ];

  const partidoFinal = { num: 104, local: obtenerGanadorReal(101), visit: obtenerGanadorReal(102) };
  const partidoTercero = {
    num: 103,
    local: obtenerPerdedorReal(101),
    visit: obtenerPerdedorReal(102)
  };


  const nombreCorto = (nombre) => {
    if (!nombre || nombre === "Tercero") return "TBD";
    const codigo = fifaCodes[nombre];
    return codigo ? codigo : nombre.substring(0, 3).toUpperCase();
  };

  const fases = [
    { nombre: "Dieciseisavos", partidos: partidosDieciseisavos },
    { nombre: "Octavos", partidos: partidosOctavos },
    { nombre: "Cuartos", partidos: partidosCuartos },
    { nombre: "Semifinales", partidos: partidosSemis },
    { nombre: "Final", partidos: [partidoFinal] },
    { nombre: "Tercer puesto", partidos: [partidoTercero] }
  ];

  let html = `<div class="admin-knockout-section"><h3 class="admin-section-title">🗡️ Resultados Eliminatorias</h3>`;
  for (const fase of fases) {
    html += `
      <div class="admin-knockout-fase" style="margin-bottom: 40px;">
        <div class="admin-group-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <span>${fase.nombre}</span>
          <div class="carousel-nav" style="display: flex; gap: 10px;">
            <button class="carousel-btn-left" data-fase="${fase.nombre}">◀</button>
            <button class="carousel-btn-right" data-fase="${fase.nombre}">▶</button>
          </div>
        </div>
        <div id="carousel-${fase.nombre.replace(/\s/g, '')}" class="admin-knockout-carousel" style="display: flex; overflow-x: auto; gap: 12px; padding-bottom: 10px;">
    `;
    for (const p of fase.partidos) {
      const resultado = resultadosMap[p.num] || { resultado_local: null, resultado_visitante: null, clasificado_real: null };
      const localCorto = nombreCorto(p.local);
      const visitCorto = nombreCorto(p.visit);
      html += `
        <div class="admin-card" data-partido="${p.num}" style="min-width: 280px; flex-shrink: 0;">
          <div class="admin-teams" style="display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <img src="https://flagcdn.com/${obtenerCodigoPais(p.local)}.svg" width="20" onerror="this.style.display='none'">
              <span style="font-weight: bold; font-size: 0.9rem;">${localCorto}</span>
            </div>
            <span style="font-size:1rem;">VS</span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <img src="https://flagcdn.com/${obtenerCodigoPais(p.visit)}.svg" width="20" onerror="this.style.display='none'">
              <span style="font-weight: bold; font-size: 0.9rem;">${visitCorto}</span>
            </div>
          </div>
          <div class="admin-score" style="display:flex; justify-content:center; gap:8px;">
            <input type="number" id="res_ko_local_${p.num}" class="admin-input" placeholder="0" value="${resultado.resultado_local !== null ? resultado.resultado_local : ''}" style="width:50px; text-align:center;">
            <span>-</span>
            <input type="number" id="res_ko_visit_${p.num}" class="admin-input" placeholder="0" value="${resultado.resultado_visitante !== null ? resultado.resultado_visitante : ''}" style="width:50px; text-align:center;">
          </div>
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:5px; margin-top:8px;">
            <select id="clasificado_ko_${p.num}" style="flex:2; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:4px; font-size:0.7rem;">
              <option value="">Empate→?</option>
              <option value="local" ${resultado.clasificado_real === "local" ? "selected" : ""}>${localCorto}</option>
              <option value="visitante" ${resultado.clasificado_real === "visitante" ? "selected" : ""}>${visitCorto}</option>
            </select>
            <button class="admin-btn" onclick="window.guardarResultadoKnockout(${p.num})" style="padding:4px 8px;">Guardar</button>
            <button class="admin-btn finalizar-btn" onclick="window.finalizarPartidoKnockout(${p.num})" style="padding:4px 8px;">Finalizar</button>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  container.innerHTML = html;

  // Conectar botones de scroll
  for (const fase of fases) {
    const carouselId = `carousel-${fase.nombre.replace(/\s/g, '')}`;
    const carousel = document.getElementById(carouselId);
    if (!carousel) continue;
    const leftBtn = document.querySelector(`.carousel-btn-left[data-fase="${fase.nombre}"]`);
    const rightBtn = document.querySelector(`.carousel-btn-right[data-fase="${fase.nombre}"]`);
    if (leftBtn) leftBtn.onclick = () => carousel.scrollBy({ left: -300, behavior: "smooth" });
    if (rightBtn) rightBtn.onclick = () => carousel.scrollBy({ left: 300, behavior: "smooth" });
  }
}
window.guardarResultadoKnockout = async (numeroPartido) => {
  const btn = event.currentTarget;
  const originalText = btn.innerText;
  btn.innerText = "💾 Guardando...";
  btn.classList.add("saving");
  try {
    const localInput = document.getElementById(`res_ko_local_${numeroPartido}`);
    const visitInput = document.getElementById(`res_ko_visit_${numeroPartido}`);
    const clasificadoSelect = document.getElementById(`clasificado_ko_${numeroPartido}`);
    if (!localInput || !visitInput) throw new Error("Inputs no encontrados");

    const local = parseInt(localInput.value);
    const visit = parseInt(visitInput.value);
    if (isNaN(local) || isNaN(visit)) throw new Error("Ingresa números válidos");

    const clasificado = clasificadoSelect ? clasificadoSelect.value : null;

    const resultadoRef = doc(db, "knockout_results", numeroPartido.toString());
    const resultadoSnap = await getDoc(resultadoRef);
    if (!resultadoSnap.exists()) {
      await setDoc(resultadoRef, {
        numero: numeroPartido,
        resultado_local: local,
        resultado_visitante: visit,
        clasificado_real: clasificado,
        finalizado: false
      });
    } else {
      await updateDoc(resultadoRef, {
        resultado_local: local,
        resultado_visitante: visit,
        clasificado_real: clasificado
      });
    }
    btn.innerText = "✅ Guardado";
    setTimeout(() => {
      btn.innerText = "Guardar";
      btn.classList.remove("saving");
    }, 1500);
  } catch (error) {
    btn.innerText = "❌ Error";
    setTimeout(() => {
      btn.innerText = "Guardar";
      btn.classList.remove("saving");
    }, 2000);
    alert(error.message);
  }
};

window.finalizarPartidoKnockout = async (numeroPartido) => {
  const btn = event.currentTarget;
  btn.innerText = "⌛ Finalizando...";
  btn.disabled = true;
  try {
    let fase = "";
    if (numeroPartido <= 88) fase = "dieciseisavos";
    else if (numeroPartido <= 96) fase = "octavos";
    else if (numeroPartido <= 100) fase = "cuartos";
    else if (numeroPartido <= 102) fase = "semifinales";
    else if (numeroPartido === 104) fase = "final";
    else if (numeroPartido === 103) fase = "tercer_puesto";
    else throw new Error("Partido no válido");

    const resultadoRef = doc(db, "knockout_results", numeroPartido.toString());
    const resultadoSnap = await getDoc(resultadoRef);
    if (!resultadoSnap.exists()) throw new Error("No hay resultado guardado aún. Guarda primero.");
    const data = resultadoSnap.data();
    if (data.resultado_local === null || data.resultado_visitante === null) throw new Error("Debes guardar el resultado primero.");

    await updateDoc(resultadoRef, { finalizado: true });
    await calcularPuntosKnockout(numeroPartido, fase);
    // 👇 REFRESCAR PUNTOS INMEDIATAMENTE
    await loadRankingKnockout();
    if (currentUser) {
      await cargarPuntosUsuarioSidebar();
      await generarDieciseisavos();
      await generarOctavos();
      await generarCuartos();
      await generarSemifinales();
      await generarFinal();
      await generarTercerPuesto();
    }
    btn.innerText = "✅ Finalizado";
    btn.classList.add("finalized");
    setTimeout(() => {
      loadAdminKnockoutMatches(); // refresca la vista
    }, 1500);
  } catch (error) {
    btn.innerText = "❌ Error";
    btn.disabled = false;
    alert(error.message);
  }
};
// ======================================================
// CÁLCULO DE PUNTOS PARA ELIMINATORIAS
// ======================================================
async function calcularPuntosKnockout(partidoNumero, fase) {
  let collectionName = "";
  if (fase === "dieciseisavos") collectionName = "predictions_knockout";
  else if (fase === "octavos") collectionName = "predictions_octavos";
  else if (fase === "cuartos") collectionName = "predictions_cuartos";
  else if (fase === "semifinales") collectionName = "predictions_semifinales";
  else if (fase === "final") collectionName = "predictions_final";
  else if (fase === "tercer_puesto") collectionName = "predictions_third";
  else return;

  const resultadoRef = doc(db, "knockout_results", partidoNumero.toString());
  const resultadoSnap = await getDoc(resultadoRef);
  if (!resultadoSnap.exists()) return;
  const resultado = resultadoSnap.data();
  const realLocal = resultado.resultado_local;
  const realVisit = resultado.resultado_visitante;
  const realEsEmpate = (realLocal === realVisit);
  let realClasificado = resultado.clasificado_real;
  if (!realClasificado) {
    realClasificado = realLocal > realVisit ? "local" : "visitante";
  }

  const prediccionesSnap = await getDocs(query(collection(db, collectionName), where("partido", "==", partidoNumero)));
  console.log(`📊 Procesando ${prediccionesSnap.size} predicciones para KO ${partidoNumero}`);

  const actualizarRankingConReintentos = async (uid, puntosAGanar, esKnockout = true) => {
    const coleccion = esKnockout ? "ranking_knockout" : "ranking";
    const rankingRef = doc(db, coleccion, uid);
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const rankingSnap = await getDoc(rankingRef);
        if (!rankingSnap.exists()) {
          await setDoc(rankingRef, { user_id: uid, puntos: puntosAGanar, updated_at: serverTimestamp() });
        } else {
          const rankingData = rankingSnap.data();
          await updateDoc(rankingRef, { puntos: (rankingData.puntos || 0) + puntosAGanar, updated_at: serverTimestamp() });
        }
        return true;
      } catch (err) {
        console.warn(`Intento ${intento} fallido para ${uid} en ${coleccion}:`, err);
        if (intento === 3) return false;
        await new Promise(r => setTimeout(r, 1000 * intento));
      }
    }
    return false;
  };

  let algunError = false;
  for (const docSnap of prediccionesSnap.docs) {
    const pred = docSnap.data();
    const uid = pred.uid;
    const predLocal = pred.pred_local;
    const predVisit = pred.pred_visitante;
    const predClasificado = pred.clasificado;

    let puntos = 0;
    const predEmpate = (predLocal === predVisit);
    const realEmpate = (realLocal === realVisit);
    const marcadorExacto = (predLocal === realLocal && predVisit === realVisit);

    if (marcadorExacto) {
      puntos = 3;
      // Si además es empate, se añade el punto por clasificado (total 4)
      if (realEmpate && predClasificado === realClasificado) {
        puntos += 1;
      }
    } else {
      if (predEmpate && realEmpate) {
        puntos = 1;
        if (predClasificado === realClasificado) puntos += 1;
      } else if (!predEmpate && !realEmpate) {
        const predGanador = predLocal > predVisit ? "local" : "visitante";
        const realGanador = realLocal > realVisit ? "local" : "visitante";
        if (predGanador === realGanador) puntos = 1;
      }
    }

    if (puntos > 0) {
      const okGlobal = await actualizarRankingConReintentos(uid, puntos, false);
      const okKO = await actualizarRankingConReintentos(uid, puntos, true);
      if (!okGlobal || !okKO) algunError = true;
    }
    // Marcar predicción como procesada
    try {
      await updateDoc(docSnap.ref, { points_assigned: true, points: puntos });
    } catch (err) {
      console.error(`Error marcando points_assigned para ${uid}:`, err);
      algunError = true;
    }
  }
  if (algunError) console.warn("⚠️ Algunas operaciones fallaron en knockout");
}
// ======================================================
// CREAR RANKING GLOBAL PARA TODOS LOS USUARIOS (grupos)
// ======================================================
async function crearRankingGlobalParaTodos() {
  const participantsSnap = await getDocs(collection(db, "participants"));
  const batch = writeBatch(db);
  let cambios = 0;
  for (const docSnap of participantsSnap.docs) {
    const uid = docSnap.id;
    // Verificar si el usuario es administrador
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists() && userSnap.data().rol === "admin") {
      continue; // Saltar al administrador
    }
    const rankingRef = doc(db, "ranking", uid);
    const rankingSnap = await getDoc(rankingRef);

    // Buscar documentos duplicados con el mismo user_id
    const duplicados = await getDocs(query(collection(db, "ranking"), where("user_id", "==", uid)));
    for (const dup of duplicados.docs) {
      if (dup.id !== uid) {
        batch.delete(dup.ref);
        cambios++;
      }
    }

    if (!rankingSnap.exists()) {
      batch.set(rankingRef, {
        user_id: uid,
        puntos: 0,
        updated_at: serverTimestamp()
      });
      cambios++;
    }
  }
  if (cambios > 0) await batch.commit();
  console.log(`✅ Creados/limpiados ${cambios} documentos en ranking global (excluyendo admin)`);
}
// ======================================================
// CREAR RANKING_KNOCKOUT PARA TODOS LOS USUARIOS HABILITADOS
// ======================================================
async function crearRankingKOparaTodos() {
  const participantsSnap = await getDocs(collection(db, "participants"));
  const batch = writeBatch(db);
  let cambios = 0;
  for (const docSnap of participantsSnap.docs) {
    const data = docSnap.data();
    if (data.enabled_knockout !== true) continue;
    const uid = data.uid;
    // Verificar si el usuario es administrador
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists() && userSnap.data().rol === "admin") {
      continue; // Saltar al administrador
    }
    const rankingRef = doc(db, "ranking_knockout", uid);
    const rankingSnap = await getDoc(rankingRef);

    // Buscar documentos duplicados con el mismo user_id
    const duplicados = await getDocs(query(collection(db, "ranking_knockout"), where("user_id", "==", uid)));
    for (const dup of duplicados.docs) {
      if (dup.id !== uid) {
        batch.delete(dup.ref);
        cambios++;
      }
    }

    if (!rankingSnap.exists()) {
      batch.set(rankingRef, {
        user_id: uid,
        puntos: 0,
        updated_at: serverTimestamp()
      });
      cambios++;
    }
  }
  if (cambios > 0) await batch.commit();
  console.log(`✅ Creados/limpiados ${cambios} documentos en ranking_knockout (excluyendo admin)`);
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
      agregarBotonesReset();
      loadAdminKnockoutMatches();
      cargarAdminTerceros();
      await crearRankingKOparaTodos();
      await crearRankingGlobalParaTodos();
      inicializarAuditoriaAdmin();
    } else {
      adminPanel.classList.add("hidden");
      cargarPuntosUsuarioSidebar();
    }

    loadMatchesAndPredictions();

    // ======================================================
    // INICIAR TEMPORIZADORES GLOBALES (UNA SOLA VEZ)
    // ======================================================
    if (!window.timerInterval) {
      window.timerInterval = setInterval(actualizarTodosLosTimers, 1000);
    }
    loadRanking();

    // Obtener datos del participante (UNA SOLA VEZ)
    const participantSnapKO = await getDoc(doc(db, "participants", currentUser.uid));
    const hasKOAccess = participantSnapKO.exists() && participantSnapKO.data().enabled_knockout === true;

    // Crear documento en ranking_knockout si tiene KO habilitado
    if (hasKOAccess) {
      const rankingKORef = doc(db, "ranking_knockout", currentUser.uid);
      const rankingKOSnap = await getDoc(rankingKORef);
      if (!rankingKOSnap.exists()) {
        await setDoc(rankingKORef, {
          user_id: currentUser.uid,
          puntos: 0,
          updated_at: serverTimestamp()
        });
        console.log("✅ Ranking KO creado para", currentUser.uid);
      }
    }

    // Limpiar posibles duplicados en ranking_knockout
    const rankingKODupQuery = query(collection(db, "ranking_knockout"), where("user_id", "==", currentUser.uid));
    const dupSnapshot = await getDocs(rankingKODupQuery);
    if (dupSnapshot.size > 1) {
      const batch = writeBatch(db);
      let primero = true;
      dupSnapshot.forEach(docSnap => {
        if (primero) { primero = false; }
        else { batch.delete(docSnap.ref); }
      });
      await batch.commit();
      console.log("✅ Duplicados de ranking KO limpiados para", currentUser.uid);
    }

    loadRankingKnockout();
    loadPrizePoolRealtime();

    // ======================================================
    // MOSTRAR / OCULTAR SECCIÓN ELIMINATORIAS SEGÚN ACCESO
    // ======================================================
    if (hasKOAccess) {
      // Tiene acceso: mostrar botones y carruseles, pero NO el menú de fases (debe ser controlado por el botón)
      const botonesDiv = document.getElementById("botonesEliminatorias");
      const mensajeAcceso = document.getElementById("knockoutAccessMessage");
      if (botonesDiv) botonesDiv.style.removeProperty("display");
      if (mensajeAcceso) mensajeAcceso.style.display = "none";

      const contenedores = ["bracketContainer", "octavosContainer", "cuartosContainer", "semifinalContainer", "finalContainer", "thirdPlaceContainer"];
      contenedores.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.removeProperty("display");
      });

      await generarOctavos();
      await generarCuartos();
      await generarSemifinales();
      await generarFinal();
      await generarTercerPuesto();
    } else {
      // No tiene acceso: ocultar botones, menú y carruseles, mostrar mensaje único
      const botonesDiv = document.getElementById("botonesEliminatorias");
      const menuDiv = document.getElementById("menuFases");
      const mensajeAcceso = document.getElementById("knockoutAccessMessage");
      if (botonesDiv) botonesDiv.style.display = "none";
      if (menuDiv) menuDiv.style.display = "none";
      if (mensajeAcceso) mensajeAcceso.style.removeProperty("display");

      const contenedores = ["bracketContainer", "octavosContainer", "cuartosContainer", "semifinalContainer", "finalContainer", "thirdPlaceContainer"];
      contenedores.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
      });
    }

  } else {
    // Limpiar listeners
    if (matchesUnsubscribe) matchesUnsubscribe();
    if (rankingUnsubscribe) rankingUnsubscribe();
    if (participantsUnsubscribe) participantsUnsubscribe();
    if (adminParticipantsUnsubscribe) adminParticipantsUnsubscribe();
    if (rankingInterval) clearInterval(rankingInterval);
    if (rankingIntervalKO) clearInterval(rankingIntervalKO);
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
      window.timerInterval = null;
    }
    authScreen.classList.add("hidden"); // Ocultar pantalla de autenticación
    appScreen.classList.add("hidden");
  }
});
// ======================================================
// BOTONES GLOBALES PARA ELIMINATORIAS (APUESTA ÚNICA)
// ======================================================

let isKnockoutClosed = false;

// Obtener deadline y actualizar estado
async function actualizarEstadoCierreEliminatorias() {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "config"));
    if (settingsSnap.exists()) {
      const deadline = settingsSnap.data().knockout_deadline?.toDate();
      isKnockoutClosed = deadline ? new Date() >= deadline : false;
    } else {
      isKnockoutClosed = false;
    }
    const btnGuardar = document.getElementById("btnGuardarTodasElim");
    const btnModificar = document.getElementById("btnModificarDesde");
    const btnBorrar = document.getElementById("btnBorrarTodoElim");
    if (isKnockoutClosed) {
      if (btnGuardar) btnGuardar.disabled = true;
      if (btnModificar) btnModificar.disabled = true;
      if (btnBorrar) btnBorrar.disabled = true;
    } else {
      if (btnGuardar) btnGuardar.disabled = false;
      if (btnModificar) btnModificar.disabled = false;
      if (btnBorrar) btnBorrar.disabled = false;
    }
  } catch (e) {
    console.warn("Error al obtener deadline eliminatorias", e);
  }
}

// Guardar todas las predicciones en batch
async function guardarTodasEliminatorias() {
  if (!currentUser) return alert("Debes iniciar sesión");
  if (isKnockoutClosed) return alert("La fase eliminatoria ya está cerrada. No se pueden guardar cambios.");

  const batch = writeBatch(db);
  const fases = [
    { contenedorId: "bracketContainer", coleccion: "predictions_knockout", fase: "dieciseisavos" },
    { contenedorId: "octavosContainer", coleccion: "predictions_octavos", fase: "octavos" },
    { contenedorId: "cuartosContainer", coleccion: "predictions_cuartos", fase: "cuartos" },
    { contenedorId: "semifinalContainer", coleccion: "predictions_semifinales", fase: "semifinales" },
    { contenedorId: "finalContainer", coleccion: "predictions_final", fase: "final" },
    { contenedorId: "thirdPlaceContainer", coleccion: "predictions_third", fase: "tercer_puesto" }
  ];

  let totalPartidos = 0;

  for (const fase of fases) {
    const container = document.getElementById(fase.contenedorId);
    if (!container) continue;
    const cards = container.querySelectorAll(".knockout-card");
    for (const card of cards) {
      let partidoNumero = null;
      if (card.dataset.partido) partidoNumero = card.dataset.partido;
      else if (card.dataset.partidoOctavos) partidoNumero = card.dataset.partidoOctavos;
      else if (card.dataset.partidoCuartos) partidoNumero = card.dataset.partidoCuartos;
      else if (card.dataset.partidoSemis) partidoNumero = card.dataset.partidoSemis;
      else if (card.dataset.partidoFinal) partidoNumero = card.dataset.partidoFinal;
      else if (card.dataset.partidoThird) partidoNumero = card.dataset.partidoThird;
      if (!partidoNumero) continue;

      const localInput = card.querySelector(`input[id$="local_${partidoNumero}"]`);
      const visitInput = card.querySelector(`input[id$="visit_${partidoNumero}"]`);
      if (!localInput || !visitInput) continue;

      const local = parseInt(localInput.value);
      const visit = parseInt(visitInput.value);
      if (isNaN(local) || isNaN(visit)) {
        return alert(`❌ Completa el marcador del partido ${partidoNumero}`);
      }

      const equipoLocal = card.dataset.local;
      const equipoVisit = card.dataset.visitante;
      let clasificado = null;
      if (local > visit) {
        clasificado = equipoLocal;
      } else if (visit > local) {
        clasificado = equipoVisit;
      } else {
        // Busca cualquier radio seleccionado dentro de la tarjeta
        let radioSelected = null;
        const radios = card.querySelectorAll('input[type="radio"]');
        for (let radio of radios) {
          if (radio.checked) {
            radioSelected = radio;
            break;
          }
        }
        if (!radioSelected) {
          return alert(`❌ En el partido ${partidoNumero} hay empate. Debes elegir quién clasifica.`);
        }
        clasificado = radioSelected.value;
      }

      const docId = `${currentUser.uid}_${partidoNumero}`;
      const ref = doc(db, fase.coleccion, docId);
      batch.set(ref, {
        uid: currentUser.uid,
        partido: Number(partidoNumero),
        pred_local: local,
        pred_visitante: visit,
        clasificado: clasificado,
        fase: fase.fase,
        updated_at: serverTimestamp()
      }, { merge: true });
      totalPartidos++;
    }
  }

  if (totalPartidos === 0) return alert("No hay partidos para guardar.");
  await batch.commit();
  alert(`✅ ${totalPartidos} predicciones guardadas correctamente.`);

  await generarDieciseisavos(false);
  await generarOctavos(false);
  await generarCuartos(false);
  await generarSemifinales(false);
  await generarFinal(false);
  await generarTercerPuesto(false);
}

// Borrar todas las predicciones localmente y en Firestore
async function borrarTodasEliminatorias() {
  if (!currentUser) return alert("Debes iniciar sesión");
  if (!confirm("⚠️ ¿Estás seguro? Se borrarán TODAS tus predicciones de eliminatorias. Esta acción no se puede deshacer.")) return;

  const colecciones = [
    "predictions_knockout",
    "predictions_octavos",
    "predictions_cuartos",
    "predictions_semifinales",
    "predictions_final",
    "predictions_third"
  ];

  const batch = writeBatch(db);
  for (const col of colecciones) {
    const q = query(collection(db, col), where("uid", "==", currentUser.uid));
    const snap = await getDocs(q);
    snap.forEach(docSnap => batch.delete(docSnap.ref));
  }
  await batch.commit();

  const contenedores = ["bracketContainer", "octavosContainer", "cuartosContainer", "semifinalContainer", "finalContainer", "thirdPlaceContainer"];
  for (const id of contenedores) {
    const container = document.getElementById(id);
    if (container) {
      const inputs = container.querySelectorAll('input.prediction-input');
      inputs.forEach(inp => inp.value = "");
      const radiosDivs = container.querySelectorAll('.knockout-radios');
      radiosDivs.forEach(div => div.style.display = "none");
    }
  }
  alert("✅ Todas tus predicciones de eliminatorias han sido eliminadas.");
  location.reload();
}

let menuVisible = false;
document.getElementById("btnModificarDesde")?.addEventListener("click", () => {
  const menu = document.getElementById("menuFases");
  if (menu) {
    menuVisible = !menuVisible;
    menu.style.display = menuVisible ? "block" : "none";
  }
});

document.querySelectorAll(".fase-opcion").forEach(btn => {
  btn.addEventListener("click", async () => {
    const fase = btn.dataset.fase;
    if (!fase) return;
    if (!confirm(`¿Borrar todas las predicciones desde ${fase} en adelante? Las fases anteriores no se modificarán.`)) return;

    const orden = { dieciseisavos: 1, octavos: 2, cuartos: 3, semifinales: 4, final: 5 };
    const faseSeleccionada = orden[fase];
    if (!faseSeleccionada) return;

    const fasesList = [
      { id: "bracketContainer", orden: 1 },
      { id: "octavosContainer", orden: 2 },
      { id: "cuartosContainer", orden: 3 },
      { id: "semifinalContainer", orden: 4 },
      { id: "finalContainer", orden: 5 },
      { id: "thirdPlaceContainer", orden: 6 }
    ];

    for (const f of fasesList) {
      if (f.orden >= faseSeleccionada) {
        const container = document.getElementById(f.id);
        if (container) {
          const inputs = container.querySelectorAll('input.prediction-input');
          inputs.forEach(inp => inp.value = "");
          const radiosDivs = container.querySelectorAll('.knockout-radios');
          radiosDivs.forEach(div => div.style.display = "none");
        }
      }
    }
    alert(`Se han borrado localmente las predicciones desde ${fase} en adelante. Completa los marcadores y guarda.`);
    const menu = document.getElementById("menuFases");
    if (menu) menu.style.display = "none";
    menuVisible = false;
  });
});

setTimeout(() => {
  actualizarEstadoCierreEliminatorias();
  iniciarContadorCierreEliminatorias();
  document.getElementById("btnGuardarTodasElim")?.addEventListener("click", guardarTodasEliminatorias);
  document.getElementById("btnBorrarTodoElim")?.addEventListener("click", borrarTodasEliminatorias);
}, 1000);

let knockoutDeadlineTimerInterval = null;

async function iniciarContadorCierreEliminatorias() {
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "config"));
    if (settingsSnap.exists()) {
      const deadlineDate = settingsSnap.data().knockout_deadline?.toDate();
      if (!deadlineDate) return;
      const timerElement = document.getElementById("knockoutDeadlineTimer");
      if (!timerElement) return;

      const actualizar = () => {
        const ahora = new Date();
        const diff = deadlineDate - ahora;
        if (diff <= 0) {
          timerElement.innerText = "🔒 Cierre de apuestas de eliminatorias ha finalizado";
          if (knockoutDeadlineTimerInterval) clearInterval(knockoutDeadlineTimerInterval);
          document.getElementById("btnGuardarTodasElim")?.setAttribute("disabled", "disabled");
          document.getElementById("btnModificarDesde")?.setAttribute("disabled", "disabled");
          document.getElementById("btnBorrarTodoElim")?.setAttribute("disabled", "disabled");
          return;
        }
        const segundosTotales = Math.floor(diff / 1000);
        const dias = Math.floor(segundosTotales / 86400);
        const horas = Math.floor((segundosTotales % 86400) / 3600);
        const minutos = Math.floor((segundosTotales % 3600) / 60);
        const segundos = segundosTotales % 60;
        let texto = "⏳ Tiempo restante para cerrar apuestas de eliminatorias: ";
        if (dias > 0) texto += `${dias}d `;
        if (horas > 0 || dias > 0) texto += `${horas}h `;
        texto += `${minutos}m ${segundos}s`;
        timerElement.innerText = texto;
      };
      actualizar();
      if (knockoutDeadlineTimerInterval) clearInterval(knockoutDeadlineTimerInterval);
      knockoutDeadlineTimerInterval = setInterval(actualizar, 1000);
    }
  } catch (e) {
    console.error("Error al cargar deadline de eliminatorias", e);
  }
}