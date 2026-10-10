import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,sendPasswordResetEmail,updateProfile} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFirestore,doc,setDoc,getDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
let auth,db,currentUser=null,currentRole='invitado';
const el=id=>document.getElementById(id);
window.ecoIsTeacher=()=>Boolean(currentUser&&currentRole==='docente');
window.ecoLogout=async()=>{if(auth)await signOut(auth)};
window.resetEcoPassword=async()=>{const email=el('authEmail').value.trim();if(!email){el('authError').textContent='Ingresa tu correo primero.';return}try{await sendPasswordResetEmail(auth,email);el('authError').textContent='Si el correo está registrado, recibirás instrucciones.'}catch{el('authError').textContent='No se pudo enviar el correo. Verifica la dirección.'}};
function showUser(){el('authState').textContent=currentUser?'👤 '+(currentUser.displayName||currentUser.email)+' ('+currentRole+')':'👤 Invitado';el('authOpenBtn').hidden=!!currentUser;el('authLogoutBtn').hidden=!currentUser;
 document.querySelectorAll('[onclick*="showEcoRegister"]').forEach(b=>b.hidden=!window.ecoIsTeacher());}
if(firebaseConfig.apiKey==='REEMPLAZAR'||firebaseConfig.appId==='REEMPLAZAR'){
 el('authState').textContent='⚠️ Firebase pendiente';
}else{
 const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);window.ecoFirebaseReady=true;
 onAuthStateChanged(auth,async user=>{
   currentUser=user;currentRole='invitado';
   if(user){try{const snap=await getDoc(doc(db,'usuarios',user.uid));currentRole=snap.exists()&&snap.data().rol==='docente'?'docente':'alumno'}catch(e){console.error('No se pudo consultar el perfil:',e);currentRole='alumno'}}
   showUser();
 });
 el('authForm').addEventListener('submit',async event=>{
   event.preventDefault();el('authError').textContent='';const email=el('authEmail').value.trim(),password=el('authPassword').value;
   try{
     if(window.ecoAuthMode==='register'){
       const name=el('authName').value.trim();if(!name)throw Error('Ingresa tu nombre.');
       const credential=await createUserWithEmailAndPassword(auth,email,password);
       await updateProfile(credential.user,{displayName:name});
       await setDoc(doc(db,'usuarios',credential.user.uid),{nombre:name,correo:email,rol:'alumno',creadoEn:serverTimestamp()});
     }else await signInWithEmailAndPassword(auth,email,password);
     closeAuth();
   }catch(e){el('authError').textContent=e.code==='auth/email-already-in-use'?'Este correo ya está registrado.':e.code==='auth/invalid-credential'?'Correo o contraseña incorrectos.':e.message||'Error al ingresar.'}
 });
}
