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

const userEmailSpan = document.getElementById("userEmail");

const miPosicionSpan = document.getElementById("miPosicion");
const misPuntosSpan = document.getElementById("misPuntos");

const proxLocalSpan = document.getElementById("proxLocal");
const proxVisitSpan = document.getElementById("proxVisit");
const proxFechaSpan = document.getElementById("proxFecha");


// ======================================================
// VARIABLES
// ======================================================

let currentUser = null;
let currentUserRol = null;

let matchesUnsubscribe = null;

let gruposData = {};


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

    "Bélgica": "be",
    "Egipto": "eg",
    "Irán": "ir",
    "Nueva Zelanda": "nz",

    "España": "es",
    "Cabo Verde": "cv",
    "Arabia Saudita": "sa",
    "Uruguay": "uy",

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
// CÓDIGOS FIFA
// ======================================================

const fifaCodes = {

  "México": "MEX",
  "Sudáfrica": "RSA",
  "Corea del Sur": "KOR",
  "República Checa": "CZE",

  "Canadá": "CAN",
  "Bosnia y Herzegovina": "BIH",
  "Qatar": "QAT",
  "Suiza": "SUI",

  "Brasil": "BRA",
  "Marruecos": "MAR",
  "Haití": "HAI",
  "Escocia": "SCO",

  "Estados Unidos": "USA",
  "Paraguay": "PAR",
  "Australia": "AUS",
  "Turquía": "TUR",

  "Alemania": "GER",
  "Curazao": "CUW",
  "Costa de Marfil": "CIV",
  "Ecuador": "ECU",

  "Países Bajos": "NED",
  "Japón": "JPN",
  "Suecia": "SWE",
  "Túnez": "TUN",

  "Bélgica": "BEL",
  "Egipto": "EGY",
  "Irán": "IRN",
  "Nueva Zelanda": "NZL",

  "España": "ESP",
  "Cabo Verde": "CPV",
  "Arabia Saudita": "KSA",
  "Uruguay": "URU",

  "Francia": "FRA",
  "Senegal": "SEN",
  "Noruega": "NOR",
  "Irak": "IRQ",

  "Argentina": "ARG",
  "Argelia": "ALG",
  "Austria": "AUT",
  "Jordania": "JOR",

  "Portugal": "POR",
  "RD Congo": "COD",
  "Uzbekistán": "UZB",
  "Colombia": "COL",

  "Inglaterra": "ENG",
  "Croacia": "CRO",
  "Panamá": "PAN",
  "Ghana": "GHA"

};


// ======================================================
// FASE GRUPOS
// ======================================================

function esFaseGrupos(match) {
  return match.fase === "grupos";
}


// ======================================================
// AGRUPAR PARTIDOS
// ======================================================

function agruparPartidos(partidos) {

  const grupos = {};

  partidos.forEach(match => {

    const grupo = match.grupo;

    if (!grupos[grupo]) {
      grupos[grupo] = [];
    }

    grupos[grupo].push(match);

  });

  for (const g in grupos) {

    grupos[g].sort((a, b) => {
      return a.hora_partido.toDate() - b.hora_partido.toDate();
    });

  }

  return grupos;

}


// ======================================================
// MOSTRAR TODOS LOS GRUPOS
// ======================================================

function mostrarTodosLosGrupos() {

  const grupos = Object.keys(gruposData).sort();

  let html = "";

  grupos.forEach(grupo => {

    html += `
      <div class="grupo-card">

        <div class="grupo-header">
          <h3 class="text-xl font-bold text-yellow-300">
            GRUPO ${grupo}
          </h3>
        </div>

        <div class="matches-grid">
    `;

    gruposData[grupo].forEach(match => {

      const matchId = match.id;

      const predLocal = match.userPred
        ? match.userPred.pred_local
        : "";

      const predVisit = match.userPred
        ? match.userPred.pred_visitante
        : "";

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
              ${isBlocked ? "disabled" : ""}
            >

            <span class="score-separator">-</span>

            <input
              type="number"
              id="visit_${matchId}"
              value="${predVisit}"
              placeholder="0"
              class="prediction-input"
              ${isBlocked ? "disabled" : ""}
            >

          </div>

          <button
            class="btn-guardar"
            onclick="window.savePrediction('${matchId}')"
            ${isBlocked ? "disabled" : ""}
          >
            Guardar
          </button>

          <div class="match-date">
            📅 ${match.hora_partido.toDate().toLocaleString("es-CO", {
              timeZone: "America/Bogota"
            })}
          </div>

        </div>
      `;

    });

    html += `
        </div>
      </div>
    `;

  });

  gruposContainer.innerHTML = html;

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

      match.bloqueado =
        new Date() >= match.hora_partido.toDate();

      matches.push(match);

    }

    const partidosGrupos = matches.filter(esFaseGrupos);

    gruposData = agruparPartidos(partidosGrupos);

    mostrarTodosLosGrupos();

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

  const email =
    document.getElementById("loginEmail").value;

  const pwd =
    document.getElementById("loginPassword").value;

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      pwd
    );

  } catch (error) {

    alert(error.message);

  }

};


// ======================================================
// REGISTER
// ======================================================

document.getElementById("btnRegister").onclick = async () => {

  const name =
    document.getElementById("registerName").value;

  const email =
    document.getElementById("registerEmail").value;

  const pwd =
    document.getElementById("registerPassword").value;

  try {

    const cred =
      await createUserWithEmailAndPassword(
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

  const partidosPorGrupo = {};

  snapshot.forEach(docSnap => {

    const match = {
      id: docSnap.id,
      ...docSnap.data()
    };

    const grupo = match.grupo || "OTROS";

    if (!partidosPorGrupo[grupo]) {
      partidosPorGrupo[grupo] = [];
    }

    partidosPorGrupo[grupo].push(match);

  });

  let html = "";

  Object.keys(partidosPorGrupo)
    .sort()
    .forEach(grupo => {

      html += `
        <div class="admin-group">

          <div class="admin-group-title">
            GRUPO ${grupo}
          </div>

          <div class="admin-grid">
      `;

      partidosPorGrupo[grupo].forEach(match => {

        html += `
          <div class="admin-card">

            <div class="admin-teams">

              <div class="admin-team">

                <img
                  class="flag-admin"
                  src="https://flagcdn.com/w40/${obtenerCodigoPais(match.equipo_local)}.png"
                >

                <span>
                  ${fifaCodes[match.equipo_local] || match.equipo_local}
                </span>

              </div>

              <div class="admin-vs">
                VS
              </div>

              <div class="admin-team">

                <img
                  class="flag-admin"
                  src="https://flagcdn.com/w40/${obtenerCodigoPais(match.equipo_visitante)}.png"
                >

                <span>
                  ${fifaCodes[match.equipo_visitante] || match.equipo_visitante}
                </span>

              </div>

            </div>

            <div class="admin-score">

              <input
                type="number"
                id="res_local_${match.id}"
                placeholder="0"
                class="admin-input"
              >

              <span>-</span>

              <input
                type="number"
                id="res_vis_${match.id}"
                placeholder="0"
                class="admin-input"
              >

            </div>

            <button
              class="admin-btn"
              onclick="window.submitResult('${match.id}')"
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
// BOTÓN ADMIN
// ======================================================

function setupUploadButton() {

  const btn =
    document.getElementById("btnCargarPartidos");

  if (!btn) return;

  btn.onclick = async () => {

    if (confirm("¿Cargar partidos nuevamente?")) {

      await cargarTodosLosPartidos();

      alert("✅ Partidos cargados");

      location.reload();

    }

  };

}