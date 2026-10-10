import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,collection,query,where,getDocs,getDoc,doc,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const fields=['plastico','papel','carton','metal','otros'];
let teacher=false,week=1,month='',student='',rows=[],busy=false,ready=false;
const localISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=()=>localISO(new Date());
const monthOf=d=>d.slice(0,7);
const weekOf=d=>Math.min(4,Math.floor((Number(d.slice(8,10))-1)/7)+1);
const dateForWeek=(m,w)=>`${m}-${String((w-1)*7+1).padStart(2,'0')}`;
const status=msg=>{$('retoStatus').textContent=msg};
const counts=()=>fields.map((_,i)=>Number($('c'+(i+1)).textContent)||0);
const setCounts=a=>fields.forEach((_,i)=>$('c'+(i+1)).textContent=String(a?.[i]||0));
const canEdit=()=>ready&&teacher&&!!student&&month===monthOf(today())&&week===weekOf(today())&&!busy;
window.ecoRetoCanEdit=canEdit;
function render(){
 const allowed=canEdit();$('retoSave').hidden=!allowed;
 document.querySelectorAll('#tab-ecoreto .btn-circle').forEach(b=>{b.disabled=!allowed;b.style.opacity=allowed?'1':'.4'});
 $('retoStudentLabel').hidden=!teacher;
 $('retoDate').disabled=!allowed;
 const selected=$('retoDate').value;
 const item=rows.find(r=>r.fecha===selected);
 setCounts(item?fields.map(k=>item[k]):[0,0,0,0,0]);
 const notes=document.querySelector('#tab-ecoreto textarea');notes.value=item?.observaciones||'';notes.disabled=!allowed;
 document.querySelectorAll('#tab-ecoreto .week-btn').forEach((b,i)=>{b.classList.toggle('active',i+1===week)});
 const totals=fields.map(k=>rows.filter(r=>weekOf(r.fecha)===week).reduce((n,r)=>n+(r[k]||0),0));
 const sum=totals.reduce((a,b)=>a+b,0);
 status(!ready?'Inicia sesión con correo verificado para consultar EcoReto.':!student?'Selecciona un estudiante para continuar.':`${allowed?'✏️ Semana abierta':'🔒 Semana de solo lectura'} · ${rows.filter(r=>weekOf(r.fecha)===week).length} días registrados · Total semanal: ${sum} unidades (${totals.join(' / ')}).`);
}
const months={'Enero':1,'Febrero':2,'Marzo':3,'Abril':4,'Mayo':5,'Junio':6,'Julio':7,'Agosto':8,'Septiembre':9,'Octubre':10,'Noviembre':11,'Diciembre':12};
async function updateLogros(){
 const value=$('logrosMonthSelect').value;const [name,year]=value.split(' ');const m=`${year}-${String(months[name]||1).padStart(2,'0')}`;
 if(!ready||!student){$('logroRecolectados').textContent='0';$('logroAcumulado').textContent='0';$('logroReducidos').textContent='0';$('logroMetaPct').textContent='0%';$('logroMetaBar').style.width='0%';return}
 try{const snap=await getDocs(query(collection(db,'recolecciones'),where('alumnoId','==',student),where('mes','==',m)));
 const total=snap.docs.reduce((sum,d)=>sum+fields.reduce((n,k)=>n+(Number(d.data()[k])||0),0),0);
 $('logroRecolectados').textContent=String(total);$('logroAcumulado').textContent=String(total);
 const reused=0; // EcoArte aún no integrado con Firestore.
 $('logroReutilizados').textContent=String(reused);$('logroReducidos').textContent=String(total-reused);
 const pct=Math.min(100,Math.round(total/300*100));$('logroMetaPct').textContent=pct+'%';$('logroMetaBar').style.width=pct+'%';
 $('logrosSource').textContent=`Recolección real de ${teacher?$('retoStudent').selectedOptions[0]?.textContent||'estudiante':'tu cuenta'} · ${value}. Reutilización pendiente de integrar con EcoArte.`;
 }catch(e){console.error(e);$('logrosSource').textContent='No se pudieron cargar las estadísticas de Firestore.'}
}
window.ecoRetoUpdateLogros=updateLogros;
async function load(){
 rows=[];if(!ready||!student){render();await updateLogros();return}
 try{const snap=await getDocs(query(collection(db,'recolecciones'),where('alumnoId','==',student),where('mes','==',month)));
 rows=snap.docs.map(d=>d.data());render();await updateLogros();}
 catch(e){console.error(e);status('No se pudieron consultar los registros. Revisa las reglas de Firestore.');}
}
function updateDate(){const start=dateForWeek(month,week),end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();const last=`${month}-${String(week===4?end:week*7).padStart(2,'0')}`;
 $('retoDate').min=start;$('retoDate').max=last;
 const current=today();$('retoDate').value=current>=start&&current<=last?current:start;
 render();}
window.ecoRetoSelectWeek=w=>{week=w;updateDate()};
$('retoDate').addEventListener('change',()=>{const v=$('retoDate').value;if(monthOf(v)!==month||weekOf(v)!==week){updateDate();return}render()});
$('retoMonth').addEventListener('change',async()=>{month=$('retoMonth').value||monthOf(today());week=month===monthOf(today())?weekOf(today()):1;updateDate();await load()});
$('retoStudent').addEventListener('change',async()=>{student=$('retoStudent').value;await load()});
async function loadStudents(){const sel=$('retoStudent');sel.replaceChildren();
 try{const snap=await getDocs(query(collection(db,'usuarios'),where('rol','==','alumno')));
 const students=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
 sel.add(new Option('Selecciona un estudiante',''));
 students.forEach(s=>sel.add(new Option(`${s.nombre||'Alumno'} (${s.correo||''})`,s.id)));
 if(!students.length)status('Aún no hay alumnos registrados.');
 }catch(e){console.error(e);status('No se pudo cargar la lista de alumnos. Revisa los permisos.');}
}
window.ecoRetoSave=async()=>{
 if(!canEdit())return status('No tienes permiso para guardar o la semana está cerrada.');
 const fecha=$('retoDate').value;
 if(monthOf(fecha)!==month||weekOf(fecha)!==week||fecha>today())return status('Selecciona una fecha válida de la semana actual.');
 const a=counts();if(a.some(n=>!Number.isSafeInteger(n)||n<0||n>10000))return status('Las cantidades deben estar entre 0 y 10 000.');
 const notes=document.querySelector('#tab-ecoreto textarea').value.trim();if(notes.length>500)return status('La observación no puede superar 500 caracteres.');
 busy=true;render();status('Guardando recolección...');
 try{
 const id=`${student}_${fecha}`;
 await setDoc(doc(db,'recolecciones',id),{alumnoId:student,fecha,mes,semana:week,anio:Number(fecha.slice(0,4)),mesNumero:Number(fecha.slice(5,7)),dia:Number(fecha.slice(8,10)),plastico:a[0],papel:a[1],carton:a[2],metal:a[3],otros:a[4],observaciones:notes,registradoPor:auth.currentUser.uid,actualizadoEn:serverTimestamp()});
 await load();status('✅ Recolección guardada en Firebase correctamente.');
 }catch(e){console.error(e);status('❌ No se pudo guardar: '+(e.code||e.message));}
 finally{busy=false;render();}
};
onAuthStateChanged(auth,async u=>{
 ready=false;teacher=false;student='';rows=[];
 if(u){try{await u.reload();if(u.emailVerified){const profile=await getDoc(doc(db,'usuarios',u.uid));teacher=profile.exists()&&profile.data().rol==='docente';ready=true;if(teacher)await loadStudents();else student=u.uid;}}catch(e){console.error(e)}}
 if(!teacher)$('retoStudent').replaceChildren();
 month=monthOf(today());$('retoMonth').value=month;week=weekOf(today());updateDate();await load();
});
