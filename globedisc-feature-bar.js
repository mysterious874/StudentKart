(function(){'use strict';
function init(){
  if(document.getElementById('globediscMoreMenu')) return;
  const items=[
    ['fa-wand-magic-sparkles','AI Tools','features.html'],
    ['fa-graduation-cap','Study','features.html'],
    ['fa-calculator','Utilities','features.html'],
    ['fa-plane','Travel','travel.html'],
    ['fa-briefcase','Jobs','features.html'],
    ['fa-microchip','Tech','features.html'],
    ['fa-camera','Lens','globedisc-lens.html'],
    ['fa-layer-group','Answers','features.html'],
    ['fa-gauge-high','Dashboard','personal-dashboard.html'],
    ['fa-microphone','Voice','voice-to-text.html'],
    ['fa-bookmark','Saved','saved-collections.html'],
    ['fa-store','Marketplace','marketplace.html'],
    ['fa-message','Chat','#chat'],
    ['fa-compass','Discovery','discovery-hub.html'],
    ['fa-newspaper','News','#worldNewsSection'],
    ['fa-gear','Settings','#settings']
  ];

  const menu=document.createElement('div');
  menu.id='globediscMoreMenu';
  menu.className='globedisc-more-menu hidden';
  menu.setAttribute('aria-hidden','true');
  menu.innerHTML='<div class="globedisc-more-backdrop" data-more-close></div>'+
    '<div class="globedisc-more-sheet" role="dialog" aria-label="More features">'+
      '<div class="globedisc-more-handle"></div>'+
      '<div class="globedisc-more-header"><div><span>COMMUNITY</span><strong>More</strong></div><button type="button" data-more-close aria-label="Close"><i class="fas fa-xmark"></i></button></div>'+
      '<div class="globedisc-more-grid">'+
        items.map(function(x){return '<button type="button" class="globedisc-more-item" data-more-target="'+x[2]+'"><span><i class="fas '+x[0]+'"></i></span><strong>'+x[1]+'</strong></button>';}).join('')+
      '</div>'+
    '</div>';
  document.body.appendChild(menu);

  function close(){menu.classList.add('hidden');menu.setAttribute('aria-hidden','true');document.body.classList.remove('globedisc-more-open');}
  function open(){menu.classList.remove('hidden');menu.setAttribute('aria-hidden','false');document.body.classList.add('globedisc-more-open');}
  window.openGlobeDiscMore=open;
  window.closeGlobeDiscMore=close;

  document.addEventListener('click',function(e){
    const more=e.target.closest('#bottomMoreButton');
    if(more){e.preventDefault();e.stopPropagation();open();return;}
    if(e.target.closest('[data-more-close]')){close();return;}
    const item=e.target.closest('.globedisc-more-item');
    if(!item) return;
    const target=item.getAttribute('data-more-target')||'';
    close();
    if(target==='#chat'){
      document.getElementById('chatButton')?.click();
    }else if(target==='#worldNewsSection'){
      document.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});
    }else if(target==='#settings'){
      window.openModal?.('settingsModal');
    }else{
      window.location.href=target;
    }
  },true);

  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();