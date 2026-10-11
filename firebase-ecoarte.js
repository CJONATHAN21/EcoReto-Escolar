import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,addDoc,updateDoc,query,where,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const CLOUD_NAME='hohksfnm',UPLOAD_PRESET='ecoarte_escolar';
let user=null,role='invitado',projects=[],current=0,records=[],saving=false,session=0;
const templates=(window.ecoProjects||ecoProjects).map((p,i)=>({...p,id:`base_${i}`,source:'base'}));
const notify=(title,message)=>{if(typeof window.openModal==='function')window.openModal(title,message);else alert(title+'\n'+message)};
const text=(node,value)=>{node.textContent=String(value??'');return node};
const make=(tag,className='',content='')=>{const e=document.createElement(tag);if(className)e.className=className;if(content)text(e,content);return e};
const isTeacher=()=>!!user&&role==='docente';
const isStudent=()=>!!user&&role==='alumno';
const validQty=(n,max=100000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const getProject=()=>projects[current];
const close=id=>{$(id).hidden=true;document.body.style.overflow=''};
const open=id=>{$(id).hidden=false;document.body.style.overflow='hidden'};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function normalize(p,id){return {...p,id,materials:(p.materials||[]).map(m=>Array.isArray(m)?m:[m.nombre,m.icono||'♻️',m.cantidad]),steps:p.steps||[]};}
async function loadProjects(){
 const token=session;
 try{
  const snap=await getDocs(collection(db,'manualidades'));
  if(token!==session)return;
  projects=[...templates,...snap.docs.map(d=>normalize(d.data(),d.id))];
  renderProjects();
 }catch(e){console.error('EcoArte plantillas:',e);if(token===session){projects=[...templates];renderProjects();}}
}
function renderProjects(){
 const grid=$('ecoArteGallery');grid.replaceChildren();
 projects.forEach((p,i)=>{
  const card=make('article','art-card eco-project-card');
  const img=make('img','art-img');img.src=p.image;img.alt=p.name;img.loading='lazy';
  const info=make('div','art-info');info.append(make('h4','',p.name),make('p','',p.description));
  const actions=make('div','eco-card-actions');
  const view=make('button','eco-view','👁 Ver / Materiales');view.onclick=()=>window.showEcoDetail(i);
  const pdf=make('button','eco-pdf','📄 Descargar PDF');pdf.onclick=()=>window.downloadEcoGuide(i);
  actions.append(view,pdf);card.append(img,info,actions);grid.append(card);
 });
 const gallery=$('mainPublicGallery');
 // Conservar las tarjetas de demostración existentes y añadir las publicadas por el docente.
 gallery.querySelectorAll('[data-eco-dynamic]').forEach(x=>x.remove());
 projects.filter(p=>p.source!=='base').forEach(p=>{
  const card=make('div','art-card');card.dataset.ecoDynamic='1';
  const img=make('img','art-img');img.src=p.image;img.alt=p.name;img.loading='lazy';
  const info=make('div','art-info',p.name);
  const button=make('button','eco-view','👁 Ver / Materiales');button.onclick=()=>window.showEcoDetail(projects.indexOf(p));
  card.append(img,info,button);gallery.append(card);
 });
}
window.showEcoDetail=i=>{
 if(!projects[i])return;current=i;const p=getProject();
 text($('ecoDetailTitle'),'🎨 '+p.name);$('ecoDetailImage').src=p.image;$('ecoDetailImage').alt=p.name;
 $('ecoSteps').replaceChildren(...p.steps.map(s=>make('li','',s)));
 $('ecoMaterialList').replaceChildren(...p.materials.map(m=>make('li','',m[1]+'  '+m[0])));
 text($('ecoDetailFinish'),'¡Y listo! Ya tienes tu '+p.name.toLowerCase()+'.');
 $('ecoRegisterBtn').hidden=!isStudent();
 open('ecoDetailOverlay');
};
window.closeEcoDetail=()=>close('ecoDetailOverlay');
window.openEcoPreview=()=>notify('🎨 '+getProject().name,getProject().description+'\n\n'+getProject().steps.map((x,i)=>`${i+1}. ${x}`).join('\n'));
window.downloadEcoGuide=index=>{
 const p=projects[index===undefined?current:index];if(!p)return;
 if(p.pdf?.startsWith('https://')){window.open(p.pdf,'_blank','noopener,noreferrer');return;}
 const body=p.name+'\n\nMATERIALES\n'+p.materials.map(m=>'- '+m[0]).join('\n')+'\n\nPROCEDIMIENTO\n'+p.steps.map((s,i)=>`${i+1}. ${s}`).join('\n');
 window.downloadPdf?.(p.pdf||'Guia_EcoArte.pdf',body);
};
window.showEcoRegister=()=>{
 if(!isStudent())return notify('Acceso restringido','Solo los estudiantes pueden registrar manualidades realizadas.');
 const p=getProject();$('ecoRegisterImage').src=p.image;text($('ecoRegisterName'),p.name);$('ecoProductQuantity').value=1;
 $('ecoRegisterMaterials').replaceChildren(...p.materials.map(m=>{
  const tr=make('tr'),label=make('td','',m[1]+' '+m[0]),td=make('td'),input=make('input');
  input.type='number';input.min='0';input.max='100000';input.step='1';input.required=true;input.value=m[2];input.dataset.material=m[0];input.dataset.icon=m[1];
  td.append(input);tr.append(label,td);return tr;
 }));close('ecoDetailOverlay');open('ecoRegisterOverlay');
};
window.closeEcoRegister=()=>{close('ecoRegisterOverlay');open('ecoDetailOverlay')};
window.changeEcoProduct=delta=>{const input=$('ecoProductQuantity');input.value=Math.max(1,Math.min(1000,(Number(input.value)||1)+delta))};
window.saveEcoRegister=async event=>{
 event.preventDefault();if(!isStudent()||saving)return;
 const p=getProject(),productos=Number($('ecoProductQuantity').value);
 const materiales=[...document.querySelectorAll('#ecoRegisterMaterials input')].map(x=>({nombre:x.dataset.material,icono:x.dataset.icon,cantidad:Number(x.value)}));
 if(!validQty(productos,1000)||productos<1||materiales.length===0||materiales.length>20||materiales.some(m=>!validQty(m.cantidad,100000))||!materiales.some(m=>m.cantidad>0))return alert('Revisa la cantidad de productos y materiales utilizados.');
 saving=true;const button=$('ecoRegisterForm').querySelector('[type=submit]');button.disabled=true;
 try{
  await addDoc(collection(db,'manualidades_realizadas'),{alumnoId:user.uid,proyectoId:p.id,proyectoNombre:p.name,productos,materiales,estado:'pendiente',observacion:'',creadoEn:serverTimestamp(),actualizadoEn:serverTimestamp()});
  close('ecoRegisterOverlay');notify('📨 Enviado al docente','Tu manualidad quedó pendiente de aprobación. No se contabilizará hasta que el docente la apruebe.');await loadRecords();
 }catch(e){console.error(e);alert('No se pudo enviar el registro: '+e.message)}finally{saving=false;button.disabled=false}
};

window.openEcoCreate=()=>{if(!isTeacher())return alert('Solo el docente puede publicar manualidades.');$('ecoCreateForm').reset();text($('ecoCreateStatus'),'');open('ecoCreateOverlay')};
window.closeEcoCreate=()=>{if(!saving)close('ecoCreateOverlay')};
function parseMaterials(raw){return raw.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const [nombre,cantidad,icono]=line.split('|').map(s=>s.trim());return [nombre,icono||'♻️',Number(cantidad)]})}
function parseSteps(raw){return raw.split('\n').map(s=>s.trim()).filter(Boolean)}
async function uploadPhoto(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('Selecciona una fotografía JPG, PNG o WebP de máximo 2 MB.');
 const form=new FormData();form.append('file',file);form.append('upload_preset',UPLOAD_PRESET);
 const response=await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{method:'POST',body:form});
 const result=await response.json();if(!response.ok||!result.secure_url)throw Error(result.error?.message||'No se pudo subir la fotografía.');
 return result.secure_url;
}
$('ecoCreateForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!isTeacher()||saving)return;
 const form=e.currentTarget,values=new FormData(form),nombre=String(values.get('nombre')||'').trim(),description=String(values.get('descripcion')||'').trim(),materials=parseMaterials(String(values.get('materiales')||'')),steps=parseSteps(String(values.get('pasos')||'')),pdf=String(values.get('pdf')||'').trim();
 if(!nombre||nombre.length>100||!description||description.length>600||!materials.length||materials.length>20||materials.some(m=>!m[0]||m[0].length>70||!validQty(m[2],100000)||m[2]===0)||!steps.length||steps.length>20||steps.some(s=>s.length>250))return alert('Revisa los campos. Máximo 20 materiales y 20 pasos; cada cantidad debe ser mayor que cero.');
 if(pdf&&(!pdf.startsWith('https://')||pdf.length>500))return alert('El enlace PDF debe empezar con https://');
 saving=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;
 try{
  text($('ecoCreateStatus'),'Subiendo fotografía a Cloudinary...');
  const image=await uploadPhoto(values.get('foto'));
  text($('ecoCreateStatus'),'Guardando manualidad en Firebase...');
  await addDoc(collection(db,'manualidades'),{name:nombre,description,image,materials,steps,pdf,creadoPor:user.uid,creadoEn:serverTimestamp()});
  close('ecoCreateOverlay');notify('✅ Manualidad publicada','Los alumnos ya pueden consultar esta manualidad y registrar los materiales utilizados.');await loadProjects();
 }catch(err){console.error(err);text($('ecoCreateStatus'),'Error: '+err.message);alert('No se pudo publicar: '+err.message)}finally{saving=false;submit.disabled=false}
});

async function loadRecords(){
 const token=session;if(!user)return;
 try{
  const q=isTeacher()?collection(db,'manualidades_realizadas'):query(collection(db,'manualidades_realizadas'),where('alumnoId','==',user.uid));
  const snap=await getDocs(q);if(token!==session)return;
  records=snap.docs.map(d=>({id:d.id,...d.data()}));renderRecords();updateApprovedTotals();
 }catch(e){console.error('EcoArte registros:',e);if(token===session)text(isTeacher()?$('ecoReviewList'):$('ecoMyRecords'),'No se pudieron cargar los registros: '+e.message)}
}
function renderRecords(){
 const review=$('ecoReviewList'),mine=$('ecoMyRecords');review.replaceChildren();mine.replaceChildren();
 if(isTeacher()){
  const pending=records.filter(r=>r.estado==='pendiente');if(!pending.length)review.append(make('p','','No hay manualidades pendientes de revisión.'));
  pending.forEach(r=>{
   const row=make('div','eco-work-row'),info=make('div');info.append(make('strong','',r.proyectoNombre),make('small','',`Alumno: ${r.alumnoId} · Productos: ${r.productos}`),make('small','',r.materiales.map(m=>`${m.icono||'♻️'} ${m.nombre}: ${m.cantidad}`).join(' · ')));
   const actions=make('div'),approve=make('button','approve','✓ Aprobar'),observe=make('button','observe','✎ Observar');
   approve.onclick=()=>decide(r,'aprobado');observe.onclick=()=>decide(r,'observado');actions.append(approve,observe);row.append(info,actions);review.append(row);
  });
 }else if(isStudent()){
  if(!records.length)mine.append(make('p','','Aún no registras manualidades realizadas.'));
  records.forEach(r=>{const row=make('div','eco-work-row'),info=make('div');info.append(make('strong','',r.proyectoNombre),make('small','',`${r.productos} producto(s) · ${r.estado}`));if(r.observacion)info.append(make('small','','Observación: '+r.observacion));row.append(info);mine.append(row)});
 }
}
async function decide(r,state){
 if(!isTeacher()||r.estado!=='pendiente')return;
 let observation='';if(state==='observado'){const value=prompt('Escribe el motivo de la observación (obligatorio):');if(value===null)return;observation=value.trim();if(!observation||observation.length>500)return alert('Escribe un motivo de máximo 500 caracteres.');}
 if(state==='aprobado'&&!confirm(`¿Aprobar ${r.productos} producto(s) de ${r.proyectoNombre}?`))return;
 try{await updateDoc(doc(db,'manualidades_realizadas',r.id),{estado:state,observacion:observation,revisadoPor:user.uid,revisadoEn:serverTimestamp(),actualizadoEn:serverTimestamp()});await loadRecords();notify('Registro revisado',state==='aprobado'?'Se aprobó y contará en los logros del alumno.':'Se registró la observación.');}
 catch(e){console.error(e);alert('No se pudo revisar: '+e.message)}
}
function updateApprovedTotals(){
 if(!isStudent())return;
 const selector=$('logrosMonthSelect');if(!selector)return;
 const monthName=selector.value||'',names={Enero:1,Febrero:2,Marzo:3,Abril:4,Mayo:5,Junio:6,Julio:7,Agosto:8,Septiembre:9,Octubre:10,Noviembre:11,Diciembre:12};const [n,y]=monthName.split(' ');const month=`${y}-${String(names[n]||1).padStart(2,'0')}`;
 const approved=records.filter(r=>r.estado==='aprobado'&&r.creadoEn?.toDate?.().toISOString().slice(0,7)===month);
 const total=approved.reduce((s,r)=>s+(r.materiales||[]).reduce((t,m)=>t+(Number(m.cantidad)||0),0),0);
 text($('logroReutilizados'),total);
 const collected=Number($('logroRecolectados')?.textContent)||0;text($('logroReducidos'),Math.max(0,collected-total));
}
$('logrosMonthSelect')?.addEventListener('change',()=>setTimeout(updateApprovedTotals,500));
// Firebase-reto actualiza los indicadores de manera asíncrona: reponer EcoArte tras cada actualización.
const target=$('logroRecolectados');if(target){const observer=new MutationObserver(()=>updateApprovedTotals());observer.observe(target,{childList:true,characterData:true,subtree:true});}
onAuthStateChanged(auth,async u=>{
 session++;user=u?.emailVerified?u:null;role='invitado';records=[];
 if(user){try{const snap=await getDoc(doc(db,'usuarios',user.uid));role=snap.data()?.rol==='docente'?'docente':'alumno';}catch(e){console.error('EcoArte perfil:',e)}}
 $('ecoCreateBtn').hidden=!isTeacher();$('ecoTeacherReview').hidden=!isTeacher();$('ecoStudentRecords').hidden=!isStudent();$('ecoRegisterBtn').hidden=!isStudent();
 await loadProjects();if(user)await loadRecords();else{text($('logroReutilizados'),0)}
});
