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
let rankingUnsubscribeKO = null;
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
      partido: partidoNumero,
      pred_local: local,
      pred_visitante: visit,
      clasificado: clasificado,
      fase: "tercer_puesto",
      updated_at: serverTimestamp()
    }, { merge: true });

    alert("✅ Predicción guardada");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

// ======================================================
// GENERAR FINAL (CARRUSEL HORIZONTAL)
// ======================================================
async function generarFinal() {
  const container = document.getElementById("finalContainer");
  if (!container) return;

// ========== VALIDACIÓN DE ACCESO ==========
const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
  container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
    <h3>🔒 Acceso restringido</h3>
    <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
  </div>`;
  return;
}
// ==========================================

  const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
  const semisSnap = await getDocs(semisQuery);
  const clasificados = {};
  semisSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partido = { numero: 104, local: clasificados[101] || "Ganador 101", visitante: clasificados[102] || "Ganador 102" };

  const horaPartido = obtenerHoraPartidoKnockout(104);
  const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
  const disabled = new Date() >= cierreApuestas;
  const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

  const finalRef = doc(db, "predictions_final", `${currentUser.uid}_FINAL_104`);
  const finalSnap = await getDoc(finalRef);
  const pred = finalSnap.exists() ? finalSnap.data() : {};
  const predLocal = pred.pred_local ?? "";
  const predVisit = pred.pred_visitante ?? "";
  const clasifGuardado = pred.clasificado ?? "";

  const radiosId = `radios_final_${partido.numero}`;
  const showRadios = (predLocal === predVisit && predLocal !== "");

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

  const tarjetaHTML = `
    <div class="knockout-card" data-partido-final="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}" style="min-width: 340px;">
      <div class="knockout-match-number">Partido ${partido.numero} - FINAL</div>
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
        <input type="number" id="final_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
        <span class="score-separator">-</span>
        <input type="number" id="final_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
      </div>
      <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
        <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
        <label><input type="radio" name="final_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
      </div>
      <button class="btn-guardar" onclick="window.saveFinalPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
      <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
        ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
      </div>
      <div class="match-date">📅 ${fechaLocal}</div>
    </div>
  `;
  carousel.insertAdjacentHTML('beforeend', tarjetaHTML);

  // Listeners para radios
  if (!disabled) {
    const localInput = document.getElementById(`final_local_${partido.numero}`);
    const visitInput = document.getElementById(`final_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_final_${partido.numero}`);
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
}

// ======================================================
// GENERAR TERCER PUESTO (CARRUSEL HORIZONTAL)
// ======================================================
async function generarTercerPuesto() {
  const container = document.getElementById("thirdPlaceContainer");
  if (!container) return;

      // ========== VALIDACIÓN DE ACCESO ==========
const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
  container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
    <h3>🔒 Acceso restringido</h3>
    <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
  </div>`;
  return;
}
// ==========================================

  const semisQuery = query(collection(db, "predictions_semifinales"), where("uid", "==", currentUser.uid));
  const semisSnap = await getDocs(semisQuery);
  const clasificados = {};
  semisSnap.forEach(doc => {
    const data = doc.data();
    clasificados[data.partido] = data.clasificado;
  });

  const partido = {
    numero: 103,
    local: clasificados[101] ? `Perdedor ${clasificados[101]}` : "Perdedor 101",
    visitante: clasificados[102] ? `Perdedor ${clasificados[102]}` : "Perdedor 102"
  };

  const horaPartido = obtenerHoraPartidoKnockout(103);
  const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
  const disabled = new Date() >= cierreApuestas;
  const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

  const thirdRef = doc(db, "predictions_third", `${currentUser.uid}_THIRD_103`);
  const thirdSnap = await getDoc(thirdRef);
  const pred = thirdSnap.exists() ? thirdSnap.data() : {};
  const predLocal = pred.pred_local ?? "";
  const predVisit = pred.pred_visitante ?? "";
  const clasifGuardado = pred.clasificado ?? "";

  const radiosId = `radios_third_${partido.numero}`;
  const showRadios = (predLocal === predVisit && predLocal !== "");

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">🥉 Tercer Puesto</h3>
   <div class="puntuacion-info">
  ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
  Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
  Aciertas solo quién gana → <strong>1 punto</strong>. 
  En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
  <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
</div>
    <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
      <button id="scrollThirdLeft" class="scroll-btn" style="visibility: hidden;"><i class="fas fa-chevron-left"></i></button>
      <div id="carouselThird" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px; justify-content: center;"></div>
      <button id="scrollThirdRight" class="scroll-btn" style="visibility: hidden;"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;
  
  container.innerHTML = html;
  const carousel = document.getElementById("carouselThird");

  const tarjetaHTML = `
    <div class="knockout-card" data-partido-third="${partido.numero}" data-local="${partido.local}" data-visitante="${partido.visitante}" style="min-width: 340px;">
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
        <input type="number" id="third_local_${partido.numero}" class="prediction-input local-score" value="${predLocal}" placeholder="0" ${disabled ? "disabled" : ""}>
        <span class="score-separator">-</span>
        <input type="number" id="third_visit_${partido.numero}" class="prediction-input visitor-score" value="${predVisit}" placeholder="0" ${disabled ? "disabled" : ""}>
      </div>
      <div id="${radiosId}" class="knockout-radios" style="display: ${showRadios ? "flex" : "none"};">
        <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.local}" ${clasifGuardado === partido.local ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.local] || partido.local}</label>
        <label><input type="radio" name="third_clasificado_${partido.numero}" value="${partido.visitante}" ${clasifGuardado === partido.visitante ? "checked" : ""} ${disabled ? "disabled" : ""}> ${fifaCodes[partido.visitante] || partido.visitante}</label>
      </div>
      <button class="btn-guardar" onclick="window.saveThirdPlacePrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
      <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
        ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
      </div>
      <div class="match-date">📅 ${fechaLocal}</div>
    </div>
  `;
  carousel.insertAdjacentHTML('beforeend', tarjetaHTML);

  if (!disabled) {
    const localInput = document.getElementById(`third_local_${partido.numero}`);
    const visitInput = document.getElementById(`third_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_third_${partido.numero}`);
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
// LOAD RANKING
// ======================================================
function loadRankingKnockout() {
  const rankingRef = collection(db, "ranking_knockout");
  rankingUnsubscribeKO = onSnapshot(query(rankingRef, orderBy("puntos", "desc")), async (snapshot) => {
    const container = document.getElementById("rankingKnockoutList");
    if (!container) return;
    let pos = 1;
    let encontrado = false;
    let html = "";
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const userSnap = await getDoc(doc(db, "users", data.user_id));
      const nombre = userSnap.exists() ? userSnap.data().nombre : "Usuario";
      let medalla = "";
      if (pos === 1) medalla = "🥇";
      else if (pos === 2) medalla = "🥈";
      else if (pos === 3) medalla = "🥉";
      else medalla = `#${pos}`;
      html += `<div style="display:flex; justify-content:space-between; padding:8px 0;"><span>${medalla} ${nombre}</span><strong>${data.puntos} pts</strong></div>`;
      
      // Actualizar mi posición KO si es el usuario actual
      if (data.user_id === currentUser.uid) {
        document.getElementById("miPosicionKO").innerText = pos + "°";
        document.getElementById("misPuntosKO").innerText = data.puntos;
        encontrado = true;
      }
      pos++;
    }
    if (!encontrado) {
      document.getElementById("miPosicionKO").innerText = "-";
      document.getElementById("misPuntosKO").innerText = "0";
    }
    container.innerHTML = html || "<div>No hay datos aún</div>";
  });
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
  const container = document.getElementById("bracketContainer");
  if (!container) return;

  // ========== VALIDACIÓN DE ACCESO ==========
  const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
  if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
    container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
      <h3>🔒 Acceso restringido</h3>
      <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
    </div>`;
    return;
  }
  // ==========================================

  // Obtener asignación de terceros guardada por el admin
  let tercerosMap = {};
  try {
    const asignacionDoc = await getDoc(doc(db, "settings", "terceros_asignacion"));
    if (asignacionDoc.exists()) {
      tercerosMap = asignacionDoc.data();
    }
  } catch(e) { console.error("Error al cargar terceros", e); }

  // Definir los partidos, reemplazando los placeholders con los equipos asignados
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
    const disabled = new Date() >= cierreApuestas;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const predictionId = `${currentUser.uid}_KO_${partido.numero}`;
    const predictionSnap = await getDoc(doc(db, "predictions_knockout", predictionId));
    let predLocal = "", predVisit = "", clasifGuardado = "";
    if (predictionSnap.exists()) {
      const data = predictionSnap.data();
      predLocal = data.pred_local ?? "";
      predVisit = data.pred_visitante ?? "";
      clasifGuardado = data.clasificado ?? "";
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
        <button class="btn-guardar" onclick="window.saveKnockoutPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
        <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
          ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
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

    const localInput = document.getElementById(`ko_local_${partido.numero}`);
    const visitInput = document.getElementById(`ko_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_ko_${partido.numero}`);

    if (disabled) continue;
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

    // ========== VALIDACIÓN DE ACCESO ==========
const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
  container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
    <h3>🔒 Acceso restringido</h3>
    <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
  </div>`;
  return;
}
// ==========================================

  // Obtener clasificados de dieciseisavos (desde predictions_knockout)
  const knockoutSnap = await getDocs(collection(db, "predictions_knockout"));
  const clasificados = {};
  knockoutSnap.forEach(doc => {
    const data = doc.data();
    if (data.uid === currentUser.uid) {
      clasificados[data.partido] = data.clasificado;
    }
  });


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

  // Crear estructura con carrusel
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

  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
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

        <button class="btn-guardar" onclick="window.saveOctavosPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>

        <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
          ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
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

  // Listeners para radios en empate
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;

    const localInput = document.getElementById(`oct_local_${partido.numero}`);
    const visitInput = document.getElementById(`oct_visit_${partido.numero}`);
    const radiosDiv = document.getElementById(`radios_oct_${partido.numero}`);

    if (disabled || !localInput || !visitInput || !radiosDiv) continue;

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
// GENERAR CUARTOS AUTOMÁTICOS (CARRUSEL HORIZONTAL)
// ======================================================
async function generarCuartos() {
  const container = document.getElementById("cuartosContainer");
  if (!container) return;

// ========== VALIDACIÓN DE ACCESO ==========
const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
  container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
    <h3>🔒 Acceso restringido</h3>
    <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
  </div>`;
  return;
}
// ==========================================

  // Obtener clasificados de octavos
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

  // Obtener predicciones guardadas
  const cuartosQuery = query(collection(db, "predictions_cuartos"), where("uid", "==", currentUser.uid));
  const cuartosSnap = await getDocs(cuartosQuery);
  const predicciones = {};
  cuartosSnap.forEach(doc => {
    const data = doc.data();
    predicciones[data.partido] = data;
  });

  let html = `<div class="tabla-grupo-card">
    <h3 class="tabla-title">Cuartos de Final</h3>
    <div class="puntuacion-info">
      ⚽ <strong>Reglas de puntuación:</strong> Se toma el marcador de los 90 minutos. 
      Puntos: aciertas el marcador exacto → <strong>3 puntos</strong>. 
      Aciertas solo quién gana → <strong>1 punto</strong>. 
      En caso de <strong>empate</strong>, suma <strong>+1 punto</strong> si seleccionas correctamente el clasificado.
      <span style="display:block; margin-top:6px; font-size:0.7rem; color:#facc15;">➡️ Cuando marques un empate, aparecerán las opciones para elegir quién avanza.</span>
    </div>
    <div class="grupos-tabs-wrapper" style="margin-bottom: 16px;">
      <button id="scrollCuartosLeft" class="scroll-btn"><i class="fas fa-chevron-left"></i></button>
      <div id="carouselCuartos" class="knockout-carousel" style="display: flex; overflow-x: auto; gap: 20px; scroll-behavior: smooth; padding-bottom: 10px;"></div>
      <button id="scrollCuartosRight" class="scroll-btn"><i class="fas fa-chevron-right"></i></button>
    </div>
  </div>`;
  
  container.innerHTML = html;
  const carousel = document.getElementById("carouselCuartos");

  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
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
        <button class="btn-guardar" onclick="window.saveCuartosPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
        <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
          ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
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

  // Listeners para radios
  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;
    if (disabled) continue;

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
      updateRadios();
    }
  }
}

// ======================================================
// GENERAR SEMIFINALES (CARRUSEL HORIZONTAL)
// ======================================================
async function generarSemifinales() {
  const container = document.getElementById("semifinalContainer");
  if (!container) return;

 // ========== VALIDACIÓN DE ACCESO ==========
const participantSnap = await getDoc(doc(db, "participants", currentUser.uid));
if (!participantSnap.exists() || participantSnap.data().enabled_knockout !== true) {
  container.innerHTML = `<div class="tabla-grupo-card" style="text-align:center; padding:30px;">
    <h3>🔒 Acceso restringido</h3>
    <p>No tienes habilitada la participación en la fase eliminatoria.<br>Contacta al administrador para obtener acceso.</p>
  </div>`;
  return;
}
// ==========================================

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
    const disabled = new Date() >= cierreApuestas;
    const fechaLocal = horaPartido.toLocaleString("es-CO", { timeZone: "America/Bogota" });

    const pred = predicciones[partido.numero] || {};
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
        <button class="btn-guardar" onclick="window.saveSemifinalPrediction('${partido.numero}')" ${disabled ? "disabled" : ""}>Guardar</button>
        <div class="match-timer" data-cierre="${cierreApuestas.toISOString()}">
          ⏰ Resultados se bloquean en: <span class="timer-value">${formatearTiempoRestante(cierreApuestas)}</span>
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

  for (const partido of partidos) {
    const horaPartido = obtenerHoraPartidoKnockout(partido.numero);
    const cierreApuestas = new Date(horaPartido.getTime() - 60 * 60 * 1000);
    const disabled = new Date() >= cierreApuestas;
    if (disabled) continue;

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
  if (participantsUnsubscribe) participantsUnsubscribe();

  const participantsRef = collection(db, "participants");
  participantsUnsubscribe = onSnapshot(participantsRef, (snapshot) => {
    let totalGrupos = 0, acumuladoGrupos = 0;
    let totalKO = 0, acumuladoKO = 0;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.paid_groups === true) {
        totalGrupos++;
        acumuladoGrupos += Number(data.amount_groups || 0);
      }
      if (data.paid_knockout === true) {
        totalKO++;
        acumuladoKO += Number(data.amount_knockout || 0);
      }
    });

    // Actualizar elementos de grupos
    const gruposTotal = document.getElementById("totalParticipantesGrupos");
    const gruposAcumulado = document.getElementById("totalAcumuladoGrupos");
    const gruposPrimer = document.getElementById("premioGruposPrimer");
    const gruposAdmin = document.getElementById("premioGruposAdmin");
    const gruposPlataforma = document.getElementById("premioGruposPlataforma");

    if (gruposTotal) gruposTotal.innerText = totalGrupos;
    if (gruposAcumulado) gruposAcumulado.innerText = formatearCOP(acumuladoGrupos);
    if (gruposPrimer) gruposPrimer.innerText = formatearCOP(acumuladoGrupos * 0.7);
    if (gruposAdmin) gruposAdmin.innerText = formatearCOP(acumuladoGrupos * 0.2);
    if (gruposPlataforma) gruposPlataforma.innerText = formatearCOP(acumuladoGrupos * 0.1);

    // Actualizar elementos de knockout
    const koTotal = document.getElementById("totalParticipantesKO");
    const koAcumulado = document.getElementById("totalAcumuladoKO");
    const koPrimer = document.getElementById("premioKOPrimer");
    const koAdmin = document.getElementById("premioKOAdmin");
    const koPlataforma = document.getElementById("premioKOPlataforma");

    if (koTotal) koTotal.innerText = totalKO;
    if (koAcumulado) koAcumulado.innerText = formatearCOP(acumuladoKO);
    if (koPrimer) koPrimer.innerText = formatearCOP(acumuladoKO * 0.7);
    if (koAdmin) koAdmin.innerText = formatearCOP(acumuladoKO * 0.2);
    if (koPlataforma) koPlataforma.innerText = formatearCOP(acumuladoKO * 0.1);
  });
}


// ======================================================
// ADMIN PARTICIPANTES (con filtro y dos pollas)
// ======================================================

// Función auxiliar para escapar HTML
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
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
    amount_groups: nuevoEstado ? 55000 : 0,
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
    amount_knockout: nuevoEstado ? 55000 : 0,
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


// ======================================================
// RESET DE PRUEBAS PARA KNOCKOUT (VERSIÓN ROBUSTA)
// ======================================================
window.resetearPruebasKnockout = async () => {
  if (!confirm("⚠️ ¿Eliminar TODAS las predicciones de knockout y reiniciar resultados reales? Esta acción no se puede deshacer.")) return;

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

  alert("✅ Predicciones de knockout eliminadas y resultados reales reiniciados.");
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

  alert("✅ Predicciones de grupos eliminadas y resultados reiniciados.");
  location.reload();
};

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
// BOTÓN "VER GRUPO" EN LA SIDEBAR
// ======================================================
document.getElementById("verGrupoBtn").onclick = () => {
  const grupoActivoElement = document.querySelector(".grupo-tab.active");
  if (grupoActivoElement) {
    grupoActivoElement.scrollIntoView({ behavior: "smooth", block: "center" });
    const gruposContainer = document.getElementById("gruposContainer");
    if (gruposContainer) gruposContainer.scrollIntoView({ behavior: "smooth" });
  } else {
    alert("No hay grupo activo");
  }
};
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
    tabla.sort((a,b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
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
    <table class="tabla-posiciones" style="width:100%;">
      <thead>
        <tr><th>Grupo</th><th>Equipo</th><th>PTS</th><th>DG</th><th>GF</th><th>Seleccionar</th></tr>
      </thead>
      <tbody>`;

  const seleccionadosPrev = asignacion.equiposSeleccionados || [];
  for (const t of tercerosList) {
    const checked = seleccionadosPrev.includes(t.equipo) ? "checked" : "";
    html += `
      <tr>
        <td>${t.grupo}</td>
        <td>${t.equipo}</td>
        <td>${t.pts}</td>
        <td>${t.dg}</td>
        <td>${t.gf}</td>
        <td><input type="checkbox" class="tercero-checkbox" value="${t.equipo}" ${checked}></td>
      </tr>`;
  }
  html += `</tbody></table>`;

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
          ${tercerosList.map(t => `<option value="${t.equipo}" ${valorActual === t.equipo ? "selected" : ""}>${t.equipo}</option>`).join('')}
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
    // Actualizar los dropdowns para mostrar solo los equipos seleccionados (además de la opción vacía)
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
// ADMIN PANEL: RESULTADOS REALES DE KNOCKOUT
// ======================================================
async function loadAdminKnockoutMatches() {
  const container = document.getElementById("adminKnockoutMatchesList");
  if (!container) return;

  // Obtener resultados actuales desde knockout_results
  const resultadosSnap = await getDocs(collection(db, "knockout_results"));
  const resultadosMap = {};
  resultadosSnap.forEach(doc => {
    const data = doc.data();
    resultadosMap[data.numero] = data;
  });

  const fases = [
    { nombre: "Dieciseisavos", inicio: 73, fin: 88 },
    { nombre: "Octavos", inicio: 89, fin: 96 },
    { nombre: "Cuartos", inicio: 97, fin: 100 },
    { nombre: "Semifinales", inicio: 101, fin: 102 },
    { nombre: "Final", inicio: 104, fin: 104 },
    { nombre: "Tercer puesto", inicio: 103, fin: 103 }
  ];

  let html = `<div class="admin-knockout-section" style="margin-top: 30px;">
    <h3 class="admin-section-title">🗡️ Resultados Eliminatorias</h3>`;

  for (const fase of fases) {
    // Obtener los partidos de esta fase
    const partidosFase = [];
    for (let num = fase.inicio; num <= fase.fin; num++) {
      partidosFase.push({
        numero: num,
        resultado: resultadosMap[num] || { resultado_local: null, resultado_visitante: null, clasificado_real: null }
      });
    }

    // Crear carrusel horizontal
    html += `
      <div class="admin-knockout-fase" style="margin-bottom: 40px;">
        <div class="admin-group-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>${fase.nombre}</span>
          <div class="carousel-nav" style="display: flex; gap: 10px;">
            <button class="carousel-btn-left" data-fase="${fase.nombre}">◀</button>
            <button class="carousel-btn-right" data-fase="${fase.nombre}">▶</button>
          </div>
        </div>
        <div id="carousel-${fase.nombre.replace(/\s/g, '')}" class="admin-knockout-carousel" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12px; padding-bottom: 10px;">
    `;

    for (const p of partidosFase) {
      const resultado = p.resultado;
      html += `
  <div class="admin-card" data-partido="${p.numero}" style="min-width: 280px; flex-shrink: 0;">
    <div class="admin-teams" style="text-align:center; margin-bottom:6px;">
      <div class="admin-team">Partido ${p.numero}</div>
    </div>
    <div class="admin-score" style="display:flex; justify-content:center; gap:8px; margin:8px 0;">
      <input type="number" id="res_ko_local_${p.numero}" class="admin-input" placeholder="0" value="${resultado.resultado_local !== null ? resultado.resultado_local : ''}" style="width:55px; text-align:center;">
      <span style="font-size:1.2rem;">-</span>
      <input type="number" id="res_ko_visit_${p.numero}" class="admin-input" placeholder="0" value="${resultado.resultado_visitante !== null ? resultado.resultado_visitante : ''}" style="width:55px; text-align:center;">
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:8px;">
      <select id="clasificado_ko_${p.numero}" style="flex:1; background:#0f172a; border:1px solid #334155; border-radius:20px; padding:5px 8px; font-size:0.7rem; color:white;">
        <option value="">Empate → ?</option>
        <option value="local" ${resultado.clasificado_real === "local" ? "selected" : ""}>Local</option>
        <option value="visitante" ${resultado.clasificado_real === "visitante" ? "selected" : ""}>Visitante</option>
      </select>
      <button class="admin-btn" onclick="window.guardarResultadoKnockout(${p.numero})" style="padding:5px 10px;">Guardar</button>
      <button class="admin-btn finalizar-btn" onclick="window.finalizarPartidoKnockout(${p.numero})" style="padding:5px 10px;">Finalizar</button>
    </div>
  </div>
`;
    }

    html += `</div></div>`;
  }
  html += `</div>`;
  container.innerHTML = html;

  // Conectar botones de navegación para cada carrusel
  for (const fase of fases) {
    const carouselId = `carousel-${fase.nombre.replace(/\s/g, '')}`;
    const carousel = document.getElementById(carouselId);
    if (!carousel) continue;
    const leftBtn = document.querySelector(`.carousel-btn-left[data-fase="${fase.nombre}"]`);
    const rightBtn = document.querySelector(`.carousel-btn-right[data-fase="${fase.nombre}"]`);
    if (leftBtn) {
      leftBtn.onclick = () => carousel.scrollBy({ left: -360, behavior: "smooth" });
    }
    if (rightBtn) {
      rightBtn.onclick = () => carousel.scrollBy({ left: 360, behavior: "smooth" });
    }
  }
}

window.guardarResultadoKnockout = async (numeroPartido) => {
  const localInput = document.getElementById(`res_ko_local_${numeroPartido}`);
  const visitInput = document.getElementById(`res_ko_visit_${numeroPartido}`);
  const clasificadoSelect = document.getElementById(`clasificado_ko_${numeroPartido}`);
  if (!localInput || !visitInput) return alert("Error: no se encontraron los inputs");

  const local = parseInt(localInput.value);
  const visit = parseInt(visitInput.value);
  if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");

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
  alert("✅ Resultado guardado. Puedes finalizar el partido cuando esté correcto.");
};

window.finalizarPartidoKnockout = async (numeroPartido) => {
  let fase = "";
  if (numeroPartido <= 88) fase = "dieciseisavos";
  else if (numeroPartido <= 96) fase = "octavos";
  else if (numeroPartido <= 100) fase = "cuartos";
  else if (numeroPartido <= 102) fase = "semifinales";
  else if (numeroPartido === 104) fase = "final";
  else if (numeroPartido === 103) fase = "tercer_puesto";
  else return alert("Partido no válido");

  const resultadoRef = doc(db, "knockout_results", numeroPartido.toString());
  const resultadoSnap = await getDoc(resultadoRef);
  if (!resultadoSnap.exists()) return alert("No hay resultado guardado aún. Guarda primero.");
  const data = resultadoSnap.data();
  if (data.resultado_local === null || data.resultado_visitante === null) return alert("Debes guardar el resultado primero.");
  
  await updateDoc(resultadoRef, { finalizado: true });
  await calcularPuntosKnockout(numeroPartido, fase);
  alert("✅ Partido finalizado y puntos calculados.");
  loadAdminKnockoutMatches(); // refrescar vista
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
  for (const docSnap of prediccionesSnap.docs) {
    const pred = docSnap.data();
    const uid = pred.uid;
    const predLocal = pred.pred_local;
    const predVisit = pred.pred_visitante;
    const predClasificado = pred.clasificado;

    let puntos = 0;
    if (predLocal === realLocal && predVisit === realVisit) {
      puntos = 3;
    } else {
      const predEmpate = (predLocal === predVisit);
      if (predEmpate && realEsEmpate) {
        puntos = 1;
        if (predClasificado === realClasificado) puntos += 1;
      } else if (!predEmpate && !realEsEmpate) {
        const predGanador = predLocal > predVisit ? "local" : "visitante";
        const realGanador = realLocal > realVisit ? "local" : "visitante";
        if (predGanador === realGanador) puntos = 1;
      }
    }

    if (puntos > 0) {
      // Ranking global
      const rankingRef = doc(db, "ranking", uid);
      const rankingSnap = await getDoc(rankingRef);
      if (rankingSnap.exists()) {
        await updateDoc(rankingRef, {
          puntos: (rankingSnap.data().puntos || 0) + puntos,
          updated_at: serverTimestamp()
        });
      } else {
        await setDoc(rankingRef, {
          user_id: uid,
          puntos: puntos,
          updated_at: serverTimestamp()
        });
      }

      // Ranking solo knockout
      const rankingKORef = doc(db, "ranking_knockout", uid);
      const rankingKOSnap = await getDoc(rankingKORef);
      if (rankingKOSnap.exists()) {
        await updateDoc(rankingKORef, {
          puntos: (rankingKOSnap.data().puntos || 0) + puntos,
          updated_at: serverTimestamp()
        });
      } else {
        await setDoc(rankingKORef, {
          user_id: uid,
          puntos: puntos,
          updated_at: serverTimestamp()
        });
      }
    }

    // Marcar que ya se asignaron puntos
    await updateDoc(docSnap.ref, { points_assigned: true, points: puntos });
  }
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
     // agregarBotonResetKnockout();   // ← esta línea debe estar presente
      agregarBotonesReset();          // ← COMENTA O ELIMINA
      loadAdminKnockoutMatches();     // ← COMENTA O ELIMINA
      cargarTercerosAdmin();
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
    loadRankingKnockout();
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