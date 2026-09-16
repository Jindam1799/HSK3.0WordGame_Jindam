/* No build step or server required: keep the four files in the same directory.
 * XP tuning and round timing live in RULES. Never put paid TTS API keys here.
 * Set data.js audio URLs to reviewed recordings to use consistent voice quality.
 */
(() => {
  'use strict';
  const RULES = Object.freeze({seconds:7, baseXP:5, penalty:2, bonusXP:3});
  const KEY = 'word-forest-v1';
  let activeForest=0;
  const FORESTS=[{name:'초록빛 숲',grades:'1~3급',start:1},{name:'살구빛 숲',grades:'4~6급',start:4},{name:'보랏빛 숲',grades:'7~9급',start:7}];
  const forestKey=i=>i===0?KEY:KEY+'-forest-'+i;
  const STUDENT_BG = '';
  // HSK grade and character level are independent. Costs continue beyond Lv.10.
  const XP_MULTIPLIERS=[1,1.5,2];
  const xpNeeded = (level,forest=activeForest) => (100 + 50*(level-1) + 10*(level-1)**2)*XP_MULTIPLIERS[forest];
  const xpStart = (level,forest=activeForest) => {const n=level-1;return (100*n+25*n*(n-1)+10*n*(n-1)*(2*n-1)/6)*XP_MULTIPLIERS[forest];};
  function levelFromXP(xp,forest=activeForest){
    let lo=1,hi=2;
    while(xpStart(hi,forest)<=xp)hi*=2;
    while(lo+1<hi){const mid=Math.floor((lo+hi)/2);if(xpStart(mid,forest)<=xp)lo=mid;else hi=mid;}
    return lo;
  }
  const $ = id => document.getElementById(id);
  const data = Array.isArray(window.HSK_DATA) ? window.HSK_DATA : [];
  const allPhrases = data.flatMap(w => w.collocations.map(p => ({...p, parent:w.id, level:w.level})));
  const shuffle = items => {
    const a = [...items];
    for (let i=a.length-1; i>0; i--) {const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
    return a;
  };
  const GROWTH = {
    petal:{name:'마음꽃',icon:'🌷',routes:[
      {id:'sunflower',name:'햇살의 길',final:'황금 해바라기',gift:'햇살 보석',badge:'☀️'},
      {id:'rose',name:'우아함의 길',final:'여왕 장미',gift:'장미 보석',badge:'🌹'},
      {id:'hibiscus',name:'용기의 길',final:'용감한 무궁화',gift:'용기 보석',badge:'🌺'}
    ]},
    mushroom:{name:'마음송이',icon:'🍄',routes:[
      {id:'matsutake',name:'든든함의 길',final:'대왕 송이버섯',gift:'숲의 보석',badge:'🌲'},
      {id:'horn',name:'멋쟁이의 길',final:'멋쟁이 뿔버섯',gift:'뿔 보석',badge:'🔶'},
      {id:'reishi',name:'윤기의 길',final:'잘생긴 영지버섯',gift:'호박 보석',badge:'🟠'}
    ]},
    succulent:{name:'마음담이',icon:'🪴',routes:[
      {id:'undulata',name:'물결의 길',final:'거대한 온두라타',gift:'물결 보석',badge:'💧'},
      {id:'euphorbia',name:'새침함의 길',final:'새침한 괴마옥',gift:'잎새 보석',badge:'🍃'},
      {id:'cactus',name:'끈기의 길',final:'끈질긴 칵투스',gift:'사막 보석',badge:'🌵'}
    ]}
  };
  const STUDENT_PETS=['clover','berry','tree'];
  const petAllowed=pet=>!STUDENT_PETS.includes(pet)||Boolean(STUDENT_BG);
  Object.assign(GROWTH,{
    clover:{name:'마음잎',icon:'🍀',routes:[
      {id:'lucky',name:'행운의 길',final:'행운의 네잎클로버',gift:'행운 보석'},
      {id:'silver',name:'달빛의 길',final:'달빛 은빛클로버',gift:'달빛 보석'},
      {id:'crimson',name:'다정함의 길',final:'다정한 붉은토끼풀',gift:'다정 보석'}]},
    berry:{name:'마음열매',icon:'🍓',routes:[
      {id:'strawberry',name:'달콤함의 길',final:'달콤한 왕딸기',gift:'딸기 보석'},
      {id:'blueberry',name:'별빛의 길',final:'별빛 블루베리',gift:'별빛 보석'},
      {id:'raspberry',name:'생기의 길',final:'생기 가득 산딸기',gift:'생기 보석'}]},
    tree:{name:'마음나무',icon:'🌳',routes:[
      {id:'oak',name:'든든함의 길',final:'든든한 참나무',gift:'참나무 보석'},
      {id:'willow',name:'바람의 길',final:'바람결 버드나무',gift:'바람 보석'},
      {id:'ginkgo',name:'황금빛의 길',final:'황금빛 은행나무',gift:'은행 보석'}]}
  });
  const routeFor=(pet,routes)=>GROWTH[pet]?.routes.find(r=>r.id===routes?.[pet]);
  function safeRoutes(raw,level){
    const routes={};
    if(level>=3)for(const [pet,info] of Object.entries(GROWTH))if(petAllowed(pet)&&info.routes.some(r=>r.id===raw?.[pet]))routes[pet]=raw[pet];
    return routes;
  }
  const growthStage=(level,route)=>level===1?0:level<3?1:level>=10&&route?4:level>=4?3:2;
  const displayPet=(pet,level)=>level===1?'seed':level===2||!GROWTH[pet]?'sprout':pet;
  function growthName(pet,routes,level){
    if(level===1)return '마음씨';if(level===2||!GROWTH[pet])return '마음싹';
    const route=routeFor(pet,routes);
    return level>=10&&route?route.final:level>=4?'쑥쑥 자라는 '+GROWTH[pet].name:GROWTH[pet].name;
  }
  function plantGeometry(pet,route,level){
    const family=displayPet(pet,level),adult=level>=10&&Boolean(route);
    const scale=family==='seed'?0.7:family==='sprout'?0.8:adult?1:0.63+0.045*(Math.min(level,9)-3);
    let face=[90,144],head=[90,105],neck=[90,171];
    if(family==='sprout'){face=[90,151];head=[90,102];neck=[90,174];}
    if(family==='petal'){face=[90,91];head=[90,35];neck=[90,142];}
    if(family==='mushroom'){face=adult&&route==='reishi'?[99,148]:[91,157];head=adult&&route==='horn'?[88,25]:[90,39];neck=[91,180];}
    if(family==='succulent'){face=adult&&route==='cactus'?[94,105]:[90,147];head=adult&&route==='cactus'?[94,26]:[90,39];neck=[92,177];}
    if(family==='clover'){face=[90,115];head=[90,53];neck=[90,147];}
    if(family==='berry'){face=[90,119];head=[90,65];neck=[90,156];}
    if(family==='tree'){face=[90,159];head=[90,44];neck=[90,181];}
    return {family,adult,scale,face,head,neck};
  }
  // Botanical-inspired SVG illustrations. Horn mushroom is a fictional form.
  // Cotyledon-like undulating leaves, caudex-and-leaf Euphorbia, and columnar cactus.
  // This is a game growth sequence, not a botanical life-cycle diagram.
  function creatureSVG(pet,route,level,color='#aac875',silhouette=false){
    const g=plantGeometry(pet,route,level),kind=g.family,adult=g.adult;
    const C=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
    const leaf=(x,y,angle,size=1,fill='#648e52')=>`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${size})"><path d="M0 0Q-24 -24 0 -58Q26 -26 0 0Z" fill="${fill}" stroke="#416e42" stroke-width="1.3"/><path d="M0 -3V-50M0 -20L-10 -30M0 -30L9 -40" stroke="#b5c695" stroke-width="1" fill="none"/></g>`;
    let art='';
    if(kind==='seed'){
      art='<path d="M91 97C53 108 50 152 68 176C87 199 119 177 124 148C126 125 109 104 91 97Z" fill="#b89360" stroke="#745432" stroke-width="3"/><path d="M91 108Q70 147 84 174" stroke="#e4c99c" stroke-width="4" fill="none"/><path d="M100 122L112 130M99 173L112 163" stroke="#957040" fill="none"/>';
    }else if(kind==='sprout'){
      art='<path d="M89 178Q94 147 91 105" stroke="#668954" stroke-width="9" fill="none"/>'+leaf(91,112,-57,.9)+leaf(92,103,52,.8)+'<ellipse cx="90" cy="156" rx="31" ry="37" fill="#c5ab7f" stroke="#9c8058" stroke-width="2"/><path d="M76 185Q82 164 78 136" stroke="#e3d1ad" stroke-width="2" fill="none"/>';
    }else if(kind==='petal'){
      art='<path d="M90 191Q103 145 90 111" stroke="#547443" stroke-width="8" fill="none"/>'+leaf(95,162,-59,.9)+leaf(94,148,62,.78);
      if(!adult){
        const petals=level>=5?8:5;
        for(let i=0;i<petals;i++)art+=`<ellipse cx="90" cy="61" rx="19" ry="30" fill="${i%2?'#eab4b3':'#f4d2c0'}" stroke="#c99191" stroke-width="1" transform="rotate(${i*360/petals} 90 91)"/>`;
        art+=C(90,91,24,'#efce83');
      }else if(route==='sunflower'){
        for(let layer=0;layer<2;layer++)for(let i=0;i<17;i++)art+=`<path d="M90 77Q67 30 89 8Q109 35 92 77" fill="${layer?'#efc843':'#dba331'}" stroke="#c29125" stroke-width=".7" transform="rotate(${i*360/17+layer*11} 90 85) ${layer?'translate(9 8) scale(.9)':''}"/>`;
        art+=C(90,85,35,'#694c2e');
        for(let r=9;r<=30;r+=7)for(let i=0;i<20;i++)art+=C(90+Math.cos(i*.314+r)*r,85+Math.sin(i*.314+r)*r,1.25,'#c99e56');
      }else if(route==='rose'){
        for(let i=0;i<10;i++)art+=`<path d="M90 91Q31 83 41 42Q80 5 119 42Q150 83 90 91Z" fill="${i%2?'#bb6578':'#d48694'}" stroke="#a8566d" stroke-width="1.4" transform="rotate(${i*36} 90 86) translate(${i*1.7} ${i*1.6}) scale(${1-i*.036})"/>`;
        art+='<path d="M67 79Q86 52 112 75Q126 102 98 112Q76 120 66 96Q63 72 86 72Q109 71 105 91Q99 105 84 94" fill="#c27488" stroke="#e7acb6" stroke-width="5"/>';
      }else{
        for(let i=0;i<5;i++)art+=`<path d="M90 91Q51 71 51 40Q57 22 75 29Q93 7 115 31Q134 61 90 91Z" fill="${i%2?'#d4b2ce':'#e7c5db'}" stroke="#ba8fb4" stroke-width="1.5" transform="rotate(${i*72} 90 91)"/>`;
        for(let i=0;i<5;i++)art+=`<path d="M90 92L81 57L97 64Z" fill="#a34e79" transform="rotate(${i*72} 90 91)"/>`;
        art+='<path d="M91 89L103 56" stroke="#f0d9bc" stroke-width="7"/>';
        for(const [x,y] of [[101,55],[106,52],[105,60],[99,61],[109,58]])art+=C(x,y,3,'#e7c25c');
      }
    }else if(kind==='mushroom'){
      if(adult&&route==='reishi'){
        art='<path d="M101 99Q89 148 104 189" stroke="#854c30" stroke-width="23" fill="none" stroke-linecap="round"/>';
        art+='<path d="M101 115C40 142 11 111 20 71C28 41 62 23 88 43C112 15 159 40 165 78C169 109 143 129 101 115Z" fill="#b06b38" stroke="#e8cfa4" stroke-width="9"/>';
        art+='<path d="M98 107C51 125 27 104 31 78C39 53 64 42 87 57C111 33 147 50 151 80C155 104 128 116 98 107Z" fill="#9c482d" stroke="#cc995c" stroke-width="7"/><path d="M96 98C56 111 43 94 51 75C61 61 76 62 89 74C111 55 134 64 135 86C135 104 112 106 96 98Z" fill="#743e2b" stroke="#b97340" stroke-width="5"/>';
      }else{
        art='<path d="M76 97Q68 145 63 182Q91 198 117 182Q108 137 105 97Z" fill="#dfcfac" stroke="#b59b77" stroke-width="2"/>';
        for(let x=74;x<=106;x+=8)art+=`<path d="M${x} 132L${x-5} 180" stroke="#b3a080" stroke-width="1.5"/>`;
        art+=`<path d="M21 111Q28 44 89 42Q151 44 160 111Q94 131 21 111Z" fill="${adult&&route==='horn'?'#847264':'#a98458'}" stroke="#69533a" stroke-width="2"/><path d="M23 111Q87 96 157 111Q96 137 23 111Z" fill="#e0cfab"/>`;
        for(let i=0;i<17;i++){const x=29+i*7.5;art+=`<path d="M90 116L${x} ${108+Math.abs(x-90)*.12}" stroke="#b6a080" stroke-width="1"/>`;}
        for(const [x,y] of [[55,77],[89,60],[118,81],[69,94],[126,98],[41,99],[104,93]])art+=`<path d="M${x-5} ${y+3}l4 -9 7 6" fill="#725039" opacity=".6"/>`;
        if(adult&&route==='matsutake')art+='<path d="M71 126Q88 144 110 127L108 139Q89 151 70 139Z" fill="#c3b18e"/>';
        if(adult&&route==='horn')art+='<path d="M48 73Q26 50 40 16Q44 46 68 54Z" fill="#c3b496" stroke="#7e7262" stroke-width="2"/><path d="M115 55Q144 41 143 14Q161 49 137 75Z" fill="#c3b496" stroke="#7e7262" stroke-width="2"/>';
      }
    }else if(kind==='clover'){
      const tint=adult&&route==='silver'?'#a7c4b2':'#70a363';
      art='<path d="M90 189Q103 153 90 116" fill="none" stroke="#567f4e" stroke-width="7"/>'+leaf(95,171,65,.65);
      for(let i=0;i<(adult?4:3);i++)art+=`<path d="M90 116C60 106 41 77 56 60Q75 47 90 69Q109 46 124 61C141 80 118 107 90 116Z" fill="${tint}" stroke="#4f7951" stroke-width="2" transform="rotate(${i*(adult?90:120)} 90 116)"/><path d="M90 113V77" stroke="#ccdbad" stroke-width="1.5" transform="rotate(${i*(adult?90:120)} 90 116)"/>`;
      if(adult&&route==='crimson'){art+='<path d="M90 143L113 50" stroke="#567f4e" stroke-width="4"/>';for(let i=0;i<15;i++)art+=`<ellipse cx="${113+Math.sin(i*2.4)*13}" cy="${38+Math.cos(i*2.4)*17}" rx="5" ry="9" fill="${i%2?'#c57493':'#e3a5b7'}"/>`;}
    }else if(kind==='berry'){
      art='<path d="M90 181Q67 126 90 61" fill="none" stroke="#64814e" stroke-width="6"/>'+leaf(85,168,-60,.8)+leaf(87,156,62,.75);
      if(adult&&route==='blueberry'){
        for(const [x,y] of [[68,99],[106,96],[90,125],[65,135],[111,133]])art+=C(x,y,22,'#7684ae')+C(x-5,y-8,5,'#aeb8ce')+`<path d="M${x-6} ${y}l5 -4 5 4-5 4Z" fill="#505d89"/>`;
      }else if(adult&&route==='raspberry'){
        for(let row=0;row<5;row++)for(let col=0;col<5-row;col++)art+=C(57+col*17+row*8,88+row*15,12,row%2?'#c66c80':'#d38494');
      }else{
        art+='<path d="M48 89Q48 69 90 82Q132 68 132 92Q128 140 90 166Q53 141 48 89Z" fill="#d78983" stroke="#aa625e" stroke-width="2"/>';
        for(let y=97;y<148;y+=15)for(let x=65;x<122-(y-95)*.3;x+=18)art+=`<ellipse cx="${x}" cy="${y}" rx="1.6" ry="3" fill="#f2d5a1"/>`;
      }
      for(let i=0;i<5;i++)art+=leaf(90,83,-85+i*42,.38,'#789854');
    }else if(kind==='tree'){
      art='<path d="M76 189L80 94H102L112 189L95 183Z" fill="#aa8963" stroke="#806848" stroke-width="2"/><path d="M90 183V114M88 135L65 113M99 142L121 118" fill="none" stroke="#806848" stroke-width="2"/>';
      if(adult&&route==='willow'){
        art+='<path d="M30 83Q90 5 150 83Z" fill="#97b180"/>';
        for(let i=0;i<9;i++){const x=30+i*15;art+=`<path d="M90 58Q${x} 44 ${x} 145" stroke="#5f8657" stroke-width="3" fill="none"/>`;for(let y=80;y<144;y+=15)art+=leaf(x,y,-25,.28,'#8dab70');}
      }else if(adult&&route==='ginkgo'){
        for(let i=0;i<13;i++){const x=90+Math.sin(i*2.4)*49,y=77+Math.cos(i*2.4)*34;art+=`<path d="M${x} ${y+29}L${x-25} ${y-6}Q${x} ${y-33} ${x+25} ${y-6}Z" fill="${i%2?'#d2b559':'#e9cd77'}" stroke="#b29949" stroke-width="1"/>`;}
      }else{
        for(const [x,y,r] of [[49,92,29],[72,63,32],[111,63,33],[132,94,29],[90,103,38]])art+=C(x,y,r,'#86a575');
        for(let i=0;i<(adult?20:8);i++)art+=leaf(90+Math.sin(i*2.4)*49,89+Math.cos(i*2.4)*29,i*33,.4,i%2?'#6b915d':'#abc18e');
        if(adult)for(const x of [48,130])art+=`<ellipse cx="${x}" cy="115" rx="7" ry="10" fill="#b39362"/><path d="M${x-8} 109Q${x} 98 ${x+8} 109Z" fill="#7d704a"/>`;
      }
    }else{
      if(!adult){
        art='<path d="M76 128L75 186Q90 195 109 185L104 128Z" fill="#bdab80"/>';
        const n=level>=5?9:6;
        for(let i=0;i<n;i++)art+=leaf(90,138,i*360/n,.95,i%2?'#88a58b':'#a6bb9f');
      }else if(route==='undulata'){
        art='<path d="M80 111L76 187Q91 196 111 185L102 111Z" fill="#ac9d80"/>';
        for(let layer=0;layer<2;layer++)for(let i=0;i<5;i++)art+=`<path d="M90 145Q52 127 49 100Q31 91 47 79Q31 65 51 55Q43 39 64 41Q74 19 88 41Q107 26 115 48Q137 49 121 69Q140 82 121 96Q125 122 90 145Z" fill="${layer?'#b5c5ba':'#95ada3'}" stroke="#dce4d2" stroke-width="3" transform="rotate(${i*72+layer*30} 90 119) translate(${layer*17} ${layer*21}) scale(${layer?.8:1})"/>`;
      }else if(route==='euphorbia'){
        art='<path d="M64 109Q58 73 89 70Q124 74 120 109L127 168Q117 193 89 193Q59 190 54 166Z" fill="#ae9470" stroke="#796c50" stroke-width="2"/>';
        for(let y=98;y<184;y+=13)for(let x=65;x<123;x+=13)art+=`<path d="M${x} ${y}l5 -5 5 5 -5 6Z" fill="${(x+y)%2?'#c1aa85':'#927f5d'}" stroke="#806f52" stroke-width=".8"/>`;
        for(let i=0;i<9;i++)art+=leaf(90,82,-95+i*24,.98,i%2?'#638d49':'#80a55c');
      }else{
        art='<path d="M72 181V110H55Q31 110 31 86V65Q31 49 43 49Q55 49 55 65V85H72V42Q72 18 94 18Q116 18 116 42V112H132V83Q132 67 144 67Q156 67 156 83V112Q156 137 130 137H116V185Q94 197 72 181Z" fill="#789768" stroke="#4f7553" stroke-width="3"/>';
        for(const x of [80,93,106])art+=`<path d="M${x} 42V182" stroke="#b0be83" stroke-width="2" fill="none"/>`;
        for(let y=51;y<180;y+=22)for(const x of [83,105])art+=`<path d="M${x-3} ${y-3}l6 6m-6 0l6 -6" stroke="#ece2b4" stroke-width="1.5"/>`;
      }
    }
    const [fx,fy]=g.face;
    const face=C(fx-10,fy,level>=5?2.3:3,'#38442d')+C(fx+10,fy,level>=5?2.3:3,'#38442d')+`<path d="M${fx-4} ${fy+7}Q${fx} ${fy+11} ${fx+4} ${fy+7}" stroke="#38442d" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    const charm=`<ellipse cx="${fx-18}" cy="${fy+7}" rx="4" ry="2.5" fill="${color}"/><ellipse cx="${fx+18}" cy="${fy+7}" rx="4" ry="2.5" fill="${color}"/>`;
    // SVG filter is local to each SVG. Silhouette removes all fill/stroke colors and facial detail.
    if(silhouette)art=art.replace(/fill="[^"]+"/g,'fill="#34453d"').replace(/stroke="[^"]+"/g,'stroke="#34453d"').replace(/opacity="[^"]+"/g,'opacity="1"');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210" aria-hidden="true"><g transform="translate(${90*(1-g.scale)} ${197*(1-g.scale)}) scale(${g.scale})">${art}${silhouette?'':charm+`<g class="expression-normal">${face}</g><g class="expression-lift"><circle cx="${fx-10}" cy="${fy}" r="4" fill="#38442d"/><circle cx="${fx+10}" cy="${fy}" r="4" fill="#38442d"/><ellipse cx="${fx}" cy="${fy+10}" rx="4" ry="6" fill="#68483a"/></g><g class="expression-land"><path d="M${fx-15} ${fy-4}l7 4-7 4M${fx+15} ${fy-4}l-7 4 7 4M${fx-5} ${fy+12}q5 -5 10 0" stroke="#38442d" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`}</g></svg>`;
  }
  const LOOK_DEFAULT = Object.freeze({pet:'', color:'mint', head:'none', face:'none', neck:'none', scene:'meadow', back:'none', charm:'none', name:''});
  // [id, label, icon or color, required level]. Unlocks never consume XP.
  const WARDROBE = {
    pet: {label:'01 · Lv.3 성장 계열 선택',items:[['petal','마음꽃','🌷',3],['mushroom','마음송이','🍄',3],['succulent','마음담이','🪴',3]]},
    color: {label:'02 · 볼 포인트 색상',items:[['mint','민트','#aac875',1],['peach','복숭아','#efb69f',1],['cream','바닐라','#eed594',1],['sky','하늘','#9cc9de',1],['lavender','라벤더','#c2acd9',3],['rose','장미','#df9eae',5]]},
    head: {label:'03 · 머리 장식',items:[['none','없음','—',1],['ribbon','리본','🎀',1],['flower','꽃','🌼',2],['cap','모자','🧢',3],['crown','왕관','👑',5],['wizard','마법 모자','🧙',8]]},
    face: {label:'04 · 얼굴 장식',items:[['none','없음','—',1],['glasses','동글 안경','👓',2],['stars','스타 안경','⭐',4]]},
    neck: {label:'05 · 목 장식',items:[['none','없음','—',1],['bow','나비넥타이','🎀',2],['scarf','목도리','🧣',3],['medal','성장 메달','🏅',6]]},
    back:{label:'06 · 날개와 망토',items:[['none','없음','—',1],['wings','요정 날개','🦋',4],['cape','탐험 망토','🦸',6],['sparkle','반짝 오라','✨',9]]},
    charm:{label:'07 · 성장 선물',items:[['none','없음','—',1],['routegift','성장길 보석','💎',10]]},
    scene: {label:'08 · 친구의 정원',items:[['meadow','초록 들판','🌿',1],['sunset','노을 정원','🌅',2],['night','별빛 정원','🌙',4],['rainbow','무지개 정원','🌈',7]]}
  };
  // Original vector artwork shares the plants' soft outlines and muted palette.
  function accessorySVG(id){
    const art={
      ribbon:'<path d="M46 43Q19 17 10 28L13 67Q30 72 46 54M54 43Q81 17 90 28L87 67Q70 72 54 54" fill="#d88d91"/><path d="M39 55L28 86 45 80 51 62M61 55L73 86 56 80 49 62" fill="#c8757c"/><path d="M17 35L40 46M82 35L61 46" stroke="#f0bec0"/><rect x="41" y="39" width="18" height="24" rx="7" fill="#e7a4a6"/>',
      flower:'<path d="M49 56Q64 75 83 71Q80 56 59 54" fill="#819e66"/><g fill="#f3dfad"><ellipse cx="50" cy="29" rx="12" ry="20"/><ellipse cx="50" cy="29" rx="12" ry="20" transform="rotate(72 50 50)"/><ellipse cx="50" cy="29" rx="12" ry="20" transform="rotate(144 50 50)"/><ellipse cx="50" cy="29" rx="12" ry="20" transform="rotate(216 50 50)"/><ellipse cx="50" cy="29" rx="12" ry="20" transform="rotate(288 50 50)"/></g><circle cx="50" cy="50" r="15" fill="#cfaa61"/><circle cx="46" cy="46" r="3" fill="#efcc86" stroke="none"/>',
      cap:'<path d="M16 57Q12 19 49 18Q81 21 81 58" fill="#83a99e"/><path d="M49 20Q34 35 40 56" fill="none" stroke="#bdd0b7"/><path d="M17 55Q52 44 81 56L94 66Q69 80 44 67L17 65Z" fill="#618a80"/><path d="M51 31l4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#dfcc8e" stroke-width="1"/>',
      crown:'<path d="M17 70L10 27 33 43 50 18 68 43 91 27 82 70Z" fill="#d8b86d"/><path d="M18 63H82V77H18Z" fill="#e5c985"/><g fill="#a5bd91"><circle cx="50" cy="49" r="7"/><circle cx="29" cy="55" r="4"/><circle cx="71" cy="55" r="4"/></g><path d="M23 69H76" stroke="#f8e5b2"/>',
      wizard:'<path d="M20 76L47 9Q52 29 68 33L80 76Z" fill="#8c87ab"/><path d="M24 62Q52 69 74 61L79 75 21 76Z" fill="#c8b281"/><ellipse cx="50" cy="79" rx="43" ry="10" fill="#6d698f"/><path d="M47 32l3 7 8 1-6 5 2 8-7-4-6 4 1-8-6-5 8-1Z" fill="#f4dc9d" stroke-width="1"/>',
      glasses:'<g fill="#d8e8df" fill-opacity=".36" stroke="#756a53" stroke-width="4"><circle cx="27" cy="51" r="20"/><circle cx="73" cy="51" r="20"/></g><path d="M47 49Q50 45 53 49M7 46L1 41M93 46L99 41" fill="none" stroke="#756a53" stroke-width="4"/><path d="M16 44l7-6M62 44l7-6" stroke="#fffcf1" stroke-width="3"/>',
      stars:'<g fill="#f4df9c" fill-opacity=".65" stroke="#aa8951" stroke-width="3"><path d="M26 28l7 14 16 2-12 11 3 17-14-8-14 8 3-17L3 44l16-2Z"/><path d="M74 28l7 14 16 2-12 11 3 17-14-8-14 8 3-17-12-11 16-2Z"/></g><path d="M46 47h8" stroke="#aa8951" stroke-width="3"/>',
      bow:'<path d="M45 45L13 28Q5 47 13 69L45 55M55 45L87 28Q95 47 87 69L55 55" fill="#b78372"/><path d="M18 40l20 9M82 40l-20 9" stroke="#dfb6a0"/><rect x="42" y="38" width="16" height="24" rx="5" fill="#d6a08a"/>',
      scarf:'<path d="M60 42L78 46 73 91 54 86Z" fill="#ba775f"/><path d="M62 61l13 3M58 75l15 4" stroke="#e4b995" stroke-width="5"/><path d="M12 26Q50 44 88 26L88 49Q49 64 12 48Z" fill="#d79e78"/><path d="M17 35Q50 47 83 35" stroke="#ebc7a2"/><path d="M55 86l-1 7m7-5v7m7-5v6" stroke="#ad6955"/>',
      medal:'<path d="M20 13H38L53 44 44 59ZM80 13H62L47 44 56 59Z" fill="#8faea1"/><circle cx="50" cy="64" r="25" fill="#d7b56b"/><circle cx="50" cy="64" r="18" fill="#efcf84"/><path d="M50 50l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill="#b89450" stroke="none"/>',
      wings:'<g fill="#dae5cf" fill-opacity=".8" stroke="#92ae95"><path d="M48 54Q9 3 5 25Q1 58 35 63Q7 68 20 86Q40 95 49 59M52 54Q91 3 95 25Q99 58 65 63Q93 68 80 86Q60 95 51 59"/><path d="M14 29L43 54M27 77L44 62M86 29L57 54M73 77L56 62" fill="none" stroke="#b2c7a8"/></g>',
      cape:'<path d="M35 13Q50 21 65 13L91 85Q73 98 51 86Q29 98 9 85Z" fill="#aa7f70"/><path d="M37 25L28 81M63 25L72 81" stroke="#c89f87"/><path d="M35 14Q50 30 65 14" fill="none" stroke="#dec59d" stroke-width="4"/>',
      sparkle:'<g fill="#e7cc8d" stroke="#c1a771" stroke-width="1"><path d="M18 10l4 12 11 4-11 4-4 12-4-12-11-4 11-4Z"/><path d="M81 47l5 14 12 5-12 5-5 14-5-14-12-5 12-5Z"/><path d="M24 74l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><circle cx="77" cy="18" r="3"/><circle cx="10" cy="60" r="2"/></g>',
      routegift:'<path d="M23 21H77L92 43 50 87 8 43Z" fill="#9ebaaa"/><path d="M23 21L36 43 50 87 64 43 77 21M8 43H92M36 43L50 21 64 43" fill="none" stroke="#e4ecce"/><path d="M22 28l5 8" stroke="#fff7d8" stroke-width="3"/>'
    };
    return art[id]?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="none" stroke="#776c54" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id]}</g></svg>`:'';
  }
  WARDROBE.scene.items.push(['studentgarden','수강생 정원','✦',1]);
  WARDROBE.pet.items.push(...STUDENT_PETS.map(p=>[p,GROWTH[p].name,GROWTH[p].icon,3]));
  const SLOTS=['head','face','neck','back','charm'];
  const SLOT_NAMES={head:'머리 장식',face:'얼굴 장식',neck:'목 장식',back:'날개·망토',charm:'성장 보석'};
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  function safePoses(raw){
    const out={};
    if(raw&&typeof raw==='object')for(const [key,p] of Object.entries(raw).slice(0,150)){
      if(!/^(seed|sprout|petal|mushroom|succulent|clover|berry|tree):(young|adult-[a-z]+):(head|face|neck|back|charm):[a-z]+$/.test(key)||!p)continue;
      if(['x','y','scale','rotation'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))out[key]={x:clamp(p.x,-1,1),y:clamp(p.y,-1,1),scale:clamp(p.scale,.4,2),rotation:clamp(p.rotation,-180,180)};
    }return out;
  }
  function safeLook(raw,level){
    const look={...LOOK_DEFAULT,poses:safePoses(raw?.poses)};
    for(const [key,group] of Object.entries(WARDROBE))if(group.items.some(i=>i[0]===raw?.[key]&&i[3]<=level))look[key]=raw[key];
    if(!petAllowed(look.pet))look.pet='';
    if(typeof raw?.name==='string')look.name=raw.name.trim().slice(0,12);
    if(look.scene==='studentgarden'&&!STUDENT_BG)look.scene='meadow';
    return look;
  }
  let storageAvailable=true;
  function loadForest(index){
    let loaded={schema:6,xp:0,level:1,voice:'',rate:.9,auto:false,look:{...LOOK_DEFAULT,poses:{}},routes:{},family:null};
    try{
      const saved=JSON.parse(localStorage.getItem(forestKey(index))||'null');
      if(saved&&Number.isSafeInteger(saved.xp)&&saved.xp>=0){
        const oldLevel=Math.floor(saved.xp/100)+1;
        const migrated=xpStart(oldLevel,0)+Math.floor((saved.xp%100)/100*xpNeeded(oldLevel,0));
        const baseXP=saved.schema>=5?saved.xp:migrated;
        const xp=saved.schema>=6?saved.xp:Math.min(Number.MAX_SAFE_INTEGER,Math.floor(baseXP*XP_MULTIPLIERS[index]));
        const level=levelFromXP(xp,index);
        loaded={...loaded,xp,level,voice:typeof saved.voice==='string'?saved.voice:'',rate:[.75,.9,1].includes(saved.rate)?saved.rate:.9,
          look:safeLook(saved.look,level),routes:safeRoutes(saved.routes,level),family:level>=3&&petAllowed(saved.family)&&GROWTH[saved.family]?saved.family:null};
        if(loaded.family)loaded.look.pet=loaded.family;
      }
    }catch{storageAvailable=false;}
    return loaded;
  }
  const forestProfiles=FORESTS.map((_,i)=>loadForest(i));
  let profile=forestProfiles[activeForest];
  function save(){
    try{localStorage.setItem(forestKey(activeForest),JSON.stringify(profile));}catch{storageAvailable=false;}
    $('storageNotice').textContent=storageAvailable?'성장과 꾸미기는 이 브라우저에 저장돼요.':'저장할 수 없는 환경입니다. 현재 화면에서만 기록이 유지돼요.';
  }
  function renderProfile(){
    const progress=profile.xp-xpStart(profile.level), needed=xpNeeded(profile.level);
    $('levelTag').textContent=`LV. ${profile.level}`;$('xpLabel').textContent=`${progress.toLocaleString()} / ${needed.toLocaleString()} XP`;$('xpBar').max=needed;$('xpBar').value=progress;$('totalXp').textContent=`누적 ${profile.xp.toLocaleString()} XP`;
    const name=growthName(profile.look.pet,profile.routes,profile.level);
    $('characterName').textContent=profile.look.name||name;$('characterMessage').textContent=profile.look.name?name:profile.level<3?'작은 씨앗에서 시작하는 나의 이야기':'매일 배우며 조금씩 자라고 있어요.';
    const current=profile.level===1?0:profile.level===2?1:!profile.family?1:profile.level<4?2:profile.level<10?3:4;
    document.querySelector('.growth-path').innerHTML=[['🫘','씨앗 · 1'],['🌱','새싹 · 2'],['🔀','선택 · 3'],['🌿','성장 · 4~9'],['✨','진화 · 10']].map(([icon,label],i)=>`<span class="${i<=current?'active':''}">${icon}<small>${label}</small></span>`).join('');
    renderLook($('mascot'),$('homeHabitat'),profile.look);renderUnlockHint();renderForestTabs();
  }
  function poseKey(look,routes,slot){
    const pet=displayPet(look.pet,profile.level),route=routeFor(look.pet,routes);
    return `${pet}:${profile.level>=10&&route?'adult-'+route.id:'young'}:${slot}:${look[slot]}`;
  }
  const defaultPose=()=>({x:0,y:0,scale:1,rotation:0});
  function placeAccessories(avatar,look,routes){
    const route=routeFor(look.pet,routes),g=plantGeometry(look.pet,route?.id,profile.level);
    for(const slot of SLOTS){
      const el=avatar.querySelector('.wear-'+slot),pose=look.poses?.[poseKey(look,routes,slot)]||defaultPose();
      const anchor=g[slot]||(slot==='back'?[90,116]:[135,165]);
      const x=clamp(90+(anchor[0]-90)*g.scale+pose.x*180*g.scale,9,171),y=clamp(197+(anchor[1]-197)*g.scale+pose.y*210*g.scale,9,201);
      const size={head:50,face:63,neck:38,back:145,charm:30}[slot];
      Object.assign(el.style,{left:(x/180*100)+'%',top:(y/210*100)+'%',right:'auto',bottom:'auto',width:size+'px',height:size+'px',fontSize:size+'px',lineHeight:'1',transform:`translate(-50%,-50%) rotate(${pose.rotation}deg) scale(${pose.scale*g.scale})`});
    }
  }
  function renderLook(avatar,habitat,look,routes=profile.routes){
    const route=routeFor(look.pet,routes),g=plantGeometry(look.pet,route?.id,profile.level);
    avatar.dataset.pet=g.family;avatar.dataset.route=route?.id||'';avatar.dataset.stage=String(growthStage(profile.level,route));avatar.dataset.level=profile.level;
    avatar.classList.add('forest-avatar');avatar.style.background='transparent';
    let illustration=avatar.querySelector('.creature-art');if(!illustration){illustration=document.createElement('div');illustration.className='creature-art';avatar.prepend(illustration);}
    const concealed=avatar.id==='previewAvatar'&&g.adult&&profile.routes[look.pet]!==route?.id;
    illustration.innerHTML=creatureSVG(look.pet,route?.id,profile.level,WARDROBE.color.items.find(i=>i[0]===look.color)[2],concealed);habitat.dataset.scene=look.scene;habitat.style.backgroundImage=look.scene==='studentgarden'&&STUDENT_BG?`url("${[STUDENT_BG,'assets/garden-apricot.svg','assets/garden-violet.svg'][activeForest]}")`:'';habitat.style.backgroundSize='cover';
    for(const key of SLOTS){
      let el=avatar.querySelector('.wear-'+key);if(!el){el=document.createElement('span');el.className='wear-'+key;avatar.append(el);}
      const item=WARDROBE[key].items.find(i=>i[0]===look[key]);
      el.dataset.item=look[key];el.dataset.slot=key;el.classList.add('editable-accessory');
      el.innerHTML=look[key]==='none'||(key==='charm'&&!g.adult)?'':accessorySVG(look[key]);
      el.hidden=!el.firstElementChild;
      if(avatar.id==='previewAvatar'){el.tabIndex=el.hidden?-1:0;el.setAttribute('role','button');el.setAttribute('aria-label',`${SLOT_NAMES[key]} 이동: 끌거나 선택 후 방향키로 조절`);}
    }
    placeAccessories(avatar,look,routes);
  }
  function renderUnlockHint(){
    if(profile.level<3){$('unlockHint').textContent='Lv.3에 내 친구 꾸미기에서 성장 계열을 고를 수 있어요.';return;}
    if(!profile.family||!routeFor(profile.look.pet,profile.routes)){$('unlockHint').textContent='내 친구 꾸미기에서 성장 방향을 선택해 주세요!';return;}
    if(profile.level<10){$('unlockHint').textContent=`Lv.10까지 조금씩 성장해요. 최종 모습은 아직 비밀!`;return;}
    $('unlockHint').textContent='최종 진화 완료! 성장 보석을 달아 보세요.';
  }
  let draftLook=null,draftRoutes=null,drag=null,selectedSlot='head';
  function renderRouteChoices(){
    const pet=draftLook.pet,info=GROWTH[pet],committed=profile.routes[pet];$('routeCards').replaceChildren();
    $('routeStatus').textContent=!info?'Lv.3부터 아래에서 열린 성장 계열 중 하나를 골라 주세요.':committed?'선택한 길을 따라 자라요. Lv.10에 진화한 모습이 공개돼요.':'실루엣을 보고 성장길을 골라 주세요. 저장하면 친구와 성장길이 확정돼요.';
    for(const route of info?.routes||[]){
      const revealed=profile.level>=10&&committed===route.id;
      const card=document.createElement('button');card.type='button';card.className='route-card';card.dataset.route=route.id;card.setAttribute('aria-pressed',String(draftRoutes[pet]===route.id));card.disabled=profile.level<3||Boolean(committed&&committed!==route.id);
      const art=document.createElement('span');art.className='route-art'+(revealed?'':' silhouette');art.innerHTML=creatureSVG(pet,route.id,10,'#aac875',!revealed);
      const name=document.createElement('strong');name.textContent=route.name;
      const final=document.createElement('span');final.textContent=route.final;
      const note=document.createElement('small');note.textContent=revealed?'진화 완료!':'? · Lv.10에 모습 공개';
      card.append(art,name,final,note);card.addEventListener('click',()=>{draftRoutes[pet]=route.id;updatePreview();$('routeCards').querySelector(`[data-route="${route.id}"]`)?.focus();});$('routeCards').append(card);
    }
    $('previewStage').textContent=growthName(pet,draftRoutes,profile.level);
    $('routeTimeline').textContent='Lv.1 씨앗 → Lv.2 새싹 → Lv.3 계열 선택 → Lv.4~9 점진적 성장 → Lv.10 최종 진화';
  }
  function refreshPositionControls(){
    const equipped=SLOTS.filter(s=>draftLook[s]!=='none'&&!$('previewAvatar').querySelector('.wear-'+s).hidden);
    if(!equipped.includes(selectedSlot))selectedSlot=equipped[0]||'head';
    $('moveSlot').replaceChildren(...equipped.map(s=>new Option(SLOT_NAMES[s],s)));
    if(!equipped.length)$('moveSlot').add(new Option('먼저 장식을 골라 주세요',''));
    $('moveSlot').value=equipped.length?selectedSlot:'';
    $('positionControls').querySelectorAll('input,button,select').forEach(el=>el.disabled=!equipped.length);
    const pose=draftLook.poses[poseKey(draftLook,draftRoutes,selectedSlot)]||defaultPose();
    $('itemScale').value=pose.scale;$('itemRotation').value=pose.rotation;$('scaleValue').textContent=`${Math.round(pose.scale*100)}%`;$('rotationValue').textContent=`${Math.round(pose.rotation)}°`;
    $('previewAvatar').querySelectorAll('.editable-accessory').forEach(el=>el.classList.toggle('selected-accessory',el.dataset.slot===selectedSlot&&!el.hidden));
  }
  function updatePreview(){
    if(draftLook.charm==='routegift'&&!routeFor(draftLook.pet,draftRoutes))draftLook.charm='none';
    renderLook($('previewAvatar'),$('previewHabitat'),draftLook,draftRoutes);
    $('previewName').textContent=draftLook.name||growthName(draftLook.pet,draftRoutes,profile.level);renderRouteChoices();
    $('closetOptions').querySelectorAll('button[data-group]').forEach(button=>{
      const key=button.dataset.group,id=button.dataset.item;
      button.setAttribute('aria-pressed',String(draftLook[key]===id));
      if(key==='pet'){button.disabled=!petAllowed(id)||profile.level<3||Boolean(profile.family&&profile.family!==id);button.querySelector('small').textContent=!petAllowed(id)?'잠김 · 수강생 전용':profile.level<3?'잠김 · Lv.3':profile.family===id?'나의 성장 계열':profile.family?'다른 성장 계열':'선택 가능';}
      if(key==='pet'){
        let badge=button.querySelector('.other-forest-note');
        if(!badge){badge=document.createElement('small');badge.className='other-forest-note';button.append(badge);}
        const others=forestProfiles.flatMap((p,i)=>i!==activeForest&&p.family===id?[FORESTS[i].grades]:[]);
        badge.textContent=others.length?others.join(' · ')+'에서도 키우는 계열':'';badge.hidden=!others.length;
      }
      if(id==='routegift'){button.disabled=profile.level<10||!routeFor(draftLook.pet,draftRoutes);button.querySelector('small').textContent=profile.level<10?'잠김 · Lv.10':routeFor(draftLook.pet,draftRoutes)?.gift||'성장길 선택 필요';}
    });refreshPositionControls();
  }
  function mutatePose(mutator){
    if(!draftLook||draftLook[selectedSlot]==='none')return;
    const key=poseKey(draftLook,draftRoutes,selectedSlot),pose={...(draftLook.poses[key]||defaultPose())};mutator(pose);
    draftLook.poses[key]={x:clamp(pose.x,-1,1),y:clamp(pose.y,-1,1),scale:clamp(pose.scale,.4,2),rotation:clamp(pose.rotation,-180,180)};
    placeAccessories($('previewAvatar'),draftLook,draftRoutes);refreshPositionControls();
  }
  function setupDragging(avatar){
    avatar.addEventListener('pointerdown',e=>{
      const target=e.target.closest('.editable-accessory');if(!target||target.hidden||e.button>0)return;
      e.preventDefault();selectedSlot=target.dataset.slot;refreshPositionControls();
      const pose={...(draftLook.poses[poseKey(draftLook,draftRoutes,selectedSlot)]||defaultPose())},rect=avatar.getBoundingClientRect();
      drag={pointer:e.pointerId,slot:selectedSlot,x:e.clientX,y:e.clientY,rect,pose};
      try{avatar.setPointerCapture(e.pointerId);}catch{}
      avatar.classList.add('is-dragging');
    });
    avatar.addEventListener('pointermove',e=>{
      if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();
      const g=plantGeometry(draftLook.pet,routeFor(draftLook.pet,draftRoutes)?.id,profile.level);
      mutatePose(p=>{p.x=drag.pose.x+(e.clientX-drag.x)/Math.max(1,drag.rect.width)/g.scale;p.y=drag.pose.y+(e.clientY-drag.y)/Math.max(1,drag.rect.height)/g.scale;});
    });
    const end=e=>{if(!drag||e.pointerId!==drag.pointer)return;if(e.type==='pointercancel')mutatePose(p=>Object.assign(p,drag.pose));try{avatar.releasePointerCapture(e.pointerId);}catch{}drag=null;avatar.classList.remove('is-dragging');};
    avatar.addEventListener('pointerup',end);avatar.addEventListener('pointercancel',end);avatar.addEventListener('lostpointercapture',()=>{drag=null;avatar.classList.remove('is-dragging');});
    avatar.addEventListener('keydown',e=>{
      const el=e.target.closest('.editable-accessory');if(!el)return;selectedSlot=el.dataset.slot;
      const step=e.shiftKey?10:2,moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      if(moves[e.key]){e.preventDefault();mutatePose(p=>{p.x+=moves[e.key][0]/180;p.y+=moves[e.key][1]/210;});}
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();refreshPositionControls();}
    });
  }
  function openCloset(){
    if(state&&!['result'].includes(state.phase))return;
    forestAudio.unlock();
    draftLook={...profile.look,poses:safePoses(profile.look.poses)};draftRoutes={...profile.routes};
    const avatar=$('mascot').cloneNode(true);avatar.id='previewAvatar';avatar.classList.remove('friend-held','friend-falling','friend-landed');avatar.style.translate='';avatar.removeAttribute('role');avatar.removeAttribute('tabindex');avatar.removeAttribute('aria-label');const ground=document.createElement('div');ground.className='ground';$('previewHabitat').replaceChildren(avatar,ground);setupDragging(avatar);
    $('petName').value=draftLook.name;$('closetLevel').textContent=`LV. ${profile.level}`;$('closetOptions').replaceChildren();
    for(const [key,group] of Object.entries(WARDROBE)){
      const field=document.createElement('fieldset');field.className='wardrobe-group';const legend=document.createElement('legend');legend.textContent=group.label;field.append(legend);const grid=document.createElement('div');grid.className='item-grid';
      for(const [id,label,icon,level] of group.items){
        const button=document.createElement('button');button.type='button';button.className='wardrobe-item';button.dataset.group=key;button.dataset.item=id;
        const art=document.createElement('span');art.className='item-art';art.setAttribute('aria-hidden','true');
        if(key==='color'){art.classList.add('swatch');art.style.background=icon;}else if(key==='pet'){art.classList.add('pet-thumbnail');art.innerHTML=creatureSVG(id,null,3,'#aac875');}else if(SLOTS.includes(key)&&id!=='none'){art.classList.add('accessory-thumbnail');art.innerHTML=accessorySVG(id);}else art.textContent=icon;
        const name=document.createElement('strong');name.textContent=label;const note=document.createElement('small');const privateLocked=(id==='studentgarden'&&!STUDENT_BG)||(key==='pet'&&!petAllowed(id));note.textContent=privateLocked?'수강생 전용':level>profile.level?`잠김 · Lv.${level}`:'사용 가능';button.disabled=privateLocked||level>profile.level;button.append(art,name,note);
        button.addEventListener('click',()=>{draftLook[key]=id;if(SLOTS.includes(key))selectedSlot=key;updatePreview();});grid.append(button);
      }field.append(grid);$('closetOptions').append(field);
    }updatePreview();$('closet').showModal();$('closeCloset').focus();
  }
  function closeCloset(){drag=null;draftLook=null;draftRoutes=null;$('closet').close();$('openCloset').focus();}
  $('openCloset').onclick=openCloset;$('closeCloset').onclick=closeCloset;$('closet').addEventListener('cancel',e=>{e.preventDefault();closeCloset();});
  $('petName').addEventListener('input',()=>{if(draftLook){draftLook.name=$('petName').value.slice(0,12);updatePreview();}});
  $('resetLook').onclick=()=>{draftLook={...LOOK_DEFAULT,pet:draftLook.pet,name:draftLook.name,poses:{}};updatePreview();};
  $('saveLook').onclick=()=>{
    if(!draftLook)return;
    profile.look=safeLook(draftLook,profile.level);profile.routes={...safeRoutes(draftRoutes,profile.level),...profile.routes};
    if(profile.level>=3&&GROWTH[profile.look.pet])profile.family=profile.family||profile.look.pet;
    if(profile.family)profile.look.pet=profile.family;
    save();renderProfile();forestAudio.effect('dress');closeCloset();
  };
  $('moveSlot').onchange=()=>{selectedSlot=$('moveSlot').value;refreshPositionControls();};
  $('itemScale').oninput=()=>mutatePose(p=>{p.scale=Number($('itemScale').value);});$('itemRotation').oninput=()=>mutatePose(p=>{p.rotation=Number($('itemRotation').value);});
  $('resetPosition').onclick=()=>{delete draftLook.poses[poseKey(draftLook,draftRoutes,selectedSlot)];placeAccessories($('previewAvatar'),draftLook,draftRoutes);refreshPositionControls();};
  document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.nudge.split(',').map(Number);mutatePose(p=>{p.x+=x/180;p.y+=y/210;});});
  // Original procedural score: no audio downloads, samples, or API credentials.
  const forestAudio=(()=>{
    const STORE='word-forest-audio-v1';
    let settings={music:true,effects:true,musicVolume:.22,effectVolume:.70};
    try{const raw=JSON.parse(localStorage.getItem(STORE)||'null');if(raw){for(const key of ['music','effects'])if(typeof raw[key]==='boolean')settings[key]=raw[key];for(const key of ['musicVolume','effectVolume'])if(typeof raw[key]==='number'&&Number.isFinite(raw[key]))settings[key]=Math.max(0,Math.min(1,raw[key]));}}catch{}
    let ctx=null,musicGain,effectGain,clock=null,nextTime=0,beat=0,active=false,ducked=false;
    // Five distinct original scores. Shuffle bag plays every track before reshuffling.
    const GREEN_TRACKS=[
      {name:'햇살이 내려앉은 숲',bpm:76,tone:'keys',pattern:[1,3,2,3],chords:[[48,52,55,59],[45,48,52,55],[53,57,60,64],[55,59,62,64]],melody:[72,null,76,79,77,76,null,72,69,null,72,76,74,null,72,null,72,76,77,null,81,79,77,null,74,null,76,79,77,74,null,71]},
      {name:'이슬 맺힌 아침 정원',bpm:70,tone:'bell',pattern:[2,1,3,1],chords:[[50,54,57,61],[47,50,54,57],[55,59,62,66],[57,61,64,66]],melody:[78,null,81,null,85,81,78,null,78,76,74,null,73,null,74,null,79,null,78,76,74,null,78,null,76,73,69,null,73,76,78,null]},
      {name:'구름 위의 낮잠',bpm:62,tone:'keys',pattern:[1,2,3,2],chords:[[53,57,60,64],[50,53,57,60],[46,50,53,57],[48,52,55,59]],melody:[69,null,null,72,76,null,72,null,74,null,69,null,65,null,null,69,70,null,74,null,77,74,null,70,67,null,64,67,72,null,null,null]},
      {name:'도토리 산책길',bpm:84,tone:'keys',pattern:[1,3,1,2],chords:[[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,54,57,60]],melody:[74,71,null,67,69,null,71,74,76,74,71,null,67,71,76,null,72,76,79,76,74,72,71,null,69,74,78,76,74,69,null,66]},
      {name:'달빛 아래 작은 연못',bpm:66,tone:'bell',pattern:[3,1,2,1],chords:[[45,48,52,55],[53,57,60,64],[48,52,55,59],[55,59,62,64]],melody:[76,null,72,69,null,71,72,null,77,null,76,72,69,null,72,null,76,79,null,83,79,76,null,72,74,null,71,67,null,71,74,null]}
    ];
    const MUSIC_BANKS=[GREEN_TRACKS,[{"name": "살구빛 소풍", "bpm": 104, "tone": "keys", "pattern": [1, 3, 2, 3], "chords": [[48, 52, 55, 59], [53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65]], "melody": [72, 76, 79, null, 76, 74, 72, 67, 69, 72, 77, 76, 74, null, 72, 69, 74, 77, 81, 77, 76, 74, null, 72, 71, 74, 79, 77, 74, 71, 72, null], "mood": "lively"}, {"name": "딸기 우체부", "bpm": 112, "tone": "keys", "pattern": [1, 3, 2, 3], "chords": [[50, 54, 57, 61], [55, 59, 62, 66], [52, 55, 59, 62], [57, 61, 64, 67]], "melody": [74, null, 78, 81, 83, 81, 78, 74, 79, 83, 86, 83, 81, 79, 78, null, 76, 79, 83, 81, 79, 76, 74, 76, 73, 76, 81, 83, 81, 76, 74, null], "mood": "lively"}, {"name": "바람개비 장터", "bpm": 108, "tone": "keys", "pattern": [1, 3, 2, 3], "chords": [[53, 57, 60, 64], [50, 53, 57, 60], [58, 62, 65, 69], [48, 52, 55, 58]], "melody": [77, 81, 84, 81, null, 79, 77, 76, 74, 77, 81, null, 79, 77, 74, 72, 74, 77, 82, 86, 84, 82, 81, 77, 76, 79, 84, 82, 79, 76, 77, null], "mood": "lively"}, {"name": "통통 도토리 버스", "bpm": 118, "tone": "keys", "pattern": [1, 3, 2, 3], "chords": [[55, 59, 62, 66], [48, 52, 55, 59], [52, 55, 59, 62], [50, 54, 57, 60]], "melody": [79, 83, null, 86, 83, 81, 79, 74, 76, 79, 84, 83, 81, 79, 76, null, 76, 79, 83, 86, 83, null, 81, 79, 78, 81, 86, 84, 81, 78, 79, null], "mood": "lively"}, {"name": "노을의 작은 축제", "bpm": 100, "tone": "keys", "pattern": [1, 3, 2, 3], "chords": [[48, 52, 55, 59], [45, 48, 52, 55], [53, 57, 60, 64], [55, 59, 62, 65]], "melody": [76, 79, 84, null, 83, 79, 76, 72, 72, 76, 81, 79, 76, 72, 69, null, 77, 81, 84, 81, 79, 77, 76, 72, 74, 77, 79, 83, 81, 77, 76, null], "mood": "lively"}],[{"name": "달빛 탐험 지도", "bpm": 88, "tone": "bell", "pattern": [0, 2, 1, 2], "chords": [[45, 48, 52, 55], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]], "melody": [69, null, 72, 76, 71, null, 72, 69, 77, null, 76, 72, 69, 72, null, 76, 74, 77, null, 81, 77, 74, 72, null, 71, 68, 71, null, 76, 74, 71, null], "mood": "mystery"}, {"name": "안개 속 반딧불", "bpm": 82, "tone": "bell", "pattern": [0, 2, 1, 2], "chords": [[50, 53, 57, 60], [58, 62, 65, 69], [55, 58, 62, 65], [57, 61, 64, 67]], "melody": [74, null, 77, null, 81, 77, 76, null, 77, 81, 82, null, 81, 77, 74, null, 79, null, 82, 86, 82, null, 79, 77, 76, 73, null, 76, 81, 79, 76, null], "mood": "mystery"}, {"name": "별을 찾는 발걸음", "bpm": 96, "tone": "bell", "pattern": [0, 2, 1, 2], "chords": [[52, 55, 59, 62], [48, 52, 55, 59], [45, 48, 52, 55], [47, 51, 54, 57]], "melody": [76, 79, null, 83, 81, 79, 78, null, 79, 76, 72, null, 76, 79, 83, null, 81, 76, null, 72, 69, 72, 76, null, 78, 75, 78, 81, null, 78, 76, null], "mood": "mystery"}, {"name": "보랏빛 숲의 비밀", "bpm": 90, "tone": "bell", "pattern": [0, 2, 1, 2], "chords": [[48, 51, 55, 58], [56, 60, 63, 67], [53, 56, 60, 63], [55, 59, 62, 65]], "melody": [72, null, 75, 79, 77, null, 75, 72, 80, 79, null, 75, 72, 75, 79, null, 77, 80, 84, null, 80, 77, 75, null, 74, 71, 74, 77, 79, null, 74, null], "mood": "mystery"}, {"name": "새벽의 보물상자", "bpm": 94, "tone": "bell", "pattern": [0, 2, 1, 2], "chords": [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]], "melody": [81, 84, null, 88, 86, 84, 83, null, 84, 81, 77, 81, null, 84, 88, null, 86, 81, 77, null, 74, 77, 81, null, 80, 83, 88, null, 86, 83, 81, null], "mood": "mystery"}]];
    let TRACKS=MUSIC_BANKS[0];
    const voices=new Set();let trackIndex=-1,bag=[];
    function chooseTrack(){
      if(!bag.length){bag=shuffle(TRACKS.map((_,i)=>i));if(bag[0]===trackIndex)[bag[0],bag[1]]=[bag[1],bag[0]];}
      trackIndex=bag.shift();beat=0;
      $('currentTrack').textContent=TRACKS[trackIndex].name;
    }
    function status(text){$('musicStatus').textContent=text;}
    function persist(){try{localStorage.setItem(STORE,JSON.stringify(settings));}catch{status('소리 설정은 현재 화면에서만 유지돼요.');}}
    function ramp(node,value){if(!ctx||!node)return;const now=ctx.currentTime;node.gain.cancelScheduledValues(now);node.gain.setTargetAtTime(value,now,.09);}
    function mix(){ramp(musicGain,settings.music?settings.musicVolume*(ducked?.16:1):0);ramp(effectGain,settings.effects?settings.effectVolume*(ducked?.22:1):0);}
    function note(midi,time,length,volume,bus='music',kind='keys'){
      if(!ctx||ctx.state!=='running')return;
      const out=ctx.createGain();out.connect(bus==='music'?musicGain:effectGain);
      const peak=volume*(bus==='music'?3:2.8);out.gain.setValueAtTime(0,time);out.gain.linearRampToValueAtTime(peak,time+.018);out.gain.exponentialRampToValueAtTime(peak*.18,time+length*.65);out.gain.exponentialRampToValueAtTime(.0001,time+length);
      const partials=kind==='bass'?[[1,1]]:kind==='bell'?[[1,1],[2.01,.13],[3,.025]]:[[1,1],[2,.15],[3,.035]];
      let remaining=partials.length;
      for(const [multiple,weight] of partials){
        const oscillator=ctx.createOscillator(),amp=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=440*Math.pow(2,(midi-69)/12)*multiple;amp.gain.value=weight;oscillator.connect(amp);amp.connect(out);
        const voice={oscillator,out,amp,bus};voices.add(voice);oscillator.onended=()=>{voices.delete(voice);oscillator.disconnect();amp.disconnect();if(--remaining===0)out.disconnect();};oscillator.start(time);oscillator.stop(time+length+.02);
      }
    }
    function stopMusic(){if(clock!==null){clearInterval(clock);clock=null;}for(const v of [...voices])if(v.bus==='music'){try{v.oscillator.stop();}catch{}voices.delete(v);} }
    function schedule(){
      if(!ctx||ctx.state!=='running'||!settings.music||document.hidden)return;
      if(nextTime<ctx.currentTime-.3)nextTime=ctx.currentTime+.05;
      while(nextTime<ctx.currentTime+.3){
        if(trackIndex<0)chooseTrack();
        const track=TRACKS[trackIndex],tempo=60/track.bpm;
        const chord=track.chords[Math.floor(beat/4)%track.chords.length],pulse=beat%4;
        if(pulse===0)note(chord[0]-12,nextTime,tempo*3.5,.065,'music','bass');
        note(chord[track.pattern[pulse]],nextTime,tempo*1.7,.05);
        if(pulse===2)note(chord[1]+12,nextTime+tempo*.5,tempo,.018,'music','bell');
        if(track.mood==='lively'){
          if(pulse===2)note(chord[0]-12,nextTime,tempo*.65,.035,'music','bass');
          if(pulse===1||pulse===3)note(chord[2]+12,nextTime+tempo*.55,tempo*.35,.024,'music','keys');
        }else if(track.mood==='mystery'){
          note(chord[pulse%2?2:0]+12,nextTime+tempo*.5,tempo*.55,.016,'music','bell');
        }
        const melody=track.melody[beat%track.melody.length];if(melody!==null)note(melody,nextTime+.035,tempo*1.55,.048,'music',track.tone);
        beat++;nextTime+=tempo;
        if(beat>=track.melody.length*2){chooseTrack();nextTime+=1.2;}
      }
    }
    function setForest(index){stopMusic();TRACKS=MUSIC_BANKS[index];bag=[];trackIndex=-1;chooseTrack();startMusic();}
    function startMusic(){if(!ctx||!active||!settings.music||document.hidden||clock!==null||ctx.state!=='running')return;nextTime=ctx.currentTime+.06;schedule();clock=setInterval(schedule,120);status(`♪ ${FORESTS[activeForest].name} · 오리지널 5곡 무작위 재생`);}
    async function unlock(){
      active=true;
      try{
        if(!ctx){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext){status('이 브라우저는 배경음·효과음을 지원하지 않아요.');return false;}
          ctx=new AudioContext();musicGain=ctx.createGain();effectGain=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-16;limiter.ratio.value=4;limiter.attack.value=.006;limiter.release.value=.2;musicGain.connect(limiter);effectGain.connect(limiter);limiter.connect(ctx.destination);mix();}
        if(ctx.state!=='running')await ctx.resume();if(ctx.state!=='running'){status('소리 듣기 버튼을 다시 눌러 주세요.');return false;}startMusic();return true;
      }catch{status('소리를 시작하지 못했어요. 소리 듣기를 다시 눌러 주세요.');return false;}
    }
    // Short, dry clock transients alternate in tone, separate from the musical bells.
    let tickSide=false;
    function clockTick(time){
      tickSide=!tickSide;
      const oscillator=ctx.createOscillator(),amp=ctx.createGain(),out=ctx.createGain();
      oscillator.type='triangle';
      oscillator.frequency.setValueAtTime(tickSide?1150:820,time);
      oscillator.frequency.exponentialRampToValueAtTime(tickSide?680:480,time+.035);
      amp.gain.value=1;out.gain.setValueAtTime(0,time);
      out.gain.linearRampToValueAtTime(.18,time+.002);
      out.gain.exponentialRampToValueAtTime(.0001,time+.085);
      oscillator.connect(amp);amp.connect(out);out.connect(effectGain);
      const voice={oscillator,amp,out,bus:'effect'};voices.add(voice);
      oscillator.onended=()=>{voices.delete(voice);oscillator.disconnect();amp.disconnect();out.disconnect();};
      oscillator.start(time);oscillator.stop(time+.09);
    }
    const phrases={tap:[[76,0,.11,.075]],correct:[[76,0,.18,.12],[81,.11,.27,.09]],bonus:[[76,0,.16,.11],[79,.1,.18,.1],[84,.2,.3,.09]],wrong:[[64,0,.17,.055],[60,.12,.22,.04]],level:[[72,0,.18,.09],[76,.11,.2,.09],[79,.22,.23,.09],[84,.34,.48,.09]],finish:[[72,0,.2,.07],[76,.15,.22,.07],[79,.3,.4,.065]],dress:[[79,0,.14,.08],[84,.08,.2,.07]]};
    function effect(name,delay=0){if(!settings.effects||document.hidden)return;if(!ctx||ctx.state!=='running')return;if(name==='land'){const t=ctx.currentTime+.015;note(38,t,.18,.17,'effect','bass');note(45,t+.04,.12,.08,'effect','bass');return;}if(name==='timer'){clockTick(ctx.currentTime+.015+delay);return;}for(const [pitch,offset,length,gain] of phrases[name]||phrases.tap)note(pitch,ctx.currentTime+.015+offset+delay,length,gain,'effect','bell');}
    function duck(value){ducked=value;mix();}
    function pause(){stopMusic();if(ctx){for(const v of [...voices]){try{v.oscillator.stop();}catch{}voices.delete(v);}ctx.suspend().catch(()=>{});}status(active?'다른 화면을 보는 동안 음악을 쉬고 있어요.':'게임 시작 또는 소리 듣기를 누르면 재생돼요.');}
    $('bgmEnabled').checked=settings.music;$('sfxEnabled').checked=settings.effects;
    for(const [id,key] of [['bgmVolume','musicVolume'],['sfxVolume','effectVolume']]){
      $(id).value=Math.round(settings[key]*100);$(id+'Value').textContent=$(id).value+'%';
      $(id).oninput=()=>{settings[key]=Number($(id).value)/100;$(id+'Value').textContent=$(id).value+'%';mix();persist();};
    }
    $('bgmEnabled').onchange=()=>{settings.music=$('bgmEnabled').checked;mix();persist();if(settings.music)unlock();else{stopMusic();status('배경음악 꺼짐');}};
    $('sfxEnabled').onchange=()=>{settings.effects=$('sfxEnabled').checked;mix();persist();if(settings.effects)unlock();};
    $('listenMusic').onclick=()=>{if(!settings.music){settings.music=true;$('bgmEnabled').checked=true;persist();mix();}unlock();};
    $('listenSfx').onclick=()=>{if(!settings.effects){settings.effects=true;$('sfxEnabled').checked=true;persist();mix();}unlock().then(ok=>{if(ok)effect('bonus');});};
    $('nextMusic').onclick=()=>{stopMusic();chooseTrack();if(!settings.music){settings.music=true;$('bgmEnabled').checked=true;persist();mix();}unlock();};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(active)unlock();});
    window.addEventListener('pagehide',pause);window.addEventListener('pageshow',()=>{if(active&&!document.hidden)unlock();});
    document.addEventListener('pointerdown',()=>{if(active&&ctx&&ctx.state!=='running'&&!document.hidden)unlock();},{passive:true});
    status('게임 시작 또는 소리 듣기를 누르면 재생돼요.');
    return {unlock,effect,duck,setForest};
  })();
  $('welcomeFriends').innerHTML=['mushroom','petal','succulent'].map(p=>'<span>'+creatureSVG(p,null,3)+'</span>').join('');
  $('enterLobby').onclick=()=>{
    $('welcomeScreen').hidden=true;$('gameApp').hidden=false;
    $('startBtn').focus({preventScroll:true});
    forestAudio.unlock();
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
    forestAudio.duck(false);
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
      u.onstart=()=>{if(token===soundToken)forestAudio.duck(true);};
      u.onend=()=>{if(token===soundToken)forestAudio.duck(false);};
      u.onerror=e=>{if(token===soundToken)forestAudio.duck(false);if(!['interrupted','canceled'].includes(e.error)) $('audioStatus').textContent='발음 재생이 차단되었거나 음성을 사용할 수 없어요. 음성을 선택한 뒤 다시 듣기를 눌러 주세요.';};
      forestAudio.duck(true);
      try{window.speechSynthesis.speak(u);}catch{forestAudio.duck(false);$('audioStatus').textContent='발음을 재생하지 못했어요. 다시 듣기를 눌러 주세요.';}
    };
    if(entry.audio) {
      activeAudio=new Audio(entry.audio);
      activeAudio.playbackRate=Number($('speechRate').value);
      forestAudio.duck(true);
      activeAudio.onended=()=>{if(token===soundToken)forestAudio.duck(false);};
      activeAudio.onerror=()=>{if(token===soundToken)forestAudio.duck(false);};
      activeAudio.play().catch(()=>{if(token===soundToken)forestAudio.duck(false);fallback();});
    } else fallback();
  }
  function screen(name) {$('forestTabs').querySelectorAll('button').forEach(b=>b.disabled=name==='game');['setup','game','result'].forEach(id=>$(id).hidden=id!==name);$('openCloset').disabled=name==='game';document.body.classList.toggle('playing',name==='game');}
  function clearTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
  function changeXP(delta) {
    if(state.mode==='practice') return 0;
    const before=profile.xp;
    // Keep the XP floor at the start of the level already earned.
    profile.xp=Math.max(xpStart(profile.level),profile.xp+delta);
    profile.level=Math.max(profile.level,levelFromXP(profile.xp));
    save();renderProfile();
    return profile.xp-before;
  }
  function start(reviewIds=null) {
    forestAudio.unlock();
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
    // A bonus inherits its basic question direction, including mixed mode.
    if(!bonus)state.directionNow=state.direction==='mixed'?(Math.random()<.5?'zh-ko':'ko-zh'):state.direction;
    state.entry=bonus?shuffle(word.collocations)[0]:word;
    const e=state.entry;
    const candidates=bonus
      ? allPhrases.filter(p=>p.level===word.level&&p.id!==e.id&&p.meaning!==e.meaning&&canon(p.hanzi)!==canon(e.hanzi))
      : state.pool.filter(p=>compatible(e,p));
    const label=x=>state.directionNow==='zh-ko'?x.meaning:x.hanzi;
    const seen=new Set([label(e)]), wrong=[];
    // Prefer other phrases of this word for a meaningful bonus, then fill from the pool.
    const ordered=bonus?[...shuffle(candidates.filter(p=>p.parent===word.id)),...shuffle(candidates.filter(p=>p.parent!==word.id))]:shuffle(candidates);
    for(const candidate of ordered){if(!seen.has(label(candidate))){wrong.push(candidate);seen.add(label(candidate));}if(wrong.length===3)break;}
    if(wrong.length!==3) {finish();$('resultSubtitle').textContent='서로 다른 보기가 부족해 종료했어요. data.js 내용을 확인해 주세요.';return;}
    state.options=shuffle([e,...wrong]);
    $('gameMode').textContent=state.mode==='practice'?'☘ 준비 운동':'⚡ 덩어리 숲속으로';
    $('questionNumber').textContent=`${state.index+1} / ${state.queue.length} 단어`;
    $('roundProgress').max=state.queue.length;$('roundProgress').value=state.index;
    $('sessionXp').textContent=state.mode==='practice'?'경험치 없음':`${state.netXP>=0?'+':''}${state.netXP} XP`;
    $('questionKind').textContent=bonus?'✦ 짝꿍어휘 보너스 · +3 XP':'기본 단어 · '+(state.mode==='main'?'+5 XP':'천천히 풀어요');
    $('questionInstruction').textContent=bonus?(state.directionNow==='zh-ko'?'이 짝꿍 표현의 뜻을 골라 주세요.':'이 뜻에 맞는 짝꿍 표현을 골라 주세요.'):state.directionNow==='zh-ko'?'이 단어의 뜻은 무엇일까요?':'이 뜻에 맞는 한자를 골라 주세요.';
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
      state.deadline=performance.now()+RULES.seconds*1000;state.lastChime=RULES.seconds;
      tick();timer=setInterval(tick,50);
    }
    $('answers').firstElementChild?.focus({preventScroll:true});
  }
  function tick(){
    if(!state||!['basic','bonus'].includes(state.phase))return;
    const left=Math.max(0,(state.deadline-performance.now())/1000);
    $('timerText').textContent=`${left.toFixed(1)}초`;$('timerBar').value=left;$('timerText').classList.toggle('urgent',left<=2);
    const second=Math.ceil(left);
    if(second>0&&second<state.lastChime)forestAudio.effect('timer');
    state.lastChime=second;
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
    const koreanPrompt=state.directionNow==='ko-zh';
    $('answerHanzi').textContent=koreanPrompt?state.entry.meaning:state.entry.hanzi;
    $('answerHanzi').lang=koreanPrompt?'ko':'zh-CN';
    $('answerHanzi').setAttribute('aria-expanded','false');
    $('answerPinyin').hidden=true;$('answerMeaning').hidden=true;
    $('answerPinyin').textContent=state.entry.pinyin;
    $('answerMeaning').textContent=koreanPrompt?state.entry.hanzi:state.entry.meaning;
    $('answerMeaning').lang=koreanPrompt?'zh-CN':'ko';
    const details=$('answerMeaning').parentElement;
    if(koreanPrompt)details.insertBefore($('answerMeaning'),$('answerPinyin'));
    else details.insertBefore($('answerPinyin'),$('answerMeaning'));
    $('pinyinHint').textContent=koreanPrompt?'먼저 중국어로 말해 보세요 · 뜻을 누르면 한자와 병음이 보여요':'먼저 읽고 뜻을 떠올려 보세요 · 한자를 누르면 병음과 뜻이 보여요';
    $('feedbackNote').textContent=state.offerBonus?'이 단어와 함께 쓰는 표현도 익혀 볼까요?':correct?'발음을 듣고 한 번 따라 말해 보세요.':'정답을 확인하세요. 결과 화면에서 다시 연습할 수 있어요.';
    $('continueBtn').textContent=state.offerBonus?'짝꿍어휘 도전 · +3 XP':state.index===state.queue.length-1?'학습 결과 보기':'다음 단어 →';
    $('skipBonus').hidden=!state.offerBonus;
    if(profile.level>previousLevel){
      const gifts=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>i[3]>previousLevel&&i[3]<=profile.level);
      $('feedbackNote').textContent=`레벨 ${profile.level} 달성! `+([2,3,4,5,10].includes(profile.level)?(profile.level===2?'마음씨가 마음싹로 자랐어요!':profile.level===3?'학습 후 내 친구 꾸미기에서 성장 계열과 길을 선택하세요!':'친구가 더 자랐어요! 학습 후 달라진 모습을 확인하세요.'):gifts.length?gifts.map(i=>i[1]).join(' · ')+' 선물이 열렸어요. 학습 후 꾸며 보세요!':'친구와 한 걸음 더 자랐어요!');
    }
    forestAudio.effect(correct?(bonus?'bonus':'correct'):'wrong');
    if(profile.level>previousLevel)forestAudio.effect('level',.32);
    $('feedback').showModal();$('continueBtn').focus();
    // Pronunciation is strictly manual: use the listen button, including after correct answers.
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
    clearTimer();stopSound();forestAudio.effect('finish');state.phase='result';screen('result');
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
    $('ruleBox').innerHTML=practice?'시간제한 없이 기본 단어만 연습해요.<br>경험치 획득·차감과 보너스 문제는 없어요.':'기본 정답 <b>+5 XP</b> · 오답/시간 초과 <b>−2 XP</b><br>보너스 정답 <b>+3 XP</b> · 보너스 오답 차감 없음';
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
  $('speechRate').value=profile.rate;
  $('speechRate').onchange=()=>{profile.rate=Number($('speechRate').value);save();};
  $('voiceSelect').onchange=()=>{profile.voice=$('voiceSelect').value;save();};
  document.addEventListener('click',e=>{const control=e.target.closest('button,summary,a,input,select');if(control&&!control.disabled)forestAudio.unlock().then(ok=>{if(ok)forestAudio.effect('tap');});},{capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSound();});
  const FRIEND_PHRASES=[
    ['你好！','안녕!'],['加油！','힘내!'],['你真棒！','정말 잘했어!'],['谢谢你！','고마워!'],['我们一起学习吧！','우리 함께 공부하자!'],['慢慢来。','천천히 해.'],['再试一次！','한 번 더 해 봐!'],['别着急。','서두르지 마.'],['今天也要开心哦！','오늘도 즐겁게 보내!'],['休息一下吧！','잠깐 쉬자!'],['我很高兴！','난 정말 기뻐!'],['明天见！','내일 만나!']
  ];
  let phraseBag=[],bubbleTimer,bubbleEnd;
  const friend=$('mascot'),bubble=$('friendBubble');
  document.body.append(bubble);
  const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function positionBubble(){
    if(bubble.hidden)return;
    const rect=friend.getBoundingClientRect(),route=routeFor(profile.look.pet,profile.routes);
    const g=plantGeometry(profile.look.pet,route?.id,profile.level);
    const headY=rect.top+(197*(1-g.scale)+g.head[1]*g.scale)*rect.height/210;
    const width=bubble.offsetWidth||220;
    bubble.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.left+rect.width/2-width/2))+'px';
    bubble.style.top=Math.max(8,headY-(bubble.offsetHeight||78)-15)+'px';
  }
  function hideBubble(){clearTimeout(bubbleTimer);clearTimeout(bubbleEnd);bubble.classList.remove('bubble-visible');bubbleEnd=setTimeout(()=>{bubble.hidden=true;},reducedMotion()?0:260);}
  function chatWithFriend(){
    if(!phraseBag.length)phraseBag=shuffle(FRIEND_PHRASES);
    const [zh,ko]=phraseBag.pop();$('friendChinese').textContent=zh;$('friendKorean').textContent=ko;
    clearTimeout(bubbleTimer);clearTimeout(bubbleEnd);bubble.hidden=false;positionBubble();
    requestAnimationFrame(()=>bubble.classList.add('bubble-visible'));
    bubbleTimer=setTimeout(hideBubble,4200);
  }
  friend.setAttribute('role','button');friend.tabIndex=0;
  friend.setAttribute('aria-label','친구와 이야기하기. 길게 누르면 끌어 올릴 수 있어요');
  let grip=null,holdTimer,fallFrame,landTimer,offsetX=0,offsetY=0,suppressClick=false;
  const setOffset=()=>{friend.style.translate=`${offsetX}px ${offsetY}px`;positionBubble();};
  function stopFall(){cancelAnimationFrame(fallFrame);clearTimeout(landTimer);friend.classList.remove('friend-falling','friend-landed');}
  function land(){
    offsetY=0;setOffset();friend.classList.remove('friend-held','friend-falling');friend.classList.add('friend-landed');
    forestAudio.effect('land');
    const stage=$('homeHabitat');stage.classList.remove('landing-dust');void stage.offsetWidth;stage.classList.add('landing-dust');
    stage.style.setProperty('--impact-x',`calc(50% + ${offsetX}px)`);
    landTimer=setTimeout(()=>{friend.classList.remove('friend-landed');stage.classList.remove('landing-dust');},650);
  }
  function fall(){
    friend.classList.remove('friend-held');
    if(offsetY>=-2){offsetY=0;setOffset();return;}
    friend.classList.add('friend-falling');
    if(reducedMotion()){land();return;}
    let last=performance.now(),velocity=0;
    const step=now=>{const dt=Math.min((now-last)/1000,.035);last=now;velocity+=1600*dt;offsetY=Math.min(0,offsetY+velocity*dt);setOffset();if(offsetY<0)fallFrame=requestAnimationFrame(step);else land();};
    fallFrame=requestAnimationFrame(step);
  }
  friend.addEventListener('pointerdown',e=>{
    if(e.button!==0||grip)return;
    stopFall();suppressClick=false;forestAudio.unlock();
    grip={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:offsetX,y:offsetY,active:false};
    friend.setPointerCapture?.(e.pointerId);
    holdTimer=setTimeout(()=>{if(!grip)return;grip.active=true;suppressClick=true;hideBubble();friend.classList.add('friend-held');},220);
  });
  friend.addEventListener('pointermove',e=>{
    if(!grip||e.pointerId!==grip.id||!grip.active)return;
    const rect=friend.getBoundingClientRect(),stage=$('homeHabitat').getBoundingClientRect();
    const maxX=Math.max(0,(stage.width-rect.width)/2);
    offsetX=clamp(grip.x+e.clientX-grip.startX,-maxX,maxX);
    const baseTop=rect.top-offsetY;
    offsetY=clamp(grip.y+e.clientY-grip.startY,-Math.max(0,baseTop-12),0);setOffset();
  });
  function release(e){if(!grip||e.pointerId!==grip.id)return;clearTimeout(holdTimer);grip=null;friend.classList.remove('friend-held');if(friend.hasPointerCapture?.(e.pointerId))friend.releasePointerCapture(e.pointerId);fall();}
  friend.addEventListener('pointerup',release);friend.addEventListener('pointercancel',release);friend.addEventListener('lostpointercapture',release);
  friend.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}chatWithFriend();});
  friend.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chatWithFriend();}});
  function resetFriend(){clearTimeout(holdTimer);grip=null;stopFall();offsetX=offsetY=0;setOffset();friend.classList.remove('friend-held');$('homeHabitat').classList.remove('landing-dust');hideBubble();}
  window.addEventListener('resize',resetFriend);window.addEventListener('scroll',positionBubble,{passive:true});
  $('openCloset').addEventListener('click',resetFriend);$('startBtn').addEventListener('click',resetFriend);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetFriend();});
  $('answerHanzi').onclick=()=>{const show=$('answerPinyin').hidden;$('answerPinyin').hidden=!show;$('answerMeaning').hidden=!show;$('answerHanzi').setAttribute('aria-expanded',String(show));};
  $('testVoice').onclick=()=>speak({hanzi:'你好，我们一起学习汉语吧！'});
  if('speechSynthesis' in window)window.speechSynthesis.addEventListener('voiceschanged',populateVoices);
  function renderForestTabs(){
    document.body.dataset.forest=String(activeForest);
    $('forestDescription').textContent=`${FORESTS[activeForest].name} · HSK ${FORESTS[activeForest].grades}은 한 친구와 함께해요. 숲마다 성장 기록은 따로 저장돼요. 다음 레벨 필요 XP ×${XP_MULTIPLIERS[activeForest]}.`;
    $('forestTabs').querySelectorAll('button').forEach((button,i)=>{
      button.setAttribute('aria-pressed',String(i===activeForest));
      const p=forestProfiles[i];button.querySelector('small').textContent=`Lv.${p.level} · ${p.family?GROWTH[p.family].name:'마음씨부터 시작'}`;
    });
  }
  function updateCount(){
    const count=data.filter(w=>w.level===Number($('levelSelect').value)).length;
    $('wordCount').textContent=count?`${count}개의 단어`:'어휘 준비 중';$('startBtn').disabled=count<4;
  }
  function populateGrades(preferred){
    $('levelSelect').replaceChildren();
    const first=FORESTS[activeForest].start;
    for(let level=first;level<first+3;level++){
      const count=data.filter(w=>w.level===level).length;
      const option=document.createElement('option');option.value=String(level);option.disabled=count<4;
      option.textContent=`HSK ${level}급${count<4?' · 준비 중':''}`;$('levelSelect').append(option);
    }
    const available=[...$('levelSelect').options].filter(o=>!o.disabled);
    $('levelSelect').value=available.find(o=>o.value===String(preferred))?.value||available[0]?.value||String(first);
    updateCount();
  }
  function switchForest(index){
    if(index===activeForest||!FORESTS[index]||state&&['basic','bonus','feedback'].includes(state.phase))return;
    save();stopSound();clearTimer();resetFriend();state=null;activeForest=index;profile=forestProfiles[index];
    forestAudio.setForest(index);screen('setup');populateGrades();renderProfile();$('speechRate').value=profile.rate;populateVoices();modeChanged();save();
  }
  FORESTS.forEach((f,i)=>{
    const button=document.createElement('button');button.type='button';button.className='forest-tab';
    const title=document.createElement('strong');title.textContent=f.name+' · '+f.grades;
    const note=document.createElement('small');button.append(title,note);button.onclick=()=>switchForest(i);$('forestTabs').append(button);
  });
  $('levelSelect').onchange=updateCount;
  populateGrades();
  updateCount();renderProfile();save();populateVoices();modeChanged();
  if(data.length<4){$('startBtn').disabled=true;$('ruleBox').textContent='data.js를 불러오지 못했어요. 네 파일을 같은 폴더에 두었는지 확인해 주세요.';}
})();
