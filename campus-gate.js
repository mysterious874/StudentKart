/* StudentKart campus gate */
(function(){
function renderGate(){
 const list=document.getElementById("campusPickerList"); if(!list)return;
 const p=typeof getSavedProfile==="function"?getSavedProfile():null;
 const campus=String(p?.college||"").trim();
 list.innerHTML='<div class="campus-verification-card"><h3><i class="fas fa-building-columns"></i> Your Campus</h3><p>'+(campus?'<strong>'+escapeHTML(campus)+'</strong><br><small>This campus comes from your profile.</small>':'<strong>Campus not added</strong><br><small>Open Edit Profile and add your college/university first.</small>')+'</p><div class="campus-gate-note"><i class="fas fa-shield-halved"></i> Student ID verification is required before campus-community access.</div>'+(campus?'<button type="button" class="btn btn-primary btn-full" id="campusVerificationStart"><i class="fas fa-id-card"></i> Verify Student ID</button>':'<button type="button" class="btn btn-outline btn-full" id="campusEditProfile"><i class="fas fa-pen"></i> Edit Profile</button>')+'</div>';
 document.getElementById("campusEditProfile")?.addEventListener("click",()=>{closeModal("campusModal",{instant:true});openEditProfile?.()});
 document.getElementById("campusVerificationStart")?.addEventListener("click",()=>showToast("ID verification setup is ready. Connect the verification submission screen next.","info"));
}
function bind(){
 const b=document.getElementById("bottomCampusButton"); if(!b||b.dataset.campusGate)return;
 b.dataset.campusGate="1";
 b.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();renderGate();openModal("campusModal")},true);
 const st=document.createElement("style");st.textContent=".campus-verification-card{padding:20px;border:1px solid rgba(39,170,166,.18);border-radius:18px;background:#f7fffe}.campus-verification-card h3{margin:0 0 8px;display:flex;gap:9px;align-items:center}.campus-verification-card h3 i{color:#27aaa6}.campus-verification-card p{line-height:1.5;color:#667676}.campus-gate-note{margin:14px 0;padding:12px;border-radius:12px;background:#eef8f7;color:#456363;font-size:13px}";document.head.appendChild(st);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();