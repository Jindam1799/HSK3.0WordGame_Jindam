/* No build step or server required: keep the four files in the same directory.
 * XP tuning and round timing live in RULES. Never put paid TTS API keys here.
 * Set data.js audio URLs to reviewed recordings to use consistent voice quality.
 */
(() => {
  'use strict';
  const RULES = Object.freeze({seconds:7, baseXP:10, penalty:2, bonusXP:5, perLevel:100});
  const KEY = 'word-forest-v1';
  const $ = id => document.getElementById(id);
  const data = Array.isArray(window.HSK_DATA) ? window.HSK_DATA : [];
  const allPhrases = data.flatMap(w => w.collocations.map(p => ({...p, parent:w.id})));
  const shuffle = items => {
    const a = [...items];
    for (let i=a.length-1; i>0; i--) {const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  };
  const GROWTH = {
    sprout:{name:'새싹이',icon:'🌱',routes:[
      {id:'oak',name:'수호의 길',icon:'🌳',stages:['참나무 묘목','튼튼한 참나무','수호 참나무'],gift:'도토리 수호석',badge:'🌰',description:'동그란 잎과 든든한 줄기로 숲을 지켜요.'},
      {id:'sakura',name:'봄꽃의 길',icon:'🌸',stages:['벚꽃 묘목','분홍 벚나무','만개한 벚꽃 나무'],gift:'벚꽃 화관',badge:'🌸',description:'분홍 꽃송이가 가득한 커다란 나무로 자라요.'},
      {id:'pine',name:'별빛의 길',icon:'🌲',stages:['소나무 묘목','푸른 소나무','별빛 소나무'],gift:'별빛 나무별',badge:'🌟',description:'층층이 뻗은 가지 끝에 별빛이 내려앉아요.'}
    ]},
    mushroom:{name:'버섯이',icon:'🍄',routes:[
      {id:'ruby',name:'루비의 길',icon:'🍄',stages:['루비 꼬마버섯','루비 큰버섯','루비 대왕버섯'],gift:'루비 보석',badge:'💎',description:'빨간 갓과 하얀 점이 멋진 대왕버섯이 돼요.'},
      {id:'moon',name:'달빛의 길',icon:'🌙',stages:['달빛 꼬마버섯','달빛 큰버섯','달빛 대왕버섯'],gift:'초승달 보석',badge:'🌙',description:'푸른 갓 아래에서 은은한 달빛이 빛나요.'},
      {id:'rainbow',name:'무지개의 길',icon:'🌈',stages:['무지개 꼬마버섯','무지개 큰버섯','무지개 대왕버섯'],gift:'무지개 보석',badge:'🌈',description:'알록달록한 갓이 여러 층으로 자라나요.'}
    ]},
    petal:{name:'꽃잎이',icon:'🌷',routes:[
      {id:'sunflower',name:'햇살의 길',icon:'🌻',stages:['햇살 꽃봉오리','노란 해바라기','황금 해바라기'],gift:'햇살 브로치',badge:'☀️',description:'커다란 황금 꽃잎으로 환하게 웃어요.'},
      {id:'rose',name:'장미의 길',icon:'🌹',stages:['장미 꽃봉오리','분홍 장미','여왕 장미'],gift:'장미 브로치',badge:'🌹',description:'겹겹이 피어난 장미 꽃잎이 우아해요.'},
      {id:'lotus',name:'물결의 길',icon:'🪷',stages:['연꽃 꽃봉오리','물빛 연꽃','오로라 연꽃'],gift:'물방울 보석',badge:'💧',description:'물빛 꽃잎이 펼쳐지는 신비로운 연꽃이에요.'}
    ]}
  };
  function safeRoutes(raw,level){
    const routes={};
    if(level>=3)for(const [pet,info] of Object.entries(GROWTH))if(info.routes.some(r=>r.id===raw?.[pet]))routes[pet]=raw[pet];
    return routes;
  }
  const routeFor=(pet,routes)=>GROWTH[pet].routes.find(r=>r.id===routes?.[pet]);
  const growthStage=(level,route)=>!route||level<3?0:level>=10?3:level>=5?2:1;
  const growthName=(pet,routes,level)=>{const route=routeFor(pet,routes),stage=growthStage(level,route);return stage?route.stages[stage-1]:GROWTH[pet].name;};
  // Repo-native vector artwork: every family and route has its own silhouette.
  function creatureSVG(pet,route,stage,color){
    const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
    let art='',fx=90,fy=137;
    if(pet==='sprout'){
      if(!stage){art=`<path d="M91 117Q53 108 41 69Q85 61 94 102Q109 56 145 65Q139 106 99 117" fill="#6f9d58"/><rect x="56" y="108" width="70" height="77" rx="32" fill="${color}"/>`;fy=145;}
      else{
        const crown=route==='sakura'?'#efaabf':route==='pine'?'#659c85':color;
        art=`<path d="M75 106L70 187Q90 199 112 187L104 106Z" fill="${color}" stroke="#b19d7b" stroke-width="3"/>`;
        if(route==='pine'){art+=`<path d="M90 22L137 85H119L155 121H130L162 145H18L49 121H26L62 85H44Z" fill="${crown}"/>`;
          if(stage===3)art+='<path d="M90 10L95 24L110 24L98 33L103 47L90 38L77 47L82 33L70 24L85 24Z" fill="#f6d778"/>';}
        else{art+=circle(90,79,49,crown)+circle(49,103,36,crown)+circle(131,103,36,crown)+circle(90,116,35,crown);
          if(route==='sakura')for(const [x,y] of [[53,86],[99,53],[132,101],[89,119],[42,119]])art+=`<g fill="#fff0f4"><ellipse cx="${x}" cy="${y}" rx="13" ry="5"/><ellipse cx="${x}" cy="${y}" rx="5" ry="13"/></g>`;
          else if(stage===3)for(const [x,y] of [[50,104],[125,80],[92,48]])art+=circle(x,y,5,'#ecdb9a');}
        fy=166;
      }
    }else if(pet==='mushroom'){
      const cap=route==='moon'?'#8c9dd9':route==='rainbow'?'#c29bd4':stage?'#e9847d':color;
      art=`<path d="M65 100L57 174Q60 194 91 193Q124 194 124 176L115 100Z" fill="${color}"/>`;
      art+=`<path d="M17 113Q18 ${stage===3?15:39} 90 ${stage===3?21:43}Q161 38 163 113Q92 137 17 113Z" fill="${cap}"/>`;
      if(route==='rainbow'&&stage){art+='<path d="M27 86Q89 1 153 86Q92 103 27 86Z" fill="#ecc092"/><path d="M46 63Q89 -3 133 63Q91 77 46 63Z" fill="#9fc9b6"/>';}
      for(const [x,y,r] of [[52,89,10],[90,63,8],[125,96,12]])art+=circle(x,y,r,route==='moon'?'#e6eeff':'#fff6e6');
      if(route==='moon'&&stage===3)art+='<path d="M101 27A21 21 0 1 0 119 58A17 17 0 0 1 101 27Z" fill="#fff3b7"/>';
      fy=157;
    }else{
      art='<path d="M90 140V191" stroke="#6f9c67" stroke-width="13" stroke-linecap="round"/><path d="M87 175Q48 179 41 145Q80 145 87 175M95 176Q129 179 140 148Q105 144 95 176" fill="#9ab880"/>';
      const petal=route==='sunflower'?'#f2cf71':route==='rose'?'#dd8d9e':route==='lotus'?'#b7acd9':color;
      const count=stage===3?12:stage?8:5;
      for(let i=0;i<count;i++)art+=`<ellipse cx="90" cy="${stage===3?48:60}" rx="${route==='lotus'?17:20}" ry="${stage===3?40:30}" fill="${i%2?petal:route==='rose'?'#efb3bc':route==='lotus'?'#c6deea':petal}" transform="rotate(${i*360/count} 90 100)"/>`;
      if(route==='rose'&&stage)art+='<circle cx="90" cy="100" r="46" fill="#d9899b"/><path d="M60 99Q65 59 109 75Q137 100 109 126Q79 145 62 120" fill="none" stroke="#efbdc7" stroke-width="9"/>';
      art+=circle(90,102,route==='sunflower'?34:30,color);fx=90;fy=103;
    }
    const face=circle(fx-13,fy-3,3,'#394d3d')+circle(fx+13,fy-3,3,'#394d3d')+`<path d="M${fx-6} ${fy+5}Q${fx} ${fy+13} ${fx+6} ${fy+5}" stroke="#394d3d" stroke-width="2.5" fill="none" stroke-linecap="round"/>`+`<ellipse cx="${fx-24}" cy="${fy+7}" rx="7" ry="4" fill="#edb0a2"/><ellipse cx="${fx+24}" cy="${fy+7}" rx="7" ry="4" fill="#edb0a2"/>`;
    const scale=stage===0?.78:stage===1?.84:stage===2?.94:1;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210" aria-hidden="true"><g transform="translate(${90*(1-scale)} ${200*(1-scale)}) scale(${scale})">${art}${face}</g></svg>`;
  }
  const LOOK_DEFAULT = Object.freeze({pet:'sprout', color:'mint', head:'none', face:'none', neck:'none', scene:'meadow', back:'none', charm:'none', name:''});
  // [id, label, icon or color, required level]. Unlocks never consume XP.
  const WARDROBE = {
    pet: {label:'01 · 함께할 친구',items:[['sprout','새싹이','🌱',1],['mushroom','버섯이','🍄',1],['petal','꽃잎이','🌷',1]]},
    color: {label:'02 · 얼굴과 몸의 바탕색',items:[['mint','민트','#aac875',1],['peach','복숭아','#efb69f',1],['cream','바닐라','#eed594',1],['sky','하늘','#9cc9de',1],['lavender','라벤더','#c2acd9',3],['rose','장미','#df9eae',5]]},
    head: {label:'03 · 머리 장식',items:[['none','없음','—',1],['ribbon','리본','🎀',1],['flower','꽃','🌼',2],['cap','모자','🧢',3],['crown','왕관','👑',5],['wizard','마법 모자','🧙',8]]},
    face: {label:'04 · 얼굴 장식',items:[['none','없음','—',1],['glasses','동글 안경','👓',2],['stars','스타 안경','⭐',4]]},
    neck: {label:'05 · 목 장식',items:[['none','없음','—',1],['bow','나비넥타이','🎀',2],['scarf','목도리','🧣',3],['medal','성장 메달','🏅',6]]},
    back:{label:'06 · 날개와 망토',items:[['none','없음','—',1],['wings','요정 날개','🦋',4],['cape','탐험 망토','🦸',6],['sparkle','반짝 오라','✨',9]]},
    charm:{label:'07 · 성장 선물',items:[['none','없음','—',1],['routegift','성장길 보석','💎',10]]},
    scene: {label:'08 · 친구의 정원',items:[['meadow','초록 들판','🌿',1],['sunset','노을 정원','🌅',2],['night','별빛 정원','🌙',4],['rainbow','무지개 정원','🌈',7]]}
  };
  function safeLook(raw,level) {
    const look={...LOOK_DEFAULT};
    for(const [key,group] of Object.entries(WARDROBE)) {
      if(group.items.some(item=>item[0]===raw?.[key]&&item[3]<=level))look[key]=raw[key];
    }
    if(typeof raw?.name==='string')look.name=raw.name.trim().slice(0,12);
    return look;
  }
  let profile = {xp:0,level:1,voice:'',rate:0.9,auto:true,look:{...LOOK_DEFAULT},routes:{}};
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(saved && Number.isSafeInteger(saved.xp) && saved.xp>=0) {
      profile = {...profile,xp:saved.xp,level:Math.floor(saved.xp/RULES.perLevel)+1,
        voice:typeof saved.voice==='string'?saved.voice:'',
        rate:[0.75,0.9,1].includes(saved.rate)?saved.rate:0.9,auto:saved.auto!==false,look:safeLook(saved.look,Math.floor(saved.xp/RULES.perLevel)+1),routes:safeRoutes(saved.routes,Math.floor(saved.xp/RULES.perLevel)+1)};
    }
  } catch { storageAvailable=false; }
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(profile));}
    catch {storageAvailable=false;}
    $('storageNotice').textContent=storageAvailable?'성장 기록은 이 브라우저에 자동 저장돼요.':'저장할 수 없는 환경입니다. 현재 화면에서만 기록이 유지돼요.';
  }
  function renderProfile() {
    $('levelTag').textContent=`LV. ${profile.level}`;
    $('xpLabel').textContent=`${profile.xp%100} / 100 XP`;
    $('xpBar').value=profile.xp%100;
    $('totalXp').textContent=`누적 ${profile.xp.toLocaleString()} XP`;
    const stage=growthStage(profile.level,routeFor(profile.look.pet,profile.routes));
    $('characterName').textContent=profile.look.name || WARDROBE.pet.items.find(i=>i[0]===profile.look.pet)[1];
    $('characterMessage').textContent=growthName(profile.look.pet,profile.routes,profile.level);
    const route=routeFor(profile.look.pet,profile.routes);
    document.querySelector('.growth-path').innerHTML=[['🌱','시작 · Lv.1'],[route?.icon||'🔀','선택 · Lv.3'],['🌿','성장 · Lv.5'],['✨','완성 · Lv.10']].map(([icon,label],i)=>`<span class="${i<=stage?'active':''}">${icon}<small>${label}</small></span>`).join('');
    renderLook($('mascot'),$('homeHabitat'),profile.look);
    renderUnlockHint();
    document.querySelectorAll('.growth-path>span').forEach((el,i)=>el.classList.toggle('active',i<=stage));
  }
  function renderLook(avatar,habitat,look,routes=profile.routes) {
    const route=routeFor(look.pet,routes),stage=growthStage(profile.level,route);
    avatar.dataset.pet=look.pet;avatar.dataset.route=route?.id||'';avatar.dataset.stage=stage;
    avatar.classList.add('forest-avatar');avatar.style.background='transparent';
    let illustration=avatar.querySelector('.creature-art');
    if(!illustration){illustration=document.createElement('div');illustration.className='creature-art';avatar.prepend(illustration);}
    illustration.innerHTML=creatureSVG(look.pet,route?.id,stage,WARDROBE.color.items.find(i=>i[0]===look.color)[2]);
    habitat.dataset.scene=look.scene;
    for(const key of ['head','face','neck','back','charm']) {
      let slot=avatar.querySelector('.wear-'+key);
      if(!slot){slot=document.createElement('span');slot.className='wear-'+key;avatar.append(slot);}
      slot.dataset.item=look[key];
      const item=WARDROBE[key].items.find(i=>i[0]===look[key]);
      slot.textContent=look[key]==='none'?'':key==='charm'?(stage===3?route.badge:''):look[key]==='wizard'?'✦':look[key]==='stars'?'★ ★':item[2];
    }
  }
  function renderUnlockHint() {
    if(!routeFor(profile.look.pet,profile.routes)){ $('unlockHint').textContent=profile.level>=3?'성장길을 고를 수 있어요! 내 친구 꾸미기를 열어 주세요.':'Lv.3이 되면 세 가지 성장길 중 하나를 골라요.';return;}
    const locked=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>i[3]>profile.level).sort((a,b)=>a[3]-b[3]);
    const next=locked[0];
    $('unlockHint').textContent=next?`Lv.${next[3]}에 ${next[1]} 등 새 꾸미기가 열려요!`:'모든 꾸미기 선물을 모았어요! ✦';
  }
  let draftLook=null,draftRoutes=null;
  function updatePreview() {
    if(draftLook.charm==='routegift'&&!routeFor(draftLook.pet,draftRoutes))draftLook.charm='none';
    renderLook($('previewAvatar'),$('previewHabitat'),draftLook,draftRoutes);
    $('previewName').textContent=draftLook.name || WARDROBE.pet.items.find(i=>i[0]===draftLook.pet)[1];
    renderRouteChoices();
    $('closetOptions').querySelectorAll('button[data-group]').forEach(button=>{
      button.setAttribute('aria-pressed',String(draftLook[button.dataset.group]===button.dataset.item));
      if(button.dataset.item==='routegift') {button.disabled=profile.level<10||!routeFor(draftLook.pet,draftRoutes);button.querySelector('small').textContent=profile.level<10?'잠김 · Lv.10':!routeFor(draftLook.pet,draftRoutes)?'성장길 선택 필요':routeFor(draftLook.pet,draftRoutes).gift;} 
    });
  }
  function renderRouteChoices(){
    const pet=draftLook.pet,selected=draftRoutes[pet],committed=profile.routes[pet];
    $('routeStatus').textContent=committed?'이 친구는 선택한 길을 따라 자라요. 캐릭터를 바꿔도 성장길은 기억해요.':profile.level<3?'Lv.3부터 선택할 수 있어요. 완성된 모습을 미리 살펴보세요.':'세 가지 중 하나를 고르고 아래 저장 버튼으로 확정하세요. 확정한 길은 유지돼요.';
    $('routeCards').replaceChildren();
    for(const route of GROWTH[pet].routes){
      const card=document.createElement('button');card.type='button';card.className='route-card';card.dataset.route=route.id;card.setAttribute('aria-pressed',String(selected===route.id));card.disabled=profile.level<3||Boolean(committed&&committed!==route.id);
      const art=document.createElement('span');art.className='route-art';art.innerHTML=creatureSVG(pet,route.id,3,'#aac875');
      const name=document.createElement('strong');name.textContent=route.name;
      const final=document.createElement('span');final.textContent=route.stages[2];
      const detail=document.createElement('small');detail.textContent=route.description;
      const gift=document.createElement('small');gift.textContent=`Lv.10 선물 · ${route.gift}`;
      card.append(art,name,final,detail,gift);
      card.addEventListener('click',()=>{draftRoutes[pet]=route.id;updatePreview();});$('routeCards').append(card);
    }
    $('previewStage').textContent=growthName(pet,draftRoutes,profile.level);
    const stages=routeFor(pet,draftRoutes)?.stages;
    $('routeTimeline').textContent=stages?`Lv.3 ${stages[0]} → Lv.5 ${stages[1]} → Lv.10 ${stages[2]}`:'Lv.1 어린 친구 → Lv.3 성장길 선택 → Lv.5 중간 성장 → Lv.10 최종 성장';
  }
  function openCloset() {
    // Avoid opening another dialog while a timed question is running.
    if(state && !['result'].includes(state.phase))return;
    draftLook={...profile.look};draftRoutes={...profile.routes};
    const avatar=$('mascot').cloneNode(true);avatar.id='previewAvatar';
    const ground=document.createElement('div');ground.className='ground';
    $('previewHabitat').replaceChildren(avatar,ground);
    $('petName').value=draftLook.name;
    $('closetLevel').textContent=`LV. ${profile.level}`;
    $('closetOptions').replaceChildren();
    for(const [key,group] of Object.entries(WARDROBE)) {
      const field=document.createElement('fieldset');field.className='wardrobe-group';
      const legend=document.createElement('legend');legend.textContent=group.label;field.append(legend);
      const grid=document.createElement('div');grid.className='item-grid';
      for(const [id,label,icon,level] of group.items) {
        const button=document.createElement('button');button.type='button';button.className='wardrobe-item';button.dataset.group=key;button.dataset.item=id;
        const art=document.createElement('span');art.className='item-art';art.setAttribute('aria-hidden','true');
        if(key==='color'){art.classList.add('swatch');art.style.background=icon;}else if(key==='pet'){art.classList.add('pet-thumbnail');art.innerHTML=creatureSVG(id,null,0,'#aac875');}else art.textContent=icon;
        const name=document.createElement('strong');name.textContent=label;
        const note=document.createElement('small');note.textContent=level>profile.level?`잠김 · Lv.${level}`:'사용 가능';
        button.disabled=level>profile.level;
        button.append(art,name,note);
        button.addEventListener('click',()=>{draftLook[key]=id;updatePreview();});
        grid.append(button);
      }
      field.append(grid);$('closetOptions').append(field);
    }
    updatePreview();$('closet').showModal();$('closeCloset').focus();
  }
  function closeCloset(){draftLook=null;draftRoutes=null;$('closet').close();$('openCloset').focus();}
  $('openCloset').onclick=openCloset;
  $('closeCloset').onclick=closeCloset;
  $('closet').addEventListener('cancel',e=>{e.preventDefault();closeCloset();});
  $('petName').addEventListener('input',()=>{if(draftLook){draftLook.name=$('petName').value.slice(0,12);updatePreview();}});
  $('resetLook').onclick=()=>{draftLook={...LOOK_DEFAULT};$('petName').value='';updatePreview();};
  $('saveLook').onclick=()=>{
    if(!draftLook)return;
    profile.look=safeLook(draftLook,profile.level);profile.routes={...safeRoutes(draftRoutes,profile.level),...profile.routes};save();renderProfile();closeCloset();
  };
  // Prevent semantically overlapping entries from acting as wrong answers.
  const groups = [
    ['汉语','中文'],['店','商店'],['饭','米饭'],['看','看见','见','读'],
    ['会','能','可以'],['没','没有'],['很','非常','太','真'],['学','学习'],
    ['工作','事'],['时间','小时','时候'],['老师','先生'],['爱','喜欢','想','要'],
    ['好看','漂亮','好玩儿'],['饭店','店','商店'],['家','房间'],['家人','大家'],
    ['早','早上','上午'],['晚上','下午'],['病','生病'],['看病','医生']
  ];
  const meaningParts = text => text.split(/[;；]/).map(s=>s.trim());
  function compatible(a,b) {
    if(a.id===b.id || a.hanzi===b.hanzi) return false;
    if(groups.some(g=>g.includes(a.hanzi)&&g.includes(b.hanzi))) return false;
    return !meaningParts(a.meaning).some(m=>meaningParts(b.meaning).includes(m));
  }
  // Equivalent Chinese expressions are also excluded from bonus distractors.
  const canon = s=>s.replaceAll('中文','汉语').replaceAll('商店','店').replaceAll('米饭','饭').replaceAll('看书','读书').replaceAll('写作业','做作业').replaceAll('学习','学').replaceAll('没事儿','没事');
  let state=null, timer=null, voices=[], activeAudio=null, soundToken=0;
  function stopSound() {
    soundToken++;
    if(activeAudio){activeAudio.pause();activeAudio=null;}
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
  }
  function populateVoices() {
    if(!('speechSynthesis' in window)) {
      $('audioStatus').textContent='이 브라우저는 TTS를 지원하지 않습니다. 연결된 녹음 파일은 재생할 수 있어요.';
      return;
    }
    voices=window.speechSynthesis.getVoices().filter(v=>/^zh(?:-|_)/i.test(v.lang));
    const preferred=voices.find(v=>/xiaoxiao|xiaoyi|xiaohan|xiaomeng|tingting|ting-ting|lili|huihui|female|여성/i.test(v.name)&&/CN/i.test(v.lang)) || voices.find(v=>/CN/i.test(v.lang)) || voices[0];
    const selected=voices.find(v=>v.voiceURI===profile.voice)||preferred;
    $('voiceSelect').replaceChildren(new Option('기본 중국어 음성',''));
    voices.forEach(v=>$('voiceSelect').add(new Option(`${v.name} (${v.lang})`,v.voiceURI)));
    $('voiceSelect').value=selected?.voiceURI||'';
    $('audioStatus').textContent=voices.length?'음성을 미리 들어 보고 원하는 발음을 선택해 주세요.':'중국어 음성이 아직 없어요. 기기 음성 설정에서 중국어를 추가한 뒤 다시 열어 주세요.';
  }
  function speak(entry) {
    stopSound();
    const token=soundToken;
    const fallback=()=>{
      if(token!==soundToken) return;
      if(!('speechSynthesis' in window)){$('audioStatus').textContent='TTS 미지원 브라우저입니다.';return;}
      if(!voices.length) populateVoices();
      const u=new SpeechSynthesisUtterance(entry.hanzi);
      u.lang='zh-CN';u.rate=Number($('speechRate').value);u.pitch=1;
      u.voice=voices.find(v=>v.voiceURI===$('voiceSelect').value)||null;
      u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error)) $('audioStatus').textContent='발음 재생이 차단되었거나 음성을 사용할 수 없어요. 음성을 선택한 뒤 다시 듣기를 눌러 주세요.';};
      window.speechSynthesis.speak(u);
    };
    if(entry.audio) {
      activeAudio=new Audio(entry.audio);
      activeAudio.playbackRate=Number($('speechRate').value);
      activeAudio.play().catch(fallback);
    } else fallback();
  }
  function screen(name) {['setup','game','result'].forEach(id=>$(id).hidden=id!==name);$('openCloset').disabled=name==='game';document.body.classList.toggle('playing',name==='game');}
  function clearTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
  function changeXP(delta) {
    if(state.mode==='practice') return 0;
    const before=profile.xp;
    // Keep the XP floor at the start of the level already earned.
    profile.xp=Math.max((profile.level-1)*RULES.perLevel,profile.xp+delta);
    profile.level=Math.max(profile.level,Math.floor(profile.xp/RULES.perLevel)+1);
    save();renderProfile();
    return profile.xp-before;
  }
  function start(reviewIds=null) {
    stopSound();clearTimer();
    const pool=data.filter(w=>w.level===Number($('levelSelect').value));
    const selected=reviewIds?pool.filter(w=>reviewIds.includes(w.id)):pool;
    if(pool.length<4 || !selected.length) return;
    const size=$('roundSize').value==='all'?selected.length:Number($('roundSize').value);
    state={mode:reviewIds?'practice':document.querySelector('input[name="mode"]:checked').value,
      direction:$('direction').value,queue:shuffle(selected).slice(0,reviewIds?selected.length:size),
      pool,index:0,phase:'basic',answered:0,correct:0,bonusAnswered:0,bonusCorrect:0,netXP:0,
      mistakes:new Map(),startLevel:profile.level};
    screen('game');showQuestion(false);
  }
  function showQuestion(bonus) {
    clearTimer();stopSound();
    state.phase=bonus?'bonus':'basic';
    const word=state.queue[state.index];
    state.word=word;
    state.directionNow=bonus?'ko-zh':state.direction==='mixed'?(Math.random()<.5?'zh-ko':'ko-zh'):state.direction;
    state.entry=bonus?shuffle(word.collocations)[0]:word;
    const e=state.entry;
    const candidates=bonus
      ? allPhrases.filter(p=>p.id!==e.id&&p.meaning!==e.meaning&&canon(p.hanzi)!==canon(e.hanzi))
      : state.pool.filter(p=>compatible(e,p));
    const label=x=>state.directionNow==='zh-ko'?x.meaning:x.hanzi;
    const seen=new Set([label(e)]), wrong=[];
    // Prefer other phrases of this word for a meaningful bonus, then fill from the pool.
    const ordered=bonus?[...shuffle(candidates.filter(p=>p.parent===word.id)),...shuffle(candidates.filter(p=>p.parent!==word.id))]:shuffle(candidates);
    for(const candidate of ordered){if(!seen.has(label(candidate))){wrong.push(candidate);seen.add(label(candidate));}if(wrong.length===3)break;}
    if(wrong.length!==3) {finish();$('resultSubtitle').textContent='서로 다른 보기가 부족해 종료했어요. data.js 내용을 확인해 주세요.';return;}
    state.options=shuffle([e,...wrong]);
    $('gameMode').textContent=state.mode==='practice'?'☘ 연습 모드':'⚡ 본게임';
    $('questionNumber').textContent=`${state.index+1} / ${state.queue.length} 단어`;
    $('roundProgress').max=state.queue.length;$('roundProgress').value=state.index;
    $('sessionXp').textContent=state.mode==='practice'?'경험치 없음':`${state.netXP>=0?'+':''}${state.netXP} XP`;
    $('questionKind').textContent=bonus?'✦ 짝꿍어휘 보너스 · +5 XP':'기본 단어 · '+(state.mode==='main'?'+10 XP':'천천히 풀어요');
    $('questionInstruction').textContent=bonus?'이 뜻에 맞는 짝꿍 표현을 골라 주세요.':state.directionNow==='zh-ko'?'이 단어의 뜻은 무엇일까요?':'이 뜻에 맞는 한자를 골라 주세요.';
    $('questionText').textContent=state.directionNow==='zh-ko'?e.hanzi:e.meaning;
    $('questionText').classList.toggle('korean',state.directionNow==='ko-zh');
    $('questionText').lang=state.directionNow==='zh-ko'?'zh-CN':'ko';
    $('answers').replaceChildren();
    state.options.forEach((option,i)=>{
      const button=document.createElement('button');button.type='button';button.className='answer';
      const num=document.createElement('span');num.className='number';num.textContent=i+1;num.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=label(option);text.lang=state.directionNow==='ko-zh'?'zh-CN':'ko';
      button.append(num,text);button.addEventListener('click',()=>answer(option.id));$('answers').append(button);
    });
    $('timerBar').hidden=state.mode==='practice';$('timerText').classList.remove('urgent');
    if(state.mode==='practice'){$('timerText').textContent='시간제한 없음';}
    else {
      state.deadline=performance.now()+RULES.seconds*1000;
      tick();timer=setInterval(tick,50);
    }
    $('answers').firstElementChild?.focus({preventScroll:true});
  }
  function tick(){
    if(!state||!['basic','bonus'].includes(state.phase))return;
    const left=Math.max(0,(state.deadline-performance.now())/1000);
    $('timerText').textContent=`${left.toFixed(1)}초`;$('timerBar').value=left;$('timerText').classList.toggle('urgent',left<=2);
    if(left<=0)answer(null);
  }
  function answer(id) {
    if(!state||!['basic','bonus'].includes(state.phase)) return;
    if(state.mode==='main'&&performance.now()>=state.deadline)id=null;
    const bonus=state.phase==='bonus', correct=id===state.entry.id;
    state.phase='feedback';clearTimer();
    $('answers').querySelectorAll('button').forEach(b=>b.disabled=true);
    if(bonus){state.bonusAnswered++;if(correct)state.bonusCorrect++;}
    else{state.answered++;if(correct)state.correct++;}
    if(!correct) state.mistakes.set(state.entry.id,{...state.entry,parent:state.word.id,bonus});
    const previousLevel=profile.level;
    const delta=changeXP(correct?(bonus?RULES.bonusXP:RULES.baseXP):(bonus?0:-RULES.penalty));
    state.netXP+=delta;
    state.offerBonus=!bonus&&correct&&state.mode==='main'&&state.word.collocations.length>0;
    $('feedbackIcon').textContent=correct?'✓':id===null?'◷':'↻';
    $('feedbackTitle').textContent=correct?'정답이에요!':id===null?'시간이 다 됐어요':'다시 익히면 괜찮아요';
    $('rewardText').textContent=state.mode==='practice'?'부담 없이 익히는 중':delta?`${delta>0?'+':''}${delta} XP`:bonus?'보너스 오답 · 경험치 차감 없음':'레벨 보호 · 경험치 차감 없음';
    $('answerHanzi').textContent=state.entry.hanzi;$('answerPinyin').textContent=state.entry.pinyin;$('answerMeaning').textContent=state.entry.meaning;
    $('feedbackNote').textContent=state.offerBonus?'이 단어와 함께 쓰는 표현도 익혀 볼까요?':correct?'발음을 듣고 한 번 따라 말해 보세요.':'정답을 확인하세요. 결과 화면에서 다시 연습할 수 있어요.';
    $('continueBtn').textContent=state.offerBonus?'짝꿍어휘 도전 · +5 XP':state.index===state.queue.length-1?'학습 결과 보기':'다음 단어 →';
    $('skipBonus').hidden=!state.offerBonus;
    if(profile.level>previousLevel){
      const gifts=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>i[3]>previousLevel&&i[3]<=profile.level);
      $('feedbackNote').textContent=`레벨 ${profile.level} 달성! `+([3,5,10].includes(profile.level)?(profile.level===3?'학습 후 내 친구 꾸미기에서 성장길을 선택하세요!':'친구가 더 자랐어요! 학습 후 달라진 모습을 확인하세요.'):gifts.length?gifts.map(i=>i[1]).join(' · ')+' 선물이 열렸어요. 학습 후 꾸며 보세요!':'친구와 한 걸음 더 자랐어요!');
    }
    $('feedback').showModal();$('continueBtn').focus();
    if($('autoSpeak').checked)speak(state.entry);
  }
  function advance(skip=false) {
    if(!state||state.phase!=='feedback')return;
    $('feedback').close();stopSound();
    if(state.offerBonus&&!skip){showQuestion(true);return;}
    state.index++;
    if(state.index>=state.queue.length)finish();else showQuestion(false);
  }
  function finish() {
    if(!state)return;
    clearTimer();stopSound();state.phase='result';screen('result');
    if($('feedback').open)$('feedback').close();
    $('resultSubtitle').textContent=`${state.answered}개의 기본 문제를 풀었어요.`+(profile.level>state.startLevel?` 레벨 ${profile.level} 달성!`:'');
    $('resultAccuracy').textContent=`${state.answered?Math.round(state.correct/state.answered*100):0}%`;
    $('resultXp').textContent=state.mode==='practice'?'없음':`${state.netXP>=0?'+':''}${state.netXP}`;
    $('resultBonus').textContent=`${state.bonusCorrect}/${state.bonusAnswered}`;
    $('reviewList').replaceChildren();
    state.mistakes.forEach(entry=>{
      const row=document.createElement('div');row.className='review-item';
      const copy=document.createElement('div'),zh=document.createElement('strong'),py=document.createElement('small'),ko=document.createElement('small');
      zh.textContent=entry.hanzi;zh.lang='zh-CN';py.textContent=entry.pinyin;ko.textContent=`${entry.bonus?'보너스 · ':''}${entry.meaning}`;copy.append(zh,py,ko);
      const btn=document.createElement('button');btn.className='secondary';btn.textContent='🔊';btn.setAttribute('aria-label',`${entry.hanzi} 발음 듣기`);btn.onclick=()=>speak(entry);row.append(copy,btn);$('reviewList').append(row);
    });
    if(!state.mistakes.size){const p=document.createElement('p');p.className='subtle';p.textContent=state.answered?'모두 잘했어요! 다음 모험에서 만나요.':'아직 푼 문제가 없어요.';$('reviewList').append(p);}
    $('reviewBtn').hidden=!state.mistakes.size;
    $('reviewBtn').textContent='틀린 문제의 기본 단어 연습하기';
    $('homeBtn').focus({preventScroll:true});
  }
  function modeChanged(){
    const practice=document.querySelector('input[name="mode"]:checked').value==='practice';
    $('ruleBox').innerHTML=practice?'시간제한 없이 기본 단어만 연습해요.<br>경험치 획득·차감과 보너스 문제는 없어요.':'기본 정답 <b>+10 XP</b> · 오답/시간 초과 <b>−2 XP</b><br>보너스 정답 <b>+5 XP</b> · 보너스 오답 차감 없음';
    $('startBtn').firstChild.textContent=practice?'연습 시작하기 ':'모험 시작하기 ';
    $('startBtn').nextElementSibling.textContent=practice?'틀려도 괜찮아요. 발음을 듣고 천천히 익혀 보세요.':'기본 문제를 맞히면 짝꿍어휘 보너스에 도전할 수 있어요.';
  }
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();clearTimer();stopSound();state=null;screen('setup');});
  $('startBtn').onclick=()=>start();$('continueBtn').onclick=()=>advance();$('skipBonus').onclick=()=>advance(true);
  $('feedback').addEventListener('cancel',e=>e.preventDefault());
  $('replayBtn').onclick=()=>{if(state)speak(state.entry);};
  $('quitBtn').onclick=finish;
  $('homeBtn').onclick=()=>{stopSound();state=null;screen('setup');$('startBtn').focus();};
  $('reviewBtn').onclick=()=>start([...new Set([...state.mistakes.values()].map(x=>x.parent))]);
  document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener('change',modeChanged));
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(state&&['basic','bonus'].includes(state.phase)&&/^[1-4]$/.test(e.key)){e.preventDefault();answer(state.options[Number(e.key)-1].id);}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state?.mode==='main')tick();});
  $('speechRate').value=profile.rate;$('autoSpeak').checked=profile.auto;
  $('speechRate').onchange=()=>{profile.rate=Number($('speechRate').value);save();};
  $('autoSpeak').onchange=()=>{profile.auto=$('autoSpeak').checked;save();};
  $('voiceSelect').onchange=()=>{profile.voice=$('voiceSelect').value;save();};
  $('testVoice').onclick=()=>speak({hanzi:'你好，我们一起学习汉语吧！'});
  if('speechSynthesis' in window)window.speechSynthesis.addEventListener('voiceschanged',populateVoices);
  for(const level of [...new Set(data.map(w=>w.level))]){
    const option=[...$('levelSelect').options].find(o=>Number(o.value)===level);
    if(option){option.disabled=false;option.textContent=`HSK ${level}급`;}
  }
  const updateCount=()=>{$('wordCount').textContent=`${data.filter(w=>w.level===Number($('levelSelect').value)).length}개의 단어`;};
  $('levelSelect').onchange=updateCount;
  updateCount();renderProfile();save();populateVoices();modeChanged();
  if(data.length<4){$('startBtn').disabled=true;$('ruleBox').textContent='data.js를 불러오지 못했어요. 네 파일을 같은 폴더에 두었는지 확인해 주세요.';}
})();
