import { db } from "./firebase.js";
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const container = document.getElementById("matches");

async function cargarPartidos() {
  const querySnapshot = await getDocs(collection(db, "matches"));

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const div = document.createElement("div");
    div.className = "match";

    div.innerHTML = `
      <p>
        <img src="https://flagcdn.com/w40/${data.codigo1}.png">
        ${data.equipo1}
        <input type="number" id="r1-${id}">
        vs
        <input type="number" id="r2-${id}">
        ${data.equipo2}
        <img src="https://flagcdn.com/w40/${data.codigo2}.png">
      </p>

      <button onclick="guardar('${id}')">Guardar</button>
    `;

    container.appendChild(div);
  });
}

window.guardar = async function(id) {
  const r1 = document.getElementById(`r1-${id}`).value;
  const r2 = document.getElementById(`r2-${id}`).value;

  await setDoc(doc(db, "predicciones", id), {
    resultado1: Number(r1),
    resultado2: Number(r2)
  });

  alert("Guardado ⚽");
};

cargarPartidos();
