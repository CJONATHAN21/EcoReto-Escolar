import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,sendPasswordResetEmail,sendEmailVerification,updateProfile} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,setDoc,getDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const el=id=>document.getElementById(id);
const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
window.ecoFirebaseReady=true;
let role='invitado',lastSentAt=0;
const message=text=>{el('authError').textContent=text};
window.ecoIsTeacher=()=>Boolean(auth.currentUser?.emailVerified && role==='docente');
function showUser(){
 const u=auth.currentUser;
 el('authState').textContent=!u?'👤 Invitado':u.emailVerified?'👤 '+(u.displayName||u.email)+' ('+role+')':'📩 Correo sin verificar';
 el('authOpenBtn').hidden=!!u&&u.emailVerified;
 el('authOpenBtn').textContent=u&&!u.emailVerified?'Verificar correo':'Ingresar / Registrarse';
 el('authLogoutBtn').hidden=!u;
 el('authVerifyBox').hidden=!u||u.emailVerified;
 document.querySelectorAll('[onclick*="showEcoRegister"]').forEach(b=>b.hidden=!window.ecoIsTeacher());
}
window.ecoLogout=async()=>{await signOut(auth);window.closeAuth()};
window.resetEcoPassword=async()=>{
 const email=el('authEmail').value.trim();
 if(!email)return message('Ingresa tu correo primero.');
 try{await sendPasswordResetEmail(auth,email);message('Si el correo está registrado, recibirás instrucciones.')}
 catch(e){message(e.code==='auth/too-many-requests'?'Espera antes de volver a intentarlo.':'No se pudo enviar. Comprueba el correo.')}
};
async function sendVerification(){
 const u=auth.currentUser;
 if(!u||u.emailVerified)return;
 if(Date.now()-lastSentAt<60000)return message('Espera al menos 60 segundos antes de reenviar.');
 try{
   await sendEmailVerification(u);
   lastSentAt=Date.now();message('Enviamos el enlace de verificación. Revisa tu correo y Spam.');
 }catch(e){message(e.code==='auth/too-many-requests'?'Se alcanzó el límite temporal de envíos. Intenta más tarde.':'No se pudo enviar la verificación: '+e.code)}
}
el('authResend').addEventListener('click',sendVerification);
el('authCheckVerified').addEventListener('click',async()=>{
 const u=auth.currentUser;if(!u)return message('Inicia sesión nuevamente.');
 try{await u.reload();if(u.emailVerified){await loadRole();showUser();window.closeAuth()}else message('Aún no está verificado. Abre primero el enlace recibido por correo.')}
 catch(e){message('No se pudo comprobar la verificación. Intenta nuevamente.')}
});
async function loadRole(){
 role='invitado';
 const u=auth.currentUser;
 if(!u||!u.emailVerified)return;
 try{const snap=await getDoc(doc(db,'usuarios',u.uid));role=snap.exists()&&snap.data().rol==='docente'?'docente':'alumno'}
 catch(e){console.warn('No se pudo cargar perfil',e);role='alumno'}
}
onAuthStateChanged(auth,async u=>{
 await loadRole();showUser();
 if(u&&!u.emailVerified){el('authOverlay').hidden=false;message('Debes verificar tu correo para acceder a las funciones privadas.')}
});
el('authForm').addEventListener('submit',async e=>{
 e.preventDefault();message('');
 const email=el('authEmail').value.trim(),password=el('authPassword').value;
 el('authSubmit').disabled=true;
 try{
   if(window.ecoAuthMode==='register'){
     const name=el('authName').value.trim();
     if(!name)throw Error('Ingresa tu nombre.');
     if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres.');
     if(password!==el('authConfirm').value)throw Error('Las contraseñas no coinciden.');
     const result=await createUserWithEmailAndPassword(auth,email,password);
     await updateProfile(result.user,{displayName:name});
     await setDoc(doc(db,'usuarios',result.user.uid),{nombre:name,correo:email,rol:'alumno',creadoEn:serverTimestamp()});
     await sendVerification();
     el('authVerifyBox').hidden=false;
     showUser();
   }else{
     const result=await signInWithEmailAndPassword(auth,email,password);
     await result.user.reload();
     await loadRole();showUser();
     if(result.user.emailVerified)window.closeAuth();
     else message('Tu correo todavía no está verificado. Revisa el mensaje recibido.');
   }
 }catch(err){
   const labels={'auth/email-already-in-use':'Este correo ya está registrado.','auth/invalid-credential':'Correo o contraseña incorrectos.','auth/invalid-email':'El correo no es válido.','auth/too-many-requests':'Demasiados intentos. Espera unos minutos.','auth/weak-password':'La contraseña es demasiado débil.','permission-denied':'Firestore rechazó guardar el perfil. Revisa las reglas.'};
   message(labels[err.code]||err.message||'No se pudo completar la operación.');
 }finally{el('authSubmit').disabled=false}
});
