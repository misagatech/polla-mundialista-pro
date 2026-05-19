import { db, auth } from "./firebase.js";
import { 
  collection, query, where, getDocs, addDoc, updateDoc, doc, 
  onSnapshot, orderBy, getDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { 
  onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { todosLosPartidos } from "./partidos.js";

// Elementos DOM
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

let currentUser = null;
let currentUserRol = null;
let matchesUnsubscribe = null;
let currentUserPuntos = 0;
let currentUserPosicion = 0;
let gruposData = {}; // { grupo: [partidos] }
let grupoActual = "A";

// Mapeo de equipos a grupos (12 grupos)
const equipoGrupo = {
  "México":"A","Sudáfrica":"A","Corea del Sur":"A","República Checa":"A",
  "Canadá":"B","Bosnia y Herzegovina":"B","Qatar":"B","Suiza":"B",
  "Brasil":"C","Marruecos":"C","Haití":"C","Escocia":"C",
  "Estados Unidos":"D","Paraguay":"D","Australia":"D","Turquía":"D",
  "Alemania":"E","Curazao":"E","Costa de Marfil":"E","Ecuador":"E",
  "Países Bajos":"F","Japón":"F","Suecia":"F","Túnez":"F",
  "Bélgica":"G","Egipto":"G","Irán":"G","Nueva Zelanda":"G",
  "España":"H","Cabo Verde":"H","Arabia Saudita":"H","Uruguay":"H",
  "Francia":"I","Senegal":"I","Noruega":"I","Irak":"I",
  "Argentina":"J","Argelia":"J","Austria":"J","Jordania":"J",
  "Portugal":"K","RD Congo":"K","Uzbekistán":"K","Colombia":"K",
  "Inglaterra":"L","Croacia":"L","Panamá":"L","Ghana":"L"
};

// Códigos de país para banderas
function obtenerCodigoPais(nombre) {
  const paises = {
    "México":"mx","Sudáfrica":"za","Corea del Sur":"kr","República Checa":"cz",
    "Canadá":"ca","Bosnia y Herzegovina":"ba","Qatar":"qa","Suiza":"ch",
    "Brasil":"br","Marruecos":"ma","Haití":"ht","Escocia":"sct",
    "Estados Unidos":"us","Paraguay":"py","Australia":"au","Turquía":"tr",
    "Alemania":"de","Curazao":"cw","Costa de Marfil":"ci","Ecuador":"ec",
    "Países Bajos":"nl","Japón":"jp","Suecia":"se","Túnez":"tn",
    "España":"es","Cabo Verde":"cv","Arabia Saudita":"sa","Uruguay":"uy",
    "Bélgica":"be","Egipto":"eg","Irán":"ir","Nueva Zelanda":"nz",
    "Francia":"fr","Senegal":"sn","Noruega":"no","Irak":"iq",
    "Argentina":"ar","Argelia":"dz","Austria":"at","Jordania":"jo",
    "Portugal":"pt","RD Congo":"cd","Uzbekistán":"uz","Colombia":"co",
    "Inglaterra":"gb-eng","Croacia":"hr","Panamá":"pa","Ghana":"gh"
  };
  return paises[nombre] || "unknown";
}

// Determina si es fase de grupos (equipos reales)
function esFaseGrupos(match) {
  return equipoGrupo[match.equipo_local] && equipoGrupo[match.equipo_visitante];
}

// Agrupa partidos por grupo
function agruparPartidos(partidos) {
  const grupos = {};
  for (const match of partidos) {
    if (!esFaseGrupos(match)) continue;
    const grupo = equipoGrupo[match.equipo_local];
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(match);
  }
  // Ordenar partidos por fecha
  for (const g in grupos) {
    grupos[g].sort((a,b) => a.hora_partido.toDate() - b.hora_partido.toDate());
  }
  return grupos;
}

// Renderizar los botones de grupos (scroll horizontal)
function renderGruposTabs() {
  const grupos = Object.keys(gruposData).sort();
  let tabsHtml = '';
  grupos.forEach(g => {
    tabsHtml += `<div class="grupo-tab ${g === grupoActual ? 'active' : ''}" data-grupo="${g}">GRUPO ${g}</div>`;
  });
  gruposCarousel.innerHTML = tabsHtml;
  // Agregar eventos
  document.querySelectorAll('.grupo-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      grupoActual = tab.dataset.grupo;
      renderGruposTabs();
      mostrarGrupo(grupoActual);
    });
  });
}

// Mostrar un grupo específico (acordeón abierto, otros cerrados)
function mostrarGrupo(grupo) {
  if (!gruposData[grupo]) return;
  let html = `
    <div class="grupo-card">
      <div class="grupo-header" onclick="toggleGrupo('${grupo}')">
        <h3 class="text-xl font-bold text-yellow-300">GRUPO ${grupo}</h3>
        <i class="fas fa-chevron-down text-yellow-400 transition-transform" id="icon-${grupo}"></i>
      </div>
      <div class="grupo-body open" id="body-${grupo}">
        <div class="p-2">
          <div class="match-row font-semibold text-gray-300 text-xs uppercase">
            <div>Local</div><div></div><div>Visitante</div><div>Mi pronóstico</div><div>Acción</div>
          </div>
  `;
  for (const match of gruposData[grupo]) {
    const matchId = match.id;
    const predLocal = match.userPred ? match.userPred.pred_local : '';
    const predVisit = match.userPred ? match.userPred.pred_visitante : '';
    const isBlocked = match.bloqueado;
    html += `
      <div class="match-row" data-match-id="${matchId}">
        <div class="team"><img class="flag-icon" src="https://flagcdn.com/24x18/${obtenerCodigoPais(match.equipo_local)}.png"> ${match.equipo_local}</div>
        <div>VS</div>
        <div class="team">${match.equipo_visitante} <img class="flag-icon" src="https://flagcdn.com/24x18/${obtenerCodigoPais(match.equipo_visitante)}.png"></div>
        <div class="flex gap-2 justify-center">
          <input type="number" id="local_${matchId}" value="${predLocal}" placeholder="0" class="prediction-input" ${isBlocked ? 'disabled' : ''}>
          <span>-</span>
          <input type="number" id="visit_${matchId}" value="${predVisit}" placeholder="0" class="prediction-input" ${isBlocked ? 'disabled' : ''}>
        </div>
        <div>
          <button class="btn-guardar" onclick="window.savePrediction('${matchId}')" ${isBlocked ? 'disabled' : ''}>Guardar</button>
        </div>
      </div>
      <div class="text-xs text-gray-400 px-2 pb-2">📅 ${match.hora_partido.toDate().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (Hora Colombia)</div>
    `;
  }
  html += `</div></div></div>`;
  gruposContainer.innerHTML = html;
  // Asegurar que el icono del grupo abierto apunte hacia arriba
  const icon = document.getElementById(`icon-${grupo}`);
  if (icon) icon.style.transform = 'rotate(180deg)';
}

window.toggleGrupo = (grupo) => {
  const body = document.getElementById(`body-${grupo}`);
  const icon = document.getElementById(`icon-${grupo}`);
  if (body.classList.contains('open')) {
    body.classList.remove('open');
    icon.style.transform = 'rotate(0deg)';
  } else {
    body.classList.add('open');
    icon.style.transform = 'rotate(180deg)';
  }
};

// Cargar partidos y predicciones, agrupar y actualizar UI
async function loadMatchesAndPredictions() {
  const q = query(collection(db, "matches"), orderBy("hora_partido"));
  matchesUnsubscribe = onSnapshot(q, async (snapshot) => {
    let matches = [];
    for (const matchDoc of snapshot.docs) {
      const match = { id: matchDoc.id, ...matchDoc.data() };
      const predQuery = query(collection(db, "predictions"), 
        where("user_id", "==", currentUser.uid), 
        where("match_id", "==", match.id));
      const predSnap = await getDocs(predQuery);
      match.userPred = predSnap.empty ? null : predSnap.docs[0].data();
      const now = new Date();
      match.bloqueado = now >= match.hora_partido.toDate();
      matches.push(match);
    }
    const partidosGrupos = matches.filter(esFaseGrupos);
    gruposData = agruparPartidos(partidosGrupos);
    renderGruposTabs();
    mostrarGrupo(grupoActual);
    
    // Actualizar sidebar: próximo partido (el más cercano en el futuro)
    const ahora = new Date();
    const proximos = partidosGrupos.filter(m => m.hora_partido.toDate() > ahora).sort((a,b)=> a.hora_partido.toDate()-b.hora_partido.toDate());
    if (proximos.length) {
      const p = proximos[0];
      proxLocalSpan.innerText = p.equipo_local;
      proxVisitSpan.innerText = p.equipo_visitante;
      proxFechaSpan.innerText = p.hora_partido.toDate().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      verGrupoBtn.onclick = () => {
        const grupo = equipoGrupo[p.equipo_local];
        grupoActual = grupo;
        renderGruposTabs();
        mostrarGrupo(grupo);
        document.getElementById(`body-${grupo}`)?.scrollIntoView({ behavior: 'smooth' });
      };
    } else {
      proxLocalSpan.innerText = "---"; proxVisitSpan.innerText = "---"; proxFechaSpan.innerText = "No hay más partidos";
    }
  });
}

window.savePrediction = async (matchId) => {
  const local = parseInt(document.getElementById(`local_${matchId}`).value) || 0;
  const visit = parseInt(document.getElementById(`visit_${matchId}`).value) || 0;
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  if (new Date() >= matchSnap.data().hora_partido.toDate()) {
    alert("No puedes guardar, el partido ya comenzó.");
    return;
  }
  const existingQuery = query(collection(db, "predictions"), 
    where("user_id", "==", currentUser.uid), 
    where("match_id", "==", matchId));
  const existing = await getDocs(existingQuery);
  if (existing.empty) {
    await addDoc(collection(db, "predictions"), {
      user_id: currentUser.uid,
      match_id: matchId,
      pred_local: local,
      pred_visitante: visit,
      puntos: 0,
      bloqueado: false
    });
  } else {
    await updateDoc(doc(db, "predictions", existing.docs[0].id), {
      pred_local: local,
      pred_visitante: visit
    });
  }
  alert("✅ Predicción guardada");
};

// Ranking en tiempo real
function loadRanking() {
  const rankingRef = collection(db, "ranking");
  onSnapshot(query(rankingRef, orderBy("puntos", "desc")), (snapshot) => {
    let pos = 1;
    let encontrado = false;
    snapshot.forEach(doc => {
      if (doc.data().user_id === currentUser.uid) {
        currentUserPosicion = pos;
        currentUserPuntos = doc.data().puntos;
        miPosicionSpan.innerText = pos + '°';
        misPuntosSpan.innerText = doc.data().puntos;
        encontrado = true;
      }
      pos++;
    });
    if (!encontrado) {
      miPosicionSpan.innerText = '-';
      misPuntosSpan.innerText = '0';
    }
  });
}

// ========== AUTENTICACIÓN (igual que antes) ==========
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", user.email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      currentUserRol = snap.docs[0].data().rol;
    } else {
      await addDoc(usersRef, {
        uid: user.uid,
        nombre: user.displayName || user.email.split('@')[0],
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
    } else {
      adminPanel.classList.add("hidden");
    }
    loadMatchesAndPredictions();
    loadRanking();
  } else {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    if (matchesUnsubscribe) matchesUnsubscribe();
  }
});

// Login, registro, logout
document.getElementById("btnLogin").onclick = async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch (error) {
    alert("Error: " + error.message);
  }
};
document.getElementById("btnRegister").onclick = async () => {
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const pwd = document.getElementById("registerPassword").value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    await addDoc(collection(db, "users"), {
      uid: cred.user.uid,
      nombre: name,
      email: email,
      puntos_totales: 0,
      rol: "user"
    });
    alert("Registro exitoso. Ya puedes iniciar sesión.");
  } catch (error) {
    alert("Error: " + error.message);
  }
};
document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
};

// ========== ADMIN ==========
async function loadAdminMatches() {
  const q = query(collection(db, "matches"), where("estado", "in", ["pendiente", "en_juego"]));
  const snapshot = await getDocs(q);
  let html = '<h3 class="font-bold mb-2">📋 Cargar resultados</h3>';
  snapshot.forEach(docSnap => {
    const match = docSnap.data();
    html += `
      <div class="admin-match">
        <span class="text-sm">${match.equipo_local} vs ${match.equipo_visitante}</span>
        <div>
          <input type="number" id="res_local_${docSnap.id}" placeholder="Local" class="w-16 p-1 rounded">
          -
          <input type="number" id="res_vis_${docSnap.id}" placeholder="Visitante" class="w-16 p-1 rounded">
          <button onclick="window.submitResult('${docSnap.id}')" class="bg-green-600 text-white px-2 py-1 rounded">Guardar</button>
        </div>
      </div>
    `;
  });
  document.getElementById("adminMatchesList").innerHTML = html;
}

window.submitResult = async (matchId) => {
  if (currentUserRol !== "admin") return alert("No autorizado");
  const local = parseInt(document.getElementById(`res_local_${matchId}`).value);
  const visit = parseInt(document.getElementById(`res_vis_${matchId}`).value);
  if (isNaN(local) || isNaN(visit)) return alert("Ingresa números válidos");
  const matchRef = doc(db, "matches", matchId);
  await updateDoc(matchRef, {
    resultado_local: local,
    resultado_visitante: visit,
    estado: "finalizado"
  });
  const predictionsSnap = await getDocs(query(collection(db, "predictions"), where("match_id", "==", matchId)));
  const batch = writeBatch(db);
  const usersPuntos = {};
  for (const predDoc of predictionsSnap.docs) {
    const pred = predDoc.data();
    const puntos = calcularPuntos({ local: pred.pred_local, visitante: pred.pred_visitante }, { local, visit });
    batch.update(predDoc.ref, { puntos, bloqueado: true });
    usersPuntos[pred.user_id] = (usersPuntos[pred.user_id] || 0) + puntos;
  }
  await batch.commit();
  for (const [uid, suma] of Object.entries(usersPuntos)) {
    const userQuery = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
    if (!userQuery.empty) {
      const userDoc = userQuery.docs[0];
      const puntosActuales = userDoc.data().puntos_totales || 0;
      await updateDoc(userDoc.ref, { puntos_totales: puntosActuales + suma });
    }
  }
  await rebuildRanking();
  alert("Resultado guardado y puntos actualizados");
  loadAdminMatches();
};

function calcularPuntos(pred, real) {
  if (pred.local === real.local && pred.visitante === real.visitante) return 5;
  const predGanador = Math.sign(pred.local - pred.visitante);
  const realGanador = Math.sign(real.local - real.visitante);
  if (predGanador === realGanador) return 3;
  return 0;
}

async function rebuildRanking() {
  const usersSnap = await getDocs(collection(db, "users"));
  const ranking = [];
  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    ranking.push({
      user_id: user.uid,
      nombre: user.nombre,
      puntos: user.puntos_totales || 0
    });
  }
  ranking.sort((a,b) => b.puntos - a.puntos);
  const batch = writeBatch(db);
  const oldRanking = await getDocs(collection(db, "ranking"));
  oldRanking.forEach(doc => batch.delete(doc.ref));
  for (const item of ranking) {
    const newRef = doc(collection(db, "ranking"));
    batch.set(newRef, item);
  }
  await batch.commit();
}

async function cargarTodosLosPartidos() {
  const existingMatches = await getDocs(collection(db, "matches"));
  const batchDelete = writeBatch(db);
  existingMatches.forEach(doc => batchDelete.delete(doc.ref));
  await batchDelete.commit();
  for (const p of todosLosPartidos) {
    await addDoc(collection(db, "matches"), {
      equipo_local: p.local,
      equipo_visitante: p.visitante,
      hora_partido: new Date(p.fechaUTC),
      estado: "pendiente",
      resultado_local: null,
      resultado_visitante: null
    });
  }
  console.log("✅ 104 partidos cargados");
}

function setupUploadButton() {
  const btn = document.getElementById("btnCargarPartidos");
  if (!btn) return;
  btn.onclick = async () => {
    if (currentUserRol !== "admin") {
      alert("No eres administrador");
      return;
    }
    if (confirm("¿Cargar los 104 partidos? Se eliminarán los existentes.")) {
      await cargarTodosLosPartidos();
      alert("Partidos cargados. Recarga la página.");
      location.reload();
    }
  };
}

// Scroll horizontal de grupos
if (scrollLeftBtn) {
  scrollLeftBtn.addEventListener('click', () => {
    gruposCarousel.scrollBy({ left: -200, behavior: 'smooth' });
  });
  scrollRightBtn.addEventListener('click', () => {
    gruposCarousel.scrollBy({ left: 200, behavior: 'smooth' });
  });
}
