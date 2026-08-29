/* NURSELINK_MEMBER_PORTAL_SHELL_COHESION_V6300 */
(function(){
  'use strict';
  if (window.__NurseLinkMemberShellCohesionV6300) return;
  window.__NurseLinkMemberShellCohesionV6300 = true;

  var path = location.pathname || '/';
  var memberPaths = [
    '/profile','/smart-registration','/application-status','/portfolio','/jobs',
    '/applications','/learning','/initiatives','/policies','/policy-center',
    '/nurselink-mentoring.html','/nurselink-digital-id.html'
  ];
  if (memberPaths.indexOf(path) === -1) return;

  var html=document.documentElement;
  html.setAttribute('data-nl-v63-member','1');

  function rgbParts(v){
    var m=String(v||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return m ? [Number(m[1]),Number(m[2]),Number(m[3])] : null;
  }

  function isDarkPage(){
    var rgb=rgbParts(getComputedStyle(document.body).backgroundColor);
    return !!(rgb && ((rgb[0]+rgb[1]+rgb[2])/3)<90);
  }

  function largestMain(){
    var candidates=[].slice.call(document.querySelectorAll('main,[role="main"],.main,.content,.page-content,.app-main'));
    if(!candidates.length) return null;
    candidates.sort(function(a,b){
      var ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
      return (br.width*br.height)-(ar.width*ar.height);
    });
    return candidates[0];
  }

  function cardish(el){
    if(!el || el.nodeType!==1) return false;
    var r=el.getBoundingClientRect();
    if(r.width<150 || r.height<38) return false;
    var s=getComputedStyle(el);
    var radius=parseFloat(s.borderRadius)||0;
    var bg=rgbParts(s.backgroundColor);
    var bordered=(parseFloat(s.borderTopWidth)||0)>0 || (parseFloat(s.borderLeftWidth)||0)>0;
    return radius>=6 || bordered || !!bg;
  }

  function markExpansion(main){
    if(!main) return;
    main.classList.add('nl63-main-region');

    [].slice.call(main.children).forEach(function(child){
      var r=child.getBoundingClientRect();
      var mr=main.getBoundingClientRect();
      if(mr.width>1100 && r.width>0 && r.width < mr.width*.88 && r.left > mr.left+40){
        child.classList.add('nl63-expand');
      }
    });

    [].slice.call(main.querySelectorAll('section,div')).forEach(function(group){
      if(group.children.length<2 || group.children.length>6) return;
      var kids=[].slice.call(group.children).filter(cardish);
      if(kids.length!==group.children.length) return;
      var r=group.getBoundingClientRect();
      if(r.width<760) return;
      if(kids.length===2) group.classList.add('nl63-grid-2');
      else if(kids.length===3) group.classList.add('nl63-grid-3');
      else if(kids.length===4 && r.width>1100) group.classList.add('nl63-grid-4');
      else if(kids.length>=4) group.classList.add('nl63-grid-3');
    });
  }

  function normalizeDarkSurfaces(main){
    if(!main || !isDarkPage()) return;
    html.setAttribute('data-nl-v63-dark','1');
    [].slice.call(main.querySelectorAll('section,article,div,label')).forEach(function(el){
      if(el.children.length>18) return;
      var r=el.getBoundingClientRect();
      if(r.width<180 || r.height<38) return;
      var rgb=rgbParts(getComputedStyle(el).backgroundColor);
      if(!rgb) return;
      if(((rgb[0]+rgb[1]+rgb[2])/3)>235){
        el.classList.add('nl63-dark-surface');
      }
    });
  }

  var nav=[
    ['Dashboard','/dashboard'],
    ['My Profile','/profile'],
    ['Smart Registration','/smart-registration'],
    ['Application Status','/application-status'],
    ['Portfolio','/portfolio'],
    ['Jobs','/jobs'],
    ['Applications','/applications'],
    ['Mentoring','/nurselink-mentoring.html'],
    ['Engagement Hub','/engagement'],
    ['Learning','/learning'],
    ['Credentials','/credentials'],
    ['Qualifications','/qualifications'],
    ['Documents','/documents'],
    ['Digital Member ID','/nurselink-digital-id.html'],
    ['Messages','/messages'],
    ['Events','/events'],
    ['Programs & Initiatives','/initiatives'],
    ['Policies & Advocacy','/policies'],
    ['Welfare & Crisis','/welfare'],
    ['Policy & Privacy','/policy-center']
  ];

  function installLegacySidebar(){
    if(path!=='/nurselink-mentoring.html' && path!=='/nurselink-digital-id.html') return;
    if(document.getElementById('nl63LegacyMemberSidebar')) return;
    html.setAttribute('data-nl-v63-legacy','1');

    var aside=document.createElement('aside');
    aside.id='nl63LegacyMemberSidebar';
    aside.innerHTML=
      '<div class="nl63-brand"><div class="nl63-mark">NL</div><div><strong>NurseLink</strong><small>KAPIT-BISIG</small></div></div>'+
      '<nav>'+nav.map(function(row){
        return '<a href="'+row[1]+'"'+(path===row[1]?' aria-current="page"':'')+'>'+row[0]+'</a>';
      }).join('')+'</nav>'+
      '<div class="nl63-admin-links">'+
      '<a href="/logout">Sign Out</a>'+
      '</div>';
    document.body.insertBefore(aside,document.body.firstChild);
  }

  function apply(){
    installLegacySidebar();
    var main=largestMain();
    markExpansion(main);
    normalizeDarkSurfaces(main);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      apply(); setTimeout(apply,500); setTimeout(apply,1800);
    });
  } else {
    apply(); setTimeout(apply,500); setTimeout(apply,1800);
  }

  var observer=new MutationObserver(function(){
    clearTimeout(window.__nl63mut);
    window.__nl63mut=setTimeout(apply,180);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
