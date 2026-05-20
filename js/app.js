import { db, auth } from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  getDoc,
  writeBatch
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

const userEmailSpan = document.getElementById("userEmail");

const miPosicionSpan = document.getElementById("miPosicion");
const misPuntosSpan = document.getElementById("misPuntos");

const proxLocalSpan = document.getElementById("proxLocal");
const proxVisitSpan = document.getElementById("proxVisit");
const proxFechaSpan = document.getElementById("proxFecha");

const verGrupoBtn = document.getElementById("verGrupoBtn");

const scrollLeftBtn = document.getElementById("scrollGruposLeft");
const scrollRightBtn = document.getElementById("scrollGruposRight");


// ======================================================
// VARIABLES
// ======================================================

let currentUser = null;
let currentUserRol = null;

let matchesUnsubscribe = null;

let gruposData = {};

let grupoActual = "A";


// ======================================================
// GRUPOS
// ======================================================

const equipoGrupo = {

  "México": "A",
  "Sudáfrica": "A",
  "Corea del Sur": "A",
  "República Checa": "A",

  "Canadá": "B",
  "Bosnia y Herzegovina": "B",
  "Qatar": "B",
  "Suiza": "B",

  "Brasil": "C",
  "Marruecos": "C",
  "Haití": "C",
  "Escocia": "C",

  "Estados Unidos": "D",
  "Paraguay": "D",
  "Australia": "D",
  "Turquía": "D",

  "Alemania": "E",
  "Curazao": "E",
  "Costa de Marfil": "E",
  "Ecuador": "E",

  "Países Bajos": "F",
  "Japón": "F",
  "Suecia": "F",
  "Túnez": "F",

  "Bélgica": "G",
  "Egipto": "G",
  "Irán": "G",
  "Nueva Zelanda": "G",

  "España": "H",
  "Cabo Verde": "H",
  "Arabia Saudita": "H",
  "Uruguay": "H",

  "Francia": "I",
  "Senegal": "I",
  "Noruega": "I",
  "Irak": "I",

  "Argentina": "J",
  "Argelia": "J",
  "Austria": "J",
  "Jordania": "J",

  "Portugal": "K",
  "RD Congo": "K",
  "Uzbekistán": "K",
  "Colombia": "K",

  "Inglaterra": "L",
  "Croacia": "L",
  "Panamá": "L",
  "Ghana": "L"

};


// ======================================================
// BANDERAS
// ======================================================

function obtenerCodigoPais(nombre) {

  const paises = {

    "México": "mx",
    "Sudáfrica": "za",
    "Corea del Sur": "kr",
    "República Checa": "cz",

    "Canadá": "ca",
    "Bosnia y Herzegovina": "ba",
    "Qatar": "qa",
    "Suiza": "ch",

    "Brasil": "br",
    "Marruecos": "ma",
    "Haití": "ht",
    "Escocia": "gb-sct",

    "Estados Unidos": "us",
    "Paraguay": "py",
    "Australia": "au",
    "Turquía": "tr",

    "Alemania": "de",
    "Curazao": "cw",
    "Costa de Marfil": "ci",
    "Ecuador": "ec",

    "Países Bajos": "nl",
    "Japón": "jp",
    "Suecia": "se",
    "Túnez": "tn",

    "España": "es",
    "Cabo Verde": "cv",
    "Arabia Saudita": "sa",
    "Uruguay": "uy",

    "Bélgica": "be",
    "Egipto": "eg",
    "Irán": "ir",
    "Nueva Zelanda": "nz",

    "Francia": "fr",
    "Senegal": "sn",
    "Noruega": "no",
    "Irak": "iq",

    "Argentina": "ar",
    "Argelia": "dz",
    "Austria": "at",
    "Jordania": "jo",

    "Portugal": "pt",
    "RD Congo": "cd",
    "Uzbekistán": "uz",
    "Colombia": "co",

    "Inglaterra": "gb-eng",
    "Croacia": "hr",
    "Panamá": "pa",
    "Ghana": "gh"

  };

  return paises[nombre] || "un";

}


// ======================================================
// FASES
// ======================================================

function esFaseGrupos(match) {
  return match.fase === "grupos";
}


// ======================================================
// AGRUPAR PARTIDOS
// ======================================================

function agruparPartidos(partidos) {

  const grupos = {};

  for (const match of partidos) {

    const grupo = match.grupo;

    if (!grupos[grupo]) {
      grupos[grupo] = [];
    }

    grupos[grupo].push(match);

  }

  for (const g in grupos) {

    grupos[g].sort((a, b) => {
      return a.hora_partido.toDate() - b.hora_partido.toDate();
    });

  }

  return grupos;

}


// ======================================================
// TABS DE GRUPOS
// ======================================================

function renderGruposTabs() {

  const grupos = Object.keys(gruposData).sort();

  let html = "";

  grupos.forEach(grupo => {

    html += `
      <button 
        class="grupo-tab ${grupo === grupoActual ? "active" : ""}" 
        data-grupo="${grupo}">
        Grupo ${grupo}
      </button>
    `;

  });

  gruposCarousel.innerHTML = html;

  document.querySelectorAll(".grupo-tab").forEach(btn => {

    btn.addEventListener("click", () => {

      grupoActual = btn.dataset.grupo;

      renderGruposTabs();

      mostrarGrupo(grupoActual);

    });

  });

}


// ======================================================
// MOSTRAR GRUPO
// ======================================================

function mostrarGrupo(grupo) {
  if (!gruposData[grupo]) return;

  let html = `
    <div class="grupo-card">
      <div class="grupo-header" onclick="toggleGrupo('${grupo}')">
        <h3 class="text-xl font-bold text-yellow-300">
          GRUPO ${grupo}
        </h3>

        <i class="fas fa-chevron-down text-yellow-400 transition-transform"
           id="icon-${grupo}">
        </i>
      </div>

      <div class="grupo-body open" id="body-${grupo}">
        <div class="matches-grid">
  `;

  for (const match of gruposData[grupo]) {

    const matchId = match.id;

    const predLocal = match.userPred
      ? match.userPred.pred_local
      : '';

    const predVisit = match.userPred
      ? match.userPred.pred_visitante
      : '';

    const isBlocked = match.bloqueado;

    html += `
      <div class="match-card">

        <div class="match-teams">

          <div class="team-row">
            <img
              class="flag-icon"
              src="https://flagcdn.com/w40/${obtenerCodigoPais(match.equipo_local)}.png"
            >

            <span>${match.equipo_local}</span>
          </div>

          <div class="vs-text">VS</div>

          <div class="team-row">
            <img
              class="flag-icon"
              src="https://flagcdn.com/w40/${obtenerCodigoPais(match.equipo_visitante)}.png"
            >

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
            ${isBlocked ? 'disabled' : ''}
          >

          <span class="score-separator">-</span>

          <input
            type="number"
            id="visit_${matchId}"
            value="${predVisit}"
            placeholder="0"
            class="prediction-input"
            ${isBlocked ? 'disabled' : ''}
          >

        </div>

        <button
          class="btn-guardar"
          onclick="window.savePrediction('${matchId}')"
          ${isBlocked ? 'disabled' : ''}
        >
          Guardar
        </button>

        <div class="match-date">
          📅 ${match.hora_partido.toDate().toLocaleString('es-CO', {
      timeZone: 'America/Bogota'
    })}
        </div>

      </div>
    `;
  }

  html += `
        </div>
      </div>
    </div>
  `;

  gruposContainer.innerHTML = html;

  const icon = document.getElementById(`icon-${grupo}`);

  if (icon) {
    icon.style.transform = 'rotate(180deg)';
  }
}

// ======================================================
// CARGAR PARTIDOS
// ======================================================

async function loadMatchesAndPredictions() {

  const q = query(
    collection(db, "matches"),
    orderBy("hora_partido")
  );

  matchesUnsubscribe = onSnapshot(q, async (snapshot) => {

    let matches = [];

    for (const matchDoc of snapshot.docs) {

      const match = {
        id: matchDoc.id,
        ...matchDoc.data()
      };

      const predQuery = query(
        collection(db, "predictions"),
        where("user_id", "==", currentUser.uid),
        where("match_id", "==", match.id)
      );

      const predSnap = await getDocs(predQuery);

      match.userPred = predSnap.empty
        ? null
        : predSnap.docs[0].data();

      match.bloqueado = new Date() >= match.hora_partido.toDate();

      matches.push(match);

    }

    const partidosGrupos = matches.filter(esFaseGrupos);

    gruposData = agruparPartidos(partidosGrupos);

    renderGruposTabs();

    mostrarGrupo(grupoActual);

    // Próximo partido
    const ahora = new Date();

    const proximos = partidosGrupos
      .filter(m => m.hora_partido.toDate() > ahora)
      .sort((a, b) => a.hora_partido.toDate() - b.hora_partido.toDate());

    if (proximos.length > 0) {

      const p = proximos[0];

      proxLocalSpan.innerText = p.equipo_local;
      proxVisitSpan.innerText = p.equipo_visitante;

      proxFechaSpan.innerText = p.hora_partido
        .toDate()
        .toLocaleString("es-CO", {
          timeZone: "America/Bogota"
        });

    }

  });

}


// ======================================================
// GUARDAR PREDICCIÓN
// ======================================================

window.savePrediction = async (matchId) => {

  const local = parseInt(
    document.getElementById(`local_${matchId}`).value
  ) || 0;

  const visit = parseInt(
    document.getElementById(`visit_${matchId}`).value
  ) || 0;

  const existingQuery = query(
    collection(db, "predictions"),
    where("user_id", "==", currentUser.uid),
    where("match_id", "==", matchId)
  );

  const existing = await getDocs(existingQuery);

  if (existing.empty) {

    await addDoc(collection(db, "predictions"), {

      user_id: currentUser.uid,
      match_id: matchId,

      pred_local: local,
      pred_visitante: visit,

      puntos: 0

    });

  } else {

    await updateDoc(
      doc(db, "predictions", existing.docs[0].id),
      {
        pred_local: local,
        pred_visitante: visit
      }
    );

  }

  alert("✅ Predicción guardada");

};


// ======================================================
// RANKING
// ======================================================

function loadRanking() {

  const rankingRef = collection(db, "ranking");

  onSnapshot(
    query(rankingRef, orderBy("puntos", "desc")),
    (snapshot) => {

      let pos = 1;

      let encontrado = false;

      snapshot.forEach(docSnap => {

        const data = docSnap.data();

        if (data.user_id === currentUser.uid) {

          miPosicionSpan.innerText = pos + "°";
          misPuntosSpan.innerText = data.puntos;

          encontrado = true;

        }

        pos++;

      });

      if (!encontrado) {

        miPosicionSpan.innerText = "-";
        misPuntosSpan.innerText = "0";

      }

    }
  );

}


// ======================================================
// AUTH
// ======================================================

onAuthStateChanged(auth, async (user) => {

  if (user) {

    currentUser = user;

    const usersRef = collection(db, "users");

    const q = query(
      usersRef,
      where("email", "==", user.email)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {

      currentUserRol = snap.docs[0].data().rol;

    } else {

      await addDoc(usersRef, {

        uid: user.uid,
        nombre: user.email,
        email: user.email,

        puntos_totales: 0,

        rol: "user"

      });

      currentUserRol = "user";

    }

    userEmailSpan.innerText = user.email;

    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    if (currentUserRol === "admin") {

      adminPanel.classList.remove("hidden");

      loadAdminMatches();

      setupUploadButton();

    }

    loadMatchesAndPredictions();

    loadRanking();

  } else {

    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");

  }

});


// ======================================================
// LOGIN
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


// ======================================================
// REGISTER
// ======================================================

document.getElementById("btnRegister").onclick = async () => {

  const name = document.getElementById("registerName").value;

  const email = document.getElementById("registerEmail").value;

  const pwd = document.getElementById("registerPassword").value;

  try {

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      pwd
    );

    await addDoc(collection(db, "users"), {

      uid: cred.user.uid,
      nombre: name,
      email: email,

      puntos_totales: 0,

      rol: "user"

    });

    alert("✅ Registro exitoso");

  } catch (error) {

    alert(error.message);

  }

};


// ======================================================
// LOGOUT
// ======================================================

document.getElementById("btnLogout").onclick = async () => {

  await signOut(auth);

};


// ======================================================
// ADMIN
// ======================================================

async function loadAdminMatches() {

  const q = query(
    collection(db, "matches"),
    where("estado", "in", ["pendiente", "en_juego"])
  );

  const snapshot = await getDocs(q);

  let html = "<h3>📋 Cargar Resultados</h3>";

  snapshot.forEach(docSnap => {

    const match = docSnap.data();

    html += `

      <div class="admin-match">

        <span>
          ${match.equipo_local} vs ${match.equipo_visitante}
        </span>

        <div>

          <input
            type="number"
            id="res_local_${docSnap.id}"
            placeholder="0"
          >

          -

          <input
            type="number"
            id="res_vis_${docSnap.id}"
            placeholder="0"
          >

          <button
            onclick="window.submitResult('${docSnap.id}')"
          >
            Guardar
          </button>

        </div>

      </div>

    `;

  });

  document.getElementById("adminMatchesList").innerHTML = html;

}


// ======================================================
// SUBIR RESULTADOS
// ======================================================

window.submitResult = async (matchId) => {

  const local = parseInt(
    document.getElementById(`res_local_${matchId}`).value
  );

  const visit = parseInt(
    document.getElementById(`res_vis_${matchId}`).value
  );

  if (isNaN(local) || isNaN(visit)) {
    return alert("Ingresa números válidos");
  }

  const matchRef = doc(db, "matches", matchId);

  await updateDoc(matchRef, {

    resultado_local: local,
    resultado_visitante: visit,

    estado: "finalizado"

  });

  alert("✅ Resultado guardado");

};


// ======================================================
// CARGAR PARTIDOS FIREBASE
// ======================================================

async function cargarTodosLosPartidos() {

  const existingMatches = await getDocs(
    collection(db, "matches")
  );

  const batchDelete = writeBatch(db);

  existingMatches.forEach(docItem => {
    batchDelete.delete(docItem.ref);
  });

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
      resultado_visitante: null

    });

  }

  console.log("✅ Partidos cargados");

}


// ======================================================
// BOTÓN ADMIN CARGAR
// ======================================================

function setupUploadButton() {

  const btn = document.getElementById("btnCargarPartidos");

  if (!btn) return;

  btn.onclick = async () => {

    if (confirm("¿Cargar partidos nuevamente?")) {

      await cargarTodosLosPartidos();

      alert("✅ Partidos cargados");

      location.reload();

    }

  };

}


// ======================================================
// SCROLL GRUPOS
// ======================================================

if (scrollLeftBtn) {

  scrollLeftBtn.addEventListener("click", () => {

    gruposCarousel.scrollBy({
      left: -200,
      behavior: "smooth"
    });

  });

}

if (scrollRightBtn) {

  scrollRightBtn.addEventListener("click", () => {

    gruposCarousel.scrollBy({
      left: 200,
      behavior: "smooth"
    });

  });

}