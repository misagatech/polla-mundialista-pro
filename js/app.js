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
const rankingList = document.getElementById("rankingList");
const matchesContainer = document.getElementById("matchesContainer");
const userEmailSpan = document.getElementById("userEmail");

let currentUser = null;
let currentUserRol = null;
let matchesUnsubscribe = null;

// ========== AUTENTICACIÓN ==========
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
      setupUploadButton();  // Configura el botón de carga
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

// Login
document.getElementById("btnLogin").onclick = async () => {
  const email = document.getElementById("loginEmail").value;
  const pwd = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
  } catch (error) {
    alert("Error: " + error.message);
  }
};

// Registro
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

// Logout
document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
};

// ========== CARGAR PARTIDOS Y PREDICCIONES ==========
async function loadMatchesAndPredictions() {
  const q = query(collection(db, "matches"), orderBy("hora_partido"));
  matchesUnsubscribe = onSnapshot(q, async (snapshot) => {
    let html = "";
    for (const matchDoc of snapshot.docs) {
      const match = { id: matchDoc.id, ...matchDoc.data() };
      const predQuery = query(collection(db, "predictions"), 
        where("user_id", "==", currentUser.uid), 
        where("match_id", "==", match.id));
      const predSnap = await getDocs(predQuery);
      let userPred = predSnap.empty ? null : predSnap.docs[0].data();

      const now = new Date();
      const matchTime = match.hora_partido.toDate();
      const isBlocked = now >= matchTime;

      // Función para obtener código de país (puedes ampliarla)
      const getCode = (nombre) => {
        const paises = {
          "México": "mx", "Sudáfrica": "za", "Corea del Sur": "kr", "República Checa": "cz",
          "Canadá": "ca", "Bosnia y Herzegovina": "ba", "Qatar": "qa", "Suiza": "ch",
          "Brasil": "br", "Marruecos": "ma", "Haití": "ht", "Escocia": "sct",
          "Estados Unidos": "us", "Paraguay": "py", "Australia": "au", "Turquía": "tr",
          "Alemania": "de", "Curazao": "cw", "Costa de Marfil": "ci", "Ecuador": "ec",
          "Países Bajos": "nl", "Japón": "jp", "Suecia": "se", "Túnez": "tn",
          "España": "es", "Cabo Verde": "cv", "Arabia Saudita": "sa", "Uruguay": "uy",
          "Bélgica": "be", "Egipto": "eg", "Irán": "ir", "Nueva Zelanda": "nz",
          "Francia": "fr", "Senegal": "sn", "Noruega": "no", "Irak": "iq",
          "Argentina": "ar", "Argelia": "dz", "Austria": "at", "Jordania": "jo",
          "Portugal": "pt", "RD Congo": "cd", "Uzbekistán": "uz", "Colombia": "co",
          "Inglaterra": "gb-eng", "Croacia": "hr", "Panamá": "pa", "Ghana": "gh"
        };
        return paises[nombre] || "unknown";
      };

      html += `
        <div class="match-card">
          <div class="match-teams">
            <div class="team"><img class="flag" src="https://flagcdn.com/32x24/${getCode(match.equipo_local)}.png"> ${match.equipo_local}</div>
            <span class="text-xl font-bold">VS</span>
            <div class="team">${match.equipo_visitante} <img class="flag" src="https://flagcdn.com/32x24/${getCode(match.equipo_visitante)}.png"></div>
            <span class="estado-badge ${match.estado === 'pendiente' ? 'estado-pendiente' : (match.estado === 'en_juego' ? 'estado-juego' : 'estado-finalizado')}">${match.estado === 'pendiente' ? 'Pendiente' : (match.estado === 'en_juego' ? 'En juego' : 'Finalizado')}</span>
          </div>
          <div class="match-score-input">
            <input type="number" id="local_${match.id}" value="${userPred ? userPred.pred_local : ''}" placeholder="0" min="0" ${isBlocked ? 'disabled' : ''}>
            <span>-</span>
            <input type="number" id="visit_${match.id}" value="${userPred ? userPred.pred_visitante : ''}" placeholder="0" min="0" ${isBlocked ? 'disabled' : ''}>
            <button onclick="window.savePrediction('${match.id}')" ${isBlocked ? 'disabled' : ''}>Guardar</button>
          </div>
          ${isBlocked ? '<p class="text-red-400 text-xs mt-1">🔒 Partido bloqueado (ya comenzó)</p>' : ''}
          <div class="text-xs text-gray-400 mt-2">📅 ${match.hora_partido.toDate().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (Hora Colombia)</div>
        </div>
      `;
    }
    matchesContainer.innerHTML = html;
  });
}

window.savePrediction = async (matchId) => {
  const local = parseInt(document.getElementById(`local_${matchId}`).value) || 0;
  const visit = parseInt(document.getElementById(`visit_${matchId}`).value) || 0;
  
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  const match = matchSnap.data();
  if (new Date() >= match.hora_partido.toDate()) {
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

// ========== RANKING EN TIEMPO REAL ==========
function loadRanking() {
  const rankingRef = collection(db, "ranking");
  onSnapshot(query(rankingRef, orderBy("puntos", "desc")), (snapshot) => {
    let html = "";
    let pos = 1;
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `<div class="ranking-item"><span class="ranking-pos">${pos++}</span> <span>${data.nombre}</span> <span class="font-bold">${data.puntos} pts</span></div>`;
    });
    rankingList.innerHTML = html;
  });
}

// ========== PANEL ADMIN (cargar resultados) ==========
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

// ========== FUNCIÓN PARA CARGAR TODOS LOS PARTIDOS DESDE partidos.js ==========
async function cargarTodosLosPartidos() {
  // Primero, opcional: borrar partidos existentes (si quieres limpiar)
  const existingMatches = await getDocs(collection(db, "matches"));
  const batchDelete = writeBatch(db);
  existingMatches.forEach(doc => batchDelete.delete(doc.ref));
  await batchDelete.commit();

  // Insertar los 104 partidos
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
  console.log("✅ Todos los partidos cargados");
}

// Configurar el botón "Cargar Mundial 2026"
function setupUploadButton() {
  const btn = document.getElementById("btnCargarPartidos");
  if (!btn) return;
  btn.onclick = async () => {
    if (currentUserRol !== "admin") {
      alert("No eres administrador");
      return;
    }
    const confirmar = confirm("¿Cargar los 104 partidos del Mundial 2026? Esto eliminará los partidos existentes.");
    if (!confirmar) return;
    await cargarTodosLosPartidos();
    alert("Partidos cargados correctamente. Recarga la página para verlos.");
    location.reload();
  };
}
