
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

// ==========================================
// CONFIGURACION FIREBASE
// ==========================================

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

const fields = [
  'plastico',
  'papel',
  'carton',
  'metal',
  'otros'
];

let teacher = false;
let week = 1;
let month = '';
let student = '';
let rows = [];
let busy = false;
let ready = false;
let statusOverride = '';
let loadVersion = 0;

// ==========================================
// FECHAS
// ==========================================

const localISO = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = () => localISO(new Date());

const monthOf = d => d.slice(0, 7);

const weekOf = d =>
  Math.min(
    4,
    Math.floor(
      (Number(d.slice(8, 10)) - 1) / 7
    ) + 1
  );

const dateForWeek = (m, w) =>
  `${m}-${String(
    (w - 1) * 7 + 1
  ).padStart(2, '0')}`;

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

// ==========================================
// ESTADO Y CONTADORES
// ==========================================

function status(message) {
  const element = $('retoStatus');

  if (element) {
    element.textContent = message;
  }
}

function counts() {
  return fields.map((_, i) => {
    const element = $('c' + (i + 1));

    return element
      ? Number(element.textContent) || 0
      : 0;
  });
}

function setCounts(values) {
  fields.forEach((_, i) => {
    const element = $('c' + (i + 1));

    if (element) {
      element.textContent = String(
        values?.[i] ?? 0
      );
    }
  });
}

function clearForm() {
  setCounts([0, 0, 0, 0, 0]);

  const notes = document.querySelector(
    '#tab-ecoreto textarea'
  );

  if (notes) {
    notes.value = '';
  }
}

function canEdit() {
  return (
    ready &&
    teacher &&
    !!student &&
    month === monthOf(today()) &&
    week === weekOf(today()) &&
    !busy
  );
}

window.ecoRetoCanEdit = canEdit;

// ==========================================
// INTERFAZ ECORETO
// ==========================================

function render(preserveValues = false) {
  const allowed = canEdit();

  const saveButton = $('retoSave');

  const selectedDate = $('retoDate')?.value;

  // Buscar si existe una recoleccion
  // del estudiante en la fecha elegida.
  const item = rows.find(
    r => r.fecha === selectedDate
  );

  const existingRecord = !!item;

  // ======================================
  // BOTON GUARDAR / ACTUALIZAR
  // ======================================

  if (saveButton) {
    saveButton.hidden = !allowed && !busy;
    saveButton.disabled = busy;

    if (busy) {
      saveButton.textContent =
        '⏳ Procesando...';

    } else if (existingRecord) {
      saveButton.textContent =
        '✏️ Actualizar recolección';

    } else {
      saveButton.textContent =
        '💾 Guardar recolección';
    }
  }

  // ======================================
  // BOTONES DE CANTIDADES
  // ======================================

  document.querySelectorAll(
    '#tab-ecoreto .btn-circle'
  ).forEach(button => {
    button.disabled = !allowed;

    button.style.opacity =
      allowed ? '1' : '.4';
  });

  // ======================================
  // SELECTOR DE ESTUDIANTE
  // ======================================

  if ($('retoStudentLabel')) {
    $('retoStudentLabel').hidden = !teacher;
  }

  // ======================================
  // FECHA
  // ======================================

  if ($('retoDate')) {
    $('retoDate').disabled = !allowed;
  }

  const notes = document.querySelector(
    '#tab-ecoreto textarea'
  );

  // Recuperar datos del registro existente
  // cuando se selecciona estudiante o fecha.
  if (!preserveValues) {
    setCounts(
      item
        ? fields.map(
            k => Number(item[k]) || 0
          )
        : [0, 0, 0, 0, 0]
    );

    if (notes) {
      notes.value =
        item?.observaciones || '';
    }
  }

  if (notes) {
    notes.disabled = !allowed;
  }

  // ======================================
  // SEMANAS
  // ======================================

  document.querySelectorAll(
    '#tab-ecoreto .week-btn'
  ).forEach((button, i) => {
    button.classList.toggle(
      'active',
      i + 1 === week
    );
  });

  // ======================================
  // TOTALES SEMANALES
  // ======================================

  const weekRows = rows.filter(
    r => weekOf(r.fecha) === week
  );

  const totals = fields.map(k =>
    weekRows.reduce(
      (total, r) =>
        total + (Number(r[k]) || 0),
      0
    )
  );

  const sum = totals.reduce(
    (a, b) => a + b,
    0
  );

  if (statusOverride) {
    status(statusOverride);
    return;
  }

  if (!ready) {
    status(
      'Inicia sesión con correo verificado para consultar EcoReto.'
    );
    return;
  }

  if (!student) {
    status(
      'Selecciona un estudiante para continuar.'
    );
    return;
  }

  status(
    `${allowed
      ? '✏️ Semana abierta'
      : '🔒 Semana de solo lectura'} · ` +
    `${weekRows.length} días registrados · ` +
    `Total semanal: ${sum} unidades ` +
    `(${totals.join(' / ')}).`
  );
}

// ==========================================
// MIS LOGROS
// ==========================================

async function updateLogros() {
  const selector = $('logrosMonthSelect');

  if (!selector) return;

  const value = selector.value;

  if (!value) return;

  const [name, year] = value.split(' ');

  const selectedMonth =
    `${year}-${String(
      months[name] || 1
    ).padStart(2, '0')}`;

  function setText(id, value) {
    if ($(id)) {
      $(id).textContent = String(value);
    }
  }

  function clearLogros() {
    setText('logroRecolectados', 0);
    setText('logroAcumulado', 0);
    setText('logroReutilizados', 0);
    setText('logroReducidos', 0);
    setText('logroMetaPct', '0%');

    if ($('logroMetaBar')) {
      $('logroMetaBar').style.width = '0%';
    }
  }

  if (!ready || !student) {
    clearLogros();
    return;
  }

  const requestedStudent = student;

  try {
    const snap = await getDocs(
      query(
        collection(db, 'recolecciones'),
        where(
          'alumnoId',
          '==',
          requestedStudent
        ),
        where(
          'mes',
          '==',
          selectedMonth
        )
      )
    );

    if (requestedStudent !== student) {
      return;
    }

    const total = snap.docs.reduce(
      (sum, document) => {
        const data = document.data();

        return sum + fields.reduce(
          (n, k) =>
            n + (Number(data[k]) || 0),
          0
        );
      },
      0
    );

    const reused = 0;

    setText(
      'logroRecolectados',
      total
    );

    setText(
      'logroAcumulado',
      total
    );

    setText(
      'logroReutilizados',
      reused
    );

    setText(
      'logroReducidos',
      total - reused
    );

    const percentage = Math.min(
      100,
      Math.round(
        (total / 300) * 100
      )
    );

    setText(
      'logroMetaPct',
      percentage + '%'
    );

    if ($('logroMetaBar')) {
      $('logroMetaBar').style.width =
        percentage + '%';
    }

    if ($('logrosSource')) {
      const studentName = teacher
        ? $('retoStudent')
            ?.selectedOptions[0]
            ?.textContent || 'estudiante'
        : 'tu cuenta';

      $('logrosSource').textContent =
        `Recolección real de ${studentName} · ${value}. ` +
        'Reutilización pendiente de integrar con EcoArte.';
    }

  } catch (error) {
    console.error(
      'Error cargando logros:',
      error
    );

    if ($('logrosSource')) {
      $('logrosSource').textContent =
        'No se pudieron cargar las estadísticas de Firestore.';
    }
  }
}

window.ecoRetoUpdateLogros = updateLogros;

// ==========================================
// CONSULTAR RECOLECCIONES
// ==========================================

async function load() {
  const version = ++loadVersion;

  const requestedStudent = student;
  const requestedMonth = month;

  rows = [];

  if (!ready || !student) {
    render();
    await updateLogros();
    return;
  }

  try {
    const snap = await getDocs(
      query(
        collection(db, 'recolecciones'),
        where(
          'alumnoId',
          '==',
          requestedStudent
        ),
        where(
          'mes',
          '==',
          requestedMonth
        )
      )
    );

    if (
      version !== loadVersion ||
      requestedStudent !== student ||
      requestedMonth !== month
    ) {
      return;
    }

    rows = snap.docs.map(
      document => document.data()
    );

    render();

    await updateLogros();

  } catch (error) {
    console.error(
      'Error consultando recolecciones:',
      error
    );

    if (version !== loadVersion) {
      return;
    }

    statusOverride =
      '❌ No se pudieron consultar los registros: ' +
      (error.code || error.message);

    render();
  }
}

// ==========================================
// CONTROL DE SEMANAS Y FECHAS
// ==========================================

function updateDate() {
  const start = dateForWeek(
    month,
    week
  );

  const lastDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0
  ).getDate();

  const last =
    `${month}-${String(
      week === 4
        ? lastDay
        : week * 7
    ).padStart(2, '0')}`;

  const dateInput = $('retoDate');

  if (!dateInput) return;

  dateInput.min = start;
  dateInput.max = last;

  const current = today();

  dateInput.value =
    current >= start && current <= last
      ? current
      : start;

  statusOverride = '';

  render();
}

window.ecoRetoSelectWeek = w => {
  if (busy) return;

  const selected = Number(w);

  if (
    !Number.isInteger(selected) ||
    selected < 1 ||
    selected > 4
  ) {
    return;
  }

  week = selected;

  updateDate();
};

if ($('retoDate')) {
  $('retoDate').addEventListener(
    'change',
    () => {
      if (busy) return;

      const value = $('retoDate').value;

      if (
        monthOf(value) !== month ||
        weekOf(value) !== week
      ) {
        updateDate();
        return;
      }

      statusOverride = '';

      render();
    }
  );
}

if ($('retoMonth')) {
  $('retoMonth').addEventListener(
    'change',
    async () => {
      if (busy) return;

      month =
        $('retoMonth').value ||
        monthOf(today());

      week =
        month === monthOf(today())
          ? weekOf(today())
          : 1;

      updateDate();

      await load();
    }
  );
}

if ($('retoStudent')) {
  $('retoStudent').addEventListener(
    'change',
    async () => {
      if (busy) return;

      student = $('retoStudent').value;

      statusOverride = '';

      await load();
    }
  );
}

// ==========================================
// CARGAR ESTUDIANTES
// ==========================================

async function loadStudents() {
  const selector = $('retoStudent');

  if (!selector) return;

  selector.replaceChildren();

  selector.add(
    new Option(
      'Selecciona un estudiante',
      ''
    )
  );

  try {
    const snap = await getDocs(
      query(
        collection(db, 'usuarios'),
        where(
          'rol',
          '==',
          'alumno'
        )
      )
    );

    const students = snap.docs
      .map(document => ({
        id: document.id,
        ...document.data()
      }))
      .sort(
        (a, b) =>
          (a.nombre || '').localeCompare(
            b.nombre || ''
          )
      );

    students.forEach(s => {
      selector.add(
        new Option(
          `${s.nombre || 'Alumno'} (${s.correo || ''})`,
          s.id
        )
      );
    });

    if (!students.length) {
      status(
        'Aún no hay alumnos registrados.'
      );
    }

  } catch (error) {
    console.error(
      'Error cargando estudiantes:',
      error
    );

    statusOverride =
      '❌ No se pudo cargar la lista de alumnos: ' +
      (error.code || error.message);

    status(statusOverride);
  }
}

// ==========================================
// GUARDAR / ACTUALIZAR RECOLECCION
// ==========================================

window.ecoRetoSave = async () => {
  if (!canEdit()) {
    status(
      '❌ No tienes permiso para guardar o la semana está cerrada.'
    );
    return;
  }

  const fecha = $('retoDate').value;

  const selectedStudent = student;
  const selectedMonth = month;
  const selectedWeek = week;

  const user = auth.currentUser;

  if (!user) {
    status(
      '❌ Debes iniciar sesión.'
    );
    return;
  }

  if (
    monthOf(fecha) !== selectedMonth ||
    weekOf(fecha) !== selectedWeek ||
    fecha > today()
  ) {
    status(
      '❌ Selecciona una fecha válida de la semana actual.'
    );
    return;
  }

  // Comprobar si ya existe registro.
  const existingRecord = rows.some(
    r => r.fecha === fecha
  );

  const cantidades = counts();

  if (
    cantidades.some(
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

  const notesInput = document.querySelector(
    '#tab-ecoreto textarea'
  );

  const observaciones =
    notesInput?.value.trim() || '';

  if (observaciones.length > 500) {
    status(
      '❌ La observación no puede superar 500 caracteres.'
    );
    return;
  }

  const documentId =
    `${selectedStudent}_${fecha}`;

  const data = {
    alumnoId: selectedStudent,
    fecha: fecha,
    mes: selectedMonth,
    semana: selectedWeek,
    anio: Number(
      fecha.slice(0, 4)
    ),
    mesNumero: Number(
      fecha.slice(5, 7)
    ),
    dia: Number(
      fecha.slice(8, 10)
    ),
    plastico: cantidades[0],
    papel: cantidades[1],
    carton: cantidades[2],
    metal: cantidades[3],
    otros: cantidades[4],
    observaciones: observaciones,
    registradoPor: user.uid,
    actualizadoEn: serverTimestamp()
  };

  busy = true;

  statusOverride = existingRecord
    ? '⏳ Actualizando recolección en Firebase...'
    : '⏳ Guardando recolección en Firebase...';

  render(true);

  let saved = false;

  try {
    console.log(
      'ECORETO - Documento:',
      documentId
    );

    console.log(
      'ECORETO - Datos:',
      data
    );

    await setDoc(
      doc(
        db,
        'recolecciones',
        documentId
      ),
      data
    );

    saved = true;

    // Actualizar registros locales.
    rows = rows.filter(
      r => r.fecha !== fecha
    );

    rows.push({
      ...data,
      actualizadoEn: new Date()
    });

    // Mantener comportamiento de
    // limpieza despues de guardar.
    clearForm();

    statusOverride = existingRecord
      ? '✅ Recolección actualizada correctamente en Firebase.'
      : '✅ Recolección guardada correctamente en Firebase.';

  } catch (error) {
    console.error(
      'ECORETO - ERROR:',
      error
    );

    statusOverride =
      '❌ Error al guardar: ' +
      (error.code || error.message);

  } finally {
    busy = false;

    // Conserva los valores actuales.
    // Si guardo correctamente, quedan en 0.
    // Si fallo, mantiene los ingresados.
    render(true);
  }

  if (saved) {
    try {
      await updateLogros();

    } catch (error) {
      console.error(
        'ECORETO - Error actualizando logros:',
        error
      );
    }

    status(statusOverride);
  }
};

// ==========================================
// AUTENTICACION Y CARGA INICIAL
// ==========================================

onAuthStateChanged(
  auth,
  async user => {
    ++loadVersion;

    ready = false;
    teacher = false;
    student = '';
    rows = [];
    busy = false;
    statusOverride = '';

    if (user) {
      try {
        await user.reload();

        if (user.emailVerified) {
          const profile = await getDoc(
            doc(
              db,
              'usuarios',
              user.uid
            )
          );

          if (profile.exists()) {
            const profileData =
              profile.data();

            teacher =
              profileData.rol === 'docente';

            ready = true;

            if (teacher) {
              await loadStudents();
            } else {
              student = user.uid;
            }

          } else {
            statusOverride =
              '❌ No se encontró tu perfil de usuario.';
          }

        } else {
          statusOverride =
            '⚠️ Verifica tu correo electrónico para continuar.';
        }

      } catch (error) {
        console.error(
          'ECORETO - Error de autenticación:',
          error
        );

        statusOverride =
          '❌ Error verificando usuario: ' +
          (error.code || error.message);
      }
    }

    if (
      !teacher &&
      $('retoStudent')
    ) {
      $('retoStudent').replaceChildren();
    }

    month = monthOf(today());

    if ($('retoMonth')) {
      $('retoMonth').value = month;
    }

    week = weekOf(today());

    updateDate();

    await load();
  }
);


