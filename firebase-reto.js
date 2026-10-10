
import {
  initializeApp,
  getApps,
  getApp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

const fields = ['plastico', 'papel', 'carton', 'metal', 'otros'];

let teacher = false;
let week = 1;
let month = '';
let student = '';
let rows = [];
let busy = false;
let ready = false;
let statusOverride = '';
let loadVersion = 0;

const localISO = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = () => localISO(new Date());

const monthOf = d => d.slice(0, 7);

const weekOf = d =>
  Math.min(4, Math.floor((Number(d.slice(8, 10)) - 1) / 7) + 1);

const dateForWeek = (m, w) =>
  `${m}-${String((w - 1) * 7 + 1).padStart(2, '0')}`;

const status = msg => {
  const element = $('retoStatus');
  if (element) element.textContent = msg;
};

const counts = () =>
  fields.map((_, i) =>
    Number($('c' + (i + 1)).textContent) || 0
  );

const setCounts = a => {
  fields.forEach((_, i) => {
    $('c' + (i + 1)).textContent = String(a?.[i] || 0);
  });
};

const canEdit = () =>
  ready &&
  teacher &&
  !!student &&
  month === monthOf(today()) &&
  week === weekOf(today()) &&
  !busy;

window.ecoRetoCanEdit = canEdit;

function render(preserveForm = false) {
  const allowed = canEdit();

  $('retoSave').hidden = !allowed && !busy;
  $('retoSave').disabled = busy;

  document
    .querySelectorAll('#tab-ecoreto .btn-circle')
    .forEach(b => {
      b.disabled = !allowed;
      b.style.opacity = allowed ? '1' : '.4';
    });

  $('retoStudentLabel').hidden = !teacher;
  $('retoDate').disabled = !allowed;

  const selected = $('retoDate').value;
  const item = rows.find(r => r.fecha === selected);

  const notes = document.querySelector(
    '#tab-ecoreto textarea'
  );

  // No modificar los valores mientras se guarda.
  if (!preserveForm) {
    setCounts(
      item
        ? fields.map(k => Number(item[k]) || 0)
        : [0, 0, 0, 0, 0]
    );

    if (notes) {
      notes.value = item?.observaciones || '';
    }
  }

  if (notes) notes.disabled = !allowed;

  document
    .querySelectorAll('#tab-ecoreto .week-btn')
    .forEach((b, i) => {
      b.classList.toggle('active', i + 1 === week);
    });

  const weeklyRows = rows.filter(
    r => weekOf(r.fecha) === week
  );

  const totals = fields.map(k =>
    weeklyRows.reduce(
      (n, r) => n + (Number(r[k]) || 0),
      0
    )
  );

  const sum = totals.reduce((a, b) => a + b, 0);

  const baseStatus = !ready
    ? 'Inicia sesión con correo verificado para consultar EcoReto.'
    : !student
      ? 'Selecciona un estudiante para continuar.'
      : `${allowed ? '✏️ Semana abierta' : '🔒 Semana de solo lectura'} · ${weeklyRows.length} días registrados · Total semanal: ${sum} unidades (${totals.join(' / ')}).`;

  status(statusOverride || baseStatus);
}

const months = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12
};

async function updateLogros() {
  const selector = $('logrosMonthSelect');
  if (!selector) return;

  const value = selector.value;
  const [name, year] = value.split(' ');

  const m = `${year}-${String(months[name] || 1).padStart(2, '0')}`;

  if (!ready || !student) {
    $('logroRecolectados').textContent = '0';
    $('logroAcumulado').textContent = '0';
    $('logroReutilizados').textContent = '0';
    $('logroReducidos').textContent = '0';
    $('logroMetaPct').textContent = '0%';
    $('logroMetaBar').style.width = '0%';
    return;
  }

  const selectedStudent = student;

  try {
    const snap = await getDocs(
      query(
        collection(db, 'recolecciones'),
        where('alumnoId', '==', selectedStudent),
        where('mes', '==', m)
      )
    );

    if (student !== selectedStudent) return;

    const total = snap.docs.reduce((sum, d) => {
      const data = d.data();

      return sum + fields.reduce(
        (n, k) => n + (Number(data[k]) || 0),
        0
      );
    }, 0);

    $('logroRecolectados').textContent = String(total);
    $('logroAcumulado').textContent = String(total);

    // Pendiente: integrar reutilización desde EcoArte.
    const reused = 0;

    $('logroReutilizados').textContent = String(reused);
    $('logroReducidos').textContent = String(
      Math.max(0, total - reused)
    );

    const pct = Math.min(
      100,
      Math.round(total / 300 * 100)
    );

    $('logroMetaPct').textContent = pct + '%';
    $('logroMetaBar').style.width = pct + '%';

    const studentName = teacher
      ? $('retoStudent').selectedOptions[0]?.textContent ||
        'estudiante'
      : 'tu cuenta';

    $('logrosSource').textContent =
      `Recolección real de ${studentName} · ${value}. ` +
      'Reutilización pendiente de integrar con EcoArte.';

  } catch (e) {
    console.error('Error cargando logros:', e);

    $('logrosSource').textContent =
      'No se pudieron cargar las estadísticas de Firestore.';
  }
}

window.ecoRetoUpdateLogros = updateLogros;

async function load() {
  const version = ++loadVersion;
  const selectedStudent = student;
  const selectedMonth = month;

  rows = [];

  if (!ready || !selectedStudent) {
    render();
    await updateLogros();
    return;
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, 'recolecciones'),
        where('alumnoId', '==', selectedStudent),
        where('mes', '==', selectedMonth)
      )
    );

    if (
      version !== loadVersion ||
      student !== selectedStudent ||
      month !== selectedMonth
    ) return;

    rows = snap.docs.map(d => d.data());

    render();
    await updateLogros();

  } catch (e) {
    console.error('Error consultando recolecciones:', e);

    if (version !== loadVersion) return;

    status(
      '❌ No se pudieron consultar los registros: ' +
      (e.code || e.message)
    );
  }
}

function updateDate() {
  const start = dateForWeek(month, week);

  const end = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0
  ).getDate();

  const last = `${month}-${String(
    week === 4 ? end : week * 7
  ).padStart(2, '0')}`;

  $('retoDate').min = start;
  $('retoDate').max = last;

  const current = today();

  $('retoDate').value =
    current >= start && current <= last
      ? current
      : start;

  statusOverride = '';
  render();
}

window.ecoRetoSelectWeek = w => {
  if (busy) return;

  week = w;
  updateDate();
};

$('retoDate').addEventListener('change', () => {
  if (busy) return;

  const v = $('retoDate').value;

  if (
    monthOf(v) !== month ||
    weekOf(v) !== week
  ) {
    updateDate();
    return;
  }

  statusOverride = '';
  render();
});

$('retoMonth').addEventListener('change', async () => {
  if (busy) return;

  month = $('retoMonth').value || monthOf(today());

  week = month === monthOf(today())
    ? weekOf(today())
    : 1;

  updateDate();
  await load();
});

$('retoStudent').addEventListener('change', async () => {
  if (busy) return;

  student = $('retoStudent').value;
  statusOverride = '';

  await load();
});

async function loadStudents() {
  const sel = $('retoStudent');

  sel.replaceChildren();

  try {
    const snap = await getDocs(
      query(
        collection(db, 'usuarios'),
        where('rol', '==', 'alumno')
      )
    );

    const students = snap.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '')
      );

    sel.add(
      new Option('Selecciona un estudiante', '')
    );

    students.forEach(s => {
      sel.add(
        new Option(
          `${s.nombre || 'Alumno'} (${s.correo || ''})`,
          s.id
        )
      );
    });

    if (!students.length) {
      status('Aún no hay alumnos registrados.');
    }

  } catch (e) {
    console.error('Error cargando alumnos:', e);

    status(
      'No se pudo cargar la lista de alumnos. Revisa los permisos.'
    );
  }
}

// ======================================
// GUARDAR RECOLECCIÓN EN FIRESTORE
// ======================================

window.ecoRetoSave = async () => {
  if (!canEdit()) {
    status(
      '❌ No tienes permiso para guardar o la semana está cerrada.'
    );
    return;
  }

  const fecha = $('retoDate').value;

  if (
    monthOf(fecha) !== month ||
    weekOf(fecha) !== week ||
    fecha > today()
  ) {
    status(
      '❌ Selecciona una fecha válida de la semana actual.'
    );
    return;
  }

  // Capturar valores antes de modificar la interfaz.
  const a = counts();

  if (
    a.some(
      n =>
        !Number.isSafeInteger(n) ||
        n < 0 ||
        n > 10000
    )
  ) {
    status(
      '❌ Las cantidades deben estar entre 0 y 10 000.'
    );
    return;
  }

  const notes = document
    .querySelector('#tab-ecoreto textarea')
    .value.trim();

  if (notes.length > 500) {
    status(
      '❌ La observación no puede superar 500 caracteres.'
    );
    return;
  }

  const selectedStudent = student;
  const selectedMonth = month;
  const selectedWeek = week;
  const currentUser = auth.currentUser;

  if (!currentUser) {
    status('❌ Debes iniciar sesión nuevamente.');
    return;
  }

  busy = true;
  statusOverride = '⏳ Guardando recolección...';

  // No reiniciar los contadores durante el guardado.
  render(true);

  try {
    const id = `${selectedStudent}_${fecha}`;

    const data = {
      alumnoId: selectedStudent,
      fecha: fecha,

      // Corrección del error "mes is not defined".
      mes: selectedMonth,

      semana: selectedWeek,
      anio: Number(fecha.slice(0, 4)),
      mesNumero: Number(fecha.slice(5, 7)),
      dia: Number(fecha.slice(8, 10)),

      plastico: a[0],
      papel: a[1],
      carton: a[2],
      metal: a[3],
      otros: a[4],

      observaciones: notes,
      registradoPor: currentUser.uid,
      actualizadoEn: serverTimestamp()
    };

    await setDoc(
      doc(db, 'recolecciones', id),
      data
    );

    console.log(
      'Recolección guardada correctamente:',
      id,
      data
    );

    // Actualizar registros desde Firebase.
    const snap = await getDocs(
      query(
        collection(db, 'recolecciones'),
        where('alumnoId', '==', selectedStudent),
        where('mes', '==', selectedMonth)
      )
    );

    rows = snap.docs.map(d => d.data());

    busy = false;

    // Actualizar contadores y estadísticas.
    render();
    await updateLogros();

    statusOverride =
      '✅ Recolección guardada correctamente en Firebase.';

    render();

  } catch (e) {
    console.error(
      'Error al guardar la recolección:',
      e
    );

    statusOverride =
      '❌ No se pudo completar la operación: ' +
      (e.code || e.message);

    busy = false;

    // Conservar cantidades para reintentar.
    render(true);

  } finally {
    busy = false;
  }
};

// ======================================
// AUTENTICACIÓN Y CARGA INICIAL
// ======================================

onAuthStateChanged(auth, async u => {
  ++loadVersion;

  ready = false;
  teacher = false;
  student = '';
  rows = [];
  busy = false;
  statusOverride = '';

  if (u) {
    try {
      await u.reload();

      if (u.emailVerified) {
        const profile = await getDoc(
          doc(db, 'usuarios', u.uid)
        );

        teacher =
          profile.exists() &&
          profile.data().rol === 'docente';

        ready = true;

        if (teacher) {
          await loadStudents();
        } else {
          student = u.uid;
        }
      }

    } catch (e) {
      console.error(
        'Error verificando usuario:',
        e
      );
    }
  }

  if (!teacher) {
    $('retoStudent').replaceChildren();
  }

  month = monthOf(today());
  $('retoMonth').value = month;
  week = weekOf(today());

  updateDate();
  await load();
});

