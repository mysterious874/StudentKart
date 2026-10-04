/* =========================================================
   BANJARA CONNECT — FRONTEND FOUNDATION
   Phase 1 navigation shell. Frontend-only; no backend writes.
   ========================================================= */
(function(){
  "use strict";

  function qs(s){return document.querySelector(s);}
  function all(s){return Array.prototype.slice.call(document.querySelectorAll(s));}

  function ensureCreateMenu(){
    if(qs("#banjaraCreateMenu")) return;
    var menu=document.createElement("div");
    menu.id="banjaraCreateMenu";
    menu.className="banjara-create-menu";
    menu.hidden=true;
    menu.innerHTML=
      '<div class="banjara-create-backdrop" data-bc-close-create></div>'+
      '<div class="banjara-create-sheet" role="dialog" aria-modal="true" aria-label="Create">'+
        '<div class="banjara-create-head"><strong>Create</strong><button type="button" class="banjara-create-close" data-bc-close-create aria-label="Close">&times;</button></div>'+
        '<div class="banjara-create-grid">'+
          '<button type="button" class="banjara-create-option" data-bc-create="post"><i class="fas fa-pen"></i><span><b>Post</b><small>Share something with your community</small></span></button>'+
          '<button type="button" class="banjara-create-option" data-bc-create="photo"><i class="fas fa-image"></i><span><b>Photo / Video</b><small>Share a moment</small></span></button>'+
          '<button type="button" class="banjara-create-option" data-bc-create="poll"><i class="fas fa-square-poll-vertical"></i><span><b>Poll</b><small>Ask your community</small></span></button>'+
          '<button type="button" class="banjara-create-option" data-bc-create="event"><i class="fas fa-calendar-days"></i><span><b>Event</b><small>Create a community event</small></span></button>'+
          '<button type="button" class="banjara-create-option" data-bc-create="group"><i class="fas fa-user-group"></i><span><b>Group</b><small>Start a group conversation</small></span></button>'+
          '<button type="button" class="banjara-create-option" data-bc-create="community"><i class="fas fa-people-group"></i><span><b>Community</b><small>Bring people together</small></span></button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(menu);

    menu.addEventListener("click",function(e){
      var close=e.target.closest("[data-bc-close-create]");
      if(close){closeCreate();return;}
      var option=e.target.closest("[data-bc-create]");
      if(option){
        closeCreate();
        var label=(option.querySelector("b")||{}).textContent||"Create";
        if(typeof window.showToast==="function") window.showToast(label+" will be connected in the frontend build.","info");
      }
    });
  }

  function openCreate(){
    ensureCreateMenu();
    var menu=qs("#banjaraCreateMenu");
    menu.hidden=false;
    document.body.classList.add("banjara-modal-open");
    requestAnimationFrame(function(){qs("#banjaraCreateMenu .banjara-create-close")?.focus();});
  }
  function closeCreate(){
    var menu=qs("#banjaraCreateMenu");
    if(!menu) return;
    menu.hidden=true;
    document.body.classList.remove("banjara-modal-open");
  }

  function activate(action){
    all(".banjara-bottom-nav .bottom-nav-item").forEach(function(item){
      item.classList.toggle("is-active",item.dataset.bottomAction===action);
    });
  }

  function route(action){
    activate(action);
    if(action==="home"){
      all("main > section[data-bc-screen]").forEach(function(x){x.hidden=true;});
      var home=qs("#home"); if(home){home.hidden=false;window.scrollTo({top:0,behavior:"smooth"});}
      return;
    }
    if(action==="more"){
      if(typeof window.openSettingsFromNav==="function"){window.openSettingsFromNav();return;}
      if(typeof window.showToast==="function") window.showToast("More options are being prepared.","info");
      return;
    }
    var names={chats:"Chats",connect:"Connect",community:"Community",notifications:"Notifications"};
    if(typeof window.showToast==="function") window.showToast(names[action]+" screen is part of the frontend build.","info");
  }

  function init(){
    ensureCreateMenu();
    var nav=qs(".banjara-bottom-nav");
    if(!nav) return;

    nav.addEventListener("click",function(e){
      var create=e.target.closest("#bottomCreateButton");
      if(create){e.preventDefault();openCreate();return;}
      var item=e.target.closest("[data-bottom-action]");
      if(!item) return;
      e.preventDefault();
      e.stopPropagation();
      route(item.dataset.bottomAction||"home");
    });

    document.addEventListener("keydown",function(e){
      if(e.key==="Escape") closeCreate();
    });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
  window.BanjaraFoundation={openCreate:openCreate,closeCreate:closeCreate};
})();