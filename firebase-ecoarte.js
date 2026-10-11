
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
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

const CLOUD_NAME = 'hohksfnm';
const UPLOAD_PRESET = 'ecoarte_escolar';

let user = null;
let role = 'invitado';
let projects = [];
let current = 0;
let records = [];
let saving = false;
let session = 0;

const originalProjects =
  window.ecoProjects ||
  (typeof ecoProjects !== 'undefined' ? ecoProjects : []);

const templates = originalProjects.map((p, i) => ({
  ...p,
  id: `base_${i}`,
  source: 'base'
}));

function notify(title, message) {
  if (typeof window.openModal === 'function') {
    window.openModal(title, message);
  } else {
    alert(title + '\n' + message);
  }
}

function text(node, value) {
  if (node) {
    node.textContent = String(value ?? '');
  }
  return node;
}

function make(tag, className = '', content = '') {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (content !== '') {
    text(element, content);
  }

  return element;
}

const isTeacher = () => !!user && role === 'docente';
const isStudent = () => !!user && role === 'alumno';

const validQty = (n, max = 100000) =>
  Number.isSafeInteger(n) &&
  n >= 0 &&
  n <= max;

const getProject = () => projects[current];

function close(id) {
  const element = $(id);
  if (element) element.hidden = true;
  document.body.style.overflow = '';
}

function open(id) {
  const element = $(id);
  if (element) element.hidden = false;
  document.body.style.overflow = 'hidden';
}

/*
 * NORMALIZACIÓN DE MATERIALES
 *
 * Firestore:
 * { nombre, icono, cantidad }
 *
 * Interfaz original:
 * [nombre, icono, cantidad]
 *
 * Se admiten ambos formatos para no afectar
 * las cinco manualidades existentes.
 */
function normalizeMaterial(material) {
  if (Array.isArray(material)) {
    return [
      String(material[0] ?? ''),
      String(material[1] || '♻️'),
      Number(material[2] ?? 1)
    ];
  }

  return [
    String(material?.nombre ?? ''),
    String(material?.icono || '♻️'),
    Number(material?.cantidad ?? 1)
  ];
}

function normalize(project, id) {
  return {
    ...project,
    id,
    source: project.source || 'firebase',
    materials: (project.materials || [])
      .map(normalizeMaterial),
    steps: Array.isArray(project.steps)
      ? project.steps
      : []
  };
}

/*
 * CARGAR MANUALIDADES
 */
async function loadProjects() {
  const token = session;

  try {
    const snapshot = await getDocs(
      collection(db, 'manualidades')
    );

    if (token !== session) return;

    projects = [
      ...templates.map(p => normalize(p, p.id)),
      ...snapshot.docs.map(d =>
        normalize(d.data(), d.id)
      )
    ];

    renderProjects();

  } catch (error) {
    console.error('EcoArte - cargar manualidades:', error);

    if (token === session) {
      projects = templates.map(p => normalize(p, p.id));
      renderProjects();
    }
  }
}

/*
 * MOSTRAR TARJETAS
 */
function renderProjects() {
  const grid = $('ecoArteGallery');

  if (grid) {
    grid.replaceChildren();

    projects.forEach((project, index) => {
      const card = make(
        'article',
        'art-card eco-project-card'
      );

      const image = make('img', 'art-img');
      image.src = project.image || '';
      image.alt = project.name || 'Manualidad';
      image.loading = 'lazy';

      const info = make('div', 'art-info');

      info.append(
        make('h4', '', project.name),
        make('p', '', project.description)
      );

      const actions = make(
        'div',
        'eco-card-actions'
      );

      const view = make(
        'button',
        'eco-view',
        '👁 Ver / Materiales'
      );

      view.type = 'button';
      view.onclick = () =>
        window.showEcoDetail(index);

      const pdf = make(
        'button',
        'eco-pdf',
        '📄 Descargar PDF'
      );

      pdf.type = 'button';
      pdf.onclick = () =>
        window.downloadEcoGuide(index);

      actions.append(view, pdf);
      card.append(image, info, actions);
      grid.append(card);
    });
  }

  const gallery = $('mainPublicGallery');

  if (!gallery) return;

  gallery
    .querySelectorAll('[data-eco-dynamic]')
    .forEach(element => element.remove());

  projects
    .filter(project => project.source !== 'base')
    .forEach(project => {
      const card = make('div', 'art-card');
      card.dataset.ecoDynamic = '1';

      const image = make('img', 'art-img');
      image.src = project.image || '';
      image.alt = project.name || 'Manualidad';
      image.loading = 'lazy';

      const info = make(
        'div',
        'art-info',
        project.name
      );

      const button = make(
        'button',
        'eco-view',
        '👁 Ver / Materiales'
      );

      button.type = 'button';

      button.onclick = () => {
        const index = projects.indexOf(project);
        window.showEcoDetail(index);
      };

      card.append(image, info, button);
      gallery.append(card);
    });
}

/*
 * DETALLE DE MANUALIDAD
 */
window.showEcoDetail = index => {
  if (!projects[index]) return;

  current = index;

  const project = getProject();

  text(
    $('ecoDetailTitle'),
    '🎨 ' + project.name
  );

  const image = $('ecoDetailImage');

  if (image) {
    image.src = project.image || '';
    image.alt = project.name || '';
  }

  const steps = $('ecoSteps');

  if (steps) {
    steps.replaceChildren(
      ...project.steps.map(step =>
        make('li', '', step)
      )
    );
  }

  const materials = $('ecoMaterialList');

  if (materials) {
    materials.replaceChildren(
      ...project.materials.map(material =>
        make(
          'li',
          '',
          `${material[1]} ${material[0]}`
        )
      )
    );
  }

  text(
    $('ecoDetailFinish'),
    '¡Y listo! Ya tienes tu ' +
    project.name.toLowerCase() +
    '.'
  );

  if ($('ecoRegisterBtn')) {
    $('ecoRegisterBtn').hidden = !isStudent();
  }

  open('ecoDetailOverlay');
};

window.closeEcoDetail = () => {
  close('ecoDetailOverlay');
};

window.openEcoPreview = () => {
  const project = getProject();
  if (!project) return;

  notify(
    '🎨 ' + project.name,
    project.description +
    '\n\n' +
    project.steps
      .map((step, index) =>
        `${index + 1}. ${step}`
      )
      .join('\n')
  );
};

/*
 * DESCARGAR GUÍA
 */
window.downloadEcoGuide = index => {
  const project = projects[
    index === undefined ? current : index
  ];

  if (!project) return;

  if (
    project.pdf &&
    project.pdf.startsWith('https://')
  ) {
    window.open(
      project.pdf,
      '_blank',
      'noopener,noreferrer'
    );
    return;
  }

  const content =
    project.name +
    '\n\nMATERIALES\n' +
    project.materials
      .map(m => '- ' + m[0])
      .join('\n') +
    '\n\nPROCEDIMIENTO\n' +
    project.steps
      .map((step, index) =>
        `${index + 1}. ${step}`
      )
      .join('\n');

  if (typeof window.downloadPdf === 'function') {
    window.downloadPdf(
      project.pdf || 'Guia_EcoArte.pdf',
      content
    );
  }
};

/*
 * ALUMNO: REGISTRAR MANUALIDAD REALIZADA
 */
window.showEcoRegister = () => {
  if (!isStudent()) {
    return notify(
      'Acceso restringido',
      'Solo los estudiantes pueden registrar manualidades realizadas.'
    );
  }

  const project = getProject();
  if (!project) return;

  const image = $('ecoRegisterImage');

  if (image) {
    image.src = project.image || '';
  }

  text($('ecoRegisterName'), project.name);

  if ($('ecoProductQuantity')) {
    $('ecoProductQuantity').value = 1;
  }

  const tbody = $('ecoRegisterMaterials');

  if (tbody) {
    tbody.replaceChildren(
      ...project.materials.map(material => {
        const tr = make('tr');

        const label = make(
          'td',
          '',
          `${material[1]} ${material[0]}`
        );

        const td = make('td');
        const input = make('input');

        input.type = 'number';
        input.min = '0';
        input.max = '100000';
        input.step = '1';
        input.required = true;
        input.value = validQty(material[2])
          ? material[2]
          : 1;

        input.dataset.material = material[0];
        input.dataset.icon = material[1];

        td.append(input);
        tr.append(label, td);

        return tr;
      })
    );
  }

  close('ecoDetailOverlay');
  open('ecoRegisterOverlay');
};

window.closeEcoRegister = () => {
  close('ecoRegisterOverlay');
  open('ecoDetailOverlay');
};

window.changeEcoProduct = delta => {
  const input = $('ecoProductQuantity');

  if (!input) return;

  const value = Number(input.value) || 1;

  input.value = Math.max(
    1,
    Math.min(1000, value + delta)
  );
};

window.saveEcoRegister = async event => {
  event.preventDefault();

  if (!isStudent() || saving) return;

  const project = getProject();
  if (!project) return;

  const productos = Number(
    $('ecoProductQuantity')?.value
  );

  const materiales = [
    ...document.querySelectorAll(
      '#ecoRegisterMaterials input'
    )
  ].map(input => ({
    nombre: input.dataset.material || '',
    icono: input.dataset.icon || '♻️',
    cantidad: Number(input.value)
  }));

  if (
    !validQty(productos, 1000) ||
    productos < 1 ||
    materiales.length === 0 ||
    materiales.length > 20 ||
    materiales.some(m =>
      !validQty(m.cantidad, 100000)
    ) ||
    !materiales.some(m => m.cantidad > 0)
  ) {
    alert(
      'Revisa la cantidad de productos y materiales utilizados.'
    );
    return;
  }

  saving = true;

  const button = $('ecoRegisterForm')
    ?.querySelector('[type=submit]');

  if (button) button.disabled = true;

  try {
    await addDoc(
      collection(db, 'manualidades_realizadas'),
      {
        alumnoId: user.uid,
        proyectoId: project.id,
        proyectoNombre: project.name,
        productos,
        materiales,
        estado: 'pendiente',
        observacion: '',
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      }
    );

    close('ecoRegisterOverlay');

    notify(
      '📨 Enviado al docente',
      'Tu manualidad quedó pendiente de aprobación.'
    );

    await loadRecords();

  } catch (error) {
    console.error(
      'EcoArte - registro del alumno:',
      error
    );

    alert(
      'No se pudo enviar el registro: ' +
      error.message
    );

  } finally {
    saving = false;
    if (button) button.disabled = false;
  }
};

/*
 * DOCENTE: ABRIR FORMULARIO DE CREACIÓN
 */
window.openEcoCreate = () => {
  if (!isTeacher()) {
    alert(
      'Solo el docente puede publicar manualidades.'
    );
    return;
  }

  $('ecoCreateForm')?.reset();

  text($('ecoCreateStatus'), '');

  open('ecoCreateOverlay');
};

window.closeEcoCreate = () => {
  if (!saving) {
    close('ecoCreateOverlay');
  }
};

/*
 * CORRECCIÓN PRINCIPAL
 *
 * ANTES:
 * [
 *   ["Botellas", "🧴", 2],
 *   ["Pintura", "🎨", 1]
 * ]
 *
 * AHORA:
 * [
 *   {nombre:"Botellas",icono:"🧴",cantidad:2},
 *   {nombre:"Pintura",icono:"🎨",cantidad:1}
 * ]
 *
 * Este formato es compatible con Firestore.
 */
function parseMaterials(raw) {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line
        .split('|')
        .map(value => value.trim());

      const nombre = parts[0] || '';
      const cantidad = Number(parts[1]);
      const icono = parts[2] || '♻️';

      return {
        nombre,
        icono,
        cantidad
      };
    });
}

function parseSteps(raw) {
  return raw
    .split('\n')
    .map(step => step.trim())
    .filter(Boolean);
}

/*
 * CLOUDINARY
 */
async function uploadPhoto(file) {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (
    !file ||
    !allowedTypes.includes(file.type) ||
    file.size > 2 * 1024 * 1024
  ) {
    throw new Error(
      'Selecciona una fotografía JPG, PNG o WebP de máximo 2 MB.'
    );
  }

  const form = new FormData();

  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: form
    }
  );

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(
      result.error?.message ||
      'No se pudo subir la fotografía.'
    );
  }

  return result.secure_url;
}

/*
 * DOCENTE: PUBLICAR MANUALIDAD
 */
const createForm = $('ecoCreateForm');

if (createForm) {
  createForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (!isTeacher() || saving) return;

      const form = event.currentTarget;
      const values = new FormData(form);

      const nombre = String(
        values.get('nombre') || ''
      ).trim();

      const description = String(
        values.get('descripcion') || ''
      ).trim();

      const materials = parseMaterials(
        String(values.get('materiales') || '')
      );

      const steps = parseSteps(
        String(values.get('pasos') || '')
      );

      const pdf = String(
        values.get('pdf') || ''
      ).trim();

      const invalidMaterials =
        materials.length === 0 ||
        materials.length > 20 ||
        materials.some(material =>
          !material.nombre ||
          material.nombre.length > 70 ||
          !validQty(material.cantidad, 100000) ||
          material.cantidad === 0 ||
          material.icono.length > 20
        );

      const invalidSteps =
        steps.length === 0 ||
        steps.length > 20 ||
        steps.some(step => step.length > 250);

      if (
        !nombre ||
        nombre.length > 100 ||
        !description ||
        description.length > 600 ||
        invalidMaterials ||
        invalidSteps
      ) {
        alert(
          'Revisa los campos. Máximo 20 materiales y 20 pasos; cada cantidad debe ser mayor que cero.'
        );
        return;
      }

      if (
        pdf &&
        (
          !pdf.startsWith('https://') ||
          pdf.length > 500
        )
      ) {
        alert(
          'El enlace PDF debe empezar con https://'
        );
        return;
      }

      saving = true;

      const submit = form.querySelector(
        '[type=submit]'
      );

      if (submit) submit.disabled = true;

      try {
        text(
          $('ecoCreateStatus'),
          'Subiendo fotografía a Cloudinary...'
        );

        const image = await uploadPhoto(
          values.get('foto')
        );

        text(
          $('ecoCreateStatus'),
          'Guardando manualidad en Firebase...'
        );

        /*
         * Los materiales ahora son objetos.
         * Ya no existen arreglos anidados.
         */
        const data = {
          name: nombre,
          description,
          image,
          materials,
          steps,
          pdf,
          source: 'firebase',
          creadoPor: user.uid,
          creadoEn: serverTimestamp()
        };

        await addDoc(
          collection(db, 'manualidades'),
          data
        );

        close('ecoCreateOverlay');

        notify(
          '✅ Manualidad publicada',
          'Los alumnos ya pueden consultar esta manualidad y registrar los materiales utilizados.'
        );

        await loadProjects();

      } catch (error) {
        console.error(
          'EcoArte - publicar manualidad:',
          error
        );

        text(
          $('ecoCreateStatus'),
          'Error: ' + error.message
        );

        alert(
          'No se pudo publicar: ' +
          error.message
        );

      } finally {
        saving = false;

        if (submit) {
          submit.disabled = false;
        }
      }
    }
  );
}

/*
 * CARGAR REGISTROS DE ALUMNOS
 */
async function loadRecords() {
  const token = session;

  if (!user) return;

  try {
    const request = isTeacher()
      ? collection(db, 'manualidades_realizadas')
      : query(
          collection(db, 'manualidades_realizadas'),
          where('alumnoId', '==', user.uid)
        );

    const snapshot = await getDocs(request);

    if (token !== session) return;

    records = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    renderRecords();
    updateApprovedTotals();

  } catch (error) {
    console.error(
      'EcoArte - cargar registros:',
      error
    );

    if (token !== session) return;

    const container = isTeacher()
      ? $('ecoReviewList')
      : $('ecoMyRecords');

    text(
      container,
      'No se pudieron cargar los registros: ' +
      error.message
    );
  }
}

/*
 * BANDEJA DOCENTE Y REGISTROS DEL ALUMNO
 */
function renderRecords() {
  const review = $('ecoReviewList');
  const mine = $('ecoMyRecords');

  if (review) review.replaceChildren();
  if (mine) mine.replaceChildren();

  if (isTeacher() && review) {
    const pending = records.filter(
      record => record.estado === 'pendiente'
    );

    if (!pending.length) {
      review.append(
        make(
          'p',
          '',
          'No hay manualidades pendientes de revisión.'
        )
      );
    }

    pending.forEach(record => {
      const row = make('div', 'eco-work-row');
      const info = make('div');

      info.append(
        make(
          'strong',
          '',
          record.proyectoNombre
        ),
        make(
          'small',
          '',
          `Alumno: ${record.alumnoId} · Productos: ${record.productos}`
        ),
        make(
          'small',
          '',
          (record.materiales || [])
            .map(material =>
              `${material.icono || '♻️'} ` +
              `${material.nombre}: ${material.cantidad}`
            )
            .join(' · ')
        )
      );

      const actions = make('div');

      const approve = make(
        'button',
        'approve',
        '✓ Aprobar'
      );

      const observe = make(
        'button',
        'observe',
        '✎ Observar'
      );

      approve.type = 'button';
      observe.type = 'button';

      approve.onclick = () =>
        decide(record, 'aprobado');

      observe.onclick = () =>
        decide(record, 'observado');

      actions.append(approve, observe);
      row.append(info, actions);
      review.append(row);
    });

  } else if (isStudent() && mine) {
    if (!records.length) {
      mine.append(
        make(
          'p',
          '',
          'Aún no registras manualidades realizadas.'
        )
      );
    }

    records.forEach(record => {
      const row = make('div', 'eco-work-row');
      const info = make('div');

      info.append(
        make(
          'strong',
          '',
          record.proyectoNombre
        ),
        make(
          'small',
          '',
          `${record.productos} producto(s) · ${record.estado}`
        )
      );

      if (record.observacion) {
        info.append(
          make(
            'small',
            '',
            'Observación: ' + record.observacion
          )
        );
      }

      row.append(info);
      mine.append(row);
    });
  }
}

/*
 * DOCENTE: APROBAR U OBSERVAR
 */
async function decide(record, state) {
  if (
    !isTeacher() ||
    record.estado !== 'pendiente'
  ) {
    return;
  }

  let observation = '';

  if (state === 'observado') {
    const value = prompt(
      'Escribe el motivo de la observación (obligatorio):'
    );

    if (value === null) return;

    observation = value.trim();

    if (
      !observation ||
      observation.length > 500
    ) {
      alert(
        'Escribe un motivo de máximo 500 caracteres.'
      );
      return;
    }
  }

  if (
    state === 'aprobado' &&
    !confirm(
      `¿Aprobar ${record.productos} producto(s) de ${record.proyectoNombre}?`
    )
  ) {
    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        'manualidades_realizadas',
        record.id
      ),
      {
        estado: state,
        observacion: observation,
        revisadoPor: user.uid,
        revisadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      }
    );

    await loadRecords();

    notify(
      'Registro revisado',
      state === 'aprobado'
        ? 'Se aprobó y contará en los logros del alumno.'
        : 'Se registró la observación.'
    );

  } catch (error) {
    console.error(
      'EcoArte - revisión:',
      error
    );

    alert(
      'No se pudo revisar: ' +
      error.message
    );
  }
}

/*
 * MIS LOGROS
 */
function updateApprovedTotals() {
  if (!isStudent()) return;

  const selector = $('logrosMonthSelect');
  if (!selector) return;

  const names = {
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

  const [monthName, year] = (
    selector.value || ''
  ).split(' ');

  if (!names[monthName] || !year) return;

  const month =
    `${year}-${String(names[monthName]).padStart(2, '0')}`;

  const approved = records.filter(record => {
    if (record.estado !== 'aprobado') {
      return false;
    }

    const date = record.creadoEn?.toDate?.();

    if (!date) return false;

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0')
    ].join('-') === month;
  });

  const total = approved.reduce(
    (sum, record) =>
      sum +
      (record.materiales || []).reduce(
        (subtotal, material) =>
          subtotal +
          (Number(material.cantidad) || 0),
        0
      ),
    0
  );

  text($('logroReutilizados'), total);

  const collected = Number(
    $('logroRecolectados')?.textContent
  ) || 0;

  text(
    $('logroReducidos'),
    Math.max(0, collected - total)
  );
}

$('logrosMonthSelect')?.addEventListener(
  'change',
  () => updateApprovedTotals()
);

const collectedTarget = $('logroRecolectados');

if (collectedTarget) {
  const observer = new MutationObserver(
    () => updateApprovedTotals()
  );

  observer.observe(collectedTarget, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

/*
 * AUTENTICACIÓN Y PERMISOS
 */
onAuthStateChanged(auth, async authUser => {
  const token = ++session;

  user = authUser?.emailVerified
    ? authUser
    : null;

  role = 'invitado';
  records = [];

  if (user) {
    try {
      const snapshot = await getDoc(
        doc(db, 'usuarios', user.uid)
      );

      if (token !== session) return;

      const storedRole = snapshot.data()?.rol;

      role = storedRole === 'docente'
        ? 'docente'
        : storedRole === 'alumno'
          ? 'alumno'
          : 'invitado';

    } catch (error) {
      console.error(
        'EcoArte - perfil:',
        error
      );
    }
  }

  if (token !== session) return;

  if ($('ecoCreateBtn')) {
    $('ecoCreateBtn').hidden = !isTeacher();
  }

  if ($('ecoTeacherReview')) {
    $('ecoTeacherReview').hidden = !isTeacher();
  }

  if ($('ecoStudentRecords')) {
    $('ecoStudentRecords').hidden = !isStudent();
  }

  if ($('ecoRegisterBtn')) {
    $('ecoRegisterBtn').hidden = !isStudent();
  }

  await loadProjects();

  if (token !== session) return;

  if (user) {
    await loadRecords();
  } else {
    text($('logroReutilizados'), 0);
  }
});
