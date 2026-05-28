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
    ${isStarted ? "disabled" : ""}
  >

  <span class="score-separator">-</span>

  <input
    type="number"
    id="visit_${matchId}"
    value="${predVisit}"
    placeholder="0"
    class="prediction-input"
    ${isStarted ? "disabled" : ""}
  >

</div>

${!isStarted ? `

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
    🔒 Partido iniciado
  </button>

`}
        
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
    generarSkeletonBracket();

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
  if (Object.keys(clasificadosGlobales).length >= 24) {
    generarDieciseisavos();
  }

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

    {
      numero: 73,
      local: clasificadosGlobales["2A"] || "2A",
      visitante: clasificadosGlobales["2B"] || "2B"
    },

    {
      numero: 74,
      local: clasificadosGlobales["1E"] || "1E",
      visitante: "3A/B/C/D/F"
    },

    {
      numero: 75,
      local: clasificadosGlobales["1F"] || "1F",
      visitante: clasificadosGlobales["2C"] || "2C"
    },

    {
      numero: 76,
      local: clasificadosGlobales["1C"] || "1C",
      visitante: clasificadosGlobales["2F"] || "2F"
    },

    {
      numero: 77,
      local: clasificadosGlobales["1I"] || "1I",
      visitante: "3C/D/F/G/H"
    },

    {
      numero: 78,
      local: clasificadosGlobales["2E"] || "2E",
      visitante: clasificadosGlobales["2I"] || "2I"
    },

    {
      numero: 79,
      local: clasificadosGlobales["1A"] || "1A",
      visitante: "3C/E/F/H/I"
    },

    {
      numero: 80,
      local: clasificadosGlobales["1L"] || "1L",
      visitante: "3E/H/I/J/K"
    },

    {
      numero: 81,
      local: clasificadosGlobales["1D"] || "1D",
      visitante: "3B/E/F/I/J"
    },

    {
      numero: 82,
      local: clasificadosGlobales["1G"] || "1G",
      visitante: "3A/E/H/I/J"
    },

    {
      numero: 83,
      local: clasificadosGlobales["2K"] || "2K",
      visitante: clasificadosGlobales["2L"] || "2L"
    },

    {
      numero: 84,
      local: clasificadosGlobales["1H"] || "1H",
      visitante: clasificadosGlobales["2J"] || "2J"
    },

    {
      numero: 85,
      local: clasificadosGlobales["1B"] || "1B",
      visitante: "3E/F/G/I/J"
    },

    {
      numero: 86,
      local: clasificadosGlobales["1J"] || "1J",
      visitante: clasificadosGlobales["2H"] || "2H"
    },

    {
      numero: 87,
      local: clasificadosGlobales["1K"] || "1K",
      visitante: "3D/E/I/J/L"
    },

    {
      numero: 88,
      local: clasificadosGlobales["2D"] || "2D",
      visitante: clasificadosGlobales["2G"] || "2G"
    }

  ];

  // =====================================
  // HTML
  // =====================================

  let html = `

  <div class="tabla-grupo-card">

    <h3 class="tabla-title">
      Dieciseisavos de Final
    </h3>

    <div class="dieciseisavos-grid">

`;

  for (const partido of partidos) {

    if (!partido.local || !partido.visitante) {
      return;
    }
    // =====================================
    // BUSCAR PREDICCIÓN GUARDADA
    // =====================================

    const predictionId =
      `${currentUser.uid}_KO_${partido.numero}`;

    const predictionRef =
      doc(
        db,
        "predictions_knockout",
        predictionId
      );

    const predictionSnap =
      await getDoc(predictionRef);

    let predLocal = "";
    let predVisit = "";
    let clasificadoGuardado = "";

    if (predictionSnap.exists()) {

      const data =
        predictionSnap.data();

      predLocal =
        data.pred_local ?? "";

      predVisit =
        data.pred_visitante ?? "";

      clasificadoGuardado =
        data.clasificado ?? "";

    }

    html += `

  <div
    class="knockout-card"
    data-partido="${partido.numero}"
    data-local="${partido.local}"
    data-visitante="${partido.visitante}"
  >

    <div class="knockout-match-number">
      Partido ${partido.numero}
    </div>

    <!-- LOCAL -->

    <div class="knockout-team">

  ${fifaCodes[partido.local]
        ? `
      <img
        src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg"
        width="24"
      >
    `
        : ""
      }

  <span>
    ${fifaCodes[partido.local] || partido.local}
  </span>

</div>

    <!-- INPUTS -->

    <div
      style="
        display:flex;
        justify-content:center;
        align-items:center;
        gap:10px;
        margin-top:14px;
      "
    >

      <input
  type="number"
  id="ko_local_${partido.numero}"
  class="prediction-input"
  placeholder="0"
  min="0"
  max="20"
  inputmode="numeric"
  style="
    width:65px;
    text-align:center;
  "
>

      <span>-</span>

      <input
  type="number"
  id="ko_visit_${partido.numero}"
  class="prediction-input"
  placeholder="0"
  min="0"
  max="20"
  inputmode="numeric"
  style="
    width:65px;
    text-align:center;
  "
>

    </div>

    <!-- VISITANTE -->

    <div
  class="knockout-team"
  style="margin-top:14px;"
>

  ${fifaCodes[partido.visitante]
        ? `
      <img
        src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg"
        width="24"
      >
    `
        : ""
      }

  <span>
    ${fifaCodes[partido.visitante] || partido.visitante}
  </span>

</div>

    <!-- EMPATE -->

    <div
      style="
        margin-top:16px;
        font-size:13px;
      "
    >

      Si empatan:

    </div>

    <div
      style="
        display:flex;
        justify-content:center;
        gap:14px;
        margin-top:10px;
        flex-wrap:wrap;
      "
    >

      <label>

        <input
          type="radio"
          name="clasificado_${partido.numero}"
          value="${partido.local}"
        >

        ${fifaCodes[partido.local]}

      </label>

      <label>

        <input
          type="radio"
          name="clasificado_${partido.numero}"
          value="${partido.visitante}"
        >

        ${fifaCodes[partido.visitante]}

      </label>

    </div>

    <!-- BOTÓN -->

    <button
      class="btn-guardar"
      style="margin-top:18px;"
      onclick="window.saveKnockoutPrediction('${partido.numero}')"
    >

      Guardar

    </button>

  </div>
`;

  }

  html += `

    </div>

  </div>

`;

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
    generarSkeletonBracket();

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

  const container =
    document.getElementById(
      "octavosContainer"
    );

  if (!container) return;

  // =====================================
  // OBTENER PREDICCIONES
  // =====================================

  const snapshot =
    await getDocs(
      collection(
        db,
        "predictions_knockout"
      )
    );

  const clasificados = {};

  snapshot.forEach(docSnap => {

    const data =
      docSnap.data();

    clasificados[
      data.partido
    ] = data.clasificado;

  });

  // =====================================
  // PARTIDOS OCTAVOS
  // =====================================

  const partidos = [

    {
      numero: 90,
      local: clasificados[73],
      visitante: clasificados[75]
    },

    {
      numero: 91,
      local: clasificados[76],
      visitante: clasificados[78]
    },

    {
      numero: 93,
      local: clasificados[83],
      visitante: clasificados[84]
    },

    {
      numero: 95,
      local: clasificados[86],
      visitante: clasificados[88]
    }

  ];

  // =====================================
  // HTML
  // =====================================

  let html = `

    <div class="tabla-grupo-card">

      <h3 class="tabla-title">
        Octavos de Final
      </h3>

      <div class="dieciseisavos-grid">

  `;

  partidos.forEach(partido => {

    if (
      !partido.local
      ||
      !partido.visitante
    ) return;
    html += `

  <div
    class="knockout-card"
    data-partido="${partido.numero}"
    data-local="${partido.local}"
    data-visitante="${partido.visitante}"
  >

    <div class="knockout-match-number">
      Partido ${partido.numero}
    </div>

    <!-- LOCAL -->

    <div class="knockout-team">

      <img
        src="https://flagcdn.com/${obtenerCodigoPais(partido.local)}.svg"
        width="24"
      >

      <span>
        ${fifaCodes[partido.local]}
      </span>

    </div>

    <!-- INPUTS -->

    <div
      style="
        display:flex;
        justify-content:center;
        align-items:center;
        gap:10px;
        margin-top:14px;
      "
    >

      <input
        type="number"
        id="oct_local_${partido.numero}"
        class="prediction-input"
        placeholder="0"
        min="0"
        style="width:65px;"
      >

      <span>-</span>

      <input
        type="number"
        id="oct_visit_${partido.numero}"
        class="prediction-input"
        placeholder="0"
        min="0"
        style="width:65px;"
      >

    </div>

    <!-- VISITANTE -->

    <div
      class="knockout-team"
      style="margin-top:14px;"
    >

      <img
        src="https://flagcdn.com/${obtenerCodigoPais(partido.visitante)}.svg"
        width="24"
      >

      <span>
        ${fifaCodes[partido.visitante]}
      </span>

    </div>

    <!-- EMPATE -->

    <div
      style="
        margin-top:16px;
        font-size:13px;
      "
    >

      Si empatan:

    </div>

    <div
      style="
        display:flex;
        justify-content:center;
        gap:14px;
        margin-top:10px;
        flex-wrap:wrap;
      "
    >

      <label>

        <input
          type="radio"
          name="oct_clasificado_${partido.numero}"
          value="${partido.local}"
        >

        ${fifaCodes[partido.local]}

      </label>

      <label>

        <input
          type="radio"
          name="oct_clasificado_${partido.numero}"
          value="${partido.visitante}"
        >

        ${fifaCodes[partido.visitante]}

      </label>

    </div>

    <!-- BOTÓN -->

    <button
      class="btn-guardar"
      style="margin-top:18px;"
      onclick="window.saveOctavosPrediction('${partido.numero}')"
    >

      Guardar

    </button>

  </div>

`;

  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

}
// ======================================================
// ESQUELETO RESTO DEL BRACKET
// ======================================================

function generarSkeletonBracket() {

  // =====================================
  // CONTENEDORES
  // =====================================

  const cuartosContainer =
    document.getElementById(
      "cuartosContainer"
    );

  const semifinalContainer =
    document.getElementById(
      "semifinalContainer"
    );

  const finalContainer =
    document.getElementById(
      "finalContainer"
    );

  // =====================================
  // CUARTOS
  // =====================================

  if (cuartosContainer) {

    cuartosContainer.innerHTML = `

      <div class="tabla-grupo-card">

        <h3 class="tabla-title">
          Cuartos de Final
        </h3>

        <div class="dieciseisavos-grid">

          ${crearPlaceholder(97)}
          ${crearPlaceholder(98)}

        </div>

      </div>

    `;

  }

  // =====================================
  // SEMIFINAL
  // =====================================

  if (semifinalContainer) {

    semifinalContainer.innerHTML = `

      <div class="tabla-grupo-card">

        <h3 class="tabla-title">
          Semifinal
        </h3>

        <div class="dieciseisavos-grid">

          ${crearPlaceholder(101)}

        </div>

      </div>

    `;

  }

  // =====================================
  // FINAL
  // =====================================

  if (finalContainer) {

    finalContainer.innerHTML = `

      <div class="tabla-grupo-card">

        <h3 class="tabla-title">
          GRAN FINAL
        </h3>

        <div class="dieciseisavos-grid">

          ${crearPlaceholder(103)}

        </div>

      </div>

    `;

  }

}

// ======================================================
// PLACEHOLDER
// ======================================================

function crearPlaceholder(numero) {

  return `

    <div class="knockout-card">

      <div class="knockout-match-number">
        Partido ${numero}
      </div>

      <div
        style="
          height:42px;
          background:rgba(255,255,255,0.08);
          border-radius:10px;
          margin-top:14px;
        "
      ></div>

      <div
        style="
          text-align:center;
          margin:14px 0;
          opacity:0.5;
        "
      >
        VS
      </div>

      <div
        style="
          height:42px;
          background:rgba(255,255,255,0.08);
          border-radius:10px;
        "
      ></div>

    </div>

  `;

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
    loadRanking();
    loadPrizePoolRealtime();
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