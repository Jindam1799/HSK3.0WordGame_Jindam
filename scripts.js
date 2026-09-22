/* No build step or server required: keep the four files in the same directory.
 * XP tuning and round timing live in RULES. Never put paid TTS API keys here.
 * Set data.js audio URLs to reviewed recordings to use consistent voice quality.
 */
(() => {
  'use strict';
  const RULES = Object.freeze({seconds:7, baseXP:5, penalty:2, bonusXP:3});
  const GARDEN_RULES=Object.freeze({baseCoins:2,bonusCoins:1,graceHours:48,penaltyHours:24,penaltyXP:5,maxPenaltySteps:4});
  const FERTILIZERS=Object.freeze({
    gentle:{name:'햇살 비료',price:20,boost:1,uses:10},
    rich:{name:'든든 비료',price:35,boost:2,uses:10},
    lush:{name:'반짝 비료',price:50,boost:3,uses:10}
  });
  const WORLD_RULES=Object.freeze({sprayPrice:10,umbrellaPrice:30,bugMs:90000,rainMs:120000,minGapMs:120000,maxGapMs:240000});
  const isRain=kind=>kind==='rain'||kind==='heavyRain';
  const worldGap=()=>WORLD_RULES.minGapMs+Math.floor(Math.random()*(WORLD_RULES.maxGapMs-WORLD_RULES.minGapMs));
  const HOUR=60*60*1000;
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
  const studyKey=KEY+'-study-v1';
  let studied=new Set(),studyStorageOK=true;
  try{const saved=JSON.parse(localStorage.getItem(studyKey)||'[]');if(Array.isArray(saved))studied=new Set(saved.filter(x=>typeof x==='string'));}catch{studyStorageOK=false;}
  const studyId=w=>`${w.level}:${w.id}`;
  function recordStudy(word){
    studied.add(studyId(word));
    try{localStorage.setItem(studyKey,JSON.stringify([...studied]));studyStorageOK=true;}catch{studyStorageOK=false;}
  }
  function renderStudy(forest=activeForest){
    $('studyHeading').textContent=FORESTS[forest].name+' 학습 진행률';
    $('studyRows').replaceChildren();
    for(let level=FORESTS[forest].start;level<FORESTS[forest].start+3;level++){
      const words=[...new Map(data.filter(w=>w.level===level).map(w=>[studyId(w),w])).values()];
      const count=words.filter(w=>studied.has(studyId(w))).length,total=words.length,percent=total?Math.floor(count/total*100):0;
      const row=document.createElement('section');row.className='study-row';
      const heading=document.createElement('h3');heading.textContent=`HSK ${level}급`;
      const bar=document.createElement('progress');bar.max=total||1;bar.value=count;bar.setAttribute('aria-label',`HSK ${level}급 학습 진행률`);
      const detail=document.createElement('div');detail.className='row';
      const amount=document.createElement('span');amount.textContent=total?`${count.toLocaleString()} / ${total.toLocaleString()} 단어`:'어휘 준비 중';
      const ratio=document.createElement('strong');ratio.textContent=total?`${percent}%`:'—';detail.append(amount,ratio);row.append(heading,bar,detail);$('studyRows').append(row);
    }
    $('studyNote').textContent=studyStorageOK?'이 기능을 추가한 뒤 답을 확인한 기본 단어를 기록해요. 정답·오답·준비 운동 모두 포함하며, 같은 단어는 한 번만 세어요. 짝꿍어휘는 제외해요. 전체 수는 현재 등록된 어휘 기준이에요. 기록은 이 브라우저에 저장돼요.':'현재 브라우저에 기록을 저장할 수 없어요. 이번 접속 중의 기록만 표시되며, 새로고침하면 사라질 수 있어요.';
  }
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
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210" aria-hidden="true"><g transform="translate(${90*(1-g.scale)} ${197*(1-g.scale)}) scale(${g.scale})"><g class="plant-body">${art}</g>${silhouette?'':charm+`<g class="expression-normal">${face}</g><g class="expression-happy"><path d="M${fx-16} ${fy+1}q6 -10 12 0M${fx+4} ${fy+1}q6 -10 12 0" fill="none" stroke="#38442d" stroke-width="2.6" stroke-linecap="round"/><path d="M${fx-7} ${fy+8}q7 4 14 0q-1 14-7 14t-7-14" fill="#79473f"/><path d="M${fx-4} ${fy+17}q4 -4 8 0" fill="none" stroke="#edaaa0" stroke-width="3"/><ellipse cx="${fx-19}" cy="${fy+9}" rx="6" ry="3.5" fill="#eaa28d" opacity=".8"/><ellipse cx="${fx+19}" cy="${fy+9}" rx="6" ry="3.5" fill="#eaa28d" opacity=".8"/></g><g class="expression-lift"><circle cx="${fx-10}" cy="${fy}" r="4" fill="#38442d"/><circle cx="${fx+10}" cy="${fy}" r="4" fill="#38442d"/><ellipse cx="${fx}" cy="${fy+10}" rx="4" ry="6" fill="#68483a"/></g><g class="expression-land"><path d="M${fx-15} ${fy-4}l7 4-7 4M${fx+15} ${fy-4}l-7 4 7 4M${fx-5} ${fy+12}q5 -5 10 0" stroke="#38442d" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`}</g></svg>`;
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
  const FOREST_ACCESSORIES=[{"forest": 1, "slot": "head", "id": "sunhat", "name": "소풍 밀짚모자", "level": 2, "art": "<path d=\"M24 59L30 26Q50 15 70 26L77 59Z\" fill=\"#e5c18b\"/><ellipse cx=\"50\" cy=\"64\" rx=\"44\" ry=\"13\" fill=\"#efd4a5\"/><path d=\"M28 49Q50 57 73 49\" stroke=\"#be8068\" stroke-width=\"9\"/>"}, {"forest": 1, "slot": "head", "id": "peachribbon", "name": "살구꽃 리본", "level": 4, "art": "<path d=\"M45 45L10 20V76L45 55M55 45L90 20V76L55 55\" fill=\"#e5ab95\"/><g fill=\"#fff0d1\"><circle cx=\"48\" cy=\"38\" r=\"9\"/><circle cx=\"60\" cy=\"48\" r=\"9\"/><circle cx=\"48\" cy=\"58\" r=\"9\"/><circle cx=\"39\" cy=\"48\" r=\"9\"/></g><circle cx=\"49\" cy=\"48\" r=\"7\" fill=\"#d7a45e\"/>"}, {"forest": 1, "slot": "face", "id": "sunglasses", "name": "노을 선글라스", "level": 3, "art": "<path d=\"M5 36H43L39 65Q25 77 10 63ZM57 36H95L90 63Q75 77 61 65Z\" fill=\"#b88a77\"/><path d=\"M43 43H57M15 43H31M66 43H83\" stroke=\"#f5ddaf\" stroke-width=\"4\"/>"}, {"forest": 1, "slot": "face", "id": "freckles", "name": "햇살 주근깨", "level": 2, "art": "<g fill=\"#c68362\" stroke=\"none\"><circle cx=\"13\" cy=\"53\" r=\"3\"/><circle cx=\"24\" cy=\"47\" r=\"3\"/><circle cx=\"32\" cy=\"57\" r=\"3\"/><circle cx=\"68\" cy=\"57\" r=\"3\"/><circle cx=\"76\" cy=\"47\" r=\"3\"/><circle cx=\"87\" cy=\"53\" r=\"3\"/></g>"}, {"forest": 1, "slot": "neck", "id": "picnicscarf", "name": "소풍 체크 스카프", "level": 4, "art": "<path d=\"M10 26Q50 41 90 26L50 83Z\" fill=\"#deaa86\"/><path d=\"M24 39L62 70M42 36L75 54M28 60L56 35M43 76L80 39\" stroke=\"#fff0d3\" stroke-width=\"5\"/>"}, {"forest": 1, "slot": "neck", "id": "sunpendant", "name": "햇살 목걸이", "level": 5, "art": "<path d=\"M15 15Q50 69 85 15\" fill=\"none\" stroke=\"#bc975b\" stroke-width=\"4\"/><circle cx=\"50\" cy=\"63\" r=\"18\" fill=\"#efd087\"/><path d=\"M50 35V28M50 91V84M22 63H15M85 63H78M30 43L25 38M70 83L75 88\" stroke=\"#d6a155\" stroke-width=\"4\"/>"}, {"forest": 1, "slot": "back", "id": "picnicpack", "name": "도토리 소풍 가방", "level": 6, "art": "<path d=\"M33 28V16H67V28\" fill=\"none\" stroke-width=\"5\"/><rect x=\"19\" y=\"26\" width=\"62\" height=\"66\" rx=\"16\" fill=\"#c19570\"/><rect x=\"30\" y=\"56\" width=\"40\" height=\"27\" rx=\"6\" fill=\"#ebc7a0\"/><path d=\"M20 44H80M50 40V51\" stroke=\"#8c7056\" stroke-width=\"4\"/>"}, {"forest": 1, "slot": "back", "id": "butterfly", "name": "살구 나비 날개", "level": 8, "art": "<path d=\"M48 55Q2 3 5 44Q9 68 35 62Q5 90 30 93Q48 87 50 60M52 55Q98 3 95 44Q91 68 65 62Q95 90 70 93Q52 87 50 60\" fill=\"#edc4a6\" stroke=\"#be9278\"/><path d=\"M14 35L44 58M86 35L56 58\" stroke=\"#fff1d9\" stroke-width=\"4\"/>"}, {"forest": 1, "slot": "charm", "id": "peachcharm", "name": "살구 열매 장식", "level": 7, "art": "<path d=\"M50 27Q17 8 16 47Q21 74 50 88Q79 74 84 47Q83 8 50 27Z\" fill=\"#e4a38c\"/><path d=\"M50 27Q39 53 50 88\" fill=\"none\" stroke=\"#c78570\"/><path d=\"M50 26Q57 2 80 8Q77 26 50 26\" fill=\"#adb37a\"/>"}, {"forest": 1, "slot": "charm", "id": "windmill", "name": "노을 바람개비", "level": 9, "art": "<path d=\"M50 47V94\" stroke-width=\"5\"/><path d=\"M50 48L15 15H50ZM50 48L83 15V48ZM50 48L83 81H50ZM50 48L17 81V48Z\" fill=\"#dca788\"/><path d=\"M50 48L15 15L15 48ZM50 48L83 81L83 48Z\" fill=\"#efd6aa\"/><circle cx=\"50\" cy=\"48\" r=\"6\" fill=\"#b98966\"/>"}, {"forest": 2, "slot": "head", "id": "mooncrown", "name": "초승달 왕관", "level": 2, "art": "<path d=\"M16 74L10 41 33 53 50 29 68 53 90 41 84 74Z\" fill=\"#b7a5ce\"/><path d=\"M58 7A17 17 0 1 0 65 35A14 14 0 0 1 58 7\" fill=\"#f3dfa7\"/>"}, {"forest": 2, "slot": "head", "id": "astralhat", "name": "별빛 탐험 모자", "level": 5, "art": "<path d=\"M25 75L46 8 76 75Z\" fill=\"#9182b3\"/><ellipse cx=\"50\" cy=\"79\" rx=\"42\" ry=\"10\" fill=\"#73638f\"/><path d=\"M47 32l4 9 10 2-8 6 2 11-8-5-9 5 2-11-8-6 11-2Z\" fill=\"#efdca5\"/>"}, {"forest": 2, "slot": "face", "id": "moonglasses", "name": "달빛 동그란 안경", "level": 3, "art": "<g fill=\"#d7d3ee\" fill-opacity=\".5\" stroke=\"#8a77a3\" stroke-width=\"4\"><circle cx=\"27\" cy=\"51\" r=\"21\"/><circle cx=\"73\" cy=\"51\" r=\"21\"/></g><path d=\"M48 48H52M14 46L23 39M60 46L70 38\" stroke=\"#fbefd0\" stroke-width=\"3\"/>"}, {"forest": 2, "slot": "face", "id": "starcheeks", "name": "별빛 볼장식", "level": 2, "art": "<path d=\"M20 36l4 10 11 2-8 7 2 11-9-6-10 6 3-11-9-7 12-2ZM80 36l4 10 11 2-8 7 2 11-9-6-10 6 3-11-9-7 12-2Z\" fill=\"#d7bddb\" stroke=\"#a58ab4\"/>"}, {"forest": 2, "slot": "neck", "id": "nightsscarf", "name": "밤하늘 스카프", "level": 4, "art": "<path d=\"M12 25Q50 41 88 25V49L63 55 73 91 52 91 43 57 12 49Z\" fill=\"#9380b2\"/><g fill=\"#efe0b4\"><circle cx=\"30\" cy=\"40\" r=\"3\"/><circle cx=\"60\" cy=\"41\" r=\"3\"/><circle cx=\"60\" cy=\"74\" r=\"3\"/></g>"}, {"forest": 2, "slot": "neck", "id": "moonpendant", "name": "달조각 목걸이", "level": 6, "art": "<path d=\"M16 13Q50 70 84 13\" fill=\"none\" stroke=\"#ada0bc\" stroke-width=\"4\"/><path d=\"M57 43A22 22 0 1 0 69 77A19 19 0 0 1 57 43\" fill=\"#f0deb0\"/>"}, {"forest": 2, "slot": "back", "id": "nightcape", "name": "별지기 망토", "level": 7, "art": "<path d=\"M33 12H67L92 87Q73 79 52 93Q29 79 8 87Z\" fill=\"#8876a5\"/><path d=\"M35 17Q50 30 65 17\" stroke=\"#d9c69e\" stroke-width=\"5\"/><g fill=\"#ead7b3\"><circle cx=\"33\" cy=\"54\" r=\"3\"/><circle cx=\"67\" cy=\"66\" r=\"3\"/><path d=\"M50 37l3 7 8 2-6 5 1 8-6-4-7 4 2-8-6-5 8-2Z\"/></g>"}, {"forest": 2, "slot": "back", "id": "aurorawings", "name": "오로라 날개", "level": 9, "art": "<path d=\"M49 58Q4 5 8 37L22 66 8 84Q37 92 49 58M51 58Q96 5 92 37L78 66 92 84Q63 92 51 58\" fill=\"#b8b4d9\"/><path d=\"M16 31L43 61 20 81M84 31L57 61 80 81\" stroke=\"#d5e3dd\" stroke-width=\"6\" fill=\"none\"/>"}, {"forest": 2, "slot": "charm", "id": "starlantern", "name": "별빛 랜턴", "level": 8, "art": "<path d=\"M37 25V15Q50 1 63 15V25\" fill=\"none\" stroke-width=\"4\"/><path d=\"M24 29H76L69 85H31Z\" fill=\"#b9a6c9\"/><path d=\"M36 39H64V73H36Z\" fill=\"#f4ddb0\"/><path d=\"M22 28H78M27 86H73\" stroke=\"#877492\" stroke-width=\"6\"/>"}, {"forest": 2, "slot": "charm", "id": "comet", "name": "꼬마 혜성", "level": 10, "art": "<path d=\"M20 70L83 9 70 56 91 31 66 83Z\" fill=\"#c1b2d9\"/><path d=\"M31 65L70 29M40 76L77 50\" stroke=\"#e6d8ed\" stroke-width=\"4\"/><circle cx=\"27\" cy=\"74\" r=\"19\" fill=\"#f1dba9\"/>"}];
  const accessoryAllowed=(id,forest=activeForest)=>!FOREST_ACCESSORIES.some(x=>x.id===id&&x.forest!==forest);
  for(const x of FOREST_ACCESSORIES)WARDROBE[x.slot].items.push([x.id,x.name,'',x.level]);
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
    const exclusive=FOREST_ACCESSORIES.find(x=>x.id===id);if(exclusive)art[id]=exclusive.art;
    return art[id]?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="none" stroke="#776c54" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art[id]}</g></svg>`:'';
  }
  WARDROBE.pet.items.push(...STUDENT_PETS.map(p=>[p,GROWTH[p].name,GROWTH[p].icon,3]));
  const SLOTS=['head','face','neck','back','charm'];
  const SLOT_NAMES={head:'머리 장식',face:'얼굴 장식',neck:'목 장식',back:'날개·망토',charm:'성장 보석'};
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  function safePoses(raw){
    const out={};
    if(raw&&typeof raw==='object')for(const [key,p] of Object.entries(raw).slice(0,150)){
      if(!/^(seed|sprout|petal|mushroom|succulent|clover|berry|tree):(young|adult-[a-z]+):(head|face|neck|back|charm):[a-z]+$/.test(key)||!p)continue;
      if(['x','y','scale','rotation'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))out[key]={x:clamp(p.x,-1,1),y:clamp(p.y,-1,1),scale:clamp(p.scale,.4,2),rotation:clamp(p.rotation,-180,180),...(Number.isFinite(p.gx)&&Number.isFinite(p.gy)?{gx:clamp(p.gx,.03,.97),gy:clamp(p.gy,.03,.97)}:{})};
    }return out;
  }
  function safeLook(raw,level,forest=activeForest){
    const look={...LOOK_DEFAULT,poses:safePoses(raw?.poses)};
    for(const [key,group] of Object.entries(WARDROBE))if(group.items.some(i=>i[0]===raw?.[key]&&i[3]<=level&&accessoryAllowed(i[0],forest)))look[key]=raw[key];
    if(!petAllowed(look.pet))look.pet='';
    if(typeof raw?.name==='string')look.name=raw.name.trim().slice(0,12);
    if(look.scene==='studentgarden')look.scene='meadow';
    return look;
  }
  function normalizeGarden(raw,now=Date.now()){
    const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0?Math.min(v,max):0;
    const lastWatered=Number.isSafeInteger(raw?.lastWatered)&&raw.lastWatered>0?Math.min(raw.lastWatered,now):now;
    const active=raw?.active;
    const w=raw?.world;
    const kind=['bug','rain','heavyRain','heat','wind'].includes(w?.kind)?w.kind:null;
    const milliseconds=(v,fallback,max)=>Number.isFinite(v)&&v>=0?Math.min(v,max):fallback;
    const world={kind,remainingMs:kind?milliseconds(w?.remainingMs,kind==='bug'?WORLD_RULES.bugMs:WORLD_RULES.rainMs,120000):0,
      nextMs:milliseconds(w?.nextMs,worldGap(),240000),thunderMs:milliseconds(w?.thunderMs,12000+Math.random()*16000,28000),umbrellaOwned:w?.umbrellaOwned===true,umbrellaOn:w?.umbrellaOwned===true&&w?.umbrellaOn===true};
    const h=raw?.health;
    const health={sick:h?.sick===true,medicine:Math.min(999,integer(h?.medicine,999)+(h?.medicineGift===true?0:1)),medicineGift:true,fan:h?.fan===true,heater:h?.heater===true,heaterOn:h?.heater===true&&h?.heaterOn===true,exposure:milliseconds(h?.exposure,0,60000),illMs:milliseconds(h?.illMs,0,120000),heatMs:milliseconds(h?.heatMs,0,45000),coolMs:milliseconds(h?.coolMs,0,45000),loss:integer(h?.loss,5)};
    return {health,coins:integer(raw?.coins,9999999),inventory:{lush:integer(raw?.inventory?.lush,999),gentle:integer(raw?.inventory?.gentle,999),rich:integer(raw?.inventory?.rich,999),spray:raw?.world?integer(raw?.inventory?.spray,999):1},world,
      lastWatered,penaltySteps:integer(raw?.penaltySteps,GARDEN_RULES.maxPenaltySteps),
      neglectLoss:integer(raw?.neglectLoss,integer(raw?.penaltySteps,GARDEN_RULES.maxPenaltySteps)*GARDEN_RULES.penaltyXP),
      active:active&&Object.hasOwn(FERTILIZERS,active.kind)&&Number.isInteger(active.remaining)&&active.remaining>0
        ?{kind:active.kind,remaining:Math.min(active.remaining,FERTILIZERS[active.kind].uses)}:null};
  }
  // Settle each dry-day step once, including steps protected by a level floor.
  // Missing garden data starts today: older saves never receive retroactive loss.
  function settleCare(p,index,now=Date.now()){
    const g=p.garden,age=Math.max(0,now-g.lastWatered);
    const steps=age<GARDEN_RULES.graceHours*HOUR?0:Math.min(GARDEN_RULES.maxPenaltySteps,1+Math.floor((age-GARDEN_RULES.graceHours*HOUR)/(GARDEN_RULES.penaltyHours*HOUR)));
    if(steps<=g.penaltySteps)return {changed:false,loss:0};
    const requested=(steps-g.penaltySteps)*GARDEN_RULES.penaltyXP;
    const loss=Math.min(requested,Math.max(0,p.xp-xpStart(p.level,index)));
    g.penaltySteps=steps;g.neglectLoss+=loss;p.xp-=loss;
    return {changed:true,loss};
  }
  let storageAvailable=true;
  function loadForest(index){
    let loaded={schema:8,garden:normalizeGarden(null),xp:0,level:1,voice:'',rate:.9,auto:false,look:{...LOOK_DEFAULT,poses:{}},routes:{},family:null};
    try{
      const saved=JSON.parse(localStorage.getItem(forestKey(index))||'null');
      if(saved&&Number.isSafeInteger(saved.xp)&&saved.xp>=0){
        const oldLevel=Math.floor(saved.xp/100)+1;
        const migrated=xpStart(oldLevel,0)+Math.floor((saved.xp%100)/100*xpNeeded(oldLevel,0));
        const baseXP=saved.schema>=5?saved.xp:migrated;
        const xp=saved.schema>=6?saved.xp:Math.min(Number.MAX_SAFE_INTEGER,Math.floor(baseXP*XP_MULTIPLIERS[index]));
        const level=levelFromXP(xp,index);
        loaded={...loaded,xp,level,garden:normalizeGarden(saved.garden),voice:typeof saved.voice==='string'?saved.voice:'',rate:[.5,.75].includes(saved.rate)?.5:.9,
          look:safeLook(saved.look,level,index),routes:safeRoutes(saved.routes,level),family:level>=3&&petAllowed(saved.family)&&GROWTH[saved.family]?saved.family:null};
        if(loaded.family)loaded.look.pet=loaded.family;
      }
    }catch{storageAvailable=false;}
    return loaded;
  }
  const forestProfiles=FORESTS.map((_,i)=>loadForest(i));
  let profile=forestProfiles[activeForest];
  function save(){
    try{localStorage.setItem(forestKey(activeForest),JSON.stringify(profile));}catch{storageAvailable=false;}
    $('storageNotice').textContent=storageAvailable?'성장·코인·돌봄은 이 브라우저에 저장돼요.':'저장할 수 없는 환경입니다. 현재 화면에서만 기록이 유지돼요.';
  }
  function renderProfile(){
    const progress=profile.xp-xpStart(profile.level), needed=xpNeeded(profile.level);
    $('levelTag').textContent=`LV. ${profile.level}`;$('xpLabel').textContent=`${progress.toLocaleString()} / ${needed.toLocaleString()} XP`;$('xpBar').max=needed;$('xpBar').value=progress;$('totalXp').textContent=`누적 ${profile.xp.toLocaleString()} XP`;
    const name=growthName(profile.look.pet,profile.routes,profile.level);
    $('characterName').textContent=profile.look.name||name;$('characterMessage').textContent=profile.look.name?name:profile.level<3?'작은 씨앗에서 시작하는 나의 이야기':'매일 배우며 조금씩 자라고 있어요.';
    const current=profile.level===1?0:profile.level===2?1:!profile.family?1:profile.level<4?2:profile.level<10?3:4;
    document.querySelector('.growth-path').innerHTML=[['🫘','씨앗 · 1'],['🌱','새싹 · 2'],['🔀','선택 · 3'],['🌿','성장 · 4~9'],['✨','진화 · 10']].map(([icon,label],i)=>`<span class="${i<=current?'active':''}">${icon}<small>${label}</small></span>`).join('');
    renderLook($('mascot'),$('homeHabitat'),profile.look);renderUnlockHint();renderForestTabs();renderCare();
  }
  const gardenBusy=()=>!!state&&['basic','bonus','feedback'].includes(state.phase);
  function renderWaterCountdown(){
    const seconds=Math.max(0,Math.ceil((profile.garden.lastWatered+GARDEN_RULES.graceHours*HOUR-Date.now())/1000));
    const moisture=Math.ceil(seconds/(GARDEN_RULES.graceHours*3600)*100);
    $('waterBar').value=moisture;$('waterBar').setAttribute('aria-valuetext',`수분 ${moisture}%`);
    if(!seconds)$('waterState').textContent='목이 말라요';
    const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
    $('waterCountdown').textContent=seconds?`0%까지 ${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:'0% · 물이 필요해요';
    $('waterCountdown').setAttribute('aria-label',seconds?`수분 0%까지 ${hours}시간 ${minutes}분 ${rest}초`:'수분 0퍼센트, 물이 필요해요');
  }
  function renderCare(){
    renderWaterCountdown();
    const g=profile.garden,age=Math.max(0,Date.now()-g.lastWatered),hours=age/HOUR;
    const moisture=Math.max(0,Math.ceil(100*(1-hours/GARDEN_RULES.graceHours)));
    $('careCoins').textContent=g.coins.toLocaleString();
    $('waterBar').value=moisture;$('waterBar').setAttribute('aria-valuetext',`수분 ${moisture}%`);
    $('waterState').textContent=hours>=48?'목이 말라요':hours>=24?'물을 주면 좋아요':'촉촉해요';
    $('carePanel').dataset.dry=String(hours>=48);
    $('waterPlant').disabled=gardenBusy();$('openShop').disabled=gardenBusy();
    const active=g.active,remaining=active?.remaining||0;
    $('fertilizerState').textContent=active?`${FERTILIZERS[active.kind].name} · 기본 정답 +${FERTILIZERS[active.kind].boost} XP · ${remaining}회 남음`:'비료를 주면 기본 정답 경험치가 늘어나요.';
    $('waterHelp').textContent=hours>=48
      ?`이번 물 부족 차감 ${g.neglectLoss} / 20 XP · 물을 주면 다시 촉촉해져요.`
      :`물 부족 차감까지 약 ${Math.max(1,Math.ceil(48-hours))}시간 · 물주기는 무료예요.`;
    renderWorld();
    if($('gardenShop').open)renderShop();
  }
  function refreshGarden(){
    // No passive XP changes in an active quiz (including practice).
    if(gardenBusy())return;
    const result=settleCare(profile,activeForest);
    if(result.changed){
      save();renderProfile();
      $('careMessage').textContent=result.loss?`물이 부족해 ${result.loss} XP가 줄었어요. 레벨은 그대로예요.`:'물이 부족하지만 레벨 보호로 경험치는 줄지 않았어요.';
    }else renderCare();
  }
  let careReactionTimer,careSpeechTimer,careEndTimer;
  function waterPlant(){
    if(gardenBusy())return;
    refreshGarden();
    const g=profile.garden;g.lastWatered=Date.now();g.penaltySteps=0;g.neglectLoss=0;
    save();renderCare();
    $('careMessage').textContent='고마워요! 물을 충분히 마셨어요. 谢谢你！';
    playCareAnimation('water');
    forestAudio.effect('dress');
  }
  function renderShop(){
    const g=profile.garden;
    renderSupplies();
    $('shopForest').textContent=FORESTS[activeForest].name+'의 작은 상점';
    $('shopCoins').textContent=g.coins.toLocaleString()+' 코인';
    $('shopActive').textContent=g.active?`${FERTILIZERS[g.active.kind].name} 사용 중 · ${g.active.remaining}회 남음`:'구입한 아이템은 로비의 바구니에서 사용할 수 있어요.';
    for(const [kind,item] of Object.entries(FERTILIZERS)){
      const buy=document.querySelector(`[data-buy="${kind}"]`),use=document.querySelector(`[data-feed="${kind}"]`);
      $(kind+'Stock').textContent=`보관함 ${g.inventory[kind]}개`;
      buy.disabled=gardenBusy()||g.coins<item.price||g.inventory[kind]>=999;
      use.disabled=gardenBusy()||g.inventory[kind]<1;
      use.textContent=g.active?'비료 사용 중':'식물에게 주기';
      $(kind+'Hint').textContent=g.active?'지금 비료를 다 쓰면 다음 비료를 줄 수 있어요.':g.inventory[kind]>0?'준비 운동과 오답에서는 횟수가 줄지 않아요.':g.coins<item.price?`${item.price-g.coins}코인을 더 모으면 살 수 있어요.`:'구입한 비료는 보관함에 저장돼요.';
    }
  }
  function renderSupplies(){
    renderHealthShop();
    const g=profile.garden,w=g.world;
    $('sprayStock').textContent=`보관함 ${g.inventory.spray}개`;
    $('umbrellaStock').textContent=w.umbrellaOwned?(w.umbrellaOn?'우산을 씌웠어요':'보유 중'):'';
    $('buySpray').disabled=gardenBusy()||g.coins<WORLD_RULES.sprayPrice||g.inventory.spray>=999;
    $('buyUmbrella').disabled=gardenBusy()||w.umbrellaOwned||g.coins<WORLD_RULES.umbrellaPrice;
    $('buyUmbrella').textContent=w.umbrellaOwned?'구매 완료':'30 코인으로 구매';
    $('useSpray').disabled=gardenBusy()||!g.inventory.spray;
    $('useUmbrella').disabled=gardenBusy()||!w.umbrellaOwned;
    $('useUmbrella').textContent=w.umbrellaOn?'우산 접기':'우산 씌우기';
  }
  function buyFertilizer(kind){
    if(gardenBusy()||!Object.hasOwn(FERTILIZERS,kind))return false;
    const g=profile.garden,item=FERTILIZERS[kind];
    if(g.coins<item.price||g.inventory[kind]>=999)return false;
    g.coins-=item.price;g.inventory[kind]++;
    save();renderCare();renderShop();
    $('shopMessage').textContent=`${item.name} 1개를 보관함에 넣었어요. −${item.price} 코인`;
    return true;
  }
  function feedFertilizer(kind){
    if(gardenBusy()||!Object.hasOwn(FERTILIZERS,kind))return false;
    const g=profile.garden,item=FERTILIZERS[kind];
    if(g.inventory[kind]<1)return false;
    if(g.active)return playfulReaction('puzzled');
    g.inventory[kind]--;g.active={kind,remaining:item.uses};
    save();renderCare();renderShop();forestAudio.effect('dress');
    $('shopMessage').textContent=`${item.name}를 주었어요! 다음 기본 정답 ${item.uses}회에 +${item.boost} XP`;
    $('careMessage').textContent=`${item.name}를 먹고 힘이 났어요! 기본 정답 ${item.uses}회 동안 +${item.boost} XP`;
    if($('basketDialog').open)$('basketDialog').close();
    if($('gardenShop').open)$('gardenShop').close();
    $('openShop').focus({preventScroll:true});
    playCareAnimation('fertilizer',kind);
    return true;
  }
  function gardenReward(correct,bonus){
    if(state.mode!=='main'||!correct)return {coins:0,boost:0};
    const g=profile.garden,earned=bonus?GARDEN_RULES.bonusCoins:GARDEN_RULES.baseCoins;
    const coins=Math.min(earned,9999999-g.coins);g.coins+=coins;
    let boost=0;
    if(!bonus&&g.active){
      boost=FERTILIZERS[g.active.kind].boost;
      if(--g.active.remaining===0)g.active=null;
    }
    return {coins,boost};
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
      let x=90+(anchor[0]-90)*g.scale+pose.x*180*g.scale,y=197+(anchor[1]-197)*g.scale+pose.y*210*g.scale;
      if(Number.isFinite(pose.gx)&&Number.isFinite(pose.gy)){const a=avatar.getBoundingClientRect(),h=avatar.closest('.habitat').getBoundingClientRect();if(a.width&&a.height){x=(h.left+pose.gx*h.width-a.left)/a.width*180;y=(h.top+pose.gy*h.height-a.top)/a.height*210;}}
      const size={head:50,face:63,neck:38,back:145,charm:30}[slot];
      Object.assign(el.style,{left:(x/180*100)+'%',top:(y/210*100)+'%',right:'auto',bottom:'auto',width:size+'px',height:size+'px',fontSize:size+'px',lineHeight:'1',transform:`translate(-50%,-50%) rotate(${pose.rotation}deg) scale(${pose.scale*g.scale})`});
    }
  }
  function renderLook(avatar,habitat,look,routes=profile.routes){
    requestAnimationFrame(()=>{positionGround(avatar,habitat);placeAccessories(avatar,look,routes);});
    const route=routeFor(look.pet,routes),g=plantGeometry(look.pet,route?.id,profile.level);
    avatar.dataset.pet=g.family;avatar.dataset.route=route?.id||'';avatar.dataset.stage=String(growthStage(profile.level,route));avatar.dataset.level=profile.level;
    avatar.classList.add('forest-avatar');avatar.style.background='transparent';
    let illustration=avatar.querySelector('.creature-art');if(!illustration){illustration=document.createElement('div');illustration.className='creature-art';avatar.prepend(illustration);}
    const concealed=avatar.id==='previewAvatar'&&g.adult&&profile.routes[look.pet]!==route?.id;
    illustration.innerHTML=creatureSVG(look.pet,route?.id,profile.level,WARDROBE.color.items.find(i=>i[0]===look.color)[2],concealed);habitat.dataset.scene=look.scene;habitat.style.backgroundImage=`url("assets/garden-${['meadow','sunset','night','rainbow'].includes(look.scene)?look.scene:'meadow'}.svg")`;habitat.style.backgroundSize='cover';
    for(const key of SLOTS){
      let el=avatar.querySelector('.wear-'+key);if(!el){el=document.createElement('span');el.className='wear-'+key;avatar.append(el);}
      const item=WARDROBE[key].items.find(i=>i[0]===look[key]);
      el.dataset.item=look[key];el.dataset.slot=key;el.classList.add('editable-accessory');
      el.innerHTML=look[key]==='none'||(key==='charm'&&look[key]==='routegift'&&!g.adult)?'':accessorySVG(look[key]);
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
    $('previewAvatar').querySelectorAll('.editable-accessory').forEach(el=>el.classList.toggle('selected-accessory',el.dataset.slot===selectedSlot&&!el.hidden));
    const handle=$('previewHabitat').querySelector('.accessory-handle');
    if(handle){handle.hidden=!equipped.length;if(equipped.length){const r=$('previewAvatar').querySelector('.wear-'+selectedSlot).getBoundingClientRect(),h=$('previewHabitat').getBoundingClientRect();handle.style.left=clamp(r.right-h.left,20,h.width-20)+'px';handle.style.top=clamp(r.bottom-h.top,20,h.height-20)+'px';}}

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
    requestAnimationFrame(()=>{if(draftLook)refreshPositionControls();});
  }
  function mutatePose(mutator){
    if(!draftLook||draftLook[selectedSlot]==='none')return;
    const key=poseKey(draftLook,draftRoutes,selectedSlot),pose={...(draftLook.poses[key]||defaultPose())},before={...pose};mutator(pose);
    if(Number.isFinite(before.gx)&&Number.isFinite(before.gy)){
      const a=$('previewAvatar').getBoundingClientRect(),h=$('previewHabitat').getBoundingClientRect(),g=plantGeometry(draftLook.pet,routeFor(draftLook.pet,draftRoutes)?.id,profile.level);
      pose.gx+=(pose.x-before.x)*a.width*g.scale/h.width;pose.gy+=(pose.y-before.y)*a.height*g.scale/h.height;
      pose.x=before.x;pose.y=before.y;
    }
    draftLook.poses[key]={x:clamp(pose.x,-1,1),y:clamp(pose.y,-1,1),scale:clamp(pose.scale,.4,2),rotation:clamp(pose.rotation,-180,180),...(Number.isFinite(pose.gx)&&Number.isFinite(pose.gy)?{gx:clamp(pose.gx,.03,.97),gy:clamp(pose.gy,.03,.97)}:{})};
    placeAccessories($('previewAvatar'),draftLook,draftRoutes);refreshPositionControls();
  }
  function setupDragging(avatar){
    const habitat=avatar.closest('.habitat'),points=new Map();
    const handle=document.createElement('button');handle.type='button';handle.className='accessory-handle';handle.textContent='↗';handle.setAttribute('aria-label','선택 장식 크기와 회전 조절');habitat.append(handle);
    let baseline=null;
    const pose=()=>({...draftLook.poses[poseKey(draftLook,draftRoutes,selectedSlot)]||defaultPose()});
    const center=()=>{const r=avatar.querySelector('.wear-'+selectedSlot).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
    const angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x),distance=(a,b)=>Math.max(12,Math.hypot(b.x-a.x,b.y-a.y));
    const rebase=(mode='move')=>{const ps=[...points.values()],c=center();baseline={pose:pose(),c,ps:ps.map(p=>({...p})),mode};};
    habitat.onpointerdown=e=>{
      const target=e.target.closest('.editable-accessory'),isHandle=e.target===handle;
      if(e.button>0||(!points.size&&!target&&!isHandle)||points.size>=2)return;
      if(!points.size){if(target){if(target.hidden)return;selectedSlot=target.dataset.slot;}refreshPositionControls();}
      e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});rebase(isHandle?'handle':'move');
      habitat.setPointerCapture(e.pointerId);avatar.classList.add('is-dragging');
    };
    habitat.onpointermove=e=>{
      if(!points.has(e.pointerId)||!draftLook)return;e.preventDefault();points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const ps=[...points.values()],old=baseline.ps,h=habitat.getBoundingClientRect();let dx=ps[0].x-old[0].x,dy=ps[0].y-old[0].y,scale=baseline.pose.scale,rotation=baseline.pose.rotation;
      if(ps.length===2){dx=(ps[0].x+ps[1].x-old[0].x-old[1].x)/2;dy=(ps[0].y+ps[1].y-old[0].y-old[1].y)/2;scale*=distance(ps[0],ps[1])/distance(old[0],old[1]);rotation+=(angle(ps[0],ps[1])-angle(old[0],old[1]))*180/Math.PI;}
      else if(baseline.mode==='handle'){dx=dy=0;scale*=distance(baseline.c,ps[0])/distance(baseline.c,old[0]);rotation+=(angle(baseline.c,ps[0])-angle(baseline.c,old[0]))*180/Math.PI;}
      mutatePose(p=>{p.gx=(baseline.c.x+dx-h.left)/h.width;p.gy=(baseline.c.y+dy-h.top)/h.height;p.scale=scale;p.rotation=((rotation+180)%360+360)%360-180;});
    };
    const end=e=>{if(!points.delete(e.pointerId))return;if(points.size)rebase();else{baseline=null;avatar.classList.remove('is-dragging');}};
    habitat.onpointerup=end;habitat.onpointercancel=end;habitat.onlostpointercapture=end;
    habitat.onkeydown=e=>{
      const el=e.target.closest('.editable-accessory');if(!el&&e.target!==handle)return;if(el)selectedSlot=el.dataset.slot;
      const step=e.shiftKey?10:2,moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      if(moves[e.key]){e.preventDefault();mutatePose(p=>{if(e.target===handle){p.scale+=moves[e.key][1]*-.01;p.rotation+=moves[e.key][0];}else{p.x+=moves[e.key][0]/180;p.y+=moves[e.key][1]/210;}});}
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();refreshPositionControls();}
    };
    handle.title='끌어서 크기·회전 조절 · 방향키: 위아래 크기, 좌우 회전';
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
        if(!accessoryAllowed(id))continue;
        const button=document.createElement('button');button.type='button';button.className='wardrobe-item';button.dataset.group=key;button.dataset.item=id;
        const art=document.createElement('span');art.className='item-art';art.setAttribute('aria-hidden','true');
        if(key==='color'){art.classList.add('swatch');art.style.background=icon;}else if(key==='pet'){art.classList.add('pet-thumbnail');art.innerHTML=creatureSVG(id,null,3,'#aac875');}else if(SLOTS.includes(key)&&id!=='none'){art.classList.add('accessory-thumbnail');art.innerHTML=accessorySVG(id);}else art.textContent=icon;
        const name=document.createElement('strong');name.textContent=label;const note=document.createElement('small');const privateLocked=(key==='pet'&&!petAllowed(id));note.textContent=privateLocked?'수강생 전용':level>profile.level?`잠김 · Lv.${level}`:'사용 가능';button.disabled=privateLocked||level>profile.level;button.append(art,name,note);const exclusive=FOREST_ACCESSORIES.find(x=>x.id===id);if(exclusive){const badge=document.createElement('small');badge.textContent=FORESTS[exclusive.forest].grades+' 전용';button.append(badge);}
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
  $('refreshApp').onclick=()=>{save();const url=new URL(location.href);url.searchParams.set('_refresh',Date.now());location.replace(url.href);};
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
    let crisis=false;
    const CRISIS_TRACK={name:'파리떼 주의! · 위기 BGM',bpm:136,tone:'keys',pattern:[0,2,1,2],chords:[[45,48,52],[44,47,52]],melody:[69,72,76,72,68,71,76,71,69,72,77,76,71,68,64,68],mood:'mystery'};
    let TRACKS=MUSIC_BANKS[0];
    const voices=new Set();let trackIndex=-1,bag=[];
    function chooseTrack(){
      if(!bag.length){bag=shuffle(TRACKS.map((_,i)=>i));if(bag[0]===trackIndex)[bag[0],bag[1]]=[bag[1],bag[0]];}
      trackIndex=bag.shift();beat=0;
      $('currentTrack').textContent=crisis?CRISIS_TRACK.name:TRACKS[trackIndex].name;
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
        const track=crisis?CRISIS_TRACK:TRACKS[trackIndex],tempo=60/track.bpm;
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
        if(beat>=track.melody.length*2){if(crisis)beat=0;else{chooseTrack();nextTime+=1.2;}}
      }
    }
    function setCrisis(value){
      if(crisis===value)return;crisis=value;stopMusic();beat=0;
      if(trackIndex<0)chooseTrack();$('currentTrack').textContent=crisis?CRISIS_TRACK.name:TRACKS[trackIndex].name;startMusic();
    }
    function insectSound(spray=false){
      const t=ctx.currentTime,source=spray?ctx.createBufferSource():ctx.createOscillator(),amp=ctx.createGain(),out=ctx.createGain();
      if(spray){const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.65),ctx.sampleRate);const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.35;source.buffer=buffer;}
      else{source.type='sawtooth';source.frequency.setValueAtTime(155,t);source.frequency.linearRampToValueAtTime(205,t+.2);source.frequency.linearRampToValueAtTime(145,t+.55);}
      amp.gain.value=spray?.25:.025;out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(1,t+.05);out.gain.linearRampToValueAtTime(0,t+.65);
      source.connect(amp);amp.connect(out);out.connect(effectGain);const voice={oscillator:source,amp,out,bus:'effect'};voices.add(voice);source.onended=()=>{voices.delete(voice);source.disconnect();amp.disconnect();out.disconnect();};source.start(t);source.stop(t+.7);
    }
    function setForest(index){stopMusic();TRACKS=MUSIC_BANKS[index];bag=[];trackIndex=-1;chooseTrack();startMusic();}
    function startMusic(){if(!ctx||!active||!settings.music||document.hidden||clock!==null||ctx.state!=='running')return;nextTime=ctx.currentTime+.06;schedule();clock=setInterval(schedule,120);status(crisis?'파리떼가 나타났어요! 위기 BGM':`♪ ${FORESTS[activeForest].name} · 오리지널 5곡 무작위 재생`);}
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
    let rainLoop=null;
    function noiseBuffer(seconds){
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      return buffer;
    }
    function setRain(enabled){
      enabled=enabled&&settings.effects&&!document.hidden&&ctx?.state==='running';
      if(!enabled){if(rainLoop){const old=rainLoop;rainLoop=null;old.gain.gain.setTargetAtTime(0,ctx.currentTime,.08);old.source.stop(ctx.currentTime+.3);}return;}
      if(rainLoop)return;
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      source.buffer=noiseBuffer(3);source.loop=true;filter.type='lowpass';filter.frequency.value=2600;
      gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.24,ctx.currentTime+.6);
      source.connect(filter);filter.connect(gain);gain.connect(effectGain);
      source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
      rainLoop={source,gain};source.start();
    }
    function thunderSound(){
      const t=ctx.currentTime,source=ctx.createBufferSource(),amp=ctx.createBiquadFilter(),out=ctx.createGain();
      source.buffer=noiseBuffer(2.8);amp.type='lowpass';amp.frequency.setValueAtTime(1800,t);amp.frequency.exponentialRampToValueAtTime(130,t+2.6);
      out.gain.setValueAtTime(.001,t);out.gain.exponentialRampToValueAtTime(.65,t+.025);out.gain.exponentialRampToValueAtTime(.15,t+.22);out.gain.exponentialRampToValueAtTime(.4,t+.35);out.gain.exponentialRampToValueAtTime(.001,t+2.7);
      source.connect(amp);amp.connect(out);out.connect(effectGain);
      const voice={oscillator:source,amp,out,bus:'effect'};voices.add(voice);
      source.onended=()=>{voices.delete(voice);source.disconnect();amp.disconnect();out.disconnect();};source.start(t);source.stop(t+2.8);
    }
    const phrases={evolve:[[60,0,.5,.07],[67,.18,.55,.06],[72,.38,.6,.08],[76,.62,.7,.07],[79,.86,.85,.07],[84,1.14,1.15,.075],[88,1.48,1,.045]],tap:[[76,0,.11,.075]],correct:[[76,0,.18,.12],[81,.11,.27,.09]],bonus:[[76,0,.16,.11],[79,.1,.18,.1],[84,.2,.3,.09]],wrong:[[64,0,.17,.055],[60,.12,.22,.04]],level:[[72,0,.18,.09],[76,.11,.2,.09],[79,.22,.23,.09],[84,.34,.48,.09]],finish:[[72,0,.2,.07],[76,.15,.22,.07],[79,.3,.4,.065]],dress:[[79,0,.14,.08],[84,.08,.2,.07]]};
    function effect(name,delay=0){if(!settings.effects||document.hidden)return;if(!ctx||ctx.state!=='running')return;if(name==='buzz'||name==='spray'){insectSound(name==='spray');return;}if(name==='thunder'){thunderSound();return;}if(name==='land'){const t=ctx.currentTime+.015;note(38,t,.18,.17,'effect','bass');note(45,t+.04,.12,.08,'effect','bass');return;}if(name==='timer'){clockTick(ctx.currentTime+.015+delay);return;}for(const [pitch,offset,length,gain] of phrases[name]||phrases.tap)note(pitch,ctx.currentTime+.015+offset+delay,length,gain,'effect','bell');}
    function duck(value){ducked=value;mix();}
    function pause(){setRain(false);stopMusic();if(ctx){for(const v of [...voices]){try{v.oscillator.stop();}catch{}voices.delete(v);}ctx.suspend().catch(()=>{});}status(active?'다른 화면을 보는 동안 음악을 쉬고 있어요.':'게임 시작 또는 소리 듣기를 누르면 재생돼요.');}
    $('bgmEnabled').checked=settings.music;$('sfxEnabled').checked=settings.effects;
    for(const [id,key] of [['bgmVolume','musicVolume'],['sfxVolume','effectVolume']]){
      $(id).value=Math.round(settings[key]*100);$(id+'Value').textContent=$(id).value+'%';
      $(id).oninput=()=>{settings[key]=Number($(id).value)/100;$(id+'Value').textContent=$(id).value+'%';mix();persist();};
    }
    $('bgmEnabled').onchange=()=>{settings.music=$('bgmEnabled').checked;mix();persist();if(settings.music)unlock();else{stopMusic();status('배경음악 꺼짐');}};
    $('sfxEnabled').onchange=()=>{settings.effects=$('sfxEnabled').checked;if(!settings.effects)setRain(false);mix();persist();if(settings.effects)unlock();};
    $('listenMusic').onclick=()=>{if(!settings.music){settings.music=true;$('bgmEnabled').checked=true;persist();mix();}unlock();};
    $('listenSfx').onclick=()=>{if(!settings.effects){settings.effects=true;$('sfxEnabled').checked=true;persist();mix();}unlock().then(ok=>{if(ok)effect('bonus');});};
    $('nextMusic').onclick=()=>{stopMusic();chooseTrack();if(!settings.music){settings.music=true;$('bgmEnabled').checked=true;persist();mix();}unlock();};
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(active)unlock();});
    window.addEventListener('pagehide',pause);window.addEventListener('pageshow',()=>{if(active&&!document.hidden)unlock();});
    document.addEventListener('pointerdown',()=>{if(active&&ctx&&ctx.state!=='running'&&!document.hidden)unlock();},{passive:true});
    status('게임 시작 또는 소리 듣기를 누르면 재생돼요.');
    return {unlock,effect,duck,setForest,setCrisis,setRain};
  })();
  $('welcomeFriends').innerHTML=['mushroom','petal','succulent'].map(p=>'<span>'+creatureSVG(p,null,3)+'</span>').join('');
  let choosingEntryForest=false;
  $('enterLobby').onclick=()=>{
    choosingEntryForest=true;arrangeLobby();
    $('forestDialog').showModal();
    $('forestTabs').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
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
  function screen(name) {document.body.dataset.screen=name;if(name==='game')$('adventureDialog').close();$('forestTabs').querySelectorAll('button').forEach(b=>b.disabled=name==='game');['setup','game','result'].forEach(id=>$(id).hidden=id!==name);$('openCloset').disabled=name==='game';document.body.classList.toggle('playing',name==='game');renderCare();}
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
  // Edit these messages to change the free edition's promotional popups.
  const PROMOTIONS={
    start:{title:'덩어리로 익히면, 중국어가 툭!',body:'단어를 아는 것에서 한 걸음 더. 진담중국어에서는 짝꿍어휘를 익히고, 내 문장으로 바꾸고, 질문에 바로 답하는 연습을 함께해요.',note:'오늘 숲에서 배운 표현 하나, 직접 소리 내어 말해 볼까요?',button:'학습 시작하기'},
    finish:{title:'오늘 배운 중국어, 내 이야기로 말해요.',body:'게임으로 익힌 단어와 짝꿍어휘를 나의 일상에 연결해 보세요. 진담중국어 덩어리훈련은 표현을 입에 붙이고 실제 대화로 이어 가는 연습입니다.',note:'진심을 담은 중국어 · 진담중국어',button:'학습 결과 확인하기'}
  };
  let promotionDone=null,promotionRemaining=0,promotionClock=null,promotionLast=0;
  function updatePromotionTimer(){
    const now=performance.now();
    if(!document.hidden)promotionRemaining=Math.max(0,promotionRemaining-(now-promotionLast));
    promotionLast=now;
    const seconds=Math.ceil(promotionRemaining/1000);
    $('promotionSeconds').textContent=seconds?String(seconds):'✓';
    $('promotionTimer').style.setProperty('--remaining',String(promotionRemaining/20000));
    $('promotionTimer').setAttribute('aria-label',seconds?`홍보 종료까지 ${seconds}초`:'홍보 시청 완료');
    $('promotionContinue').disabled=seconds>0;$('promotionClose').disabled=seconds>0;
    $('promotionWait').textContent=seconds?'20초 후 계속할 수 있어요.':'시청이 끝났어요. 계속하기를 눌러 주세요.';
    if(!seconds){clearInterval(promotionClock);promotionClock=null;}
  }
  document.addEventListener('visibilitychange',()=>{promotionLast=performance.now();});
  function showPromotion(stage,done){
    if(STUDENT_BG){done();return;}
    if($('promotionDialog').open)return;
    const copy=PROMOTIONS[stage];
    $('promotionTitle').textContent=copy.title;$('promotionBody').textContent=copy.body;$('promotionNote').textContent=copy.note;$('promotionContinue').textContent=copy.button;
    promotionDone=done;promotionRemaining=20000;promotionLast=performance.now();updatePromotionTimer();$('promotionDialog').showModal();$('promotionTimer').focus();promotionClock=setInterval(updatePromotionTimer,100);
  }
  function closePromotion(){
    if(!$('promotionDialog').open||promotionRemaining>0)return;
    $('promotionDialog').close();const done=promotionDone;promotionDone=null;done?.();
  }
  $('promotionContinue').onclick=closePromotion;$('promotionClose').onclick=closePromotion;
  $('promotionDialog').addEventListener('cancel',e=>{e.preventDefault();closePromotion();});

  function start(reviewIds=null,afterPromo=false) {
    closeEvolution(false);
    forestAudio.unlock();
    refreshGarden();
    stopSound();clearTimer();
    const pool=data.filter(w=>w.level===Number($('levelSelect').value));
    const selected=reviewIds?pool.filter(w=>reviewIds.includes(w.id)):pool;
    if(pool.length<4 || !selected.length) return;
    if(!afterPromo&&!STUDENT_BG){showPromotion('start',()=>start(reviewIds,true));return;}
    const size=$('roundSize').value==='all'?selected.length:Number($('roundSize').value);
    state={mode:reviewIds?'practice':document.querySelector('input[name="mode"]:checked').value,
      direction:$('direction').value,queue:shuffle(selected).slice(0,reviewIds?selected.length:size),
      roundChoice:$('roundSize').value,pool,index:0,phase:'basic',answered:0,correct:0,bonusAnswered:0,bonusCorrect:0,netXP:0,earnedCoins:0,fertilizerXP:0,
      mistakes:new Map(),startLevel:profile.level,startAppearance:$('mascot').innerHTML,growthEventPlayed:false};
    screen('game');showQuestion(false);
  }
  // Pronunciation belongs to the reveal panel, never to quiz choices.
  function cleanQuizText(value){
    return String(value||'').replace(/[（(][^()（）]*[A-Za-z\u00c0-\u024f\u1e00-\u1eff][^()（）]*[)）]/g,'')
      .replace(/[A-Za-z\u00c0-\u024f\u1e00-\u1eff]+/g,'').replace(/\s+/g,' ').trim();
  }
  function pinyinToggle(hanzi,pinyin,id){
    const wrap=document.createElement('span');wrap.className='quiz-reading';
    const button=document.createElement('button');button.type='button';button.className='hanzi-reveal';button.textContent=hanzi;button.lang='zh-CN';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);
    const py=document.createElement('span');py.id=id;py.className='quiz-pinyin';py.textContent=pinyin||'병음 준비 중';py.hidden=true;
    button.onclick=()=>{py.hidden=!py.hidden;button.setAttribute('aria-expanded',String(!py.hidden));};wrap.append(button,py);return wrap;
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
    const label=x=>cleanQuizText(state.directionNow==='zh-ko'?x.meaning:x.hanzi);
    const seen=new Set([label(e)]), wrong=[];
    // Prefer other phrases of this word for a meaningful bonus, then fill from the pool.
    const ordered=bonus?[...shuffle(candidates.filter(p=>p.parent===word.id)),...shuffle(candidates.filter(p=>p.parent!==word.id))]:shuffle(candidates);
    for(const candidate of ordered){if(label(candidate)&&!seen.has(label(candidate))){wrong.push(candidate);seen.add(label(candidate));}if(wrong.length===3)break;}
    if(wrong.length!==3) {finish();$('resultSubtitle').textContent='서로 다른 보기가 부족해 종료했어요. data.js 내용을 확인해 주세요.';return;}
    state.options=shuffle([e,...wrong]);
    $('gameMode').textContent=state.mode==='practice'?'☘ 준비 운동':'⚡ 덩어리 숲속으로';
    $('questionNumber').textContent=`${state.index+1} / ${state.queue.length} 단어`;
    $('roundProgress').max=state.queue.length;$('roundProgress').value=state.index;
    $('sessionXp').textContent=state.mode==='practice'?'경험치·코인 없음':`${state.netXP>=0?'+':''}${state.netXP} XP · ${state.earnedCoins} 코인`;
    const fertilizerBoost=state.mode==='main'&&profile.garden.active?FERTILIZERS[profile.garden.active.kind].boost:0;
    $('questionKind').textContent=bonus?'✦ 짝꿍어휘 보너스 · +3 XP':'기본 단어 · '+(state.mode==='main'?`+5 XP${fertilizerBoost?` + 비료 ${fertilizerBoost}`:''}`:'천천히 풀어요');
    $('questionInstruction').textContent=bonus?(state.directionNow==='zh-ko'?'이 짝꿍 표현의 뜻을 골라 주세요.':'이 뜻에 맞는 짝꿍 표현을 골라 주세요.'):state.directionNow==='zh-ko'?'이 단어의 뜻은 무엇일까요?':'이 뜻에 맞는 한자를 골라 주세요.';
    $('questionText').replaceChildren();
    if(state.directionNow==='zh-ko')$('questionText').append(pinyinToggle(e.hanzi,e.pinyin,'promptPinyin'));else $('questionText').textContent=e.meaning;
    $('quizHint').textContent=state.directionNow==='ko-zh'?'한자를 누르면 병음 · 선택 버튼 또는 키보드 1–4로 답하기':'문제의 한자를 누르면 병음 · 보기 선택 또는 키보드 1–4';
    $('questionText').classList.toggle('korean',state.directionNow==='ko-zh');
    $('questionText').lang=state.directionNow==='zh-ko'?'zh-CN':'ko';
    $('answers').replaceChildren();
    state.options.forEach((option,i)=>{
      if(state.directionNow==='ko-zh'){
        const card=document.createElement('div');card.className='answer answer-reading';card.append(pinyinToggle(label(option),option.pinyin,'choicePinyin'+i));
        const choose=document.createElement('button');choose.type='button';choose.className='answer-select';choose.textContent=`${i+1} · 선택`;choose.setAttribute('aria-label',`${i+1}번 ${label(option)} 선택`);choose.onclick=()=>answer(option.id);card.append(choose);$('answers').append(card);return;
      }
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
    $('answers').querySelector('button')?.focus({preventScroll:true});
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
    else{state.answered++;if(correct)state.correct++;recordStudy(state.word);}
    if(!correct) state.mistakes.set(state.entry.id,{...state.entry,parent:state.word.id,bonus});
    const previousLevel=profile.level;
    const reward=gardenReward(correct,bonus);
    const delta=changeXP(correct?(bonus?RULES.bonusXP:RULES.baseXP+reward.boost):(bonus?0:-RULES.penalty));
    state.earnedCoins+=reward.coins;state.fertilizerXP+=reward.boost;
    state.netXP+=delta;
    state.offerBonus=!bonus&&correct&&state.mode==='main'&&state.word.collocations.length>0;
    $('feedbackIcon').textContent=correct?'✓':id===null?'◷':'↻';
    $('feedbackTitle').textContent=correct?'정답이에요!':id===null?'시간이 다 됐어요':'다시 익히면 괜찮아요';
    $('rewardText').textContent=state.mode==='practice'?'부담 없이 익히는 중':delta?`${delta>0?'+':''}${delta} XP`:bonus?'보너스 오답 · 경험치 차감 없음':'레벨 보호 · 경험치 차감 없음';
    if(state.mode==='main'&&correct)$('rewardText').textContent=`+${delta} XP${reward.boost?` (비료 +${reward.boost} 포함)`:''} · +${reward.coins} 코인`;
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
      const gifts=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>accessoryAllowed(i[0])&&i[3]>previousLevel&&i[3]<=profile.level);
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
    if(!state||state.phase==='result')return;
    state.perfectXP=0;
    if(state.mode==='main'&&['10','20'].includes(state.roundChoice)&&state.answered===Number(state.roundChoice)&&state.correct===state.answered){state.perfectXP=state.answered===10?10:25;state.netXP+=changeXP(state.perfectXP);}
    const celebrate=state.mode==='main'&&profile.level>state.startLevel&&!state.growthEventPlayed;
    clearTimer();stopSound();if(!celebrate)forestAudio.effect('finish');state.phase='result';screen('result');
    if($('feedback').open)$('feedback').close();
    $('resultSubtitle').textContent=`${state.answered}개의 기본 문제를 풀었어요.`+(state.perfectXP?` 전체 정답 보너스 +${state.perfectXP} XP!`:'')+(profile.level>state.startLevel?` 레벨 ${profile.level} 달성!`:'');
    $('resultGarden').textContent=state.mode==='practice'?'준비 운동에서는 코인·경험치 변화와 비료 소모가 없어요.':`숲 코인 +${state.earnedCoins} · 비료로 얻은 추가 경험치 +${state.fertilizerXP} XP`;
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
    const evolve=()=>{if(celebrate){state.growthEventPlayed=true;showEvolution();}};
    showPromotion('finish',()=>{if(state.perfectXP)showPerfect(evolve);else evolve();});
  }
  function modeChanged(){
    const practice=document.querySelector('input[name="mode"]:checked').value==='practice';
    $('ruleBox').innerHTML=practice?'시간제한 없이 기본 단어만 연습해요.<br>경험치·코인 변화와 비료 소모, 보너스 문제는 없어요.':'기본 정답 <b>+5 XP</b> · 오답/시간 초과 <b>−2 XP</b><br>보너스 정답 <b>+3 XP</b> · 보너스 오답 차감 없음<br>기본 정답 <b>2코인</b> · 보너스 정답 <b>1코인</b> · 비료는 기본 정답에만 적용';
    $('startBtn').firstChild.textContent=practice?'연습 시작하기 ':'모험 시작하기 ';
    $('startBtn').nextElementSibling.textContent=practice?'틀려도 괜찮아요. 발음을 듣고 천천히 익혀 보세요.':'기본 문제를 맞히면 짝꿍어휘 보너스에 도전할 수 있어요.';
  }
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();clearTimer();stopSound();state=null;screen('setup');refreshGarden();});
  $('startBtn').onclick=()=>start();$('continueBtn').onclick=()=>advance();$('skipBonus').onclick=()=>advance(true);
  $('feedback').addEventListener('cancel',e=>e.preventDefault());
  $('replayBtn').onclick=()=>{if(state)speak(state.entry);};
  $('quitBtn').onclick=finish;
  $('homeBtn').onclick=()=>{stopSound();state=null;screen('setup');refreshGarden();(mobileLayout.matches?$('openAdventure'):$('startBtn')).focus();};
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
    const top=bubble.classList.contains('bubble-below')?rect.bottom+8:headY-(bubble.offsetHeight||78)-15;
    bubble.style.top=Math.max(8,Math.min(window.innerHeight-bubble.offsetHeight-8,top))+'px';
  }
  function hideBubble(){clearTimeout(bubbleTimer);clearTimeout(bubbleEnd);bubble.classList.remove('bubble-visible');bubbleEnd=setTimeout(()=>{bubble.hidden=true;},reducedMotion()?0:260);}
  function showFriendPhrase([zh,ko],placement='above'){
    bubble.classList.toggle('bubble-below',placement==='below');
    $('friendChinese').textContent=zh;$('friendKorean').textContent=ko;
    clearTimeout(bubbleTimer);clearTimeout(bubbleEnd);bubble.hidden=false;positionBubble();
    requestAnimationFrame(()=>bubble.classList.add('bubble-visible'));
    bubbleTimer=setTimeout(hideBubble,4200);
  }
  function chatWithFriend(){
    if(profile.garden.world.kind){showWorldHelp();return;}
    if(!phraseBag.length)phraseBag=shuffle(FRIEND_PHRASES);
    showFriendPhrase(phraseBag.pop());
  }
  const WATER_THANKS=[
    ['谢谢你！','고마워!'],['谢谢你给我浇水！','물을 줘서 고마워!'],
    ['谢谢你的照顾！','돌봐 줘서 고마워!'],['有你真好！','네가 있어서 정말 좋아!'],
    ['谢谢你，我好开心！','고마워, 정말 행복해!']
  ];
  const FOOD_CHEERS=[['我有力气啦！','힘이 났어!'],['我会茁壮成长！','튼튼하게 자랄게!'],['谢谢你，我们一起加油！','고마워, 우리 함께 힘내자!']];
  let thanksBag=[];
  function stopCareAnimation(){
    clearTimeout(careReactionTimer);clearTimeout(careSpeechTimer);clearTimeout(careEndTimer);
    $('homeHabitat').querySelectorAll('.care-scene,.care-tool').forEach(el=>el.remove());
    friend.classList.remove('care-happy','care-energized');
  }
  function playCareAnimation(type,kind='gentle'){
    resetFriend();
    const stage=$('homeHabitat');
    // Reveal the actual friend after feeding in the shop, including on phones.
    stage.scrollIntoView({behavior:'instant',block:'center'});
    const bounds=stage.getBoundingClientRect(),rect=friend.getBoundingClientRect();
    const route=routeFor(profile.look.pet,profile.routes),g=plantGeometry(profile.look.pet,route?.id,profile.level);
    const x=rect.left-bounds.left+rect.width/2;
    const head=rect.top-bounds.top+(197*(1-g.scale)+g.head[1]*g.scale)*rect.height/210;
    const y=Math.max(78,head);
    const width=bounds.width||280,height=bounds.height||240;
    const scene=document.createElementNS('http://www.w3.org/2000/svg','svg');
    scene.setAttribute('viewBox',`0 0 ${width} ${height}`);
    scene.setAttribute('aria-hidden','true');scene.setAttribute('focusable','false');
    scene.classList.add('care-scene',type==='water'?'care-water-scene':'care-food-scene');
    const drops=Array.from({length:8},(_,i)=>`<path class="care-drop" style="animation-delay:${.55+i*.12}s" d="M${x-8+(i%3)*8} ${y-46}q-6 8 0 10q6-2 0-10" fill="#6eb4da"/>`).join('');
    const grains=Array.from({length:9},(_,i)=>`<circle class="care-grain" style="animation-delay:${.6+i*.1}s" cx="${x-12+(i%4)*8}" cy="${y-40}" r="${2.5+i%2}" fill="${kind==='rich'?'#bda0d0':'#c59a53'}"/>`).join('');
    const can=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -30 110 90" aria-hidden="true" focusable="false"><path d="M22-13q31-5 26 19q-4 13-20 10" fill="none" stroke="#5e8982" stroke-width="6"/><path d="M-8 0h37v37q-19 10-37-1z" fill="#acd4c3" stroke="#527b72" stroke-width="2.5"/><path d="M-8 18L-31 6l-6 9 29 19" fill="#b9ddd0" stroke="#527b72" stroke-width="2.5"/><path d="M-39 9l-5 9 9 5 5-10z" fill="#7db6ad" stroke="#527b72" stroke-width="2"/><ellipse cx="10" cy="0" rx="19" ry="5" fill="#76a69b"/><path d="M5 15q12-10 14 1-8 12-14-1" fill="#ecf5de"/></svg>`;
    const bag=`<g transform="translate(${x+20} ${y-71})"><g class="care-bag"><path d="M-18-16q17 6 34 0l-4 13 10 32q3 10-8 11h-31q-11-1-8-11l11-32z" fill="${kind==='rich'?'#ddcbed':'#efdfae'}" stroke="#87704e" stroke-width="2"/><path d="M-14-3h25" stroke="#87704e" stroke-width="3"/><rect x="-14" y="10" width="27" height="21" rx="5" fill="#fffaf0"/><path d="M0 27v-8q-11 0-10-9 10 1 10 9q0-11 10-12 1 10-10 12" fill="#7b9f69" stroke="#557845" stroke-width="1.5"/></g></g>`;
    const sparks=[[-47,-2],[46,8],[-31,38],[37,41]].map(([dx,dy],i)=>`<g transform="translate(${x+dx} ${y+dy})"><path class="care-energy" style="animation-delay:${1.15+i*.13}s" d="M0-7L2-2 7 0 2 2 0 7-2 2-7 0-2-2z" fill="${type==='water'?'#85bb91':'#e7bb5d'}"/></g>`).join('');
    scene.innerHTML=(type==='water'?drops:bag+grains)+sparks;
    stage.append(scene);
    if(type==='water'){
      // Animate an HTML wrapper, avoiding SVG transform-origin differences.
      const tool=document.createElement('div');tool.className='care-tool care-can';
      tool.setAttribute('aria-hidden','true');tool.innerHTML=can;
      tool.style.left=clamp(x-16,8,width-140)+'px';tool.style.top=Math.max(4,y-98)+'px';
      stage.append(tool);
    }
    careReactionTimer=setTimeout(()=>{
      friend.classList.add(type==='water'?'care-happy':'care-energized');
    },reducedMotion()?0:1100);
    careSpeechTimer=setTimeout(()=>{
      if(type==='water'){
        if(!thanksBag.length)thanksBag=shuffle(WATER_THANKS);
        showFriendPhrase(thanksBag.pop());
      }else showFriendPhrase(FOOD_CHEERS[Math.floor(Math.random()*FOOD_CHEERS.length)]);
    },reducedMotion()?0:2300);
    careEndTimer=setTimeout(stopCareAnimation,4300);
  }
  friend.setAttribute('role','button');friend.tabIndex=0;
  friend.setAttribute('aria-label','친구와 이야기하기. 길게 누르면 끌어 올릴 수 있어요');
  let grip=null,holdTimer,fallFrame,landTimer,offsetX=0,offsetY=0,suppressClick=false;
  function positionGround(avatar=$('mascot'),habitat=$('homeHabitat')){
    const ground=habitat.querySelector('.ground');if(!ground||!habitat.clientHeight)return;
    const box=avatar.getBoundingClientRect(),stage=habitat.getBoundingClientRect();
    const lifted=avatar.id==='mascot'?offsetY:0;
    const body=avatar.querySelector('.plant-body'),feet=body?.getBoundingClientRect();
    ground.style.left=((feet?feet.left+feet.width/2:box.left+box.width/2)-stage.left)+'px';
    ground.style.top=((feet?feet.bottom:box.top+box.height*193/210)-stage.top-lifted)+'px';
    ground.style.width=(box.width*(avatar.dataset.pet==='seed'?.32:.64))+'px';
    ground.style.height=Math.max(6,box.height*.04)+'px';
    ground.style.opacity=String(Math.max(.2,1+lifted/300));
    if(habitat.classList.contains('landing-dust')){
      habitat.style.setProperty('--impact-x',ground.style.left);
      habitat.style.setProperty('--impact-y',ground.style.top);
    }
  }
  const setOffset=()=>{friend.style.translate=`${offsetX}px ${offsetY}px`;positionBubble();positionGround();};
  function stopFall(){cancelAnimationFrame(fallFrame);clearTimeout(landTimer);friend.classList.remove('friend-falling','friend-landed');}
  function land(){
    offsetY=0;friend.classList.remove('friend-held','friend-falling','friend-landed');setOffset();
    forestAudio.effect('land');
    const stage=$('homeHabitat');stage.classList.remove('landing-dust');void stage.offsetWidth;stage.classList.add('landing-dust');
    const ground=stage.querySelector('.ground');
    stage.style.setProperty('--impact-x',ground.style.left);
    stage.style.setProperty('--impact-y',ground.style.top);
    friend.classList.add('friend-landed');
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
    stopCareAnimation();stopFall();suppressClick=false;forestAudio.unlock();
    grip={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:offsetX,y:offsetY,active:false};
    friend.setPointerCapture?.(e.pointerId);
    holdTimer=setTimeout(()=>{if(!grip)return;grip.active=true;suppressClick=true;hideBubble();friend.classList.add('friend-held');},220);
  });
  friend.addEventListener('pointermove',e=>{
    if(!grip||e.pointerId!==grip.id||!grip.active)return;
    const rect=friend.getBoundingClientRect(),stage=$('homeHabitat').getBoundingClientRect();
    // Use the card's full play area on phones, with a small safe screen margin.
    const mobile=window.matchMedia?.('(max-width: 620px)').matches;
    const area=mobile?friend.closest('.companion').getBoundingClientRect():stage;
    const center=rect.left-offsetX+rect.width/2;
    const route=routeFor(profile.look.pet,profile.routes);
    const geometry=plantGeometry(profile.look.pet,route?.id,profile.level);
    // The SVG canvas includes empty space around small plants.
    let halfWidth=mobile?rect.width*.45*Math.max(.55,geometry.scale):rect.width/2;
    friend.querySelectorAll('.editable-accessory:not([hidden])').forEach(item=>{
      const box=item.getBoundingClientRect();
      halfWidth=Math.max(halfWidth,Math.abs(box.left-(rect.left+rect.width/2)),Math.abs(box.right-(rect.left+rect.width/2)));
    });
    const left=Math.max(8,area.left)+halfWidth-center;
    const right=Math.min(window.innerWidth-8,area.right)-halfWidth-center;
    offsetX=left<=right?clamp(grip.x+e.clientX-grip.startX,left,right):0;
    const baseTop=rect.top-offsetY;
    offsetY=clamp(grip.y+e.clientY-grip.startY,-Math.max(0,baseTop-12),0);setOffset();
  });
  function release(e){if(!grip||e.pointerId!==grip.id)return;clearTimeout(holdTimer);grip=null;friend.classList.remove('friend-held');if(friend.hasPointerCapture?.(e.pointerId))friend.releasePointerCapture(e.pointerId);fall();}
  friend.addEventListener('pointerup',release);friend.addEventListener('pointercancel',release);friend.addEventListener('lostpointercapture',release);
  friend.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.preventDefault();return;}chatWithFriend();});
  friend.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chatWithFriend();}});
  function resetFriend(){stopCareAnimation();clearTimeout(holdTimer);grip=null;stopFall();offsetX=offsetY=0;setOffset();friend.classList.remove('friend-held','care-angry','care-puzzled');$('homeHabitat').classList.remove('landing-dust');hideBubble();}
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
    closeEvolution(false);save();stopSound();clearTimer();resetFriend();state=null;activeForest=index;profile=forestProfiles[index];$('careMessage').textContent='';
    forestAudio.setForest(index);screen('setup');populateGrades();renderProfile();$('speechRate').value=profile.rate;populateVoices();modeChanged();refreshGarden();save();
  }
  FORESTS.forEach((f,i)=>{
    const button=document.createElement('button');button.type='button';button.className='forest-tab';
    button.dataset.forest=String(i);
    const title=document.createElement('strong');title.textContent=f.name;
    const grades=document.createElement('span');grades.className='forest-grades';grades.textContent=f.grades;
    const story=document.createElement('span');story.className='forest-story';story.textContent=[
      '첫 단어가 작은 싹이 되는 숲. 반딧불을 따라 짝꿍어휘를 만나고, 마음씨와 첫 모험을 시작해요.',
      '노을빛 나뭇가지에 덩어리 열매가 열리는 숲. 한 표현씩 익힐 때마다 숲속 친구들의 이야기가 들려와요.',
      '달빛 아래 비밀 편지가 숨어 있는 숲. 길고 깊은 표현을 풀어내며, 나만의 중국어 이야기를 완성해요.'
    ][i];
    const note=document.createElement('small');button.append(title,grades,story,note);button.onclick=()=>{
      const entering=choosingEntryForest;
      if(entering){choosingEntryForest=false;$('welcomeScreen').hidden=true;$('gameApp').hidden=false;}
      switchForest(i);if($('forestDialog').open)$('forestDialog').close();
      if(entering){arrangeLobby();(mobileLayout.matches?$('openAdventure'):$('startBtn')).focus({preventScroll:true});}
    };$('forestTabs').append(button);
  });
  // Move the existing controls, retaining their listeners and desktop positions.
  const GUIDE_PAGES=[
    ['처음 만나는 덩어리 숲',
      '인트로를 누르고 공부할 숲을 골라요. 초록빛 숲은 HSK 1~3급, 살구빛 숲은 4~6급, 보랏빛 숲은 7~9급이에요. 어휘가 아직 없는 급수는 준비 중으로 표시돼요.',
      '오늘의 모험에서 급수, 문제 방향, 문제 수를 정한 뒤 시작해요. 휴대폰에서는 상단 버튼을 누르면 열리고, 데스크톱에서는 모험 설정이 화면에 보여요.',
      '세 숲은 친구·경험치·코인·보관함을 각각 따로 관리해요. 다른 숲에서는 마음씨부터 새롭게 키워요.'],
    ['문제 풀기와 발음 듣기',
      '덩어리 숲속으로는 7초 안에 답하는 본게임이에요. 기본 문제를 맞히면 짝꿍어휘 보너스에 도전해요. 준비 운동은 시간제한·경험치·코인·보너스 없이 연습해요.',
      '문제와 보기의 한자를 누르면 병음이 보여요. 한자 보기에서는 병음 확인과 정답 선택 버튼을 구분해 눌러 주세요. 답을 확인하는 팝업에서는 먼저 보이는 단어를 누르면 나머지 정보가 열려요.',
      '발음은 음성 듣기를 눌러 재생해요. 보통 또는 천천히를 선택할 수 있어요. 틀린 문제는 결과 화면에서 기본 단어로 다시 연습해 보세요.'],
    ['경험치·코인·학습 진행률',
      '본게임 기본 정답은 +5 XP와 2코인, 보너스 정답은 +3 XP와 1코인이에요. 기본 오답·시간 초과는 −2 XP이고 보너스 오답은 차감하지 않아요. 현재 레벨 아래로는 내려가지 않아요. 기본 10문제 전체 정답은 +10 XP, 20문제는 +25 XP를 더 받아요.',
      '레벨이 높아질수록 필요한 경험치가 늘어요. 살구빛 숲과 보랏빛 숲은 초록빛 숲보다 더 천천히 자라요. 꾸준히 단어를 익히며 성장시켜 주세요.',
      '학습 진행률 버튼에서 현재 숲의 급수별 기록을 봐요. 기본 문제의 답을 확인하면 정답·오답·준비 운동 모두 집계하고, 같은 단어는 한 번만 세어요. 짝꿍어휘는 제외하며 이 기능 추가 이후부터 기록해요.'],
    ['친구 성장과 꾸미기',
      '레벨 1 마음씨에서 레벨 2 마음싹으로 자라요. 레벨 3에는 성장 계열을 고르고, 레벨 4부터 9까지 점차 성장해요. 레벨 10에는 세 가지 최종 성장길 중 하나를 선택해요.',
      '마음꽃·마음송이·마음담이는 모두 고를 수 있어요. 마음잎·마음열매·마음나무는 수강생판에서 열려요. 주요 진화는 한 판을 마친 뒤 연출 중에 선택하며, 선택 전 최종 모습은 실루엣으로 보여요.',
      '내 친구 꾸미기에서 해금된 장식을 골라 위치를 조절해요. 날개와 망토는 몸 뒤에 놓여요. 로비에서 친구를 톡 누르면 대화하고, 꾹 누르면 들어 올렸다 놓을 수 있어요.'],
    ['물을 주며 함께 자라기',
      '물주기는 무료예요. 물뿌리개로 물을 주면 수분이 채워지고 친구가 기뻐해요. 수분 줄 옆에는 0%가 되기까지 남은 시간이 표시돼요.',
      '마지막 물주기에서 48시간이 지나면 −5 XP, 이후 24시간마다 −5 XP예요. 다시 물을 줄 때까지 최대 −20 XP이며 레벨은 내려가지 않아요. 물을 주면 이 차감 주기도 새로 시작해요.',
      '물 부족은 미접속 시간도 계산해요. 문제를 푸는 동안은 차감을 미뤘다가 학습 후 반영해요. 날씨·벌레 시간은 로비가 보일 때만 흘러요. 학습·팝업·다른 탭·미접속 중에는 멈춰요.'],
    ['숲 상점 사용법',
      '문제로 모은 코인으로 사요. 햇살 비료는 20코인, 든든 비료는 35코인이며 기본 정답 10회 동안 각각 +1 XP, +2 XP를 더 줘요. 반짝 비료는 50코인에 +3 XP예요. 구매 후 바구니에서 식물에게 주기를 눌러야 적용되고 한 번에 하나만 사용해요.',
      '살충제 10코인과 감기약 12코인은 한 번 쓰면 1개가 소모돼요. 우산 30코인, 부채 25코인, 난로 35코인은 한 번 사면 해당 숲에서 계속 쓸 수 있어요.',
      '준비 운동·오답·보너스에서는 비료 횟수가 줄지 않아요. 현금 결제는 없어요. 모바일은 상품 버튼을 눌러 살펴보고, 데스크톱은 상품 카드를 함께 볼 수 있어요. 도구 사용은 로비의 바구니에서 해요. 상황에 맞지 않으면 친구가 거절하며 소모품은 줄지 않아요.'],
    ['비·찬바람·감기 돌보기',
      '가랑비는 도움을 요청해도 경험치를 깎지 않아요. 폭우에는 번개가 치고 우산 안으로도 비가 튈 수 있어요. 1분 노출마다 감기 확률은 우산 없이 20%, 우산을 쓰면 5%예요.',
      '찬바람에는 1분마다 25% 확률로 감기에 걸려요. 난로를 놓으면 찬바람 감기를 예방해요. 이미 걸린 감기는 날씨가 맑아지거나 난로를 켜도 낫지 않으니 감기약을 먹여 주세요.',
      '감기 방치는 활성 로비 시간 2분마다 −1 XP예요. 치료 전 돌봄 차감은 최대 5회로 제한하고 레벨을 보호해요. 감기와 더위가 겹치면 차감 상한을 함께 사용해요.'],
    ['더위·벌레와 오래 즐기는 팁',
      '무더위 때 친구가 부채질을 부탁해요. 부채질하면 45초 동안 시원하고 무더위 이벤트는 계속돼요. 다시 더워진 뒤 45초 내 돌보지 않으면 −1 XP예요. 한 무더위의 돌봄 차감은 최대 5회예요.',
      '벌레는 90초 안에 살충제로 퇴치해요. 놓치면 한 번 −10 XP이며 처음에는 살충제 1개를 선물해요. 날씨는 로비에서 2분 동안 이어지고, 이벤트는 보통 2~4분 간격으로 찾아와요.',
      '감기약·살충제를 미리 준비하고, 먼저 문제를 풀어 코인을 모아 보세요. 기록은 이 브라우저에 저장돼요. 다른 기기와 자동 공유되지 않고 사이트 데이터를 지우면 사라지므로 주의해 주세요.']
  ];
  GUIDE_PAGES.splice(6,0,
    ['바구니와 귀여운 거절 반응',
      '상점은 구매만 하는 곳이에요. 물주기·숲 상점 옆 바구니에서 보유 수량을 확인하고 비료·살충제·감기약·우산·부채·난로를 사용해요. 비료·살충제·감기약은 소모품이며 우산·부채·난로는 계속 쓸 수 있어요.',
      '무더위에 난로를 놓으면 친구가 화내며 치워 달라고 해요. 난로를 먼저 치운 뒤 부채질해 주세요. 비가 오거나 찬바람이 불 때 부채질하면 춥다고 투덜거려요.',
      '감기가 없는데 약을 주거나 벌레가 없는데 살충제를 쓰면 거절해요. 비료가 이미 적용 중일 때도 새 비료를 거절해요. 거절한 소모품은 줄지 않고, 장난에 대한 추가 경험치 차감도 없어요.'],
    ['전체 정답 선물과 반짝 비료',
      '본게임에서 선택한 기본 10문제를 모두 맞히면 +10 XP, 20문제를 모두 맞히면 +25 XP를 한 번 더 받아요. 짝꿍어휘 정답 여부는 별개예요. 준비 운동·전체 단어 모드·기본 문제를 다 풀기 전 중도 종료에는 지급하지 않아요.',
      '전체 정답을 달성하면 친구가 중국어 격려 표현 5개 중 하나로 약 3초 동안 축하해 줘요. 레벨업도 했다면 이어서 진화 연출과 성장 선택을 진행해요.',
      '반짝 비료는 50코인에 구매해요. 바구니에서 먹이면 본게임 기본 정답 10회에 각각 +3 XP를 더 받아요. 오답·보너스·준비 운동에는 횟수가 줄지 않고, 전체 정답 보너스에는 비료 효과를 더하지 않아요.']
  );
  if(!STUDENT_BG)GUIDE_PAGES.push(['무료판과 기록 안내',
    '무료판은 매 판 시작 전과 종료 후 진담중국어 홍보 팝업이 나와요. 준비 운동과 오답 복습에도 표시되며, 20초 시청 후 계속하기 또는 닫기를 누르면 학습으로 이어져요.',
    '오른쪽 위 원형 타이머로 남은 시청 시간을 봐요. 다른 탭으로 이동하면 시청 시간이 멈추며, 홍보 중에는 문제 타이머도 흐르지 않아요. 결과 홍보를 닫으면 전체 정답 축하·진화가 있는 경우 순서대로 볼 수 있어요. 수강생판에는 홍보가 표시되지 않아요.',
    '캐릭터와 학습 기록은 이 브라우저에 저장해요. 새로고침해도 유지되지만 다른 기기와 동기화되지 않고 사이트 데이터를 지우면 사라져요. 무료판과 수강생판 기록도 별개예요.']);
  let guidePage=0;
  function renderGuide(){
    const page=GUIDE_PAGES[guidePage];$('guideTitle').textContent=page[0];$('guideCopy').replaceChildren();
    page.slice(1).forEach(text=>{const p=document.createElement('p');p.textContent=text;$('guideCopy').append(p);});
    $('guideCounter').textContent=`${guidePage+1} / ${GUIDE_PAGES.length}`;
    $('guidePrev').disabled=guidePage===0;$('guideNext').disabled=guidePage===GUIDE_PAGES.length-1;
    $('guideCopy').scrollTop=0;
  }
  $('guidePrev').onclick=()=>{if(guidePage>0){guidePage--;renderGuide();}};
  $('guideNext').onclick=()=>{if(guidePage<GUIDE_PAGES.length-1){guidePage++;renderGuide();}};
  renderGuide();

  const mobileLayout=window.matchMedia('(max-width: 620px)');
  const movable=[document.querySelector('.forest-selector'),$('setup'),...document.querySelectorAll('.audio-settings'),document.querySelector('.care-rules')];
  const anchors=movable.map(node=>{const anchor=document.createComment('desktop control');node.before(anchor);return anchor;});
  const closetAnchor=document.createComment('desktop closet');$('openCloset').before(closetAnchor);
  document.body.dataset.screen='setup';
  function settingsTab(index){
    movable.slice(2).forEach((node,i)=>node.hidden=i!==index);
    document.querySelectorAll('[data-settings-tab]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.settingsTab)===index)));
  }
  function fitCompanion(){
    const height=$('homeHabitat').clientHeight;
    $('mascot').style.setProperty('--mobile-avatar-scale',String(Math.min(1.15,Math.max(.48,(height-12)/210))));
    positionGround();placeAccessories($('mascot'),profile.look,profile.routes);
  }
  function arrangeLobby(){
    if(mobileLayout.matches){
      $('forestBody').append(movable[0]);$('adventureBody').append(movable[1]);
      $('settingsBody').append(...movable.slice(2));
      movable.slice(2).forEach(n=>n.open=true);settingsTab(0);
      $('carePanel').before($('openCloset'));
    }else{
      ['adventureDialog','settingsDialog'].forEach(id=>$(id).close());
      if(!choosingEntryForest)$('forestDialog').close();
      movable.forEach((node,i)=>{anchors[i].after(node);if(i>=2){node.hidden=false;node.open=false;}});
      closetAnchor.after($('openCloset'));
    }
    if(choosingEntryForest)$('forestBody').append(movable[0]);
    resetFriend();requestAnimationFrame(fitCompanion);
  }
  $('openAdventure').onclick=()=>{resetFriend();$('adventureBody').append($('setup'));$('adventureDialog').showModal();};
  $('openStudy').onclick=()=>{resetFriend();renderStudy();$('studyDialog').showModal();};
  $('openForest').onclick=()=>{resetFriend();$('forestBody').append(movable[0]);$('forestDialog').showModal();};
  ['adventureDialog','settingsDialog'].forEach(id=>$(id).addEventListener('close',()=>{if(!mobileLayout.matches){movable.forEach((node,i)=>{if(i>0){anchors[i].after(node);node.hidden=false;node.open=false;}});}}));
  $('forestDialog').addEventListener('close',()=>{
    if(!mobileLayout.matches&&!choosingEntryForest)anchors[0].after(movable[0]);
    if(choosingEntryForest){choosingEntryForest=false;arrangeLobby();$('enterLobby').focus({preventScroll:true});}
  });
  $('openSettings').onclick=()=>{resetFriend();$('settingsBody').append(...movable.slice(2));movable.slice(2).forEach(n=>n.open=true);settingsTab(0);$('settingsDialog').showModal();};
  document.querySelectorAll('[data-close-sheet]').forEach(b=>b.onclick=()=>$(b.dataset.closeSheet).close());
  document.querySelectorAll('[data-settings-tab]').forEach(b=>b.onclick=()=>settingsTab(Number(b.dataset.settingsTab)));
  function selectShopTab(index){
    document.querySelectorAll('.shop-item').forEach((n,i)=>n.classList.toggle('shop-selected',i===index));
    document.querySelectorAll('[data-shop-tab]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.shopTab)===index)));
  }
  document.querySelectorAll('[data-shop-tab]').forEach(b=>b.onclick=()=>selectShopTab(Number(b.dataset.shopTab)));
  selectShopTab(0);mobileLayout.addEventListener('change',arrangeLobby);arrangeLobby();
  new ResizeObserver(fitCompanion).observe($('homeHabitat'));
  new ResizeObserver(()=>{if(draftLook&&$('previewAvatar')){placeAccessories($('previewAvatar'),draftLook,draftRoutes);refreshPositionControls();}}).observe($('previewHabitat'));
  const GROWTH_PRAISE=[
    '你学得真认真！','你每天都在进步！','你的努力让我长大了！','我们一起变得更强吧！','继续加油，我陪着你！'
  ];
  let growthPraiseBag=[],evolutionTimer,evolutionMorphTimer,evolutionZoom;
  function closeEvolution(restoreFocus=true){
    clearTimeout(evolutionTimer);clearTimeout(evolutionMorphTimer);evolutionZoom?.cancel();evolutionZoom=null;
    const dialog=$('evolutionDialog');
    if(dialog.open)dialog.close();
    dialog.classList.remove('evolution-revealed','evolution-choosing');$('evolutionChoices').replaceChildren();$('evolutionChoices').hidden=true;$('evolutionChoiceHelp').hidden=true;$('evolutionBefore').replaceChildren();$('evolutionAfter').replaceChildren();
    if(restoreFocus&&!$('result').hidden)$('homeBtn').focus({preventScroll:true});
  }
  function showEvolution(){
    resetFriend();closeEvolution(false);
    const dialog=$('evolutionDialog'),source=$('mascot');
    const from=source.getBoundingClientRect();
    for(const [id,html] of [['evolutionBefore',state.startAppearance],['evolutionAfter',source.innerHTML]]){
      const copy=source.cloneNode(false);copy.removeAttribute('id');copy.removeAttribute('role');copy.removeAttribute('tabindex');copy.removeAttribute('aria-label');
      copy.className='mascot forest-avatar evolution-avatar';copy.style.cssText='background:transparent';copy.innerHTML=html;
      copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.setAttribute('aria-hidden','true');$(id).append(copy);
    }
    if(!growthPraiseBag.length)growthPraiseBag=shuffle(GROWTH_PRAISE);
    $('evolutionPhrase').textContent=growthPraiseBag.pop();
    $('evolutionLevels').textContent=`Lv.${state.startLevel} → Lv.${profile.level}`;
    $('evolutionTitle').textContent=profile.level>=10&&state.startLevel<10?'눈부신 모습으로 자랐어요!':'함께 공부해서 자랐어요!';
    dialog.showModal();$('skipEvolution').focus({preventScroll:true});
    const stage=$('evolutionStage'),to=stage.getBoundingClientRect();
    if(!reducedMotion()&&stage.animate){
      evolutionZoom=stage.animate([
        {transform:`translate(${from.left+from.width/2-to.left-to.width/2}px,${from.top+from.height/2-to.top-to.height/2}px) scale(${Math.max(.2,from.width/to.width)})`,opacity:.65},
        {transform:'translate(0,0) scale(1)',opacity:1}
      ],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
    }
    presentEvolutionChoice();
  }
  function playEvolutionReveal(){
    const dialog=$('evolutionDialog');dialog.classList.remove('evolution-choosing','evolution-revealed');
    $('evolutionChoices').hidden=true;$('evolutionChoiceHelp').hidden=true;$('skipEvolution').textContent='건너뛰기';
    const copy=$('mascot').cloneNode(true);copy.removeAttribute('id');copy.removeAttribute('role');copy.removeAttribute('tabindex');
    copy.className='mascot forest-avatar evolution-avatar';copy.style.cssText='background:transparent';
    copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.setAttribute('aria-hidden','true');
    $('evolutionAfter').replaceChildren(copy);
    // Restart particles after a leisurely choice, rather than while reading the cards.
    dialog.querySelectorAll('.evolution-halo,.evolution-rays,.evolution-stars i').forEach(n=>{n.style.animation='none';void n.offsetWidth;n.style.animation='';});
    forestAudio.effect('evolve');
    evolutionMorphTimer=setTimeout(()=>dialog.classList.add('evolution-revealed'),reducedMotion()?0:850);
    evolutionTimer=setTimeout(()=>closeEvolution(),3000);
  }
  function presentEvolutionChoice(){
    const familyChoice=profile.level>=3&&!profile.family;
    const routeChoice=!familyChoice&&profile.level>=10&&!routeFor(profile.look.pet,profile.routes);
    if(!familyChoice&&!routeChoice){playEvolutionReveal();return;}
    const dialog=$('evolutionDialog'),choices=$('evolutionChoices');
    dialog.classList.add('evolution-choosing');choices.hidden=false;choices.replaceChildren();$('evolutionChoiceHelp').hidden=false;
    $('skipEvolution').textContent='나중에 고르기';
    $('evolutionTitle').textContent=familyChoice?'어떤 친구로 자라볼까요?':'마지막 성장길을 골라 주세요';
    const options=familyChoice?Object.entries(GROWTH).map(([id,g])=>({id,name:g.name,locked:!petAllowed(id)})):GROWTH[profile.look.pet].routes.map(r=>({id:r.id,name:r.final}));
    for(const option of options){
      const button=document.createElement('button');button.type='button';button.disabled=Boolean(option.locked);
      const art=document.createElement('span');art.innerHTML=creatureSVG(familyChoice?option.id:profile.look.pet,familyChoice?null:option.id,familyChoice?3:10,'#aac875',!familyChoice);
      const label=document.createElement('strong');label.textContent=option.name;
      const note=document.createElement('small');note.textContent=option.locked?'잠김 · 수강생 전용':familyChoice?'이 친구로 성장':'선택하면 모습이 나타나요';
      button.append(art,label,note);choices.append(button);
      button.onclick=()=>{
        if(option.locked)return;
        if(familyChoice){profile.family=option.id;profile.look.pet=option.id;}
        else profile.routes[profile.look.pet]=option.id;
        save();renderProfile();
        $('evolutionTitle').textContent=growthName(profile.look.pet,profile.routes,profile.level)+'로 자랐어요!';
        // A multi-level round can cross both milestones: choose the final route too.
        if(familyChoice&&profile.level>=10&&!routeFor(profile.look.pet,profile.routes))presentEvolutionChoice();
        else playEvolutionReveal();
      };
    }
  }
  $('skipEvolution').onclick=()=>closeEvolution();
  $('evolutionDialog').addEventListener('cancel',e=>{e.preventDefault();closeEvolution();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeEvolution(false);});
  const BUG_HELP=[['帮帮我，有虫子！','도와줘, 벌레가 있어!'],['快帮我赶走虫子吧！','어서 벌레를 쫓아 줘!'],['虫子在咬我！','벌레가 나를 물고 있어!'],['请帮我喷点杀虫剂！','살충제를 좀 뿌려 줘!'],['我怕虫子，帮帮我！','벌레가 무서워, 도와줘!']];
  const RAIN_HELP=[['下雨了，帮我撑把伞吧！','비가 와, 우산을 씌워 줘!'],['我被雨淋湿了！','비에 젖었어!'],['雨好大，我需要一把伞！','비가 많이 와, 우산이 필요해!'],['快帮我挡挡雨吧！','어서 비를 막아 줘!'],['我想躲雨，帮帮我！','비를 피하고 싶어, 도와줘!']];
  const UMBRELLA_ART='<svg viewBox="0 0 120 85" aria-hidden="true"><path d="M60 35v37q0 14-10 6" fill="none" stroke="#8d7359" stroke-width="4" stroke-linecap="round"/><path d="M8 40Q60-20 112 40q-13-10-26 0-13-10-26 0-13-10-26 0-13-10-26 0" fill="#e9ba68" stroke="#997140" stroke-width="2"/><path d="M60 4Q39 11 34 40M60 4q21 7 26 36M60 4v36" stroke="#b18242" stroke-width="2" fill="none"/><path d="M60 1v5" stroke="#8d7359" stroke-width="4" stroke-linecap="round"/></svg>';
  const SPRAY_ART='<svg viewBox="0 0 80 100" aria-hidden="true"><path d="M28 28h28v8l7 14v43H22V50l6-14z" fill="#c4dbbd" stroke="#547d61" stroke-width="3"/><path d="M27 13h33v14H27zM60 13h10v8H60M31 27l-8 10" fill="#72917f" stroke="#436954" stroke-width="3"/><rect x="28" y="54" width="29" height="26" rx="5" fill="#fffbea"/><path d="M34 68l6 6 12-14" fill="none" stroke="#739966" stroke-width="4"/></svg>';
  let bugBag=[],rainBag=[],worldLast=performance.now(),helpElapsed=0,buzzElapsed=0;
  const WEATHER_PHRASES={
    rain:[['下小雨了！','보슬보슬 비가 와!'],['雨轻轻地落下来了。','빗방울이 살며시 내려.'],['小雨滴真可爱！','작은 빗방울이 귀여워!'],['帮我撑把伞，好吗？','우산을 씌워 줄래?'],['听，雨在滴答滴答！','들어 봐, 비가 똑똑 떨어져!']],
    heavyRain:[['雨太大了，快帮我撑伞！','비가 너무 많이 와, 어서 우산을 씌워 줘!'],['我快淋透啦，伞在哪里？','흠뻑 젖겠어, 우산은 어디 있어?'],['救救我的小叶子，帮我挡挡雨！','내 작은 잎 좀 살려 줘, 비를 막아 줘!'],['能给我一把伞吗？我好冷！','우산 하나 줄래? 너무 추워!'],['雨点太大啦，我需要一把伞！','빗방울이 너무 커, 우산이 필요해!']],
    heavySheltered:[['打着伞，怎么还是湿湿的？','우산을 썼는데 왜 아직 축축하지?'],['雨滴偷偷钻进来了！','빗방울이 몰래 들어왔어!'],['这雨也太调皮了吧！','이 비, 너무 장난꾸러기잖아!'],['我的小脚还是淋湿啦！','내 작은 발은 그래도 젖었네!'],['谢谢你的伞，可雨还在往里飘！','우산은 고마워, 그런데 비가 안으로 날아들어!']],
    sheltered:[['伞下面真舒服！','우산 아래가 정말 편해!'],['有伞就不怕下雨啦！','우산이 있으니 비가 와도 괜찮아!'],['谢谢你帮我挡雨！','비를 막아 줘서 고마워!'],['我们一起听雨声吧！','우리 함께 빗소리를 듣자!'],['雨再大，我也淋不到！','비가 많이 와도 젖지 않아!']],
    thunder:[['打雷了，我有点害怕！','천둥이 쳐, 조금 무서워!'],['哎呀，闪电！','앗, 번개야!'],['你能陪着我吗？','내 곁에 있어 줄래?'],['雷声好响啊！','천둥소리가 정말 커!'],['别走，陪我等雨停吧！','가지 말고 비가 그칠 때까지 함께 있어 줘!']],
    heat:[['今天好热啊！','오늘 정말 더워!'],['我都出汗了！','땀이 다 나네!'],['要是凉快一点就好了！','조금 시원해지면 좋겠어!'],['太阳晒得我好热！','햇볕 때문에 너무 더워!'],['让我歇一会儿吧！','잠깐 쉬게 해 줘!']],
    wind:[['风好大，好冷啊！','바람이 세게 불어, 너무 추워!'],['我冷得发抖了！','추워서 몸이 떨려!'],['冷风呼呼地吹！','찬바람이 쌩쌩 불어!'],['好想暖和一点！','조금 따뜻해지면 좋겠어!'],['陪我等风停吧！','바람이 멎을 때까지 함께 있어 줘!']]
  };
  const weatherBags={};let thunderTimer;
  function weatherPhrase(kind){
    if(!weatherBags[kind]?.length)weatherBags[kind]=shuffle(WEATHER_PHRASES[kind]);
    showFriendPhrase(weatherBags[kind].pop());
  }
  function clearThunder(){clearTimeout(thunderTimer);$('homeHabitat').classList.remove('weather-lightning');$('mascot').classList.remove('weather-scared');}
  function flashThunder(){
    if(profile.garden.world.kind!=='heavyRain'||!worldVisible())return;
    clearThunder();$('homeHabitat').classList.add('weather-lightning');$('mascot').classList.add('weather-scared');
    forestAudio.effect('thunder');
    weatherPhrase('thunder');helpElapsed=0;thunderTimer=setTimeout(clearThunder,2200);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearThunder();});
  function showWorldHelp(){
    const w=profile.garden.world;
    if(w.kind==='heat'&&profile.garden.health.heaterOn){playfulReaction('heater');return;}
    if(w.kind==='bug'){if(!bugBag.length)bugBag=shuffle(BUG_HELP);showFriendPhrase(bugBag.pop());}
    else if(WEATHER_PHRASES[w.kind])weatherPhrase(isRain(w.kind)&&w.umbrellaOn?(w.kind==='heavyRain'?'heavySheltered':'sheltered'):w.kind);
  }
  function positionWorldUmbrella(){
    const umbrella=$('mascot').querySelector('.world-umbrella');if(!umbrella)return;
    const route=routeFor(profile.look.pet,profile.routes),g=plantGeometry(profile.look.pet,route?.id,profile.level);
    umbrella.style.top=((197*(1-g.scale)+g.head[1]*g.scale)/210*100)+'%';
  }
  function renderWorld(){
    const g=profile.garden,w=g.world,stage=$('homeHabitat'),friend=$('mascot');
    let layer=stage.querySelector('.world-layer');
    if(!layer){layer=document.createElement('div');layer.className='world-layer';layer.setAttribute('aria-hidden','true');stage.append(layer);}
    if(layer.dataset.kind!==(w.kind||'clear')){
      layer.dataset.kind=w.kind||'clear';layer.replaceChildren();
      if(isRain(w.kind))layer.innerHTML=Array.from({length:w.kind==='heavyRain'?32:10},(_,i)=>`<i class="world-raindrop" style="left:${2+i*(w.kind==='heavyRain'?3:10)}%;animation-delay:-${i*.13}s"></i>`).join('');
      if(w.kind==='heat')layer.innerHTML='<span class="weather-sun"></span><i class="weather-warm-air"></i>';
      if(w.kind==='wind')layer.innerHTML=Array.from({length:6},(_,i)=>`<i class="weather-wind-line" style="top:${15+i*14}%;animation-delay:-${i*.4}s"></i>`).join('');
      if(w.kind==='bug')layer.innerHTML=Array.from({length:8},(_,i)=>`<div class="world-fly" style="left:${13+i%4*21}%;top:${28+Math.floor(i/4)*31}%;animation-delay:-${i*.27}s"><svg viewBox="0 0 44 40"><ellipse class="fly-wing" cx="12" cy="16" rx="10" ry="6" fill="#e0edf1" stroke="#8a9ca4"/><ellipse class="fly-wing" cx="32" cy="16" rx="10" ry="6" fill="#e0edf1" stroke="#8a9ca4"/><ellipse cx="22" cy="25" rx="6" ry="10" fill="#616568"/><circle cx="22" cy="13" r="7" fill="#45494c"/><circle cx="19" cy="12" r="2" fill="#c88365"/><circle cx="25" cy="12" r="2" fill="#c88365"/></svg></div>`).join('');
    }
    let umbrella=friend.querySelector('.world-umbrella');
    if(w.umbrellaOn){if(!umbrella){umbrella=document.createElement('div');umbrella.className='world-umbrella';umbrella.innerHTML=UMBRELLA_ART;umbrella.setAttribute('aria-hidden','true');friend.append(umbrella);}positionWorldUmbrella();}else umbrella?.remove();
    if(w.kind!=='heavyRain'||gardenBusy())clearThunder();
    stage.dataset.weather=w.kind||'clear';
    friend.classList.toggle('weather-hot',w.kind==='heat');friend.classList.toggle('weather-cold',w.kind==='wind');
    let sweat=friend.querySelector('.weather-sweat');
    if(w.kind==='heat'){
      if(!sweat){sweat=document.createElement('span');sweat.className='weather-sweat';sweat.setAttribute('aria-hidden','true');sweat.innerHTML='<svg viewBox="0 0 18 26"><path d="M9 1Q-5 18 9 25Q23 18 9 1" fill="#8bc8dc"/><path d="M6 15q-3 6 2 7" stroke="white" fill="none"/></svg>';friend.append(sweat);}
      const geometry=plantGeometry(profile.look.pet,routeFor(profile.look.pet,profile.routes)?.id,profile.level);
      sweat.style.top=((197*(1-geometry.scale)+geometry.face[1]*geometry.scale)/210*100)+'%';
    }else sweat?.remove();
    friend.classList.toggle('weather-splashed',w.kind==='heavyRain');
    const distressed=w.kind==='bug'||w.kind==='heavyRain'||isRain(w.kind)&&!w.umbrellaOn;
    friend.classList.toggle('world-distressed',distressed);
    friend.classList.toggle('world-threat',w.kind==='bug'&&!gardenBusy());
    forestAudio.setCrisis(w.kind==='bug'&&!gardenBusy()&&!document.hidden);
    stage.classList.toggle('world-raining',isRain(w.kind));
    $('worldStatus').textContent=w.kind==='bug'?`벌레가 나타났어요! ${Math.ceil(w.remainingMs/1000)}초 안에 퇴치해 주세요.`:isRain(w.kind)?`${w.kind==='heavyRain'?'폭우':'가랑비'} · ${w.umbrellaOn?(w.kind==='heavyRain'?'우산 안으로도 빗방울이 튀어요.':'우산으로 비를 막고 있어요.'):'우산을 씌워 주세요.'}`:w.kind==='heat'?'무더위 · 친구가 땀을 흘리고 있어요.':w.kind==='wind'?'찬바람 · 친구가 추워서 떨고 있어요.':'맑은 숲 · 친구가 쉬고 있어요.';
    $('worldAction').hidden=!(w.kind==='bug'||isRain(w.kind)&&!w.umbrellaOn);
    $('worldAction').disabled=gardenBusy();
    $('worldAction').textContent=w.kind==='bug'?(g.inventory.spray?`살충제 뿌리기 · ${g.inventory.spray}개`:'살충제 사러 가기'):(w.umbrellaOwned?'우산 씌우기':'우산 사러 가기');
    renderHealth();
    forestAudio.setRain(w.kind==='heavyRain'&&worldVisible());
  }
  function worldVisible(){
    if(document.hidden||$('gameApp').hidden||gardenBusy()||document.querySelector('dialog[open]'))return false;
    const rect=$('homeHabitat').getBoundingClientRect();
    return rect.bottom>60&&rect.top<window.innerHeight-60;
  }
  function worldTick(now=performance.now()){
    const dt=Math.max(0,Math.min(1500,now-worldLast));worldLast=now;
    forestAudio.setCrisis(profile.garden.world.kind==='bug'&&!gardenBusy()&&!document.hidden);
    forestAudio.setRain(profile.garden.world.kind==='heavyRain'&&worldVisible());
    if(!worldVisible())return;
    const w=profile.garden.world;
    tickHealth(dt);
    if(!w.kind){
      w.nextMs=Math.max(0,w.nextMs-dt);
      if(!w.nextMs){w.kind=['bug','rain','heavyRain','heat','wind'][Math.floor(Math.random()*5)];w.thunderMs=12000+Math.random()*16000;w.remainingMs=w.kind==='bug'?WORLD_RULES.bugMs:WORLD_RULES.rainMs;profile.garden.health.exposure=0;if(!profile.garden.health.sick)profile.garden.health.loss=0;helpElapsed=0;renderWorld();showWorldHelp();forestAudio.effect('tap');}
    }else{
      w.remainingMs=Math.max(0,w.remainingMs-dt);helpElapsed+=dt;
      if(w.kind==='heavyRain'&&w.remainingMs>0){w.thunderMs=(w.thunderMs??12000)-dt;if(w.thunderMs<=0){flashThunder();w.thunderMs=12000+Math.random()*16000;}}
      if(!w.remainingMs){
        const was=w.kind;w.kind=null;w.nextMs=worldGap();helpElapsed=0;
        if(was==='bug'){
          const loss=Math.min(10,Math.max(0,profile.xp-xpStart(profile.level)));profile.xp-=loss;
          $('careMessage').textContent=loss?`벌레를 놓쳐 ${loss} XP가 줄었어요. 다음에는 살충제를 뿌려 주세요.`:'벌레를 놓쳤지만 레벨 보호로 경험치는 줄지 않았어요.';
          hideBubble();renderProfile();
        }else{$('careMessage').textContent='날씨가 다시 맑아졌어요.';hideBubble();clearThunder();}
      }else if(helpElapsed>=20000){helpElapsed=0;showWorldHelp();}
    }
    if(w.kind==='bug'){buzzElapsed+=dt;if(buzzElapsed>=1100){buzzElapsed=0;forestAudio.effect('buzz');}if(Math.random()<.2)$('mascot').classList.toggle('escape-jump');}
    save();renderWorld();
  }
  function buySupply(kind){
    if(gardenBusy()||!['spray','umbrella'].includes(kind))return false;
    const g=profile.garden,w=g.world,price=kind==='spray'?WORLD_RULES.sprayPrice:WORLD_RULES.umbrellaPrice;
    if(g.coins<price||kind==='umbrella'&&w.umbrellaOwned||kind==='spray'&&g.inventory.spray>=999)return false;
    g.coins-=price;if(kind==='spray')g.inventory.spray++;else w.umbrellaOwned=true;
    save();renderCare();renderShop();$('shopMessage').textContent=(kind==='spray'?'살충제 1개':'우산')+'를 구입했어요.';return true;
  }
  function useSupply(kind){
    if(gardenBusy())return false;
    const g=profile.garden,w=g.world;
    const fleeing=kind==='spray'?$('homeHabitat').querySelector('.world-layer')?.cloneNode(true):null;
    if(kind==='spray'){
      if(!g.inventory.spray)return false;
      if(w.kind!=='bug')return playfulReaction('puzzled');
      g.inventory.spray--;w.kind=null;w.remainingMs=0;w.nextMs=worldGap();
    }else if(kind==='umbrella'){
      if(!w.umbrellaOwned)return false;w.umbrellaOn=!w.umbrellaOn;
    }else return false;
    resetFriend();if($('basketDialog').open)$('basketDialog').close();if($('gardenShop').open)$('gardenShop').close();
    save();renderCare();$('homeHabitat').scrollIntoView({behavior:'instant',block:'center'});
    $('openShop').focus({preventScroll:true});
    if(kind==='spray'){
      const tool=document.createElement('div');tool.className='care-tool world-spray-tool';tool.setAttribute('aria-hidden','true');tool.innerHTML=SPRAY_ART+'<span class="world-mist"></span>';$('homeHabitat').append(tool);
      if(fleeing){fleeing.className='care-tool swarm-dispersal';$('homeHabitat').append(fleeing);}
      forestAudio.effect('spray');forestAudio.effect('correct',.5);
      careEndTimer=setTimeout(stopCareAnimation,1800);
      showFriendPhrase(['谢谢你，虫子飞走了！','고마워, 벌레가 날아갔어!'],'below');$('careMessage').textContent='벌레를 퇴치했어요! 경험치를 지켰어요.';
    }else{
      showFriendPhrase(w.umbrellaOn?(w.kind==='heavyRain'?WEATHER_PHRASES.heavySheltered[Math.floor(Math.random()*5)]:['谢谢你，这下淋不到雨了！','고마워, 이제 비를 맞지 않아!']):['伞收好啦！','우산을 잘 접었어!'],'below');$('careMessage').textContent=w.umbrellaOn?'우산을 씌웠어요. 다음 비에도 계속 사용할 수 있어요.':'우산을 접었어요.';
    }
    if(kind!=='spray')forestAudio.effect('dress');return true;
  }
  $('buySpray').onclick=()=>buySupply('spray');$('buyUmbrella').onclick=()=>buySupply('umbrella');
  $('useSpray').onclick=()=>useSupply('spray');$('useUmbrella').onclick=()=>useSupply('umbrella');
  $('worldAction').onclick=()=>{
    const w=profile.garden.world;
    const h=profile.garden.health;
    if(h.sick){if(!useHealth('medicine')){$('openShop').click();selectShopTab(5);}return;}
    if(w.kind==='heat'){if(h.heaterOn){useHealth('heater');return;}if(!useHealth('fan')){$('openShop').click();selectShopTab(6);}return;}
    if(w.kind==='wind'){if(!useHealth('heater')){$('openShop').click();selectShopTab(7);}return;}
    if(w.kind==='bug'&&profile.garden.inventory.spray)useSupply('spray');
    else if(isRain(w.kind)&&w.umbrellaOwned)useSupply('umbrella');else $('openShop').click();
  };
  function healthArt(kind){
    const paths={medicine:'<rect x="23" y="25" width="54" height="65" rx="14" fill="#efc5ac"/><path d="M30 15h40v17H30z" fill="#8ea796"/><path d="M50 45v30M35 60h30" stroke="white" stroke-width="9"/>',fan:'<path d="M50 80L5 36Q50-12 95 36Z" fill="#edc591" stroke="#a37a60" stroke-width="3"/><path d="M50 95V80L25 25M50 80V15M50 80L75 25" fill="none" stroke="#a37a60" stroke-width="4"/>',heater:'<rect x="20" y="20" width="60" height="70" rx="12" fill="#956f61"/><rect x="28" y="30" width="44" height="43" rx="8" fill="#ffc77d"/><path d="M39 37v28M50 37v28M61 37v28" stroke="#e88653" stroke-width="5"/><path d="M30 90v7M70 90v7" stroke="#70564c" stroke-width="7"/>'};
    return '<svg viewBox="0 0 100 100" aria-hidden="true">'+paths[kind]+'</svg>';
  }
  function installHealthShop(){
    const group=document.createElement('div');group.className='shop-items health-items';
    ['medicine','fan','heater'].forEach((kind,i)=>{
      const name=['감기약','살랑 부채','포근 난로'][i],price=[12,25,35][i];
      const tab=document.createElement('button');tab.dataset.shopTab=String(i+4);tab.textContent=name;tab.onclick=()=>selectShopTab(i+4);document.querySelector('.shop-tabs').append(tab);
      const card=document.createElement('article');card.className='shop-item';card.innerHTML=healthArt(kind)+`<h3>${name}</h3><p class="shop-duration">${['감기 치료 · 1회용','45초 동안 더위를 식혀요','찬바람 감기를 예방해요'][i]}</p><p class="stock" id="${kind}Stock"></p><button class="primary" id="buy-${kind}">${price} 코인으로 구매</button><button class="secondary" id="use-${kind}">${['감기약 먹이기','부채질하기','난로 놓기'][i]}</button><p class="shop-hint">${['감기에 걸렸을 때 바구니에서 먹여 주세요. 처음에는 1개를 선물해요.','더울 때 바구니에서 부채질해 주세요. 무더위가 끝나는 것은 아니에요.','찬바람이 불 때 옆에 놓아 주세요. 이미 걸린 감기는 약으로 치료해요.'][i]}</p>`;group.append(card);
    });
    $('shopMessage').before(group);
    const catalog=document.createElement('div');catalog.className='shop-catalog';
    const groups=[...$('gardenShop').querySelectorAll('.shop-items')];
    groups[0].before(catalog);groups.forEach(items=>catalog.append(items));
    ['medicine','fan','heater'].forEach((kind,i)=>{
      $('buy-'+kind).onclick=()=>{const g=profile.garden,h=g.health,price=[12,25,35][i];if(gardenBusy()||g.coins<price||(kind==='medicine'?h.medicine>=999:h[kind]))return;g.coins-=price;if(kind==='medicine')h.medicine++;else h[kind]=true;save();renderCare();renderSupplies();forestAudio.effect('tap');};
      $('use-'+kind).onclick=()=>useHealth(kind);
    });
  }
  function renderHealthShop(){
    if(!$('medicineStock'))return;
    const h=profile.garden.health,g=profile.garden;
    ['medicine','fan','heater'].forEach((k,i)=>{
      $(k+'Stock').textContent=k==='medicine'?`보관함 ${h.medicine}개`:h[k]?'보유 중':'미보유';
      $('buy-'+k).disabled=gardenBusy()||g.coins<[12,25,35][i]||(k==='medicine'?h.medicine>=999:h[k]);
      $('use-'+k).disabled=gardenBusy()||(k==='medicine'?!h.medicine:!h[k]);
    });
    $('use-heater').textContent=h.heaterOn?'난로 치우기':'난로 놓기';
  }
  function healthPhrase(kind){
    const phrases=kind==='sick'?['我感冒了，帮帮我吧！','我不舒服，给我吃药吧！','阿嚏！我需要感冒药。','请照顾一下我吧！','吃了药就会好起来吧？']:['好热呀，帮我扇扇风吧！','我又热起来了！','请给我一点凉风吧！','小扇子在哪里呀？','快帮我扇扇风，我出汗了！'];
    showFriendPhrase([phrases[Math.floor(Math.random()*5)],kind==='sick'?'감기에 걸렸어. 감기약을 먹여 줘!':'더워! 부채질을 해 줘!']);
  }
  function healthLoss(h){
    if(h.loss>=5)return;
    const loss=Math.min(1,Math.max(0,profile.xp-xpStart(profile.level)));profile.xp-=loss;h.loss++;renderProfile();$('careMessage').textContent=loss?'돌봄이 필요해요 · −1 XP':'돌봄이 필요해요 · 현재 레벨은 보호돼요';
  }
  function tickHealth(dt){
    const g=profile.garden,h=g.health,w=g.world;
    if(h.sick){h.illMs+=dt;if(h.illMs>=120000){h.illMs-=120000;healthLoss(h);healthPhrase('sick');}}
    const exposed=w.kind==='heavyRain'||w.kind==='wind'&&!h.heaterOn;
    if(!h.sick&&exposed){h.exposure+=dt;if(h.exposure>=60000){h.exposure=0;if(Math.random()<(w.kind==='wind'?.25:w.umbrellaOn?.05:.2)){h.sick=true;h.illMs=0;h.loss=0;healthPhrase('sick');}}}else h.exposure=0;
    if(w.kind==='heat'){
      const cooled=h.coolMs>0;h.coolMs=Math.max(0,h.coolMs-dt);
      if(!cooled){if(h.heatMs===0)healthPhrase('heat');h.heatMs+=dt;if(h.heatMs>=45000){h.heatMs=0;healthLoss(h);}}
    }else{h.heatMs=0;h.coolMs=0;}
  }
  function useHealth(kind){
    const g=profile.garden,h=g.health;if(gardenBusy())return false;
    if($('basketDialog').open)$('basketDialog').close();
    if(kind==='medicine'){if(!h.medicine)return false;if(!h.sick)return playfulReaction('medicine');h.medicine--;h.sick=false;h.illMs=0;h.exposure=0;h.loss=0;}
    else if(kind==='fan'){if(!h.fan)return false;if(g.world.kind!=='heat')return playfulReaction(isRain(g.world.kind)||g.world.kind==='wind'?'fan':'puzzled');if(h.heaterOn)return playfulReaction('heater');h.coolMs=45000;h.heatMs=0;}
    else{if(!h.heater)return false;h.heaterOn=!h.heaterOn;}
    if($('basketDialog').open)$('basketDialog').close();
    if($('gardenShop').open)$('gardenShop').close();
    save();renderWorld();renderSupplies();if(kind==='heater'&&h.heaterOn&&g.world.kind==='heat'){playfulReaction('heater');return true;}forestAudio.effect(kind==='medicine'?'correct':'dress');
    if(kind!=='heater'){
      const tool=document.createElement('span');tool.className='health-tool '+kind+'-tool';tool.innerHTML=healthArt(kind);$('homeHabitat').append(tool);setTimeout(()=>tool.remove(),2000);
    }
    showFriendPhrase([kind==='medicine'?'谢谢你，我好多了！':kind==='fan'?'凉快多了，谢谢你！':h.heaterOn?'暖和多了！':'先把暖炉收起来吧！',kind==='medicine'?'고마워, 이제 괜찮아!':kind==='fan'?'시원해졌어! 고마워!':h.heaterOn?'따뜻해졌어!':'난로를 잠시 치울게!'],'below');return true;
  }
  function renderHealth(){
    const h=profile.garden.health,w=profile.garden.world,stage=$('homeHabitat');
    $('mascot').classList.toggle('friend-sick',h.sick);
    stage.classList.toggle('weather-cooled',w.kind==='heat'&&h.coolMs>0);
    $('mascot').classList.toggle('weather-cold',h.sick||w.kind==='wind'&&!h.heaterOn);
    $('mascot').classList.toggle('weather-hot',w.kind==='heat'&&h.coolMs<=0);
    let heater=stage.querySelector('.placed-heater');if(h.heaterOn&&!heater){heater=document.createElement('span');heater.className='placed-heater';heater.innerHTML=healthArt('heater');stage.append(heater);}if(!h.heaterOn)heater?.remove();
    if(h.sick){$('worldStatus').textContent+=' · 감기 치료가 필요해요';}
    if(w.kind==='heat'&&h.coolMs>0)$('worldStatus').textContent=`무더위 · ${Math.ceil(h.coolMs/1000)}초 동안 시원해요`;
    if(h.sick||w.kind==='heat'||w.kind==='wind'){
      $('worldAction').hidden=false;$('worldAction').textContent=h.sick?'감기약 먹이기':w.kind==='heat'?(h.heaterOn?'난로 치우기':'부채질하기'):h.heaterOn?'난로 사용 중':'난로 놓기';
      $('worldAction').disabled=gardenBusy()||!h.sick&&w.kind==='wind'&&h.heaterOn;
    }
  }
  installHealthShop();
  function installBasket(){
    document.querySelector('.care-actions').append($('openBasket'));
    const lush=document.querySelector('[data-buy="gentle"]').closest('.shop-item').cloneNode(true);
    lush.innerHTML=lush.innerHTML.replaceAll('gentle','lush').replaceAll('햇살 비료','반짝 비료').replaceAll('20코인','50코인').replaceAll('20 코인','50 코인').replaceAll('+1','+3');
    document.querySelector('.shop-catalog .shop-items').append(lush);
    const tab=document.createElement('button');tab.dataset.shopTab='7';tab.textContent='반짝 비료';tab.onclick=()=>{document.querySelectorAll('.shop-item').forEach(n=>n.classList.toggle('shop-selected',n===lush));document.querySelectorAll('[data-shop-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));};document.querySelector('.shop-tabs').append(tab);
    // Keep existing use handlers and IDs, but move every use button out of the shop.
    const entries=[...Object.keys(FERTILIZERS).map(k=>[k,document.querySelector(`[data-feed="${k}"]`)]),['spray',$('useSpray')],['umbrella',$('useUmbrella')],...['medicine','fan','heater'].map(k=>[k,$('use-'+k)])];
    entries.forEach(([key,button])=>{
      const source=button.closest('.shop-item'),card=document.createElement('article');card.className='basket-item';card.dataset.item=key;
      card.append(source.querySelector('svg').cloneNode(true),source.querySelector('h3').cloneNode(true));
      const stock=document.createElement('p');stock.className='basket-stock';card.append(stock,button);$('basketItems').append(card);
    });
    // Index order follows the eight product cards after the new fertilizer is inserted.
    document.querySelectorAll('.shop-item').forEach((card,i)=>{
      const key=card.querySelector('[data-buy]')?.dataset.buy||card.querySelector('[id^="buy-"]')?.id.slice(4)|| (card.querySelector('#buySpray')?'spray':'umbrella');
      const labels={gentle:'햇살 비료',rich:'든든 비료',lush:'반짝 비료',spray:'살충제',umbrella:'우산',medicine:'감기약',fan:'부채',heater:'난로'};
      const button=document.querySelectorAll('[data-shop-tab]')[i];button.textContent=labels[key];button.dataset.shopTab=String(i);button.onclick=()=>selectShopTab(i);
    });
    $('openBasket').onclick=()=>{if(gardenBusy())return;renderBasket();$('basketDialog').showModal();};
    $('closeBasket').onclick=()=>{$('basketDialog').close();$('openBasket').focus();};
  }
  function renderBasket(){
    const g=profile.garden,h=g.health;
    $('basketCoins').textContent=`${FORESTS[activeForest].name} · ${g.coins} 코인`;
    renderShop();
    document.querySelectorAll('.basket-item').forEach(card=>{
      const k=card.dataset.item,permanent=['fan','heater','umbrella'].includes(k),count=k==='umbrella'?Number(g.world.umbrellaOwned):k==='medicine'?h.medicine:permanent?Number(h[k]):g.inventory[k];
      card.querySelector('.basket-stock').textContent=permanent?(count?'보유 중 · 재사용 가능':'미보유'):`보유 ${count}개`;
    });
  }
  let reactionTimer;
  function playfulReaction(kind){
    const lines={
      heater:[['太热啦！快把暖炉收起来！','너무 더워! 난로부터 치워 줘!'],['我是植物，不是烤红薯！','나는 식물이지 군고구마가 아니야!'],['先关暖炉，再帮我扇风！','난로부터 끄고 부채질해 줘!'],['还加热？我要冒烟啦！','더 데우려고? 나 연기 나겠어!'],['快拿扇子来救我！','어서 부채로 나 좀 살려 줘!']],
      fan:[['阿嚏！别再扇风啦！','에취! 부채질은 그만!'],['我已经很冷啦！','나 이미 춥다고!'],['你想把我冻成冰棍吗？','나를 아이스크림으로 만들려고?'],['现在不要凉风，谢谢！','지금은 시원한 바람 사양할게!'],['我想暖和一点，不是更冷！','따뜻해지고 싶지 더 추워지고 싶진 않아!']],
      medicine:[['我没感冒呀！','나 감기 안 걸렸는데!'],['这可不是糖果哦！','이건 사탕이 아니야!'],['药先留着吧，我很好！','약은 아껴 둬, 나 괜찮아!'],['咦？为什么要吃药？','응? 왜 약을 먹어야 해?'],['别担心，我很健康！','걱정 마, 나 건강해!']],
      puzzled:[['咦？现在不用这个吧？','응? 지금은 이거 필요 없지 않을까?'],['你是不是拿错啦？','혹시 잘못 집었어?'],['让我想想……好像不需要！','어디 보자… 필요 없을 것 같은데!'],['先收好，下次再用吧！','잘 보관했다가 다음에 쓰자!'],['嘿嘿，你在逗我吗？','헤헤, 나 놀리는 거야?']]
    };
    if($('basketDialog').open)$('basketDialog').close();
    clearTimeout(reactionTimer);const friend=$('mascot');friend.classList.remove('care-angry','care-puzzled');void friend.offsetWidth;
    friend.classList.add(kind==='medicine'||kind==='puzzled'?'care-puzzled':'care-angry');
    const options=lines[kind]||lines.puzzled;showFriendPhrase(options[Math.floor(Math.random()*options.length)],'below');forestAudio.effect('wrong');
    reactionTimer=setTimeout(()=>friend.classList.remove('care-angry','care-puzzled'),3000);return false;
  }
  function showPerfect(done){
    const cheers=[['全对了，你真棒！','전부 맞혔어, 정말 멋져!'],['你的努力开花啦！','네 노력이 꽃을 피웠어!'],['一个都没错，太厉害了！','하나도 안 틀렸어, 대단해!'],['坚持学习，你越来越棒了！','꾸준히 공부하니 점점 더 멋져져!'],['我们一起继续加油吧！','우리 함께 계속 힘내자!']];
    const phrase=cheers[Math.floor(Math.random()*cheers.length)];$('perfectArt').innerHTML=$('mascot').querySelector('.creature-art').innerHTML;
    $('perfectChinese').textContent=phrase[0];$('perfectKorean').textContent=phrase[1];$('perfectReward').textContent=`전체 정답 보너스 +${state.perfectXP} XP`;
    const dialog=$('perfectDialog');dialog.showModal();forestAudio.effect('level');
    let completed=false;const close=()=>{if(completed)return;completed=true;clearTimeout(timer);dialog.close();done();};
    const timer=setTimeout(close,3200);$('closePerfect').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
  }
  installBasket();


  setInterval(()=>{renderWaterCountdown();worldTick();},1000);
  $('waterPlant').onclick=waterPlant;
  $('openShop').onclick=()=>{
    if(gardenBusy())return;
    resetFriend();refreshGarden();$('shopMessage').textContent='';renderShop();selectShopTab(profile.garden.world.kind==='bug'?3:isRain(profile.garden.world.kind)?4:0);$('gardenShop').showModal();$('closeShop').focus();
  };
  function closeShop(){$('gardenShop').close();$('openShop').focus();}
  $('closeShop').onclick=closeShop;
  $('gardenShop').addEventListener('cancel',e=>{e.preventDefault();closeShop();});
  document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buyFertilizer(b.dataset.buy));
  document.querySelectorAll('[data-feed]').forEach(b=>b.onclick=()=>feedFertilizer(b.dataset.feed));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGarden();});
  setInterval(()=>{if(!document.hidden)refreshGarden();},60000);
  $('levelSelect').onchange=updateCount;
  populateGrades();
  updateCount();renderProfile();refreshGarden();save();populateVoices();modeChanged();
  if(data.length<4){$('startBtn').disabled=true;$('ruleBox').textContent='data.js를 불러오지 못했어요. 네 파일을 같은 폴더에 두었는지 확인해 주세요.';}
})();
