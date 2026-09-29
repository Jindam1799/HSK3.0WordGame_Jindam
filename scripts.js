/* No build step or server required: keep the four files in the same directory.
 * XP tuning and round timing live in RULES. Never put paid TTS API keys here.
 * Set data.js audio URLs to reviewed recordings to use consistent voice quality.
 */
(() => {
  'use strict';
  // penalty 0: 오답·시간 초과에도 경험치를 깎지 않아요. 대신 연속 정답(streakEvery개마다) 보너스를 줘요.
  const RULES = Object.freeze({seconds:7, baseXP:5, penalty:0, bonusXP:3, streakEvery:5, streakXP:3, relaxedExtra:5, bonusExtra:2});
  // 쉬운 모드(한자+병음을 보고 뜻 고르기)는 어려운 모드보다 경험치·코인이 적어요.
  const EASY_RULES = Object.freeze({baseXP:3, bonusXP:2, streakXP:2, baseCoins:1, bonusCoins:0, perfect10:5, perfect20:12});
  const difficulty=()=>document.querySelector('input[name="difficulty"]:checked')?.value==='easy'?'easy':'hard';
  // 급수별 제한 시간(초). 급수가 높을수록 뜻이 길어져서 조금 더 여유를 줘요.
  const LEVEL_SECONDS = Object.freeze({1:7,2:7,3:8,4:10,5:12,6:12,7:14,8:14,9:14});
  // 단어 파일이 있는 급수. data/hsk6.js 같은 새 파일을 추가하면 여기에 숫자를 더해 주세요.
  const DATA_LEVELS = [1,2,3,4,5];
  const DATA_VERSION = '20260929b';
  // 홍보 팝업(무료판 전용): 결과 화면 뒤에만 한 번, PROMO_MS 뒤에 닫을 수 있어요.
  const PROMO_MS = 5000;
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
  // 수강생판·무료판 구분은 index.html 맨 위 <html data-edition="student|free"> 한 곳에서만 해요.
  // scripts.js는 두 판이 똑같아서, 파일이 섞여도 광고·저장 공간이 바뀌지 않아요.
  const EDITION = document.documentElement.dataset.edition==='free'?'free':'student';
  const KEY = EDITION==='free'?'word-forest-v1':'word-forest-student-v1';
  let activeForest=0;
  const FORESTS=[{name:'초록빛 숲',grades:'1~3급',start:1},{name:'살구빛 숲',grades:'4~6급',start:4},{name:'보랏빛 숲',grades:'7~9급',start:7}];
  const forestKey=i=>i===0?KEY:KEY+'-forest-'+i;
  const STUDENT_BG = EDITION==='free'?'':'assets/garden.svg';
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
  // 체험판(무료판)은 Lv.10까지만 자라요.
  const MAX_LEVEL=EDITION==='free'?10:Infinity;
  const xpCap=(forest=activeForest)=>MAX_LEVEL===Infinity?Number.MAX_SAFE_INTEGER:xpStart(MAX_LEVEL+1,forest)-1;
  const $ = id => document.getElementById(id);
  { const tag=document.querySelector('.topbar .edition');if(tag)tag.textContent=(EDITION==='free'?'무료판':'수강생판')+' · 함께 자라는 숲'; }
  // 단어는 급수별 파일(data/hsk1.js …)에서 필요할 때만 불러와요.
  const data = [];
  const allPhrases = [];
  const levelState = {}; // level -> 'loading' | 'ready' | 'failed'
  const levelWaiters = {};
  let loadChain = Promise.resolve();
  const levelReady = level => levelState[level]==='ready';
  const levelWords = level => data.filter(w=>w.level===level);
  function loadLevel(level){
    level=Number(level);
    if(!DATA_LEVELS.includes(level)){levelState[level]='failed';return Promise.resolve(false);}
    if(levelState[level]==='ready')return Promise.resolve(true);
    if(levelWaiters[level])return levelWaiters[level];
    levelState[level]='loading';
    // Files share the window.HSK_DATA name, so load them one at a time.
    const job=loadChain.then(()=>new Promise(resolve=>{
      const script=document.createElement('script');
      script.src=`data/hsk${level}.js?v=${DATA_VERSION}`;
      const done=ok=>{
        const words=ok&&Array.isArray(window.HSK_DATA)?window.HSK_DATA:[];
        try{delete window.HSK_DATA;}catch{window.HSK_DATA=undefined;}
        script.remove();
        const clean=words.filter(w=>w&&w.id&&w.hanzi&&w.meaning).map(w=>({...w,level,collocations:Array.isArray(w.collocations)?w.collocations:[]}));
        data.push(...clean);
        allPhrases.push(...clean.flatMap(w=>w.collocations.map(p=>({...p,parent:w.id,level}))));
        levelState[level]=clean.length?'ready':'failed';
        if(clean.length)migrateMemory(level,clean);
        resolve(clean.length>0);
      };
      script.onload=()=>done(true);script.onerror=()=>done(false);
      document.head.append(script);
    }));
    loadChain=job.catch(()=>{});
    levelWaiters[level]=job.finally(()=>{delete levelWaiters[level];});
    return levelWaiters[level];
  }
  const loadLevels = levels => Promise.all(levels.map(loadLevel));
  const forestLevels = (forest=activeForest) => [0,1,2].map(i=>FORESTS[forest].start+i).filter(l=>DATA_LEVELS.includes(l));

  /* 단어별 기억 기록 (간단한 간격 반복)
   * key "급수:id" -> {s:단계 0~5, due:다음 복습 시각, r:맞힌 수, w:틀린 수, t:마지막으로 푼 시각}
   * 틀리면 0단계로 돌아가 다음 판에 바로 다시 나오고, 맞힐 때마다 간격이 1→3→7→14→30일로 늘어나요. */
  const memoryKey=KEY+'-memory-v1';
  const DAY=24*60*60*1000;
  const INTERVAL_DAYS=[0,1,3,7,14,30];
  let memory={},memoryStorageOK=true;
  try{const saved=JSON.parse(localStorage.getItem(memoryKey)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))memory=saved;}catch{memoryStorageOK=false;}
  function saveMemory(){try{localStorage.setItem(memoryKey,JSON.stringify(memory));memoryStorageOK=true;}catch{memoryStorageOK=false;}}
  // Due times snap to 4 a.m. local time so "tomorrow" means the next study day.
  function dueAfter(days,now=Date.now()){
    if(!days)return now;
    const d=new Date(now);d.setHours(4,0,0,0);if(d.getTime()<=now)d.setDate(d.getDate()+1);
    d.setDate(d.getDate()+days-1);return d.getTime();
  }
  function rememberAnswer(word,correct,now=Date.now()){
    const key=`${word.level}:${word.id}`,old=memory[key],rec=old?{...old}:{s:0,due:now,r:0,w:0,t:0};
    if(correct){rec.r++;rec.s=Math.min(5,old?rec.s+1:2);}else{rec.w++;rec.s=0;}
    rec.due=dueAfter(INTERVAL_DAYS[rec.s],now);rec.t=now;memory[key]=rec;saveMemory();
    return rec;
  }
  const memoryOf = word => memory[`${word.level}:${word.id}`];
  const isDue = (rec,now=Date.now()) => Boolean(rec)&&rec.due<=now;
  // Count due reviews from saved records alone, without loading word files.
  // 지금 단어 자료에 있는 단어만 세요. (자료가 바뀌어 없어진 단어의 옛 기록은 세지 않아요)
  function dueCount(levels,now=Date.now()){
    let n=0;for(const L of levels){if(!levelReady(L))continue;for(const w of levelWords(L))if(isDue(memoryOf(w),now))n++;}return n;
  }
  // 단어 자료가 바뀌며 id가 달라진 기록을 새 단어로 옮기고, 없어진 단어의 기록은 정리해요.
  function migrateMemory(level,list){
    const ids=new Set(list.map(w=>w.id)),bySrc=new Map(list.map(w=>[Number(w.sourceNumber),w]));
    const target=id=>{const m=/^hsk\d-n(\d{4})$/.exec(id);return m?bySrc.get(Number(m[1])):null;};
    let changed=false;
    for(const key of Object.keys(memory)){
      const L=Number(key.split(':')[0]),id=key.slice(key.indexOf(':')+1);
      if(L!==level||ids.has(id))continue;
      const w=target(id);if(w&&!memory[`${level}:${w.id}`])memory[`${level}:${w.id}`]=memory[key];
      delete memory[key];changed=true;
    }
    for(const key of [...studied]){
      const L=Number(key.split(':')[0]),id=key.slice(key.indexOf(':')+1);
      if(L!==level||ids.has(id))continue;
      const w=target(id);if(w)studied.add(`${level}:${w.id}`);studied.delete(key);changed=true;
    }
    if(changed){saveMemory();try{localStorage.setItem(studyKey,JSON.stringify([...studied]));}catch{}}
  }
  function dueWords(levels,now=Date.now()){
    return data.filter(w=>levels.includes(w.level)&&isDue(memoryOf(w),now))
      .sort((a,b)=>memoryOf(a).s-memoryOf(b).s||memoryOf(b).w-memoryOf(a).w||memoryOf(a).due-memoryOf(b).due);
  }
  // Mix a round: due reviews first (up to half), then words never seen, then the least recent.
  function buildQueue(pool,size,now=Date.now()){
    const due=shuffle(pool.filter(w=>isDue(memoryOf(w),now))).sort((a,b)=>memoryOf(a).s-memoryOf(b).s);
    const reviewSlots=Math.min(due.length,Math.ceil(size/2));
    const picked=due.slice(0,reviewSlots),used=new Set(picked.map(w=>w.id));
    const fresh=shuffle(pool.filter(w=>!memoryOf(w)&&!used.has(w.id)));
    const rest=shuffle(pool.filter(w=>memoryOf(w)&&!used.has(w.id)&&!isDue(memoryOf(w),now))).sort((a,b)=>memoryOf(a).t-memoryOf(b).t);
    const leftoverDue=due.slice(reviewSlots);
    for(const w of [...fresh,...leftoverDue,...rest]){if(picked.length>=size)break;if(!used.has(w.id)){picked.push(w);used.add(w.id);}}
    return {queue:shuffle(picked),reviews:reviewSlots};
  }
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
    const levels=[0,1,2].map(i=>FORESTS[forest].start+i);
    if(forestLevels(forest).some(l=>!levelReady(l)&&levelState[l]!=='failed')){
      const p=document.createElement('p');p.className='subtle';p.textContent='단어 기록을 불러오는 중이에요…';$('studyRows').replaceChildren(p);
      loadLevels(forestLevels(forest)).then(()=>{if($('studyDialog').open)renderStudy(forest);});
      return;
    }
    $('studyRows').replaceChildren();
    const now=Date.now();
    for(const level of levels){
      const words=[...new Map(data.filter(w=>w.level===level).map(w=>[studyId(w),w])).values()];
      const count=words.filter(w=>studied.has(studyId(w))).length,total=words.length,percent=total?Math.floor(count/total*100):0;
      const known=words.filter(w=>(memoryOf(w)?.s||0)>=3).length,due=words.filter(w=>isDue(memoryOf(w),now)).length;
      const row=document.createElement('section');row.className='study-row';
      const heading=document.createElement('h3');heading.textContent=`HSK ${level}급`;
      const bar=document.createElement('progress');bar.max=total||1;bar.value=count;bar.setAttribute('aria-label',`HSK ${level}급 학습 진행률`);
      const detail=document.createElement('div');detail.className='row';
      const amount=document.createElement('span');amount.textContent=total?`${count.toLocaleString()} / ${total.toLocaleString()} 단어`:'어휘 준비 중';
      const ratio=document.createElement('strong');ratio.textContent=total?`${percent}%`:'—';detail.append(amount,ratio);row.append(heading,bar,detail);
      if(total){const memo=document.createElement('p');memo.className='study-memory';memo.innerHTML=`<span>오래 기억하는 단어 <b>${known}</b></span><span>오늘 복습할 단어 <b>${due}</b></span>`;row.append(memo);}
      $('studyRows').append(row);
    }
    $('studyNote').textContent=studyStorageOK&&memoryStorageOK?'답을 확인한 기본 단어를 기록해요. 같은 단어는 한 번만 세고 짝꿍어휘는 제외해요. ‘오래 기억하는 단어’는 간격을 두고 세 번 이상 연달아 맞힌 단어예요. 틀린 단어는 다음 판에 먼저 다시 나와요.':'현재 브라우저에 기록을 저장할 수 없어요. 이번 접속 중의 기록만 표시되며, 새로고침하면 사라질 수 있어요.';
  }
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
  // 체험판(무료판)은 마음꽃·마음송이 두 갈래만 고를 수 있어요. 이미 마음담이를 키우던 친구는 그대로 키워요.
  const FREE_LOCKED=EDITION==='free'?['succulent',...STUDENT_PETS]:STUDENT_PETS;
  const FREE_LEGACY=new Set();
  if(EDITION==='free')try{for(let i=0;i<3;i++){const f=JSON.parse(localStorage.getItem(forestKey(i))||'null')?.family;if(f==='succulent')FREE_LEGACY.add(f);}}catch{}
  const petAllowed=pet=>!FREE_LOCKED.includes(pet)||Boolean(STUDENT_BG)||FREE_LEGACY.has(pet);
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
  // Lv.15 두 갈래(이름) → Lv.20 최종 진화(최종 이름). 나무 '바람의 길'에는 대나무가 있어요.
  const ROUTE_BRANCHES={
    sunflower:[['twinsun','당당한 라플레시아','태양을 삼킨 타이탄 아룸'],['moonflower','날렵한 극락조화','해를 품은 부상목']],
    rose:[['crimsonrose','배고픈 파리지옥','태고의 거대 벌레잡이통풀'],['bluerose','째깍째깍 시계꽃','하늘에서 내린 만다라화']],
    hibiscus:[['hongdansim','고요한 연꽃','천년 잠에서 깬 아라홍련'],['baekdansim','나풀나풀 호접란','일곱 보석 칠보수']],
    matsutake:[['goldmatsutake','신비한 동충하초','산신령의 천년 산삼'],['twinmatsutake','레이스 두른 망태버섯','춤추는 요정의 고리']],
    horn:[['firehorn','반짝이는 야광버섯','태고의 거인 프로토택사이트'],['icehorn','퐁퐁 뿜는 먼지버섯','만년설 속 천산 설련화']],
    reishi:[['redreishi','단단한 말굽버섯','진시황이 찾던 불로초'],['nightreishi','수줍은 먹물버섯','한밤의 도깨비불 버섯']],
    undulata:[['pinkwave','통통한 에케베리아','천년을 사는 웰위치아'],['silverwave','동글동글 녹영','고생대의 칼라미테스']],
    euphorbia:[['bloomeuphorbia','뜨거운 사막의 장미','거꾸로 선 바오밥나무'],['violeteuphorbia','돌인 척하는 리톱스','최초의 식물 쿡소니아']],
    cactus:[['bloomcactus','폭신한 토끼귀 선인장','용의 피를 품은 용혈수'],['goldcactus','달밤의 월하미인','삼천 년에 한 번 피는 우담바라']],
    lucky:[['fiveleaf','사랑스러운 사랑초','신화 속 황금사과나무'],['goldclover','돌돌 말린 고사리 새순','공룡 시대의 나무고사리']],
    silver:[['starclover','용감한 에델바이스','오천 살 브리슬콘 소나무'],['frostclover','알록달록 수국','쥐라기의 아라우카리아']],
    crimson:[['bouquetclover','보송보송 토끼꼬리풀','바람을 타는 소원 민들레'],['ringclover','다정한 금낭화','두 나무가 하나 된 연리지']],
    strawberry:[['whiteberry','등불 든 꽈리','신선의 천도복숭아'],['berryfield','줄무늬 수박 덩굴','흥부네 보물 박넝쿨']],
    blueberry:[['violetberry','주렁주렁 포도 덩굴','억만 년을 견딘 소철'],['frostberry','폭신폭신 목화','하늘을 덮는 구름 목화']],
    raspberry:[['goldraspberry','멋쟁이 파인애플','하늘까지 닿은 콩나무'],['blackberry','화끈한 고추','봉황이 깃든 봉황목']],
    oak:[['elderoak','팔 벌린 반얀나무','세상을 떠받친 세계수'],['maple','붉게 물든 단풍나무','마을을 지키는 천년 당산나무']],
    willow:[['bamboo','곧게 뻗은 대나무','백 년 만에 꽃핀 대나무숲'],['weepingcherry','화사한 벚나무','하늘이 내린 신단수']],
    ginkgo:[['elderginkgo','키다리 메타세쿼이아','석탄기의 거인 인목'],['moonginkgo','향기로운 매화나무','달나라 계수나무']]
  };
  for(const info of Object.values(GROWTH))for(const r of info.routes)r.branches=(ROUTE_BRANCHES[r.id]||[]).map(([id,name,final])=>({id,name,final}));
  const routeFor=(pet,routes)=>GROWTH[pet]?.routes.find(r=>r.id===routes?.[pet]);
  const branchFor=(pet,routes,branches)=>routeFor(pet,routes)?.branches.find(b=>b.id===branches?.[pet]);
  function safeBranches(raw,level,routes){
    const out={};
    if(level>=15)for(const [pet,rid] of Object.entries(routes||{})){const r=GROWTH[pet]?.routes.find(x=>x.id===rid);if(r&&r.branches.some(b=>b.id===raw?.[pet]))out[pet]=raw[pet];}
    return out;
  }
  function safeRoutes(raw,level){
    const routes={};
    if(level>=3)for(const [pet,info] of Object.entries(GROWTH))if(petAllowed(pet)&&info.routes.some(r=>r.id===raw?.[pet]))routes[pet]=raw[pet];
    return routes;
  }
  const growthStage=(level,route)=>level===1?0:level<3?1:level>=10&&route?4:level>=4?3:2;
  const displayPet=(pet,level)=>level===1?'seed':level===2||!GROWTH[pet]?'sprout':pet;
  function growthName(pet,routes,level,branches=profile.branches){
    if(level===1)return '마음씨';if(level===2||!GROWTH[pet])return '마음싹';
    const route=routeFor(pet,routes),br=branchFor(pet,routes,branches);
    if(level>=20&&br)return br.final;
    if(level>=15&&br)return br.name;
    return level>=10&&route?route.final:level>=4?'쑥쑥 자라는 '+GROWTH[pet].name:GROWTH[pet].name;
  }
  const branchOf=(pet,route,level,adult,branch)=>branch!==undefined?branch:(level>=15&&adult&&profile?.routes?.[pet]===route?profile.branches?.[pet]:null);
  const legendForm=(br,level)=>br&&level>=15&&LEGEND.forms[br]?LEGEND.forms[br][level>=20?'l20':'l15']:null;
  function plantGeometry(pet,route,level,branch){
    const family=displayPet(pet,level),adult=level>=10&&Boolean(route);
    const form=adult?legendForm(branchOf(pet,route,level,adult,branch),level):null;
    // Lv.15 → 19: 한 레벨마다 조금씩 커져요. Lv.20은 가장 커요.
    if(form)return {family,adult,scale:level>=20?1:0.84+0.04*(level-15),face:form.face,head:form.head,neck:form.neck,form};
    const scale=family==='seed'?0.7:family==='sprout'?0.8:adult?0.86+0.035*(Math.min(level,14)-10):0.63+0.045*(Math.min(level,9)-3);
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
  /* =================================================================
   * Lv.15 · Lv.20 변신 모습 (36가지)
   * 각 모습: face 얼굴 위치, head/neck 장식 위치, f15/f20 표정, draw(lv20) 그림
   * 표정 종류: sparkle 별빛눈 · star 별눈 · wink 윙크 · cool 여유 · sleepy 졸림
   *           fierce 씩씩 · heart 하트눈 · laugh 활짝 · surprise 놀람 · owl 부엉이 · panda 판다
   * ================================================================= */
  const LEGEND=(()=>{
    const n=v=>Number(Number(v).toFixed(1));
    const at=(s,w)=>s&&s.includes('=')?s:s&&s!=='none'?` stroke="${s}" stroke-width="${w}" stroke-linejoin="round"`:'';
    const E=(cx,cy,rx,ry,f,s,w,x='')=>`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${at(s,w)}${x}/>`;
    const C=(cx,cy,r,f,s,w,x='')=>`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${f}"${at(s,w)}${x}/>`;
    const P=(d,f,s,w,x='')=>`<path d="${d}" fill="${f}"${at(s,w)}${x}/>`;
    const L=(d,s,w,x='')=>`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
    const R=(x,y,w,h,r,f,s,sw)=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(r)}" fill="${f}"${at(s,sw)}/>`;
    const G=(t,c)=>`<g transform="${t}">${c}</g>`;
    const op=o=>` opacity="${o}"`;
    const rot=(a,x,y)=>` transform="rotate(${n(a)} ${n(x)} ${n(y)})"`;
    const star=(x,y,r,f='#f6d66b',s='#fffbe8')=>P(`M${n(x)} ${n(y-r)}L${n(x+r*.28)} ${n(y-r*.28)}L${n(x+r)} ${n(y)}L${n(x+r*.28)} ${n(y+r*.28)}L${n(x)} ${n(y+r)}L${n(x-r*.28)} ${n(y+r*.28)}L${n(x-r)} ${n(y)}L${n(x-r*.28)} ${n(y-r*.28)}Z`,f,s,.8);
    const star5=(x,y,r,f='#f4c542',s='#b8871c')=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r;d+=(i?'L':'M')+n(x+Math.cos(a)*rr)+' '+n(y+Math.sin(a)*rr);}return P(d+'Z',f,s,1.2);};
    const leaf=(x,y,a,s,f='#6f9e57',st='#416e42')=>G(`translate(${n(x)} ${n(y)}) rotate(${n(a)}) scale(${n(s)})`,P('M0 0Q-24 -24 0 -58Q26 -26 0 0Z',f,st,1.4)+L('M0 -4V-50','#c9dca8',1.2));
    const cloud=(x,y,s,f='#ffffff',o=1)=>G(`translate(${n(x)} ${n(y)}) scale(${n(s)})`,C(-18,4,14,f)+C(0,-6,18,f)+C(20,2,15,f)+R(-30,2,62,16,8,f)).replace(/<g /,`<g opacity="${o}" `);
    const bloom=(x,y,r,f,c='#f3cf5a',k=5)=>{let o='';for(let i=0;i<k;i++){const a=i*2*Math.PI/k-Math.PI/2;o+=C(x+Math.cos(a)*r*.9,y+Math.sin(a)*r*.9,r*.7,f,'#ffffff',.6);}return o+C(x,y,r*.55,c);};
    const heart=(x,y,s,f)=>P(`M${n(x)} ${n(y+s*.9)}C${n(x-s*1.6)} ${n(y-s*.1)} ${n(x-s*.7)} ${n(y-s*1.3)} ${n(x)} ${n(y-s*.4)}C${n(x+s*.7)} ${n(y-s*1.3)} ${n(x+s*1.6)} ${n(y-s*.1)} ${n(x)} ${n(y+s*.9)}Z`,f);
    const note=(x,y,f='#5a4a8a')=>E(x,y,4,3,f,'',0,rot(-20,x,y))+L(`M${n(x+3.5)} ${n(y-1)}V${n(y-15)}l6 3`,f,1.6);
    const shadow=(w=58)=>E(90,194,w,6,'#35503a','',0,op(.18));
    const sparkleSet=()=>star(20,30,7)+star(160,22,6)+star(166,128,5)+star(12,118,5)+star(92,6,5);

    /* ---------- 표정 ---------- */
    const INK='#2f3a28';
    function face(style,fx,fy,s=1){
      const d=10*s,e=3*s;
      const smile=(w=4)=>L(`M${n(fx-w*s)} ${n(fy+7*s)}Q${n(fx)} ${n(fy+11.5*s)} ${n(fx+w*s)} ${n(fy+7*s)}`,INK,2*s);
      const shine=(x,y,r)=>C(x,y,r,INK)+C(x-r*.35,y-r*.35,r*.38,'#ffffff');
      switch(style){
        case 'sparkle':return shine(fx-d,fy,e*1.6)+shine(fx+d,fy,e*1.6)+C(fx-d+e*.7,fy+e*.6,e*.25,'#ffffff')+C(fx+d+e*.7,fy+e*.6,e*.25,'#ffffff')+smile(4);
        case 'star':return star5(fx-d,fy,e*1.9,'#f7c948','#9a6f12')+star5(fx+d,fy,e*1.9,'#f7c948','#9a6f12')+P(`M${n(fx-6*s)} ${n(fy+7*s)}Q${n(fx)} ${n(fy+15*s)} ${n(fx+6*s)} ${n(fy+7*s)}Z`,'#7a3b34');
        case 'wink':return L(`M${n(fx-d-4*s)} ${n(fy)}q${n(4*s)} ${n(-5*s)} ${n(8*s)} 0`,INK,2.4*s)+shine(fx+d,fy,e*1.4)+P(`M${n(fx-5*s)} ${n(fy+7*s)}Q${n(fx)} ${n(fy+13*s)} ${n(fx+5*s)} ${n(fy+7*s)}Z`,'#7a3b34')+E(fx+3*s,fy+10.5*s,2.2*s,1.6*s,'#e88a8a');
        case 'cool':return P(`M${n(fx-d-5*s)} ${n(fy-2*s)}h${n(10*s)}v${n(3*s)}a${n(5*s)} ${n(4*s)} 0 0 1 ${n(-10*s)} 0z`,INK)+P(`M${n(fx+d-5*s)} ${n(fy-2*s)}h${n(10*s)}v${n(3*s)}a${n(5*s)} ${n(4*s)} 0 0 1 ${n(-10*s)} 0z`,INK)+L(`M${n(fx-5*s)} ${n(fy+8*s)}Q${n(fx+1*s)} ${n(fy+11*s)} ${n(fx+6*s)} ${n(fy+6*s)}`,INK,2*s);
        case 'sleepy':return L(`M${n(fx-d-4*s)} ${n(fy)}q${n(4*s)} ${n(4*s)} ${n(8*s)} 0M${n(fx+d-4*s)} ${n(fy)}q${n(4*s)} ${n(4*s)} ${n(8*s)} 0`,INK,2.2*s)+E(fx,fy+9*s,2.4*s,3*s,'#7a3b34')+`<text x="${n(fx+16*s)}" y="${n(fy-12*s)}" font-size="${n(12*s)}" font-family="Arial" font-weight="bold" fill="#6d7fb3">z</text><text x="${n(fx+24*s)}" y="${n(fy-20*s)}" font-size="${n(8*s)}" font-family="Arial" font-weight="bold" fill="#6d7fb3">z</text>`;
        case 'fierce':return L(`M${n(fx-d-5*s)} ${n(fy-7*s)}l${n(9*s)} ${n(3*s)}M${n(fx+d+5*s)} ${n(fy-7*s)}l${n(-9*s)} ${n(3*s)}`,INK,2.4*s)+shine(fx-d,fy,e*1.3)+shine(fx+d,fy,e*1.3)+P(`M${n(fx-7*s)} ${n(fy+6*s)}H${n(fx+7*s)}Q${n(fx+6*s)} ${n(fy+14*s)} ${n(fx)} ${n(fy+14*s)}Q${n(fx-6*s)} ${n(fy+14*s)} ${n(fx-7*s)} ${n(fy+6*s)}Z`,'#7a3b34')+P(`M${n(fx-6*s)} ${n(fy+6*s)}H${n(fx+6*s)}V${n(fy+8.5*s)}H${n(fx-6*s)}Z`,'#ffffff');
        case 'heart':return heart(fx-d,fy,e*1.5,'#e8506e')+heart(fx+d,fy,e*1.5,'#e8506e')+smile(5);
        case 'laugh':return L(`M${n(fx-d-4*s)} ${n(fy+1*s)}q${n(4*s)} ${n(-6*s)} ${n(8*s)} 0M${n(fx+d-4*s)} ${n(fy+1*s)}q${n(4*s)} ${n(-6*s)} ${n(8*s)} 0`,INK,2.4*s)+P(`M${n(fx-7*s)} ${n(fy+6*s)}Q${n(fx)} ${n(fy+8*s)} ${n(fx+7*s)} ${n(fy+6*s)}Q${n(fx+6*s)} ${n(fy+17*s)} ${n(fx)} ${n(fy+17*s)}Q${n(fx-6*s)} ${n(fy+17*s)} ${n(fx-7*s)} ${n(fy+6*s)}Z`,'#7a3b34')+E(fx,fy+14*s,4*s,2.4*s,'#e88a8a');
        case 'surprise':return C(fx-d,fy,e*1.5,'#ffffff',INK,1.6*s)+C(fx-d,fy,e*.8,INK)+C(fx+d,fy,e*1.5,'#ffffff',INK,1.6*s)+C(fx+d,fy,e*.8,INK)+E(fx,fy+10*s,3*s,4*s,'#7a3b34');
        case 'owl':return C(fx-11*s,fy,9*s,'#fffbe8','#5a4432',2*s)+C(fx+11*s,fy,9*s,'#fffbe8','#5a4432',2*s)+shine(fx-11*s,fy+1*s,4.4*s)+shine(fx+11*s,fy+1*s,4.4*s)+P(`M${n(fx-4*s)} ${n(fy+8*s)}L${n(fx+4*s)} ${n(fy+8*s)}L${n(fx)} ${n(fy+15*s)}Z`,'#f0a534','#a8671a',1);
        case 'panda':return E(fx-11*s,fy+1*s,7*s,8.5*s,'#2b2b2b','',0,rot(-20,fx-11*s,fy))+E(fx+11*s,fy+1*s,7*s,8.5*s,'#2b2b2b','',0,rot(20,fx+11*s,fy))+C(fx-10*s,fy,3*s,'#ffffff')+C(fx+10*s,fy,3*s,'#ffffff')+C(fx-9.6*s,fy+.4*s,1.6*s,INK)+C(fx+10.4*s,fy+.4*s,1.6*s,INK)+E(fx,fy+8*s,3.6*s,2.6*s,'#2b2b2b')+smile(3.5);
        default:return C(fx-d,fy,e,INK)+C(fx+d,fy,e,INK)+smile(4);
      }
    }

    /* ---------- 식물 변신 (Lv.15 신기한 식물 → Lv.20 고대·전설의 식물) ---------- */
    const trunk=(x,top,bot,wt,wb,c,d)=>P(`M${n(x-wb/2)} ${bot}Q${n(x-wt/2-3)} ${n((top+bot)/2)} ${n(x-wt/2)} ${top}H${n(x+wt/2)}Q${n(x+wt/2+3)} ${n((top+bot)/2)} ${n(x+wb/2)} ${bot}Z`,c,d,2);
    const petal=(cx,cy,r0,len,w,ang,f,s,sw=1.2)=>E(cx,cy-r0-len/2,w,len/2,f,s,sw,rot(ang,cx,cy));
    const patch=(x,y,rx=18,ry=13,c='#fdf3df')=>E(x,y,rx,ry,c);
    const blobs=(arr,c,d,w=2)=>arr.map(([x,y,r])=>C(x,y,r,c,d,w)).join('');
    const soil=(c='#6b5238')=>E(90,193,58,6,c,'',0,op(.22));
    const stem=(d,c='#4f7d3a',w=5)=>L(d,c,w);
    const F={};
    const def=(id,l15,l20)=>F[id]={l15,l20};

    /* ===== 마음꽃 · 해바라기 ===== */
    def('twinsun',
      {name:'당당한 라플레시아',face:[90,128],head:[90,70],neck:[90,150],st:'surprise',draw(){let a=soil();
        a+=G('translate(0 34) scale(1 .74)',[0,72,144,216,288].map(ang=>E(90,70,30,36,'#c2412f','#7a1f14',2.5,rot(ang,90,118))).join('')+(()=>{let o='';for(let i=0;i<5;i++)for(const [dx,dy,r] of [[-10,-28,5],[8,-34,4],[0,-44,6],[14,-22,3],[-16,-40,3]])o+=C(90+dx,118+dy,r,'#f5e6d8','',0,rot(i*72,90,118));return o;})());
        a+=E(90,122,30,20,'#8e2a1c','#5c160c',2)+E(90,118,24,13,'#f1d3c8');
        a+=leaf(34,190,-70,.5,'#6f8a4a')+leaf(146,190,70,.5,'#6f8a4a');return a;}},
      {name:'태양을 삼킨 타이탄 아룸',face:[90,100],head:[90,18],neck:[90,132],st:'star',fs:.95,draw(){let a=soil();
        a+=P('M24 190Q8 120 40 96Q60 110 70 140Q76 110 90 100Q104 110 110 140Q120 110 140 96Q172 120 156 190Z','#6b1f3a','#3f0c20',2.5);
        a+=P('M32 188Q22 132 44 110Q60 126 66 152M148 188Q158 132 136 110Q120 126 114 152','none','#a33a5a',3);
        a+=P('M40 190Q30 150 54 132Q66 150 90 150Q114 150 126 132Q150 150 140 190Z','#8a2a4a','#3f0c20',2);
        a+=P('M72 150Q70 60 80 20Q90 4 100 20Q110 60 108 150Z','#e9d38a','#a8871c',2.5);
        for(let y=36;y<140;y+=12)a+=L(`M${80-(y<60?0:2)} ${y}q10 3 20 0`,'#cdb46a',1.3);
        a+=patch(90,104,16,12,'#f8ecc0');
        a+=P('M24 190Q40 170 60 186M156 190Q140 170 120 186','none','#5f8a3a',4);return a;}});
    def('moonflower',
      {name:'날렵한 극락조화',face:[82,104],head:[96,40],neck:[82,126],st:'wink',draw(){let a=soil();
        a+=stem('M92 192Q90 150 86 118','#4f7d3a',6)+leaf(92,190,-40,1.05,'#4f8a4a')+leaf(92,190,34,.95,'#5f9a55');
        a+=P('M40 112Q86 92 140 104Q118 120 86 124Q56 124 40 112Z','#4f7d5a','#2f5a3a',2)+P('M44 112Q90 100 134 106','none','#c24a6a',2);
        for(const [ang,len] of [[-40,58],[-20,64],[0,60],[18,52]])a+=P(`M110 104Q${110-len*.25} ${104-len*.6} ${110+Math.sin(ang*Math.PI/180)*len} ${104-len}Q${118+Math.sin(ang*Math.PI/180)*len*.6} ${104-len*.55} 116 104Z`,'#f28b1f','#b85a0a',1.5);
        a+=P('M112 104Q124 70 150 58Q134 80 120 106Z','#3f6fd0','#23408a',1.5);
        a+=patch(82,108,17,11,'#e6f3dc');return a;}},
      {name:'해를 품은 부상목',face:[90,150],head:[90,14],neck:[90,172],st:'star',draw(){let a=soil();
        a+=C(90,70,64,'#ffd36a','',0,op(.35));
        a+=trunk(90,96,192,22,40,'#b8642a','#7a3a14')+L('M90 120L56 80M90 110L126 74M90 132L40 110M90 128L142 106','#b8642a',6);
        for(const [x,y,r] of [[56,76,18],[126,70,20],[40,106,14],[142,102,14],[90,44,22]]){a+=C(x,y,r+6,'#ffb23a','',0,op(.35));a+=C(x,y,r,'#ffcf4a','#e08a1a',2);for(let i=0;i<10;i++)a+=P(`M${x} ${y-r-2}l3 -7 3 7Z`,'#ff9a2a','',0,rot(i*36,x,y));}
        a+=patch(90,152,16,12,'#ffe7c2');return a;}});
    /* ===== 장미 ===== */
    def('crimsonrose',
      {name:'배고픈 파리지옥',face:[90,108],head:[90,52],neck:[90,146],st:'fierce',draw(){let a=soil();
        const trap=(x,y,s,ang)=>G(`translate(${x} ${y}) rotate(${ang}) scale(${s})`,P('M0 0Q-40 -10 -44 -46Q-20 -30 0 -30Z','#7fb24a','#4c7a2a',2)+P('M0 0Q40 -10 44 -46Q20 -30 0 -30Z','#7fb24a','#4c7a2a',2)+P('M0 -4Q-34 -12 -38 -42Q-18 -30 0 -32Q18 -30 38 -42Q34 -12 0 -4Z','#e0504a')+(()=>{let o='';for(let i=0;i<7;i++){o+=L(`M${-44+i*6} ${-46+i*2.4}l-3 -8`,'#c8e27a',1.5)+L(`M${44-i*6} ${-46+i*2.4}l3 -8`,'#c8e27a',1.5);}return o;})());
        a+=trap(40,176,.6,-50)+trap(140,176,.6,50)+trap(64,160,.5,-20)+trap(118,160,.5,20);
        a+=stem('M90 192V150','#4c7a2a',8);
        a+=P('M90 150Q30 136 26 70Q64 92 90 88Z','#8cc255','#4c7a2a',2.5)+P('M90 150Q150 136 154 70Q116 92 90 88Z','#8cc255','#4c7a2a',2.5);
        a+=P('M90 146Q38 132 34 80Q66 98 90 96Q114 98 146 80Q142 132 90 146Z','#e86a64');
        for(let i=0;i<9;i++){a+=L(`M${26+i*4} ${70+i*3}l-6 -10`,'#d9ef8a',2)+L(`M${154-i*4} ${70+i*3}l6 -10`,'#d9ef8a',2);}
        for(const [x,y] of [[70,118],[110,118],[90,130]])a+=L(`M${x} ${y}v-6`,'#f7b0a8',1.5);
        return a;}},
      {name:'태고의 거대 벌레잡이통풀',face:[90,122],head:[90,36],neck:[90,160],st:'laugh',draw(){let a=soil('#3f5a3a');
        a+=L('M10 40Q60 10 90 30Q130 6 172 30','#4c7a2a',4)+leaf(34,34,-110,.5,'#5f9a45')+leaf(150,26,110,.5,'#5f9a45');
        const pit=(x,y,s,c1,c2)=>G(`translate(${x} ${y}) scale(${s})`,P('M-18 -40Q-26 0 -16 30Q0 44 16 30Q26 0 18 -40Z',c1,'#6a4a1a',2)+E(0,-40,20,7,'#b8302a','#6a1a14',2)+E(0,-40,13,4,'#3a1a0a')+P('M-14 -46Q0 -70 20 -52Q6 -54 -14 -46Z',c2,'#6a4a1a',1.5)+C(-8,-10,3,'#b8302a')+C(8,4,2.5,'#b8302a'));
        a+=L('M40 38Q30 70 36 100M150 34Q160 70 146 110','#4c7a2a',2.5)+pit(36,128,.6,'#c9d86a','#8ab34a')+pit(146,138,.55,'#e0a84a','#b8842a');
        a+=L('M90 30Q84 50 90 70','#4c7a2a',3);
        a+=P('M62 80Q50 140 66 176Q90 196 114 176Q130 140 118 80Z','#b9cf5a','#6a7a2a',2.5)+E(90,80,30,10,'#b8302a','#6a1a14',2.5)+E(90,80,21,6,'#3a1a0a');
        for(let i=0;i<9;i++)a+=L(`M${63+i*6.5} ${82+Math.sin(i/8*Math.PI)*6}v5`,'#6a1a14',1.4);
        a+=P('M62 74Q86 36 128 58Q104 58 62 74Z','#8ab34a','#4c7a2a',2);
        for(const [x,y,r] of [[70,140,4],[110,150,5],[80,170,3],[104,120,3]])a+=C(x,y,r,'#c2412f',op(.8));
        a+=patch(90,124,17,12,'#f3f5d0');return a;}});
    def('bluerose',
      {name:'째깍째깍 시계꽃',face:[90,92],head:[90,38],neck:[90,128],st:'sparkle',draw(){let a=soil();
        a+=stem('M90 192Q70 160 88 124','#4f7d3a',5)+L('M78 160q-20 -6 -18 -20q4 -8 10 -2','#6f9e57',2)+leaf(80,168,-70,.8,'#5f9a55')+leaf(88,150,60,.7,'#5f9a55');
        for(let i=0;i<10;i++)a+=petal(90,92,8,40,10,i*36+18,'#f4f0fb','#b9a8d6');
        for(let i=0;i<36;i++){const ang=i*10;a+=L(`M90 ${92-24}v-18`,i%2?'#6a3fb0':'#b98ae8',1.8,rot(ang,90,92))+L(`M90 ${92-38}v-6`,'#ffffff',1.6,rot(ang,90,92));}
        a+=C(90,92,24,'#8a5ac8','#5a2f90',1.5)+C(90,92,19,'#f0e2ff');
        a+=L('M90 72V58M90 58L80 50M90 58L100 50M90 58V46','#6a9a3a',2.5)+C(80,50,3,'#8a5a2a')+C(100,50,3,'#8a5a2a')+C(90,45,3,'#8a5a2a');
        return a;}},
      {name:'하늘에서 내린 만다라화',face:[90,98],head:[90,30],neck:[90,138],st:'sparkle',draw(){let a='';
        a+=cloud(90,186,1.7,'#ffffff',.95);
        for(let i=0;i<16;i++)a+=petal(90,98,20,50,10,i*22.5,i%2?'#f7e6ff':'#e2c8ff','#b08ad8');
        for(let i=0;i<8;i++)a+=petal(90,98,12,32,9,i*45+11,'#ffffff','#d6c2f0');
        a+=C(90,98,22,'#fff3b0','#e0b84a',2);
        for(const [x,y,r] of [[22,40,10],[156,30,9],[20,120,8],[162,128,9],[132,176,7],[48,172,7]])a+=G(`rotate(${x} ${x} ${y})`,(()=>{let o='';for(let i=0;i<8;i++)o+=petal(x,y,2,r,r*.3,i*45,'#f0dcff','#c7a8e8',.8);return o+C(x,y,r*.3,'#fff3b0');})());
        return a;}});
    /* ===== 무궁화 ===== */
    def('hongdansim',
      {name:'고요한 연꽃',face:[90,98],head:[90,34],neck:[90,132],st:'laugh',draw(){let a='';
        a+=E(90,186,84,14,'#9fd3ea','#5a9ac0',2)+E(56,176,34,10,'#5f9a55','#3f6d3c',2)+P('M56 176L64 166','none','#9fd3ea',3);
        a+=stem('M100 184Q108 150 96 128','#4f7d3a',5);
        for(let i=0;i<7;i++)a+=P('M90 128Q64 104 76 60Q90 76 90 128Z','#f7a8c4','#d86a92',1.5,rot(-66+i*22,90,128));
        for(let i=0;i<5;i++)a+=P('M90 124Q74 106 82 74Q92 90 90 124Z','#ffd2e2','#e88aac',1.2,rot(-44+i*22,90,124));
        a+=P('M72 100Q90 88 108 100L104 112Q90 118 76 112Z','#e9d86a','#a8971c',1.5);
        a+=patch(90,100,15,10,'#fff6d6');return a;}},
      {name:'천년 잠에서 깬 아라홍련',face:[90,96],head:[90,26],neck:[90,132],st:'star',draw(){let a='';
        a+=E(90,184,86,16,'#7fbfdc','#4a8ab0',2);
        a+=E(90,176,70,12,'#5fa05a','#2f6d3a',2.5)+E(90,172,62,8,'#7fbf6a')+L('M28 176Q90 158 152 176','#3f7d3a',1.5);
        for(const x of [42,138])a+=C(x,160,10,'#f2c8d8','#d8849f',1.5,op(.8));
        a+=stem('M90 170V130','#4f7d3a',6);
        for(let i=0;i<9;i++)a+=P('M90 130Q52 104 64 44Q90 70 90 130Z','#f28bb0','#b8416a',1.8,rot(-80+i*20,90,130));
        for(let i=0;i<7;i++)a+=P('M90 126Q68 104 76 64Q92 84 90 126Z','#ffc4d8','#e0729a',1.4,rot(-54+i*18,90,126));
        a+=P('M70 98Q90 84 110 98L106 114Q90 122 74 114Z','#e9d86a','#a8971c',1.5);
        a+=patch(90,98,15,10,'#fff6d6');return a;}});
    def('baekdansim',
      {name:'나풀나풀 호접란',face:[96,88],head:[96,42],neck:[96,120],st:'sparkle',draw(){let a=soil();
        a+=E(70,186,34,9,'#3f7d4a','#2a5a34',2,rot(-10,70,186))+E(114,184,32,9,'#4f8d5a','#2a5a34',2,rot(14,114,184));
        a+=L('M84 184Q60 80 128 40Q156 30 160 60','#5a7a3a',3);
        const moth=(x,y,s,c,lip)=>G(`translate(${x} ${y}) scale(${s})`,E(-17,-6,16,13,c,'#c8a0c0',1.2,rot(-25,-17,-6))+E(17,-6,16,13,c,'#c8a0c0',1.2,rot(25,17,-6))+E(-12,10,11,9,c,'#c8a0c0',1.2)+E(12,10,11,9,c,'#c8a0c0',1.2)+E(0,-20,8,12,c,'#c8a0c0',1.2)+P('M-7 10Q0 26 7 10Q0 16 -7 10Z',lip));
        a+=moth(150,62,.6,'#ffffff','#e0508a')+moth(128,48,.7,'#fff0f6','#e0508a');
        a+=moth(96,90,1.35,'#fff5fa','#d83f7a');
        a+=patch(96,90,15,10,'#fffbfd');return a;}},
      {name:'일곱 보석 칠보수',face:[90,150],head:[90,14],neck:[90,172],st:'star',draw(){let a=soil();
        a+=C(90,70,70,'#e8e0ff','',0,op(.35));
        a+=trunk(90,100,192,18,34,'#c9c2d6','#7d7390')+L('M90 120L50 84M90 112L132 76M90 130L36 118M90 126L146 112M90 104V50','#c9c2d6',5);
        const gems=[['#e8403a',50,84],['#f2a33a',132,76],['#f6d66b',36,118],['#5fc46a',146,112],['#4f9ae8',90,48],['#8a5ae0',66,62],['#f07ab8',116,52]];
        for(const [c,x,y] of gems)a+=P(`M${x} ${y-12}L${x+10} ${y-3}L${x+6} ${y+10}H${x-6}L${x-10} ${y-3}Z`,c,'#ffffff',1.5)+P(`M${x-4} ${y-6}L${x} ${y-10}L${x+4} ${y-6}`,'none','#ffffff',1.5)+L(`M${x} ${y-12}v-5`,'#c9c2d6',2);
        for(let i=0;i<12;i++)a+=leaf(90+Math.sin(i*2.4)*56,80+Math.cos(i*2.4)*30,i*33,.3,'#b9d6c8','#6f9a88');
        a+=patch(90,152,14,11,'#f4f1fa');return a;}});
    /* ===== 마음송이 · 신비한 버섯 ===== */
    def('goldmatsutake',
      {name:'신비한 동충하초',face:[90,146],head:[90,30],neck:[90,166],st:'wink',draw(){let a='';
        a+=P('M20 192Q90 172 160 192Z','#8a6a4a')+P('M40 184Q90 170 140 184Q128 196 90 196Q52 196 40 184Z','#b89a6a','#7a5a3a',1.5);
        for(let i=0;i<10;i++)a+=L(`M${50+i*9} 186q2 -4 4 0`,'#7a5a3a',1);
        const club=(x,top,w,c)=>P(`M${x-w*.25} 184Q${x-w*.2} ${top+40} ${x-w*.45} ${top+18}Q${x-w*.6} ${top} ${x} ${top-6}Q${x+w*.6} ${top} ${x+w*.45} ${top+18}Q${x+w*.2} ${top+40} ${x+w*.25} 184Z`,c,'#a8501a',2);
        a+=club(48,70,20,'#f28b3a')+club(132,60,22,'#f07a2a')+club(66,40,18,'#ffa34a')+club(116,46,18,'#ffa34a');
        a+=club(90,20,40,'#ff9a3a');
        for(const [x,y] of [[82,40],[98,52],[86,66],[96,30],[90,80]])a+=C(x,y,2.4,'#ffd08a');
        a+=patch(90,148,14,11,'#fff0dc');return a;}},
      {name:'산신령의 천년 산삼',face:[90,150],head:[90,26],neck:[90,176],st:'laugh',draw(){let a=soil();
        a+=stem('M90 120V70','#5f8a3a',4);
        for(const ang of [-60,0,60])for(let k=0;k<5;k++)a+=leaf(90,70,ang+(k-2)*18,.55,'#5f9a45');
        a+=C(90,56,10,'#e8403a','#8a1f1f',1.5)+[[-8,-6],[8,-6],[0,-12],[-5,4],[6,5]].map(([dx,dy])=>C(90+dx,56+dy,4.5,'#ff5a4a','#8a1f1f',1)).join('');
        a+=P('M76 120Q66 150 72 172Q80 186 90 180Q100 186 108 172Q114 150 104 120Q90 112 76 120Z','#f3e0b8','#b8955a',2.5);
        a+=L('M74 168Q56 176 44 192M106 168Q124 176 136 192M84 180Q80 192 70 198M96 180Q100 192 110 198M72 140Q54 140 44 150M108 140Q126 138 136 150','#d9c090',3);
        for(let y=126;y<170;y+=8)a+=L(`M78 ${y}q12 3 24 0`,'#d9c090',1.2);
        a+=patch(90,150,13,10,'#fdf3de');return a;}});
    def('twinmatsutake',
      {name:'레이스 두른 망태버섯',face:[90,96],head:[90,34],neck:[90,114],st:'star',draw(){let a=soil();
        a+=P('M78 190V80H102V190Z','#fbf6ec','#c9c0ae',2);
        a+=P('M66 80Q66 44 90 42Q114 44 114 80Z','#5a5a3a','#3a3a22',2)+C(90,46,4,'#fbf6ec');
        let net='';for(let i=0;i<8;i++){const t=i/7;net+=L(`M${n(76-t*50)} ${n(84+t*96)}`,'none',0);}
        a+=P('M76 84Q40 130 26 186H154Q140 130 104 84Z','#ffffff','#e0dccf',1.5,op(.55));
        for(let r=0;r<8;r++){const y=92+r*12,w=20+r*9;for(let k=0;k<=r+3;k++){const x=90-w+k*(2*w/(r+3));a+=E(x,y,5,4,'none','#f0ebdc',1.8);}}
        a+=patch(90,98,12,10,'#fffdf8');return a;}},
      {name:'춤추는 요정의 고리',face:[90,120],head:[90,62],neck:[90,146],st:'sparkle',draw(){let a='';
        a+=E(90,176,84,20,'#8fc07a','#5f8a4a',2)+E(90,176,64,13,'#a8d48f');
        const m=(x,y,s,c)=>G(`translate(${x} ${y}) scale(${s})`,R(-5,-14,10,16,4,'#fbf3e0','#c9b89a',1.2)+P('M-16 -12Q-14 -30 0 -30Q14 -30 16 -12Z',c,'#8a5a3a',1.5)+C(-6,-20,2,'#ffffff')+C(5,-24,1.6,'#ffffff'));
        for(let i=0;i<12;i++){const ang=i/12*Math.PI*2;a+=m(90+Math.cos(ang)*70,178+Math.sin(ang)*16,.9+(Math.sin(ang)+1)*.15,i%2?'#e87a6a':'#f6c05a');}
        for(let i=0;i<7;i++)a+=C(40+i*16,70+Math.sin(i)*20,2.5,'#fff3a8',op(.9))+C(40+i*16,70+Math.sin(i)*20,6,'#fff3a8',op(.25));
        a+=R(80,110,20,56,6,'#fbf3e0','#c9b89a',2)+P('M52 116Q56 64 90 62Q124 64 128 116Q90 126 52 116Z','#c77adf','#7a3a9a',2.5);
        for(const [x,y,r] of [[70,90,5],[104,80,6],[90,100,4],[116,104,4]])a+=C(x,y,r,'#f7e6ff');
        a+=patch(90,124,13,10,'#fffaf0');return a;}});
    def('firehorn',
      {name:'반짝이는 야광버섯',face:[90,92],head:[90,40],neck:[90,112],st:'surprise',draw(){let a='';
        a+=C(90,110,86,'#1f3a4a','',0,op(.2));
        a+=P('M14 192Q20 172 60 170H130Q166 172 170 192Z','#6b4a32','#3f2a1a',2)+L('M30 182h40M100 180h50','#8a6a4a',1.5);
        const bell=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,C(0,-10,22,'#9ff0d0','',0,op(.3))+L('M0 0V34','#e0fff0',2.5)+P('M-14 0Q-12 -22 0 -22Q12 -22 14 0Q7 -4 0 0Q-7 -4 -14 0Z','#7ff0c0','#2fa080',1.2));
        a+=bell(46,142,.8)+bell(134,138,.9)+bell(62,120,.6)+bell(118,116,.65)+bell(150,160,.5)+bell(32,160,.5);
        a+=L('M90 172V104','#e0fff0',5)+C(90,86,36,'#9ff0d0','',0,op(.3));
        a+=P('M58 106Q60 58 90 56Q120 58 122 106Q106 98 90 106Q74 98 58 106Z','#7ff0c0','#2fa080',2);
        a+=patch(90,94,15,10,'#e8fff6');return a;}},
      {name:'태고의 거인 프로토택사이트',face:[90,120],head:[90,10],neck:[90,150],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#8a7a5a');
        for(const [x,h] of [[22,120],[160,100]])a+=P(`M${x-8} 194V${194-h}Q${x} ${190-h-12} ${x+8} ${194-h}V194Z`,'#b9a88a','#7a6a4a',2,op(.7));
        a+=P('M64 194V30Q64 8 90 6Q116 8 116 30V194Z','#d8c8a4','#8a7650',3);
        for(let y=26;y<190;y+=14)a+=L(`M66 ${y}q24 6 48 0`,'#b8a67e',1.5);
        for(let y=40;y<190;y+=30)a+=L(`M70 ${y}v12M110 ${y+10}v12`,'#a89468',1.5);
        a+=leaf(30,194,-40,.4,'#6f9a4a')+leaf(150,194,40,.35,'#6f9a4a')+leaf(40,194,20,.3,'#8ab35a');
        a+=patch(90,122,15,11,'#f4ecd8');return a;}});
    def('icehorn',
      {name:'퐁퐁 뿜는 먼지버섯',face:[90,136],head:[90,96],neck:[90,160],st:'heart',draw(){let a=soil();
        for(let i=0;i<8;i++)a+=P('M90 160L72 150Q60 176 90 186Q120 176 108 150Z','#b89a6a','#7a5a3a',2,rot(i*45,90,160));
        a+=G('translate(0 40) scale(1 .75)',(()=>{let o='';for(let i=0;i<8;i++)o+=P('M90 160L80 130Q90 80 100 130Z','#c9a878','#7a5a3a',2,rot(i*45+22,90,160));return o;})());
        a+=C(90,138,26,'#d8c0a0','#8a6a4a',2.5)+C(90,114,4,'#8a6a4a');
        for(let i=0;i<5;i++)a+=C(84+i*4,100-i*8,3+i,'#d8c8b0',op(.6));
        a+=patch(90,140,14,10,'#f6ecdc');return a;}},
      {name:'만년설 속 천산 설련화',face:[90,110],head:[90,36],neck:[90,146],st:'sparkle',draw(){let a='';
        a+=P('M14 194L46 140L66 164L92 118L122 166L140 148L168 194Q90 202 14 194Z','#e8eef8','#b9c7de',2)+P('M46 140L53 152L39 153ZM92 118L101 134L83 135Z','#ffffff');
        for(let i=0;i<14;i++)a+=petal(90,112,6,56,15,i*25.7,'#f4f8e8','#b9c89a');
        for(let i=0;i<8;i++)a+=petal(90,112,4,38,12,i*45+10,'#fbfdf2','#c9d6a8');
        a+=C(90,112,20,'#b98ad8','#6a3a90',1.5)+C(90,112,16,'#e6d4f6');
        for(const [x,y] of [[20,40],[150,30],[160,90],[30,100]])a+=star(x,y,4,'#ffffff','#b9c7de');
        return a;}});
    def('redreishi',
      {name:'단단한 말굽버섯',face:[90,110],head:[90,60],neck:[90,140],st:'cool',draw(){let a='';
        a+=trunk(90,20,194,56,64,'#8a6a4a','#5a4228')+L('M72 30V190M104 40V186','#6f5236',1.5);
        a+=P('M40 126Q40 84 90 80Q140 84 140 126Q90 136 40 126Z','#9a8a70','#5a4a34',2.5)+P('M40 126Q90 118 140 126Q90 146 40 126Z','#f0e0c0','#8a7650',2);
        a+=P('M50 104Q90 96 130 104','none','#c9b89a',3)+P('M46 116Q90 108 134 116','none','#6a5a44',2.5);
        a+=P('M58 72Q58 48 90 46Q122 48 122 72Q90 80 58 72Z','#8a7a60','#5a4a34',2)+P('M58 72Q90 66 122 72Q90 84 58 72Z','#e8d8b8');
        a+=patch(90,112,14,9,'#f6ead4');return a;}},
      {name:'진시황이 찾던 불로초',face:[90,120],head:[90,56],neck:[90,150],st:'star',draw(){let a='';
        a+=cloud(34,170,.8,'#ffffff',.9)+cloud(148,176,.9,'#ffffff',.9);
        a+=L('M90 194Q100 160 88 140','#7a2a1a',12)+L('M92 180Q60 160 56 130','#7a2a1a',7)+L('M94 176Q126 150 130 118','#7a2a1a',7);
        const cap=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,P('M-40 6C-44 -22 -18 -34 0 -24C18 -34 44 -22 40 6Q0 16 -40 6Z','#b8352c','#f0c068',5)+P('M-30 2C-32 -16 -14 -24 0 -16C14 -24 32 -16 30 2Q0 10 -30 2Z','#8a1f1c','#d9675a',3)+P('M-18 -2C-18 -10 -8 -14 0 -8C8 -14 18 -10 18 -2Q0 3 -18 -2Z','#6a1210'));
        a+=cap(56,128,.7)+cap(130,116,.75)+cap(90,120,1.15);
        a+=C(90,120,40,'#ffd36a','',0,op(.15));
        a+=patch(90,122,15,9,'#fbe6c8');return a;}});
    def('nightreishi',
      {name:'수줍은 먹물버섯',face:[90,82],head:[90,24],neck:[90,132],st:'sleepy',draw(){let a=soil();
        a+=R(82,120,16,72,6,'#fbf8f0','#c9c0ae',2);
        a+=P('M62 124Q58 60 66 34Q90 12 114 34Q122 60 118 124Z','#f4f0e6','#b9b09a',2.5);
        for(let r=0;r<6;r++)for(let k=0;k<4;k++)a+=P(`M${68+k*12+(r%2?6:0)} ${40+r*14}q4 6 8 0`,'none','#c9b89a',1.5);
        a+=P('M62 124Q66 134 70 126Q74 138 80 126Q86 140 92 126Q98 138 104 126Q110 136 114 126Q118 132 118 124Z','#2a2a3a');
        for(const [x,l] of [[68,14],[86,20],[106,12]])a+=P(`M${x} 130q-3 ${l} 0 ${l+4}q3 -4 0 -${l+4}Z`,'#2a2a3a');
        a+=patch(90,84,15,10,'#fffdf6');return a;}},
      {name:'한밤의 도깨비불 버섯',face:[90,108],head:[90,50],neck:[90,140],st:'laugh',draw(){let a='';
        a+=C(90,110,86,'#1a2a4a','',0,op(.2));
        for(const [x,y,r] of [[26,60,10],[154,50,9],[20,130,8],[160,120,9],[60,30,6],[124,26,6]])a+=C(x,y,r+8,'#7fd8ff','',0,op(.2))+C(x,y,r,'#bff0ff','#6fd0e6',1.2)+P(`M${x-r*.7} ${y-r*.3}Q${x} ${y-r*2.4} ${x+r*.7} ${y-r*.3}Z`,'#dff8ff',op(.9));
        a+=L('M90 192Q84 160 90 136','#dff8ff',8);
        a+=C(90,104,50,'#7fd8ff','',0,op(.25));
        a+=P('M46 128Q42 62 90 58Q138 62 134 128Q112 118 90 128Q68 118 46 128Z','#5fc0e8','#2a7aa8',2.5);
        for(const [x,y,r] of [[64,88,5],[112,82,6],[88,72,4],[74,110,3],[116,108,4]])a+=C(x,y,r,'#dff8ff');
        a+=patch(90,110,15,10,'#e8fbff');return a;}});
    /* ===== 마음담이 · 다육 ===== */
    def('pinkwave',
      {name:'통통한 에케베리아',face:[90,128],head:[90,70],neck:[90,160],st:'laugh',draw(){let a=soil();
        for(let i=0;i<11;i++)a+=petal(90,140,4,50,16,i*32.7,'#9fc0b8','#6f9088',1.5);
        for(let i=0;i<9;i++)a+=petal(90,138,2,38,13,i*40+18,'#b8d4cc','#7f9f97',1.5);
        for(let i=0;i<7;i++)a+=petal(90,136,0,26,10,i*51+8,'#cfe4dd','#8faba3',1.2);
        for(let i=0;i<11;i++){const ang=(i*32.7-90)*Math.PI/180;a+=C(90+Math.cos(ang)*54,140+Math.sin(ang)*54,3.5,'#f08aa8');}
        a+=patch(90,132,15,10,'#effaf5');return a;}},
      {name:'천년을 사는 웰위치아',face:[90,160],head:[90,120],neck:[90,176],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#e8c890');
        a+=P('M76 170Q30 150 10 176Q4 190 30 186Q20 176 40 172Q56 176 70 180Z','#6f8a3a','#3f5a1a',2)+L('M70 174Q40 162 20 180','#9ab45a',1.5)+P('M12 184q-6 6 2 8M22 186q-2 8 6 6','none','#8a6a3a',2);
        a+=P('M104 170Q150 150 170 176Q176 190 150 186Q160 176 140 172Q124 176 110 180Z','#6f8a3a','#3f5a1a',2)+L('M110 174Q140 162 160 180','#9ab45a',1.5)+P('M168 184q6 6 -2 8M158 186q2 8 -6 6','none','#8a6a3a',2);
        a+=P('M60 190Q56 150 90 144Q124 150 120 190Z','#8a5a3a','#5a3a1a',2.5);
        for(const [x,y] of [[76,140],[104,138],[90,132]])a+=L(`M${x} 146Q${x} ${y} ${x+(x<90?-10:10)} ${y-20}`,'#8a5a3a',2.5)+C(x+(x<90?-10:10),y-22,6,'#c2412f','#7a1f14',1.5)+C(x+(x<90?-10:10),y-22,3,'#e8703a');
        a+=patch(90,164,14,10,'#f3e0c8');return a;}});
    def('silverwave',
      {name:'동글동글 녹영',face:[90,74],head:[90,30],neck:[90,98],st:'sleepy',draw(){let a='';
        for(let s=0;s<9;s++){const x=46+s*11,len=70+(s%3)*30;for(let k=0;k<len/10;k++)a+=C(x+Math.sin(k*.6+s)*4,86+k*10,4.8,k%2?'#8cc46a':'#9fd67a','#4f8a3a',1);}
        a+=C(90,74,38,'#9fd67a','#4f8a3a',2);
        for(let i=0;i<14;i++)a+=C(90+Math.cos(i*.45)*30,74+Math.sin(i*.45)*22,6,'#b4e38c','#4f8a3a',1);
        a+=patch(90,76,16,11,'#f0fbe6');return a;}},
      {name:'고생대의 칼라미테스',face:[90,140],head:[90,6],neck:[90,164],st:'star',fs:.95,draw(){let a='';
        a+=E(90,194,68,8,'#5a7a4a');
        const horse=(x,top,w,col)=>{let o=R(x-w/2,top,w,194-top,w/2.5,col,'#3f5a2a',1.8);for(let y=top+20;y<190;y+=22){o+=L(`M${x-w/2} ${y}h${w}`,'#3f5a2a',2);for(let k=-3;k<=3;k++)if(k)o+=L(`M${x} ${y}l${k*9} -10`,'#6f9a4a',1.6);}return o;};
        a+=horse(30,70,10,'#8ab35a')+horse(150,50,10,'#8ab35a')+horse(56,40,12,'#7aa84a')+horse(126,30,12,'#7aa84a');
        a+=horse(90,10,34,'#9ac45a');
        a+=patch(90,142,14,10,'#eef8d8');return a;}});
    def('bloomeuphorbia',
      {name:'뜨거운 사막의 장미',face:[90,150],head:[90,60],neck:[90,176],st:'wink',draw(){let a=soil();
        a+=P('M58 192Q40 150 64 124Q90 110 116 124Q140 150 122 192Z','#c9a878','#8a6a3a',2.5);
        a+=L('M78 124Q70 96 56 80M100 122Q110 92 130 76M90 118V88','#b8956a',7);
        for(const [x,y] of [[56,76],[130,72],[90,84]])for(let k=0;k<4;k++)a+=leaf(x,y,-60+k*40,.4,'#5f9a45');
        const tr=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,[0,72,144,216,288].map(ang=>E(0,-12,9,12,'#f26a9a','#b8386a',1.2,rot(ang,0,0))).join('')+C(0,0,6,'#fff0f6'));
        a+=tr(50,62,1)+tr(134,58,1)+tr(92,64,.9)+tr(70,50,.7)+tr(114,44,.7);
        a+=patch(90,152,15,11,'#f2e2c4');return a;}},
      {name:'거꾸로 선 바오밥나무',face:[90,140],head:[90,20],neck:[90,168],st:'laugh',draw(){let a='';
        a+=E(90,194,68,8,'#e0b870');
        a+=P('M50 194Q34 120 58 70H122Q146 120 130 194Z','#c9a07a','#7a5a3a',3);
        for(const x of [70,90,110])a+=L(`M${x} 80Q${x+4} 140 ${x} 190`,'#b08a64',1.5);
        a+=L('M62 72L40 44M62 72L56 30M90 70V26M118 72L124 30M118 72L142 44','#b08a64',7);
        for(const [x,y] of [[40,40],[56,26],[90,22],[124,26],[142,40]])a+=blobs([[x,y,14]],'#6f9a4a','#4f7348',1.5);
        for(const [x,y] of [[48,54],[134,56]])a+=L(`M${x} ${y}v14`,'#8a6a3a',1.5)+E(x,y+22,6,8,'#ffffff','#c9c0ae',1.2);
        a+=patch(90,142,17,12,'#f2dcc0');return a;}});
    def('violeteuphorbia',
      {name:'돌인 척하는 리톱스',face:[90,150],head:[90,84],neck:[90,170],st:'surprise',draw(){let a='';
        a+=E(90,194,68,8,'#d8c090');for(const [x,y] of [[20,190],[160,188],[40,198]])a+=E(x,y,7,4,'#b8a070');
        a+=P('M46 190Q40 120 88 116V190Z','#c9b0a8','#8a6a64',2.5)+P('M134 190Q140 120 92 116V190Z','#c2a8a0','#8a6a64',2.5);
        a+=P('M50 132Q60 118 86 118V134Q66 138 50 132Z','#a8847c',op(.6))+P('M130 132Q120 118 94 118V134Q114 138 130 132Z','#a8847c',op(.6));
        for(let i=0;i<10;i++)a+=petal(90,102,2,20,4.5,i*36,'#ffffff','#e0d8c8',.8);a+=C(90,102,6,'#f6d66b');
        a+=L('M90 108V118','#8a6a64',2);
        a+=patch(90,152,16,11,'#f4ece6');return a;}},
      {name:'최초의 식물 쿡소니아',face:[90,164],head:[90,40],neck:[90,180],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#6b5a4a')+E(40,186,20,5,'#9fd3ea',op(.7))+E(146,188,16,4,'#9fd3ea',op(.7));
        const fork=(x,y,len,ang,depth)=>{if(!depth)return C(x,y,6,'#e0b84a','#8a6a1a',1.5);const x2=x+Math.sin(ang)*len,y2=y-Math.cos(ang)*len;return L(`M${n(x)} ${n(y)}L${n(x2)} ${n(y2)}`,'#6f9a3a',5-depth*.5)+fork(x2,y2,len*.72,ang-.45,depth-1)+fork(x2,y2,len*.72,ang+.45,depth-1);};
        a+=fork(90,172,42,0,4)+fork(50,188,26,-.2,3)+fork(134,188,26,.2,3);
        a+=E(90,176,26,16,'#8ab35a','#4f7d3a',2);
        a+=patch(90,168,14,10,'#eef8d8');return a;}});
    def('bloomcactus',
      {name:'폭신한 토끼귀 선인장',face:[90,146],head:[90,62],neck:[90,176],st:'laugh',draw(){let a=soil();
        const pad=(x,y,rx,ry,ang)=>E(x,y,rx,ry,'#8cb86a','#4f7d3a',2.5,rot(ang,x,y))+(()=>{let o='';for(let i=0;i<9;i++)o+=C(x+Math.cos(i*1.3)*rx*.6,y+Math.sin(i*1.9)*ry*.6,2.2,'#f4ecc0',op(.9));return o;})();
        a+=pad(90,150,36,40,0)+pad(66,96,18,26,-22)+pad(114,96,18,26,22);
        a+=bloom(66,70,6,'#f6d66b','#f28b3a')+bloom(114,70,6,'#f6d66b','#f28b3a');
        a+=patch(90,148,15,11,'#f0f8e2');return a;}},
      {name:'용의 피를 품은 용혈수',face:[90,150],head:[90,10],neck:[90,172],st:'cool',draw(){let a='';
        a+=E(90,194,68,8,'#d0a870');
        a+=trunk(90,110,194,20,34,'#b8a07a','#6a5a3a');
        for(const [x,y] of [[40,78],[64,70],[90,66],[116,70],[140,78]])a+=L(`M90 112Q${(x+90)/2} ${y+30} ${x} ${y}`,'#b8a07a',6);
        a+=P('M10 86Q20 20 90 14Q160 20 170 86Q90 100 10 86Z','#4f8a4a','#2f5a2a',2.5);
        for(let i=0;i<20;i++)a+=L(`M${14+i*8} 86l-2 -12`,'#6fb35a',2);
        for(const [x,y] of [[70,130],[108,140],[84,172]])a+=P(`M${x} ${y}q-4 8 0 10q4 -2 0 -10Z`,'#c0203f');
        a+=patch(90,152,14,11,'#f2e6cc');return a;}});
    def('goldcactus',
      {name:'달밤의 월하미인',face:[90,76],head:[90,18],neck:[90,112],st:'sparkle',draw(){let a=soil();
        a+=C(150,30,18,'#fff4c8',op(.9));
        a+=P('M60 192Q56 150 70 120Q78 150 70 192Z','#6fa35a','#3f6d3c',2)+P('M120 192Q126 146 110 118Q102 150 110 192Z','#6fa35a','#3f6d3c',2)+P('M86 192Q80 150 90 110Q100 150 94 192Z','#7fb36a','#3f6d3c',2);
        a+=L('M90 112Q100 100 92 94','#b8704a',3);
        for(let i=0;i<14;i++)a+=petal(90,76,12,34,8,i*25.7,'#e8c8a0','#b88a5a');
        for(let i=0;i<14;i++)a+=petal(90,76,8,30,9,i*25.7+12,'#ffffff','#e0dccf');
        a+=C(90,76,14,'#fffbe8','#f0e6b0',1.5);
        return a;}},
      {name:'삼천 년에 한 번 피는 우담바라',face:[90,112],head:[90,40],neck:[90,146],st:'sparkle',draw(){let a='';
        a+=C(90,110,70,'#fff4c8','',0,op(.4));
        a+=L('M20 150Q90 136 160 150','#7a5a3a',4)+leaf(40,146,-100,.4,'#6f9a4a')+leaf(140,146,100,.4,'#6f9a4a');
        for(let i=0;i<9;i++){const x=34+i*14;a+=L(`M${x} 148Q${x+(i-4)*1.5} 120 ${x+(i-4)*2} ${96-Math.abs(i-4)*3}`,'#f4f0e0',1.2)+C(x+(i-4)*2,96-Math.abs(i-4)*3,3,'#fffdf0','#e0d8b8',.8);}
        for(let i=0;i<10;i++)a+=petal(90,112,8,26,8,i*36,'#fffdf4','#e8dcb8');
        a+=C(90,112,14,'#fff3b0','#e0c860',1.5);
        return a;}});
    /* ===== 마음잎 ===== */
    def('fiveleaf',
      {name:'사랑스러운 사랑초',face:[90,86],head:[90,40],neck:[90,112],st:'heart',draw(){let a=soil();
        const tri=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,[0,120,240].map(ang=>P('M0 0L-16 -30Q0 -38 16 -30Z','#7a3f9a','#4a1f6a',1.5,rot(ang,0,0))+E(0,-22,5,3,'#b98ad8',op(.7),rot(ang,0,0))).join(''));
        for(const [x,y,s] of [[46,128,.9],[134,124,.95],[62,158,.7],[120,160,.7]])a+=L(`M90 190Q${x} ${y+30} ${x} ${y}`,'#8a5a8a',2)+tri(x,y,s);
        a+=L('M90 190V100','#8a5a8a',3)+tri(90,96,1.5);
        for(const [x,y] of [[70,60],[110,56],[90,44]])a+=L(`M90 90Q${x} ${y+16} ${x} ${y}`,'#a8789a',1.5)+bloom(x,y,5,'#f7c0e0','#f6d66b');
        a+=patch(90,90,14,10,'#f6ecfb');return a;}},
      {name:'신화 속 황금사과나무',face:[90,154],head:[90,12],neck:[90,176],st:'star',draw(){let a=soil();
        a+=C(90,70,66,'#ffe7a0','',0,op(.35));
        a+=trunk(90,100,192,20,34,'#a8845c','#6f5236')+L('M90 120L60 92M90 114L124 88','#a8845c',6);
        a+=blobs([[44,82,26],[72,54,30],[112,52,32],[140,84,26],[90,86,32]],'#5f9a4a','#3f6d3a');
        for(const [x,y] of [[50,80],[76,48],[112,46],[138,84],[94,78],[66,96],[118,98]])a+=C(x,y,8,'#f6c83a','#b8871c',1.5)+L(`M${x} ${y-8}l2 -4`,'#6f5236',1.5)+E(x-2,y-3,2.5,1.6,'#fff3b0');
        a+=patch(90,156,14,11,'#f2e2c4');return a;}});
    def('goldclover',
      {name:'돌돌 말린 고사리 새순',face:[90,70],head:[90,30],neck:[90,104],st:'surprise',draw(){let a=soil();
        const curl=(x,y,s,c)=>G(`translate(${x} ${y}) scale(${s})`,P('M0 0Q20 -2 20 -20Q18 -38 0 -38Q-16 -36 -16 -22Q-14 -10 -2 -12Q8 -14 6 -24Q2 -30 -4 -26','none',c,6)+L('M0 0V70','#7a9a4a',6));
        a+=curl(46,112,.7,'#8ab35a')+curl(134,108,.7,'#8ab35a')+curl(66,96,.8,'#9ac45a')+curl(116,92,.8,'#9ac45a');
        a+=L('M90 192V94','#7a9a4a',8)+C(90,70,26,'#9ac45a','#5f8a3a',2.5)+P('M110 66Q112 46 94 44Q76 46 76 62','none','#6f9a4a',5);
        for(let i=0;i<14;i++)a+=L(`M${70+Math.cos(i*.45)*24} ${70+Math.sin(i*.45)*24}l2 -2`,'#c9b07a',2);
        a+=patch(90,74,14,10,'#f0f8e0');return a;}},
      {name:'공룡 시대의 나무고사리',face:[90,150],head:[90,20],neck:[90,172],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#5a7a4a');
        a+=R(78,70,24,124,8,'#6a4a32','#3f2a1a',2);for(let y=80;y<190;y+=12)a+=L(`M80 ${y}q10 4 20 0`,'#8a6a4a',1.5);
        const frond=(ang,len)=>G(`rotate(${ang} 90 70)`,L(`M90 70Q${90+len*.5} ${70-len*.3} ${90+len} ${70+len*.1}`,'#4f7d3a',3)+(()=>{let o='';for(let k=1;k<9;k++){const t=k/9,x=90+len*t,y=70-len*.3*Math.sin(t*Math.PI)+len*.1*t;o+=L(`M${n(x)} ${n(y)}l-4 -10M${n(x)} ${n(y)}l4 8`,'#6fa35a',3);}return o;})());
        for(const [ang,len] of [[-160,70],[-130,76],[-100,72],[-80,72],[-50,76],[-20,70],[-190,60],[10,60]])a+=frond(ang+90,len);
        a+=G('translate(90 64) scale(.5)',P('M0 0Q20 -2 20 -20Q18 -38 0 -38Q-16 -36 -16 -22Q-14 -10 -2 -12','none','#9ac45a',7));
        a+=patch(90,152,12,10,'#f0e6d6');return a;}});
    def('starclover',
      {name:'용감한 에델바이스',face:[90,90],head:[90,40],neck:[90,124],st:'sparkle',draw(){let a=soil();
        a+=L('M90 192V120','#9aa89a',5)+leaf(90,180,-60,.6,'#a8b8a8','#6f806f')+leaf(90,170,60,.55,'#a8b8a8','#6f806f');
        const ed=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,(()=>{let o='';for(let i=0;i<9;i++)o+=P('M0 0L-8 -30Q0 -40 8 -30Z','#f4f6f0','#b9c2b0',1.4,rot(i*40,0,0));for(let i=0;i<5;i++)o+=C(Math.cos(i*1.26)*7,Math.sin(i*1.26)*7,4,'#e8d86a','#a89a3a',.8);return o+C(0,0,5,'#e8d86a');})());
        a+=L('M90 124L56 148M90 124L126 150','#9aa89a',3)+ed(56,150,.55)+ed(126,152,.5);
        a+=ed(90,90,1.3);
        a+=patch(90,92,13,9,'#fbfcf6');return a;}},
      {name:'오천 살 브리슬콘 소나무',face:[90,150],head:[70,24],neck:[90,170],st:'star',draw(){let a='';
        a+=P('M8 194L30 178L70 188L120 172L172 194Q90 202 8 194Z','#b8b0a0','#8a8270',2);
        a+=P('M60 194Q56 150 72 120Q60 90 76 60Q84 40 70 20M76 60Q96 70 104 40M72 120Q110 110 126 80Q140 60 150 64','none','#d8ccb0',14);
        a+=P('M60 194Q56 150 72 120Q60 90 76 60Q84 40 70 20M76 60Q96 70 104 40M72 120Q110 110 126 80Q140 60 150 64','none','#a8906a',6,op(.7));
        a+=P('M64 194Q60 150 76 122','none','#8a6a4a',6);
        for(const [x,y] of [[70,18],[104,36],[150,60],[126,78]])a+=blobs([[x,y,12],[x+10,y+4,9],[x-10,y+4,9]],'#3f6d4a','#2a4a34',1.5);
        a+=C(106,116,6,'#6a4a2a')+E(106,116,3,5,'#a8906a');
        a+=patch(84,150,14,11,'#f0e6d0');return a;}});
    def('frostclover',
      {name:'알록달록 수국',face:[90,90],head:[90,36],neck:[90,132],st:'laugh',draw(){let a=soil();
        a+=L('M90 192V130','#5f8a4a',6)+leaf(90,178,-70,.9,'#5f9a55')+leaf(90,170,70,.9,'#5f9a55')+leaf(90,150,-40,.7,'#6fa865');
        a+=C(90,90,48,'#a8c0f0','#6a86c8',2);
        for(let i=0;i<34;i++){const r=Math.sqrt(i/34)*42,t=i*2.4,x=90+Math.cos(t)*r,y=90+Math.sin(t)*r;a+=G(`rotate(${i*17} ${n(x)} ${n(y)})`,[0,90,180,270].map(ang=>E(x,y-4,3.5,4.5,i%3?'#c2d4f8':'#d8c8f4','#8aa0d8',.6,rot(ang,x,y))).join('')+C(x,y,1.4,'#f6f0ff'));}
        a+=patch(90,92,15,11,'#eef3fd');return a;}},
      {name:'쥐라기의 아라우카리아',face:[90,156],head:[90,8],neck:[90,176],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#8a7a5a');
        a+=R(82,40,16,154,6,'#7a5a42','#4a3422',2);for(let y=50;y<190;y+=10)a+=L(`M83 ${y}l14 4`,'#9a7a5a',1.2);
        const tier=(y,w)=>L(`M90 ${y}Q${90-w*.6} ${y-10} ${90-w} ${y+8}M90 ${y}Q${90+w*.6} ${y-10} ${90+w} ${y+8}`,'#3f6d3a',7)+L(`M90 ${y}Q${90-w*.6} ${y-10} ${90-w} ${y+8}M90 ${y}Q${90+w*.6} ${y-10} ${90+w} ${y+8}`,'#6fa35a',3,' stroke-dasharray="2 3"');
        for(const [y,w] of [[46,28],[70,44],[96,58],[122,70]])a+=tier(y,w);
        a+=C(90,36,12,'#6fa35a','#3f6d3a',2)+C(62,76,7,'#a8804a','#6a4a2a',1.5)+C(122,100,7,'#a8804a','#6a4a2a',1.5);
        a+=patch(90,158,11,10,'#efe0cc');return a;}});
    def('bouquetclover',
      {name:'보송보송 토끼꼬리풀',face:[90,70],head:[90,28],neck:[90,104],st:'laugh',draw(){let a=soil();
        for(let i=0;i<9;i++)a+=L(`M90 192Q${70+i*5} 160 ${40+i*12} ${150-(i%3)*10}`,'#8ab35a',2);
        const tail=(x,y,s)=>L(`M90 192Q${(x+90)/2} ${y+60} ${x} ${y+22*s}`,'#a8c47a',2)+E(x,y,11*s,20*s,'#fbf6e6','#d8ccb0',1.2)+(()=>{let o='';for(let k=0;k<8;k++)o+=L(`M${x-8*s+k*2*s} ${y-16*s}l-1 -5`,'#fffdf4',1.2);return o;})();
        a+=tail(48,110,.7)+tail(132,104,.75)+tail(64,82,.8)+tail(118,78,.8);
        a+=L('M90 192V96','#a8c47a',3)+E(90,70,22,32,'#fffdf4','#d8ccb0',2);
        for(let k=0;k<12;k++)a+=L(`M${72+k*3} ${42+Math.abs(k-6)}l-1 -6`,'#ffffff',1.4);
        a+=patch(90,74,14,10,'#fffef8');return a;}},
      {name:'바람을 타는 소원 민들레',face:[90,78],head:[90,20],neck:[90,112],st:'wink',draw(){let a=soil();
        a+=L('M90 192V112','#7aa84a',5)+leaf(90,190,-70,.8,'#6f9e57')+leaf(90,188,70,.8,'#6f9e57');
        for(let i=0;i<40;i++){const ang=i/40*Math.PI*2,x2=90+Math.cos(ang)*46,y2=78+Math.sin(ang)*46;a+=L(`M90 78L${n(x2)} ${n(y2)}`,'#f4f0e0',1);for(let k=0;k<6;k++)a+=L(`M${n(x2)} ${n(y2)}l${n(Math.cos(ang+(k-2.5)*.5)*6)} ${n(Math.sin(ang+(k-2.5)*.5)*6)}`,'#ffffff',1);}
        a+=C(90,78,10,'#c9b89a');
        for(const [x,y,r] of [[150,30,-30],[166,58,-50],[132,14,-20]])a+=G(`rotate(${r} ${x} ${y})`,L(`M${x} ${y}v14`,'#e8e0c8',1)+(()=>{let o='';for(let k=0;k<7;k++)o+=L(`M${x} ${y}l${n(Math.cos(k*.9-2)*6)} ${n(Math.sin(k*.9-2)*6)}`,'#ffffff',1);return o;})())+star(x+6,y-8,3,'#fde37a');
        a+=patch(90,80,15,11,'#fffdf6');return a;}});
    def('ringclover',
      {name:'다정한 금낭화',face:[90,122],head:[90,52],neck:[90,150],st:'heart',draw(){let a=soil();
        a+=L('M40 192Q30 90 90 60Q150 50 162 110','#6f9a4a',3);
        a+=leaf(50,190,-30,.8,'#7aa865')+leaf(44,176,30,.6,'#7aa865');
        const bh=(x,y,s)=>L(`M${x} ${y-16*s}v-${10*s}`,'#6f9a4a',1.5)+G(`translate(${x} ${y}) scale(${s})`,P('M0 18C-26 4 -20 -18 -6 -16Q0 -14 0 -8Q0 -14 6 -16C20 -18 26 4 0 18Z','#f26a9a','#b8386a',1.5)+P('M-3 16Q0 28 3 16Z','#ffffff'));
        a+=bh(136,86,.6)+bh(154,104,.5)+bh(110,72,.7)+bh(62,90,.6);
        a+=L('M90 64V96','#6f9a4a',2)+bh(90,124,1.7);
        a+=patch(90,122,13,9,'#ffe6ef');return a;}},
      {name:'두 나무가 하나 된 연리지',face:[90,150],head:[90,14],neck:[90,172],st:'heart',draw(){let a=soil();
        a+=C(90,70,62,'#ffd6e2','',0,op(.35));
        a+=P('M40 194Q52 150 84 120Q90 100 70 80','none','#9a6a4a',16)+P('M140 194Q128 150 96 120Q90 100 110 80','none','#8a5a3a',16);
        a+=E(90,120,16,14,'#a8784a','#6a4a2a',2);
        a+=blobs([[60,70,30],[120,70,30],[90,44,30]],'#f7a8c4','#d86a92');
        for(let i=0;i<12;i++)a+=heart(40+(i*23)%100,30+((i*17)%60),4,'#e8406e');
        a+=heart(90,46,12,'#f04a78');
        a+=patch(90,152,14,11,'#f2e0cc');return a;}});
    /* ===== 마음열매 ===== */
    def('whiteberry',
      {name:'등불 든 꽈리',face:[90,120],head:[90,50],neck:[90,148],st:'laugh',draw(){let a=soil();
        a+=L('M30 60Q90 30 160 60','#6f9a4a',3)+leaf(50,52,-100,.5,'#7aa865')+leaf(140,50,100,.5,'#7aa865');
        const lan=(x,y,s,c,d)=>L(`M${x} ${y-24*s}V${y-34*s}`,'#6f9a4a',1.5)+G(`translate(${x} ${y}) scale(${s})`,P('M0 -26Q-24 -18 -22 6Q-14 26 0 30Q14 26 22 6Q24 -18 0 -26Z',c,d,1.8)+L('M0 -26Q-8 0 0 30M0 -26Q8 0 0 30M0 -26Q-18 -4 -14 20M0 -26Q18 -4 14 20',d,1));
        a+=lan(46,94,.6,'#f28b3a','#b8520a')+lan(140,90,.65,'#f28b3a','#b8520a')+lan(66,78,.5,'#9ab45a','#5f7a2a');
        a+=L('M90 40V86','#6f9a4a',2)+lan(90,122,1.4,'#ff7a2a','#b8420a');
        a+=patch(90,122,14,10,'#fff0e0');return a;}},
      {name:'신선의 천도복숭아',face:[90,154],head:[90,12],neck:[90,176],st:'star',draw(){let a='';
        a+=cloud(90,190,1.5,'#ffffff',.9);
        a+=trunk(90,100,186,18,30,'#8a5a3a','#5a3a1a')+L('M90 120L58 94M90 114L124 90','#8a5a3a',6);
        a+=blobs([[46,82,24],[72,56,28],[112,54,30],[138,84,24],[90,86,30]],'#8ac46a','#4f8a3a');
        for(let i=0;i<10;i++)a+=bloom(40+(i*31)%110,40+((i*19)%60),4,'#ffd0dc','#f6d66b');
        for(const [x,y,s] of [[56,92,1],[124,88,1],[90,70,1.3]])a+=P(`M${x} ${y-12*s}Q${x-14*s} ${y-12*s} ${x-13*s} ${y+2*s}Q${x-8*s} ${y+14*s} ${x} ${y+14*s}Q${x+8*s} ${y+14*s} ${x+13*s} ${y+2*s}Q${x+14*s} ${y-12*s} ${x} ${y-12*s}Z`,'#ffb0bc','#d86a7a',1.5)+P(`M${x} ${y-12*s}Q${x+6*s} ${y} ${x} ${y+14*s}`,'none','#f08a9a',1.2)+E(x-6*s,y-4*s,4*s,6*s,'#ff8a9a',op(.6));
        a+=patch(90,156,13,10,'#f4e2cc');return a;}});
    def('berryfield',
      {name:'줄무늬 수박 덩굴',face:[90,146],head:[90,106],neck:[90,176],st:'laugh',draw(){let a=soil();
        a+=L('M10 150Q40 120 60 140T110 120T170 140','#5f9a45',3)+P('M150 128q10 -10 16 0q-6 10 -16 0','none','#5f9a45',2);
        for(const [x,y] of [[30,136],[78,126],[134,124]])a+=leaf(x,y,-40,.55,'#6fae55');
        a+=bloom(106,116,6,'#f6d66b','#f2a33a');
        a+=E(90,154,58,38,'#3f8a3a','#1f5a2a',3);
        for(let i=0;i<7;i++)a+=P(`M${46+i*15} 120Q${40+i*15+(i-3)*6} 154 ${46+i*15} 190`,'none','#1f5a2a',5);
        a+=patch(90,148,17,12,'#e6f6d8');return a;}},
      {name:'흥부네 보물 박넝쿨',face:[90,146],head:[90,100],neck:[90,178],st:'fierce',draw(){let a=soil();
        a+=P('M10 110Q20 70 60 64Q90 40 120 60Q160 64 170 100','none','#8a6a3a',4)+L('M20 110V194M160 100V194','#8a6a3a',4);
        for(const [x,y] of [[30,74],[70,56],[112,52],[150,70]])a+=leaf(x,y,-30,.55,'#6fae55');
        for(const [x,y] of [[50,62],[132,60]])a+=bloom(x,y,6,'#ffffff','#f6d66b');
        a+=L('M90 52V106','#6f9a4a',3);
        a+=P('M90 106Q48 106 44 144Q42 188 90 190Q138 188 136 144Q132 106 90 106Z','#f4ecd0','#b8a878',3);
        for(let i=0;i<5;i++)a+=P(`M${58+i*16} 110Q${54+i*16+(i-2)*4} 150 ${58+i*16} 188`,'none','#d8cca8',2);
        a+=P('M60 134L120 134L112 142Q90 150 68 142Z','#3a2a1a',op(.25));
        for(const [x,y,c] of [[48,176,'#f6d66b'],[132,178,'#e8403a'],[40,160,'#4f9ae8'],[140,158,'#f6d66b']])a+=C(x,y,5,c,'#ffffff',1.5);
        a+=patch(90,148,16,12,'#fffaf0');return a;}});
    def('violetberry',
      {name:'주렁주렁 포도 덩굴',face:[90,118],head:[90,64],neck:[90,160],st:'wink',draw(){let a=soil();
        a+=L('M8 60Q50 40 90 56Q130 40 172 60','#8a6a3a',5);
        for(const [x,y] of [[30,62],[150,62],[64,56],[116,54]])a+=G(`translate(${x} ${y})`,P('M0 0Q-20 -4 -22 -18Q-14 -30 0 -22Q14 -30 22 -18Q20 -4 0 0Z','#6fae55','#3f7d3a',1.5));
        a+=P('M150 64q10 10 4 18q-8 4 -6 -4','none','#8a6a3a',1.5);
        a+=L('M90 56V76','#8a6a3a',3);
        for(let r=0;r<6;r++)for(let k=0;k<6-r;k++)a+=C(90-(5-r-1)*9+k*18,86+r*16,10,(r+k)%2?'#7a4aa8':'#8a5ac0','#4a2a70',1.2)+C(86-(5-r-1)*9+k*18,82+r*16,2.5,'#c8a8f0');
        a+=patch(90,120,15,11,'#f4ecfb');return a;}},
      {name:'억만 년을 견딘 소철',face:[90,150],head:[90,56],neck:[90,172],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#8a7a5a');
        a+=P('M66 194Q60 130 70 100H110Q120 130 114 194Z','#8a6a4a','#5a4228',2.5);
        for(let r=0;r<8;r++)for(let k=0;k<4;k++)a+=P(`M${70+k*10+(r%2?5:0)} ${106+r*11}l5 -5 5 5-5 5Z`,'#a8845c','#6f5236',.8);
        const frond=ang=>G(`rotate(${ang} 90 98)`,L('M90 98Q130 70 168 90','#4f7d3a',3)+(()=>{let o='';for(let k=1;k<12;k++){const t=k/12,x=90+78*t,y=98-28*Math.sin(t*Math.PI)+(-8)*t;o+=L(`M${n(x)} ${n(y)}l-3 -9M${n(x)} ${n(y)}l3 9`,'#5f9a45',2.5);}return o;})());
        for(const ang of [-170,-140,-110,-70,-40,-10,-190,20])a+=frond(ang);
        a+=E(90,86,14,20,'#e0b84a','#8a6a1a',2)+L('M80 76l20 20M80 92l20 -20','#b8901a',1.2);
        a+=patch(90,152,14,11,'#efe0cc');return a;}});
    def('frostberry',
      {name:'폭신폭신 목화',face:[90,82],head:[90,34],neck:[90,114],st:'sleepy',draw(){let a=soil();
        a+=L('M90 192V100M90 150L52 118M90 136L130 104','#7a5a3a',4);
        const boll=(x,y,s)=>G(`translate(${x} ${y}) scale(${s})`,P('M-14 6L0 16L14 6','none','#7a5a3a',3)+blobs([[-10,-2,11],[10,-2,11],[0,-12,12],[0,4,11]],'#ffffff','#d8d0c0',1.2));
        a+=boll(52,112,.8)+boll(132,98,.8)+boll(60,160,.6)+boll(124,150,.6);
        for(const [x,y] of [[40,140],[142,126]])a+=leaf(x,y,-50,.45,'#6f9a4a');
        a+=boll(90,82,1.7);
        a+=patch(90,86,15,11,'#fffefb');return a;}},
      {name:'하늘을 덮는 구름 목화',face:[90,110],head:[90,40],neck:[90,146],st:'sleepy',draw(){let a='';
        a+=C(90,110,80,'#dff0ff','',0,op(.4));
        a+=cloud(90,186,1.5,'#ffffff',.95);
        a+=L('M90 176V120M90 150L50 126M90 138L132 116','#b8a08a',4);
        for(const [x,y,s] of [[40,70,.7],[140,64,.8],[50,120,.6],[130,112,.65],[70,40,.55],[114,36,.6]])a+=G(`translate(${x} ${y}) scale(${s})`,blobs([[-10,-2,12],[10,-2,12],[0,-12,13],[0,4,12]],'#ffffff','#c8d8e8',1.2)+star(16,-16,4,'#fde37a'));
        a+=G('translate(90 108) scale(2.2)',blobs([[-10,-2,12],[10,-2,12],[0,-12,13],[0,4,12]],'#ffffff','#c8d8e8',.8));
        a+=patch(90,112,16,11,'#fffefb');return a;}});
    def('goldraspberry',
      {name:'멋쟁이 파인애플',face:[90,130],head:[90,50],neck:[90,168],st:'cool',draw(){let a=soil();
        for(let i=0;i<9;i++)a+=leaf(90,188,-80+i*20,.9,i%2?'#5f8a4a':'#7aa865','#3f6d3a');
        a+=E(90,132,30,40,'#f2b83a','#a8771f',2.5);
        for(let r=0;r<7;r++)for(let k=0;k<4;k++)a+=P(`M${66+k*14+(r%2?7:0)} ${102+r*10}l6 -5 6 5-6 5Z`,'#e8a02a','#b8871c',.8);
        for(let i=0;i<9;i++)a+=leaf(90,94,-60+i*15,.62,'#4f8a3a','#2f5a2a');
        a+=patch(90,134,15,11,'#fdecc0');return a;}},
      {name:'하늘까지 닿은 콩나무',face:[90,160],head:[70,10],neck:[90,176],st:'star',draw(){let a='';
        a+=cloud(40,40,.9,'#ffffff',.95)+cloud(150,70,.8,'#ffffff',.95)+cloud(100,14,.7,'#ffffff',.9);
        a+=P('M76 194Q60 150 96 120Q126 92 90 70Q60 50 88 20','none','#4f8a3a',16)+P('M104 194Q116 150 84 124Q60 100 96 76Q124 56 96 24','none','#6fae55',11);
        for(const [x,y,r] of [[60,140,-60],[124,110,60],[58,84,-50],[118,54,50],[80,30,-30]])a+=leaf(x,y,r,.8,'#7ac060');
        for(const [x,y] of [[40,130],[138,96],[64,62]])a+=P(`M${x} ${y}q-4 -14 6 -18q-2 8 -6 18`,'none','#4f8a3a',2);
        a+=C(150,40,6,'#f6d66b','#b8871c',1.5)+C(34,104,5,'#f6d66b','#b8871c',1.5);
        a+=E(90,170,40,12,'#8a6a4a',op(.3));
        a+=patch(90,162,14,10,'#ecf8dc');return a;}});
    def('blackberry',
      {name:'화끈한 고추',face:[90,124],head:[90,62],neck:[90,166],st:'fierce',draw(){let a=soil();
        a+=L('M90 192V80M90 140L54 110M90 120L128 96','#5f8a3a',4);
        for(const [x,y,r] of [[54,104,-50],[128,90,50],[76,82,-30],[106,76,30]])a+=leaf(x,y,r,.5,'#6fae55');
        const chili=(x,y,s,c)=>G(`translate(${x} ${y}) scale(${s})`,P('M-6 0Q-10 30 4 52Q0 30 6 0Z',c,'#8a1f1f',1.5)+P('M-7 0Q0 -6 7 0L4 -6H-4Z','#5f8a3a'));
        a+=chili(54,112,1,'#e8403a')+chili(128,98,1,'#f28b3a')+chili(66,140,.8,'#e8403a')+chili(116,130,.8,'#e8403a');
        a+=P('M78 100Q66 150 92 186Q106 150 102 100Z','#e8403a','#8a1f1f',2.5)+P('M76 100Q90 88 104 100L98 92H82Z','#5f8a3a','#3f6d3a',1.5);
        a+=P('M82 110Q80 130 84 140','none','#ff9a8a',3);
        a+=patch(90,126,12,10,'#ffe6e2');return a;}},
      {name:'봉황이 깃든 봉황목',face:[90,154],head:[90,12],neck:[90,174],st:'fierce',draw(){let a='';
        a+=C(90,70,66,'#ffcf8a','',0,op(.35));
        a+=trunk(90,100,192,18,32,'#8a6a4a','#5a4228')+L('M90 118L46 84M90 112L136 80M90 104V64','#8a6a4a',6);
        a+=P('M6 90Q20 30 90 22Q160 30 174 90Q90 106 6 90Z','#6fae55','#3f7d3a',2);
        for(let i=0;i<26;i++){const x=16+(i*29)%150,y=30+((i*17)%56);a+=[0,72,144,216,288].map(ang=>E(x,y-5,3.4,5,i%3?'#e8403a':'#ff7a2a','',0,rot(ang,x,y))).join('')+C(x,y,1.6,'#f6d66b');}
        for(const [x,y] of [[30,120],[150,126],[60,150]])a+=P(`M${x} ${y}q-10 14 -2 22q4 -12 2 -22Z`,'#ff7a2a',op(.8));
        a+=patch(90,156,13,10,'#f4e2cc');return a;}});
    /* ===== 마음나무 ===== */
    def('elderoak',
      {name:'팔 벌린 반얀나무',face:[90,150],head:[90,20],neck:[90,172],st:'laugh',draw(){let a=soil();
        a+=blobs([[36,78,28],[66,50,34],[114,50,34],[144,78,28],[90,82,36]],'#4f8a4a','#2f6a3a');
        for(const x of [30,46,62,118,134,150])a+=L(`M${x} 90V${190-(x%3)*6}`,'#8a6a4a',x%2?3:5);
        a+=trunk(90,96,194,28,44,'#9a7a5a','#6a4a2a')+L('M80 110Q84 150 76 190M100 110Q96 150 104 190','#7a5a3a',2);
        a+=patch(90,152,15,11,'#f0e0c8');return a;}},
      {name:'세상을 떠받친 세계수',face:[90,160],head:[90,6],neck:[90,178],st:'star',draw(){let a='';
        a+=C(90,90,86,'#e0f8d0','',0,op(.4));
        a+=P('M20 194Q60 176 76 150L74 70Q56 58 40 40M76 104Q50 96 24 76M104 104Q130 96 156 76M106 70Q124 58 140 40M104 150Q120 176 160 194','none','#9a7a5a',10);
        a+=trunk(90,60,194,26,50,'#9a7a5a','#6a4a2a');
        a+=blobs([[30,60,24],[60,34,28],[90,20,30],[120,34,28],[150,60,24],[46,86,20],[134,86,20]],'#5fae6a','#3f7d4a');
        for(let i=0;i<14;i++)a+=C(24+(i*31)%132,20+((i*23)%74),2.5,'#fff3a8');
        a+=E(90,196,70,5,'#9fd3ea',op(.6));
        a+=patch(90,162,15,11,'#f2e2cc');return a;}});
    def('maple',
      {name:'붉게 물든 단풍나무',face:[90,158],head:[90,16],neck:[90,176],st:'wink',draw(){let a=soil();
        const ml=(x,y,s,c)=>G(`translate(${n(x)} ${n(y)}) scale(${s})`,P('M0 -14L4 -6L10 -9L8 -2L14 0L8 3L10 9L3 6L0 14L-3 6L-10 9L-8 3L-14 0L-8 -2L-10 -9L-4 -6Z',c,'#9a2f18',.8));
        a+=trunk(90,100,194,22,34,'#7a4a2a','#4a2a14')+L('M90 120L58 94M90 114L124 90','#7a4a2a',5);
        a+=blobs([[48,80,28],[76,52,32],[112,50,34],[138,82,28],[90,86,32]],'#e0643c','#9a2f18');
        for(let i=0;i<24;i++)a+=ml(28+(i*37)%128,30+((i*23)%74),.9,['#c2412f','#f0a24a','#e87a3c'][i%3]);
        for(const [x,y] of [[30,170],[150,176],[46,188]])a+=ml(x,y,.7,'#f0a24a');
        a+=patch(90,160,13,10,'#f4e0cc');return a;}},
      {name:'마을을 지키는 천년 당산나무',face:[90,156],head:[90,10],neck:[90,176],st:'cool',draw(){let a=soil();
        a+=P('M40 194Q60 150 70 110Q40 90 20 80M70 110Q70 60 60 40M110 110Q110 60 124 40M110 110Q140 90 160 80M140 194Q120 150 110 110','none','#8a6a4a',12);
        a+=trunk(90,90,194,40,60,'#9a7a5a','#6a4a2a');
        a+=blobs([[26,70,26],[60,36,30],[100,26,32],[138,44,30],[158,78,24],[90,70,30]],'#5f9a4a','#3f6d3a');
        a+=P('M60 140Q90 150 120 140','none','#e8d8a8',5);
        for(const [x,c] of [[66,'#e8403a'],[78,'#4f9ae8'],[90,'#f6d66b'],[102,'#5fc46a'],[114,'#f07ab8']])a+=P(`M${x} 144l-3 22 6 0Z`,c);
        for(let i=0;i<6;i++)a+=P(`M${68+i*9} 142l-3 -6h6Z`,'#fffaf0');
        a+=patch(90,158,15,11,'#f2e2cc');return a;}});
    def('bamboo',
      {name:'곧게 뻗은 대나무',face:[90,150],head:[90,14],neck:[90,176],st:'laugh',draw(){let a='';
        const stalk=(x,top,w,col='#79ad55',dark='#4c7a36')=>{let o=R(x-w/2,top,w,194-top,w/2.6,col,dark,1.6)+L(`M${n(x-w/4)} ${top+6}V190`,'#d9ecb5',n(w/9),op(.55));for(let y=top+28;y<188;y+=28)o+=L(`M${n(x-w/2)} ${y}h${w}`,dark,2.4);return o;};
        const blade=(x,y,dir,len=26,col='#7fb15a')=>P(`M${x} ${y}q${n(dir*len*.45)} ${n(-len*.28)} ${n(dir*len)} ${n(len*.08)}q${n(-dir*len*.48)} ${n(len*.2)} ${n(-dir*len)} ${n(-len*.08)}Z`,col,'#4d7b38',.8);
        for(const [x,t,w] of [[42,40,14],[138,30,14]]){a+=stalk(x,t,w,'#8ec364','#5a8740');for(let y=t+22;y<t+110;y+=34)a+=blade(x,y,x<90?-1:1,26)+blade(x,y+8,x<90?-1:1,20,'#9ccc6e');}
        a+=stalk(90,16,38);
        for(const [x,y,d,l] of [[90,20,-1,34],[90,20,1,34],[90,30,-1,28],[90,30,1,30]])a+=blade(x,y,d,l,d<0?'#86ba5e':'#6fa24d');
        a+=patch(90,152,14,10,'#eef7dc');return a;}},
      {name:'백 년 만에 꽃핀 대나무숲',face:[90,150],head:[90,14],neck:[90,176],st:'star',draw(){let a='';
        const stalk=(x,top,w,col='#79ad55',dark='#4c7a36')=>{let o=R(x-w/2,top,w,194-top,w/2.6,col,dark,1.6)+L(`M${n(x-w/4)} ${top+6}V190`,'#d9ecb5',n(w/9),op(.55));for(let y=top+28;y<188;y+=28)o+=L(`M${n(x-w/2)} ${y}h${w}`,dark,2.4);return o;};
        for(const [x,t,w] of [[14,60,10],[32,30,13],[56,50,10],[124,40,10],[148,22,13],[168,60,10]])a+=stalk(x,t,w,'#9ccc6e','#5a8740');
        a+=stalk(90,16,38,'#e0c860','#a8901a');
        for(let i=0;i<14;i++){const x=20+(i*23)%150,y=28+((i*31)%70);a+=L(`M${x} ${y}q-2 12 2 22`,'#c9b04a',1.2)+E(x+1,y+24,3,6,'#f6e08a','#c9a83a',.8)+E(x+5,y+14,2.5,5,'#f6e08a','#c9a83a',.8);}
        a+=patch(90,152,14,10,'#fff8dc');return a;}});
    def('weepingcherry',
      {name:'화사한 벚나무',face:[90,158],head:[90,14],neck:[90,176],st:'sparkle',draw(){let a=soil();
        a+=trunk(90,100,194,20,32,'#6a4a3a','#3f2a20')+L('M90 120L56 92M90 114L126 88','#6a4a3a',5);
        a+=blobs([[44,80,28],[72,50,32],[112,48,34],[140,80,28],[90,84,32]],'#ffd0dc','#f0a0b8');
        for(let i=0;i<22;i++)a+=bloom(24+(i*37)%132,26+((i*23)%76),4,i%3?'#ffffff':'#ffb8cc','#f07a9a');
        for(const [x,y] of [[24,150],[156,140],[40,178],[140,184]])a+=E(x,y,3.5,2.2,'#ffc0d0','',0,rot(30,x,y));
        a+=patch(90,160,13,10,'#f4e2d8');return a;}},
      {name:'하늘이 내린 신단수',face:[90,156],head:[90,8],neck:[90,176],st:'sparkle',draw(){let a='';
        a+=C(90,80,84,'#fff3c8','',0,op(.45));
        a+=P('M10 194L44 154L70 180L110 142L148 178L170 194Q90 202 10 194Z','#8aa0b8','#5a708a',2,op(.6));
        a+=trunk(90,70,194,26,46,'#8a6a4a','#5a4228');
        a+=blobs([[36,60,24],[66,30,28],[114,30,28],[144,60,24],[90,50,30]],'#4f9a6a','#2f6a4a');
        for(const [x,y] of [[36,62],[66,32],[114,32],[144,62],[90,24]])a+=C(x,y,6,'#fff3b0','#e0c860',1)+C(x,y,12,'#fff3b0',op(.3));
        a+=P('M60 120Q90 132 120 120','none','#e8d8a8',4)+[64,78,92,106,116].map((x,i)=>P(`M${x} 124l-3 20h6Z`,['#e8403a','#4f9ae8','#f6d66b','#5fc46a','#ffffff'][i])).join('');
        a+=patch(90,158,15,11,'#f2e2cc');return a;}});
    def('elderginkgo',
      {name:'키다리 메타세쿼이아',face:[90,164],head:[90,10],neck:[90,180],st:'surprise',draw(){let a=soil();
        a+=R(82,120,16,74,4,'#9a5a3a','#6a3a1a',2);
        for(let t=0;t<7;t++){const y=24+t*16,w=12+t*9;a+=P(`M90 ${y-12}L${90-w} ${y+14}H${90+w}Z`,t%2?'#d88a4a':'#c8783a','#8a4a1a',1.5);}
        for(let i=0;i<20;i++)a+=L(`M${60+(i*13)%60} ${30+((i*17)%100)}l-4 3M${60+(i*13)%60} ${30+((i*17)%100)}l4 3`,'#f0b870',1.2);
        a+=patch(90,166,11,9,'#f4e0cc');return a;}},
      {name:'석탄기의 거인 인목',face:[90,150],head:[90,10],neck:[90,172],st:'star',draw(){let a='';
        a+=E(90,194,68,8,'#4f6a4a')+E(40,194,30,5,'#7fa0a8',op(.6));
        a+=R(74,40,32,154,10,'#6f8a5a','#3f5a34',2.5);
        for(let r=0;r<14;r++)for(let k=0;k<3;k++)a+=P(`M${78+k*9+(r%2?4.5:0)} ${46+r*10}l4 -4 4 4-4 5Z`,'#8aa870','#4f6a44',.8);
        a+=L('M90 44L60 20M90 44L120 20M60 20L44 10M60 20L64 4M120 20L116 4M120 20L136 10','#6f8a5a',6);
        for(const [x,y] of [[44,10],[64,4],[116,4],[136,10]])for(let k=0;k<9;k++)a+=L(`M${x} ${y}l${n(Math.cos(k*.7)*12)} ${n(Math.sin(k*.7)*12)}`,'#4f8a3a',2);
        a+=patch(90,152,14,11,'#e8f0dc');return a;}});
    def('moonginkgo',
      {name:'향기로운 매화나무',face:[92,160],head:[70,20],neck:[92,178],st:'sleepy',draw(){let a=soil();
        a+=C(146,34,20,'#fff4c8',op(.9));
        a+=P('M86 194Q80 150 96 130Q108 110 90 90Q72 70 84 44M96 130Q124 120 140 96M90 90Q62 88 44 70','none','#4a3a3a',9);
        for(const [x,y] of [[84,44],[140,96],[44,70],[110,112],[66,84],[96,64],[122,108]])a+=bloom(x,y,6,'#ffffff','#f6d66b')+C(x+10,y+8,3,'#ffc0d0');
        for(let i=0;i<8;i++)a+=bloom(50+(i*19)%90,50+((i*29)%70),3.2,'#ffe0ea','#f6d66b');
        a+=patch(92,162,13,10,'#f0e6e2');return a;}},
      {name:'달나라 계수나무',face:[90,156],head:[90,40],neck:[90,176],st:'sparkle',draw(){let a='';
        a+=C(90,96,86,'#fff3c4','#f0d98a',2,op(.95));
        for(const [x,y,r] of [[40,60,8],[140,70,6],[130,140,10],[46,140,7]])a+=C(x,y,r,'#f0e2a6');
        a+=trunk(90,100,188,18,30,'#8a6a4a','#5a4228')+L('M90 116L58 90M90 110L122 86','#8a6a4a',5);
        a+=blobs([[52,82,20],[74,58,24],[108,56,26],[130,82,20],[90,84,24]],'#6fae8a','#3f7d5a');
        for(let i=0;i<16;i++)a+=C(40+(i*29)%100,48+((i*17)%50),2.2,'#fff7c0');
        a+=patch(90,158,13,10,'#f4e6cc');return a;}});
    return {forms:F,face};
  })();
  const fx2=n=>Number(n.toFixed(1));
  const star=(x,y,r,fill='#f6d66b')=>`<path d="M${x} ${y-r}L${fx2(x+r*.28)} ${fx2(y-r*.28)}L${x+r} ${y}L${fx2(x+r*.28)} ${fx2(y+r*.28)}L${x} ${y+r}L${fx2(x-r*.28)} ${fx2(y+r*.28)}L${x-r} ${y}L${fx2(x-r*.28)} ${fx2(y-r*.28)}Z" fill="${fill}" stroke="#fffbe8" stroke-width=".8"/>`;
  const finalAura=c=>`<circle cx="90" cy="104" r="88" fill="${c}" opacity=".28"/><circle cx="90" cy="104" r="68" fill="${c}" opacity=".3"/>`;
  const finalSparkles=()=>star(22,34,7)+star(160,24,6)+star(166,132,5)+star(14,120,5)+star(90,6,5);
  function creatureSVG(pet,route,level,color='#aac875',silhouette=false,branch){
    const g=plantGeometry(pet,route,level,branch),kind=g.family,adult=g.adult;
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
    // Lv.15 갈래 · Lv.20 최종 진화
    if(g.form){
      art=g.form.draw();
      if(level>=20)art=(silhouette?'':finalAura(g.form.aura||'#fff0b3'))+art+(silhouette?'':finalSparkles());
      // Lv.16 ~ 19: 레벨마다 신비한 빛 알갱이가 하나씩 늘어나요.
      else if(level>15&&!silhouette)art=`<ellipse cx="90" cy="110" rx="${60+(level-15)*6}" ry="${70+(level-15)*6}" fill="#fff6c8" opacity="${(0.18+(level-15)*0.08).toFixed(2)}"/>`+art+[[24,40],[158,30],[164,120],[16,112]].slice(0,level-15).map(([x,y])=>star(x,y,5)).join('');
    }
    const [fx,fy]=g.face;
    const baseFace=C(fx-10,fy,level>=5?2.3:3,'#38442d')+C(fx+10,fy,level>=5?2.3:3,'#38442d')+`<path d="M${fx-4} ${fy+7}Q${fx} ${fy+11} ${fx+4} ${fy+7}" stroke="#38442d" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    const face=g.form?LEGEND.face(g.form.st,fx,fy,g.form.fs||1.1):baseFace;
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
      // 물뿌리개: 한 판을 모두 맞히면 가득(canFull). 틀린 단어(retry)를 다시 다 맞혀도 가득 차요.
      canFull:raw?.canFull===true,can:Number.isFinite(raw?.can)?Math.min(1,Math.max(0,raw.can)):0,retry:Array.isArray(raw?.retry)?raw.retry.filter(x=>typeof x==='string').slice(0,60):[],
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
    let loaded={schema:8,garden:normalizeGarden(null),xp:0,level:1,voice:'',rate:.9,auto:false,difficulty:'hard',look:{...LOOK_DEFAULT,poses:{}},routes:{},branches:{},family:null};
    try{
      const saved=JSON.parse(localStorage.getItem(forestKey(index))||'null');
      if(saved&&Number.isSafeInteger(saved.xp)&&saved.xp>=0){
        const oldLevel=Math.floor(saved.xp/100)+1;
        const migrated=xpStart(oldLevel,0)+Math.floor((saved.xp%100)/100*xpNeeded(oldLevel,0));
        const baseXP=saved.schema>=5?saved.xp:migrated;
        const xp=saved.schema>=6?saved.xp:Math.min(Number.MAX_SAFE_INTEGER,Math.floor(baseXP*XP_MULTIPLIERS[index]));
        const level=levelFromXP(Math.min(xp,xpCap(index)),index);
        loaded={...loaded,xp:Math.min(xp,xpCap(index)),level,garden:normalizeGarden(saved.garden),voice:typeof saved.voice==='string'?saved.voice:'',difficulty:saved.difficulty==='easy'?'easy':'hard',rate:[.5,.75].includes(saved.rate)?.5:.9,
          look:safeLook(saved.look,level,index),routes:safeRoutes(saved.routes,level),branches:safeBranches(saved.branches,level,safeRoutes(saved.routes,level)),family:level>=3&&petAllowed(saved.family)&&GROWTH[saved.family]?saved.family:null};
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
    const capped=profile.level>=MAX_LEVEL;$('xpLabel').nextElementSibling.textContent=capped?'체험판 최고 레벨':'다음 레벨까지';if(capped){$('xpLabel').textContent='Lv.10 달성!';$('xpBar').value=$('xpBar').max;}
    const name=growthName(profile.look.pet,profile.routes,profile.level);
    $('characterName').textContent=profile.look.name||name;$('characterMessage').textContent=profile.look.name?name:profile.level<3?'작은 씨앗에서 시작하는 나의 이야기':'매일 배우며 조금씩 자라고 있어요.';
    const current=profile.level===1?0:profile.level===2?1:!profile.family?1:profile.level<4?2:profile.level<10?3:profile.level<15?4:profile.level<20?5:6;
    document.querySelector('.growth-path').innerHTML=[['🫘','씨앗 · 1'],['🌱','새싹 · 2'],['🔀','선택 · 3'],['🌿','성장 · 4~9'],['✨','진화 · 10'],['🌗','갈래 · 15'],['👑','최종 · 20']].map(([icon,label],i)=>`<span class="${i<=current?'active':''}">${icon}<small>${label}</small></span>`).join('');
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
    // 물뿌리개: 한 판을 모두 맞히면 가득 차요. 틀렸다면 틀린 단어를 다시 풀어 다 맞혀야 가득 차요.
    const retry=g.retry.length,full=g.canFull,fill=full?1:g.can||0;
    const can=$('canWater');if(can){const h=11*fill;can.setAttribute('y',String(24-h));can.setAttribute('height',String(h));}
    $('waterPlant').classList.toggle('review-water',full);$('waterPlant').classList.toggle('can-filling',!full);$('waterPlant').classList.toggle('can-retry',!full&&retry>0);
    $('waterPlant').querySelector('span').innerHTML=full?'물주기!<small>물뿌리개가 가득 찼어요</small>':retry?`틀린 단어 다시 풀기<small>${retry}개를 맞히면 물이 가득</small>`:'물 모으는 중<small>한 판을 모두 맞히면 가득</small>';
    $('waterPlant').setAttribute('aria-label',full?'물뿌리개가 가득 찼어요. 친구에게 물 주기':retry?`틀린 단어 ${retry}개를 다시 풀어 물뿌리개 채우기`:'물뿌리개가 비어 있어요. 한 판을 모두 맞히면 가득 차요');
    renderStartCard();
    const active=g.active,remaining=active?.remaining||0;
    // 비료 안내는 캐릭터가 말로 알려 줘요. 비료를 쓰는 중일 때만 남은 횟수를 짧게 보여 줘요.
    $('fertilizerState').textContent=active?`${FERTILIZERS[active.kind].name} 사용 중 · 기본 정답 +${FERTILIZERS[active.kind].boost} XP · ${remaining}회 남음`:'';
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
      result.loss?friendSay(`我好渴……经验少了${result.loss}点。`,`목말라… 경험치가 ${result.loss} 줄었어. 레벨은 그대로야.`):friendSay('我好渴，快给我浇水吧！','목말라, 얼른 물 줘! 레벨 보호로 경험치는 그대로야.');
    }else renderCare();
  }
  let careReactionTimer,careSpeechTimer,careEndTimer;
  function waterPlant(){
    if(gardenBusy())return;
    refreshGarden();
    const g=profile.garden;if(!g.canFull)return;g.canFull=false;g.can=0;g.lastWatered=Date.now();g.penaltySteps=0;g.neglectLoss=0;
    save();renderCare();
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
      $(kind+'Hint').textContent=g.active?'지금 비료를 다 쓰면 다음 비료를 줄 수 있어요.':g.inventory[kind]>0?'오답·보너스에서는 횟수가 줄지 않아요.':g.coins<item.price?`${item.price-g.coins}코인을 더 모으면 살 수 있어요.`:'구입한 비료는 보관함에 저장돼요.';
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
    setTimeout(()=>friendSay(`好有力气！接下来答对${item.uses}次，每次多${item.boost}点经验。`,`힘이 난다! 다음 기본 정답 ${item.uses}번 동안 +${item.boost} XP야.`),1800);
    if($('basketDialog').open)$('basketDialog').close();
    if($('gardenShop').open)$('gardenShop').close();
    $('openShop').focus({preventScroll:true});
    playCareAnimation('fertilizer',kind);
    return true;
  }
  function gardenReward(correct,bonus){
    if(state.mode!=='main'||!correct)return {coins:0,boost:0};
    const g=profile.garden,rc=state.easy?EASY_RULES:GARDEN_RULES,earned=bonus?rc.bonusCoins:rc.baseCoins;
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
    const br=profile.level>=15&&route?branchFor(look.pet,routes,profile.branches):null;
    return `${pet}:${profile.level>=10&&route?'adult-'+route.id+(br?'-'+br.id:''):'young'}:${slot}:${look[slot]}`;
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
    illustration.innerHTML=creatureSVG(look.pet,route?.id,profile.level,WARDROBE.color.items.find(i=>i[0]===look.color)[2],concealed);habitat.dataset.scene=look.scene;{const sc=['meadow','sunset','night','rainbow'].includes(look.scene)?look.scene:'meadow';
      // 살구빛·보랏빛 숲의 기본 풍경은 그 숲 색깔의 언덕이에요. 언덕(땅)이 늘 보이도록 아래쪽을 기준으로 맞춰요.
      const file=sc==='meadow'&&activeForest===1?'apricot':sc==='meadow'&&activeForest===2?'violet':sc;
      habitat.style.backgroundImage=`url("assets/garden-${file}.svg")`;habitat.style.backgroundSize='cover';habitat.style.backgroundPosition='center 82%';}
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
    if(profile.level>=MAX_LEVEL){$('unlockHint').textContent='체험판은 Lv.10까지예요. 수강생판에서 Lv.15 신기한 식물 · Lv.20 전설의 식물로 계속 자라요!';return;}
    if(profile.level<10){$('unlockHint').textContent=`Lv.10까지 조금씩 성장해요. 다음 모습은 아직 비밀!`;return;}
    if(profile.level<15){$('unlockHint').textContent='Lv.15에 새로운 두 갈래가 열려요! 성장 보석도 달아 보세요.';return;}
    if(!branchFor(profile.look.pet,profile.routes,profile.branches)){$('unlockHint').textContent='나의 성장길에서 Lv.15 갈래를 골라 주세요!';return;}
    if(profile.level<20){$('unlockHint').textContent='Lv.20에 최종 진화가 기다려요!';return;}
    $('unlockHint').textContent='최종 진화 완료! 전설의 모습이에요.';
  }
  let draftLook=null,draftRoutes=null,drag=null,selectedSlot='head';
  function renderGrowthMap(){
    const tree=$('growthMapTree');tree.replaceChildren();
    const family=profile.family||profile.look.pet,chosen=routeFor(family,profile.routes),color=WARDROBE.color.items.find(c=>c[0]===profile.look.color)?.[2]||'#aac875';
    $('growthMapForest').textContent=FORESTS[activeForest].name+' · '+FORESTS[activeForest].grades;
    $('growthMapStatus').textContent=`${profile.look.name||growthName(family,profile.routes,profile.level)} · 현재 Lv.${profile.level}`;
    const node=(pet,route,level,name,reached,current=false,branch)=>{
      const el=document.createElement('div');el.className='growth-node'+(reached?' reached':' unrevealed')+(current?' current':'');
      if(current)el.setAttribute('aria-current','step');
      const art=document.createElement('span');art.className='growth-node-art';art.setAttribute('aria-hidden','true');art.innerHTML=creatureSVG(pet,route,level,color,!reached,branch);
      const title=document.createElement('strong');title.textContent=name;
      const label=document.createElement('small');label.textContent=`Lv.${level}`+(current?' · 지금 여기':reached?' · 지나온 길':' · 아직 만나지 않은 모습');el.append(art,title,label);
      if(level===20)el.classList.add('legend-node');
      const intro=reached&&branch&&(level===15||level===20)?PLANT_INTROS[branch+(level>=20?':20':'')]:null;
      if(intro){const q=document.createElement('p');q.className='growth-node-intro';q.textContent='“'+intro[1]+'”';el.append(q);}
      return el;
    };
    const buildBranch=(pet,info,selected)=>{
      const branch=document.createElement('section');branch.className='growth-branch'+(selected?' followed':'');branch.dataset.family=pet;
      branch.setAttribute('aria-label',info.name+(selected?' · 내가 걸어온 길':''));
      branch.append(node(pet,null,3,info.name,selected,selected&&profile.level===3));
      if(!petAllowed(pet)){const lock=document.createElement('p');lock.className='tiny';lock.textContent='잠김 · 수강생 전용';branch.append(lock);}
      const steps=document.createElement('div');steps.className='growth-steps';
      for(let lv=4;lv<=9;lv++)steps.append(node(pet,null,lv,selected&&profile.level>=lv?'자라는 '+info.name:'?',selected&&profile.level>=lv,selected&&profile.level===lv));
      branch.append(steps);
      const label=document.createElement('h4');label.textContent='Lv.10 · 마지막 세 갈래';branch.append(label);
      const finals=document.createElement('div');finals.className='growth-finals';
      for(const route of info.routes){const reached=selected&&profile.level>=10&&chosen?.id===route.id;finals.append(node(pet,route.id,10,reached?route.final:'?',reached,reached));}
      branch.append(finals);
      const more=document.createElement('p');more.className='tiny growth-more';more.textContent='Lv.15에 갈래마다 신기한 식물 두 가지 · Lv.20에 고대·전설의 식물로 변신해요.';branch.append(more);return branch;
    };
    const link=on=>{const i=document.createElement('i');i.className='growth-link'+(on?' on':'');i.setAttribute('aria-hidden','true');return i;};
    const heading=(text,tag='h3')=>{const h=document.createElement(tag);h.className='growth-journey-label';h.textContent=text;return h;};
    const picked=profile.level>=3&&profile.family&&GROWTH[profile.family]?profile.family:null;
    if(picked){
      // 고른 계열이 있으면 마음씨 → 마음싹 → 그 계열로 한 줄로 바로 이어서 보여 줘요.
      const info=GROWTH[picked],journey=document.createElement('div');journey.className='growth-journey';
      journey.append(node('seed',null,1,'마음씨',true,false),link(true),node('sprout',null,2,'마음싹',true,false),link(true),
        heading(`Lv.3 · 내가 고른 갈래 · ${info.name}`),node(picked,null,3,info.name,true,profile.level===3),link(profile.level>=4),
        heading('Lv.4 ~ 9 · 쑥쑥 자라는 길','h4'));
      const steps=document.createElement('div');steps.className='growth-journey-grid';
      for(let lv=4;lv<=9;lv++)steps.append(node(picked,null,lv,profile.level>=lv?'자라는 '+info.name:'?',profile.level>=lv,profile.level===lv));
      journey.append(steps,link(profile.level>=10),heading(chosen?`Lv.10 · ${chosen.name}`:'Lv.10 · 세 갈래 중 하나','h4'));
      const finals=document.createElement('div');finals.className='growth-journey-grid';
      for(const route of info.routes){const reached=profile.level>=10&&chosen?.id===route.id;const el=node(picked,route.id,10,reached?route.final:route.name,reached,reached&&profile.level<11,null);if(!reached&&chosen)el.classList.add('not-taken');finals.append(el);}
      journey.append(finals);
      if(MAX_LEVEL<=10){const lock=document.createElement('div');lock.className='growth-trial-lock';lock.innerHTML='<strong>🔒 Lv.11 ~ 20은 수강생판에서 열려요</strong><span>Lv.15 신기한 식물 · Lv.20 고대·전설의 식물로 변신하는 길이 기다리고 있어요.</span>';journey.append(link(false),lock);}
      else{
      // Lv.11 ~ 20: 무르익는 길 → Lv.15 신기한 식물(두 갈래) → 신비한 길 → Lv.20 고대·전설의 식물
      const lv=profile.level,br=branchFor(picked,profile.routes,profile.branches);
      const grid=cls=>{const g=document.createElement('div');g.className='growth-journey-grid '+cls;return g;};
      const g1=grid('cols4');
      for(let l=11;l<=14;l++)g1.append(chosen?node(picked,chosen.id,l,lv>=l?'무르익는 '+chosen.final:'?',lv>=l,lv===l,null):node(picked,null,l,'?',false,false,null));
      journey.append(link(lv>=11),heading('Lv.11 ~ 14 · 무르익는 길','h4'),g1,link(lv>=15),heading(br?`Lv.15 · 신기한 식물로 변신 · ${br.name}`:'Lv.15 · 신기한 식물로 변신 · 두 갈래 중 하나','h4'));
      const g2=grid('cols2');
      if(chosen)for(const b of chosen.branches){const reached=lv>=15&&br?.id===b.id;const el=node(picked,chosen.id,15,b.name,reached,reached&&lv<16,b.id);if(!reached&&br)el.classList.add('not-taken');g2.append(el);}
      else for(let i=0;i<2;i++)g2.append(node(picked,null,15,'?',false,false,null));
      const g3=grid('cols4');
      const STAGE16=['뿌리를 내리는 중','신비한 빛을 모으는 중','전설을 꿈꾸는 중','깨어나기 직전!'];
      for(let l=16;l<=19;l++)g3.append(br?node(picked,chosen.id,l,lv>=l?STAGE16[l-16]:'?',lv>=l,lv===l,br.id):node(picked,chosen?.id||null,l,'?',false,false,null));
      const g4=grid('single');
      g4.append(br?node(picked,chosen.id,20,lv>=20?br.final:'??? 전설의 식물',lv>=20,lv>=20,br.id):node(picked,chosen?.id||null,20,'??? 전설의 식물',false,false,null));
      if(lv<20){const hint=document.createElement('p');hint.className='growth-legend-hint';hint.textContent=br?`Lv.20이 되면 ${br.name}이(가) 고대·전설의 식물로 깨어나요. 어떤 모습일지는 그때 공개!`:'Lv.15에서 고른 식물이 Lv.20에 고대·전설의 식물로 깨어나요.';g4.append(hint);}
      journey.append(g2,link(lv>=16),heading(br?`Lv.16 ~ 19 · ${br.name}의 신비한 길`:'Lv.16 ~ 19 · 신비한 길','h4'),g3,link(lv>=20),heading('Lv.20 · 최종 진화 · 고대·전설의 식물','h4'),g4);
      }
      tree.append(journey);
      const others=document.createElement('details');others.className='growth-others';
      const sum=document.createElement('summary');sum.textContent='다른 다섯 갈래도 구경하기';others.append(sum);
      const branches=document.createElement('div');branches.className='growth-branches';
      for(const [pet,inf] of Object.entries(GROWTH))if(pet!==picked)branches.append(buildBranch(pet,inf,false));
      others.append(branches);tree.append(others);
    }else{
      const origin=document.createElement('div');origin.className='growth-origin';origin.append(node('seed',null,1,'마음씨',true,profile.level===1),node('sprout',null,2,'마음싹',profile.level>=2,profile.level===2));tree.append(origin);
      tree.append(heading(profile.level>=3?'Lv.3 · 여섯 갈래 중 하나를 골라 주세요':'Lv.3 · 여섯 갈래의 시작'));
      const branches=document.createElement('div');branches.className='growth-branches';
      for(const [pet,info] of Object.entries(GROWTH))branches.append(buildBranch(pet,info,false));
      tree.append(branches);
    }
    $('resumeGrowth').hidden=!(profile.level>=3&&!profile.family||profile.level>=10&&!chosen||profile.level>=15&&chosen&&!branchFor(family,profile.routes,profile.branches));
  }
  $('openGrowth').onclick=()=>{resetFriend();renderGrowthMap();$('growthMapDialog').showModal();requestAnimationFrame(()=>$('growthMapTree').querySelector('.growth-journey .current, .growth-origin .current')?.scrollIntoView({block:'center'}));};
  $('resumeGrowth').onclick=()=>{
    $('growthMapDialog').close();resetFriend();closeEvolution(false);
    $('evolutionLevels').textContent=`Lv.${profile.level} · 기다리는 진화`;$('evolutionPhrase').textContent='一起长大吧！';
    const copy=$('mascot').cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.className='mascot forest-avatar evolution-avatar';$('evolutionBefore').append(copy);
    $('evolutionDialog').showModal();presentEvolutionChoice();
  };
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
    $('previewName').textContent=draftLook.name||growthName(draftLook.pet,draftRoutes,profile.level);$('previewStage').textContent=growthName(draftLook.pet,draftRoutes,profile.level);
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
      if(key==='pet')continue;
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
    function effect(name,delay=0){if(!settings.effects||document.hidden)return;if(!ctx||ctx.state!=='running')return;if(name==='buzz'||name==='spray'){insectSound(name==='spray');return;}if(name==='thunder'){thunderSound();return;}if(name==='land'){const t=ctx.currentTime+.015;note(38,t,.18,.17,'effect','bass');note(45,t+.04,.12,.08,'effect','bass');return;}if(name==='timer'){clockTick(ctx.currentTime+.015+delay);return;}if(name==='legend'){const t=ctx.currentTime+.02+delay;[[36,0],[43,.02],[48,.9],[55,.92],[36,1.8],[48,1.82]].forEach(([m,o])=>note(m,t+o,.9,.16,'effect','bass'));[[60,0,.3],[64,.12,.3],[67,.24,.3],[72,.36,.35],[76,.5,.35],[79,.64,.4],[84,.8,.9],[72,1.2,.25],[76,1.3,.25],[79,1.4,.25],[84,1.5,.3],[88,1.62,.35],[91,1.76,1.2],[96,1.9,1.4],[84,1.9,1.4],[88,1.9,1.4]].forEach(([m,o,l])=>note(m,t+o,l,.075,'effect','bell'));for(let i=0;i<10;i++)note(96+(i%4)*3,t+2.4+i*.09,.25,.03,'effect','bell');return;}for(const [pitch,offset,length,gain] of phrases[name]||phrases.tap)note(pitch,ctx.currentTime+.015+offset+delay,length,gain,'effect','bell');}
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
  // 뜻은 ; 또는 , 로 나뉘어요(괄호 안의 쉼표는 제외). 같은 뜻이 하나라도 겹치면 오답 보기로 쓰지 않아요.
  const meaningParts = text => text.split(/[;；,，](?![^()（）]*[)）])/).map(s=>s.replace(/[~～]/g,'').trim()).filter(Boolean);
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
    // 중국어(보통화) 음성만 모아요. 안드로이드는 cmn-CN, zh_CN 처럼 표시하기도 해요. 홍콩·대만·광둥어는 빼요.
    voices=window.speechSynthesis.getVoices().filter(v=>/^(zh|cmn)(\b|[-_])/i.test(v.lang)&&!/(HK|TW|MO|yue|Hant)/i.test(v.lang)&&!/(粤|粵|臺灣|台灣|香港|Cantonese|Taiwan|Hong ?Kong)/i.test(v.name));
    const best=chineseVoice();
    $('voiceSelect').replaceChildren(new Option(best?`${best.name} (${best.lang})`:'기본 중국어 음성',best?.voiceURI||''));
    $('voiceSelect').value=best?.voiceURI||'';$('voiceSelect').disabled=true;
    $('audioStatus').textContent=!voices.length?'이 기기에서 중국어 음성을 찾지 못했어요. 아래 안내대로 중국어 음성을 설치해 주세요.':
      `지금 쓰는 음성 · ${best.name}. 기기마다 가장 좋은 여성 음성을 자동으로 골라요.`;
  }
  // 음성 우선순위: 아이폰·맥 Tingting → 엣지 Xiaoxiao(자연스러운 여성) → 구글 보통화(여성) → 그 밖의 여성 음성 → 아무 보통화 음성
  const VOICE_RANK=[
    /ting-?ting|婷婷/i,
    /xiaoxiao/i,
    /google.*(普通话|中国大陆|mandarin|chinese)|google.*zh/i,
    /cmn-cn-x-(ccc|cce|ssa)/i,
    /xiaoyi|xiaohan|xiaomeng|xiaomo|xiaoxuan|xiaorui|xiaoshuang/i,
    /huihui|yaoyao/i,
    /lili|yu-?shu|meijia|sinji/i,
    /samsung|female|女/i
  ];
  const MALE_VOICE=/kangkang|yunxi|yunyang|yunjian|yunye|yunfeng|yunhao|li-?mu|male(?!.*female)|男/i;
  function chineseVoice(){
    for(const re of VOICE_RANK){const v=voices.find(x=>re.test(x.name)||re.test(x.voiceURI));if(v)return v;}
    return voices.find(v=>/CN|Hans/i.test(v.lang)&&!MALE_VOICE.test(v.name))||voices.find(v=>!MALE_VOICE.test(v.name))||voices[0]||null;
  }
  function speak(entry) {
    stopSound();
    const token=soundToken;
    const fallback=()=>{
      if(token!==soundToken) return;
      if(!('speechSynthesis' in window)){$('audioStatus').textContent='TTS 미지원 브라우저입니다.';return;}
      if(!voices.length) populateVoices();
      const u=new SpeechSynthesisUtterance(entry.hanzi);
      const v=chineseVoice();try{u.voice=v;}catch{}u.lang=v?.lang?.replace('_','-')||'zh-CN';u.rate=Number($('speechRate').value);u.pitch=1;
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
  function screen(name) {document.body.dataset.screen=name;if(name==='setup')setTimeout(flushSay,400);if(name==='game')$('adventureDialog').close();$('forestTabs').querySelectorAll('button').forEach(b=>b.disabled=name==='game');['setup','game','result'].forEach(id=>$(id).hidden=id!==name);$('openCloset').disabled=name==='game';document.body.classList.toggle('playing',name==='game');renderCare();}
  function clearTimer(){if(timer!==null){clearInterval(timer);timer=null;}}
  function changeXP(delta) {
    if(state.mode==='practice') return 0;
    const before=profile.xp;
    // Keep the XP floor at the start of the level already earned.
    profile.xp=Math.min(xpCap(),Math.max(xpStart(profile.level),profile.xp+delta));
    if(MAX_LEVEL!==Infinity&&profile.xp>=xpCap()&&before<xpCap())friendSay('体验版只能长到10级哦！','체험판은 Lv.10까지 자랄 수 있어요. 수강생판에서는 Lv.20 전설의 식물까지 키울 수 있어요!');
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
    $('promotionTimer').style.setProperty('--remaining',String(promotionRemaining/PROMO_MS));
    $('promotionTimer').setAttribute('aria-label',seconds?`홍보 종료까지 ${seconds}초`:'홍보 시청 완료');
    $('promotionContinue').disabled=seconds>0;$('promotionClose').disabled=seconds>0;
    $('promotionWait').textContent=seconds?`${seconds}초 후 닫을 수 있어요.`:'이제 닫고 결과를 볼 수 있어요.';
    if(!seconds){clearInterval(promotionClock);promotionClock=null;}
  }
  document.addEventListener('visibilitychange',()=>{promotionLast=performance.now();});
  function showPromotion(stage,done){
    if(STUDENT_BG){done();return;}
    if($('promotionDialog').open)return;
    const copy=PROMOTIONS[stage];
    $('promotionTitle').textContent=copy.title;$('promotionBody').textContent=copy.body;$('promotionNote').textContent=copy.note;$('promotionContinue').textContent=copy.button;
    promotionDone=done;promotionRemaining=PROMO_MS;promotionLast=performance.now();updatePromotionTimer();$('promotionDialog').showModal();$('promotionTimer').focus();promotionClock=setInterval(updatePromotionTimer,100);
  }
  function closePromotion(){
    if(!$('promotionDialog').open||promotionRemaining>0)return;
    $('promotionDialog').close();const done=promotionDone;promotionDone=null;done?.();
  }
  $('promotionContinue').onclick=closePromotion;$('promotionClose').onclick=closePromotion;
  $('promotionDialog').addEventListener('cancel',e=>{e.preventDefault();closePromotion();});

  // kind: 'normal' | 'refill'(틀린 단어 다시 풀어 물뿌리개 채우기) | 'due'(오늘의 복습)
  function start(reviewIds=null,kind=reviewIds?'refill':'normal') {
    closeEvolution(false);
    forestAudio.unlock();
    refreshGarden();
    stopSound();clearTimer();
    const level=Number($('levelSelect').value);
    const needed=kind==='normal'?[level]:forestLevels();
    if(needed.some(l=>!levelReady(l)&&levelState[l]!=='failed')){
      $('startBtn').disabled=true;$('wordCount').textContent='단어를 불러오는 중…';
      loadLevels(needed).then(()=>{updateCount();start(reviewIds,kind);});return;
    }
    const roundChoice=$('roundSize').value;
    let queue=[],reviews=0;
    if(kind==='normal'){
      const pool=levelWords(level);if(pool.length<4)return;
      const size=roundChoice==='all'?pool.length:Number(roundChoice);
      ({queue,reviews}=buildQueue(pool,size));
    }else if(kind==='refill'){
      queue=shuffle(data.filter(w=>reviewIds.includes(w.id)));
    }else{
      const size=roundChoice==='20'?20:10;
      queue=shuffle(dueWords(forestLevels()).slice(0,size));reviews=queue.length;
    }
    queue=queue.filter(w=>levelWords(w.level).length>=4);
    if(!queue.length){if(kind==='due'){friendSay('今天的复习都完成啦！','오늘 복습을 다 끝냈어!');renderCare();}return;}
    state={mode:kind==='refill'?'practice':document.querySelector('input[name="mode"]:checked').value,kind,
      direction:'mixed',easy:kind==='refill'||difficulty()==='easy',queue,reviews,relaxed:$('timeSetting')?.value==='relaxed',
      roundChoice:kind==='normal'?roundChoice:'review',index:0,phase:'basic',answered:0,correct:0,bonusAnswered:0,bonusCorrect:0,netXP:0,earnedCoins:0,fertilizerXP:0,
      streak:0,bestStreak:0,streakXP:0,
      mistakes:new Map(),startLevel:profile.level,startAppearance:$('mascot').innerHTML,growthEventPlayed:false};
    screen('game');showQuestion(false);
  }
  const questionSeconds=(word,bonus)=>(LEVEL_SECONDS[word.level]||RULES.seconds)+(bonus?RULES.bonusExtra:0)+(state?.relaxed?RULES.relaxedExtra:0);
  // Pronunciation belongs to the reveal panel, never to quiz choices.
  function cleanQuizText(value){
    return String(value||'').replace(/[（(][^()（）]*[A-Za-z\u00c0-\u024f\u1e00-\u1eff][^()（）]*[)）]/g,'')
      .replace(/[A-Za-z\u00c0-\u024f\u1e00-\u1eff]+/g,'').replace(/\s+/g,' ').trim();
  }
  function pinyinToggle(hanzi,pinyin,id){
    const wrap=document.createElement('span');wrap.className='quiz-reading';
    const button=document.createElement('button');button.type='button';button.className='hanzi-reveal';button.textContent=hanzi;button.lang='zh-CN';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);
    const py=document.createElement('span');py.id=id;py.className='quiz-pinyin';py.textContent=pinyin||'병음 준비 중';py.hidden=!state?.easy;button.setAttribute('aria-expanded',String(!py.hidden));
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
      : levelWords(word.level).filter(p=>compatible(e,p));
    const label=x=>cleanQuizText(state.directionNow==='zh-ko'?x.meaning:x.hanzi);
    const seen=new Set([label(e)]), wrong=[];
    // Prefer other phrases of this word for a meaningful bonus, then fill from the pool.
    const ordered=bonus?[...shuffle(candidates.filter(p=>p.parent===word.id)),...shuffle(candidates.filter(p=>p.parent!==word.id))]:shuffle(candidates);
    for(const candidate of ordered){if(label(candidate)&&!seen.has(label(candidate))){wrong.push(candidate);seen.add(label(candidate));}if(wrong.length===3)break;}
    if(wrong.length!==3) {finish();$('resultSubtitle').textContent='서로 다른 보기가 부족해 종료했어요. data.js 내용을 확인해 주세요.';return;}
    state.options=shuffle([e,...wrong]);
    $('gameMode').textContent=state.kind==='refill'?'💧 틀린 단어 다시 풀기':state.mode==='practice'?'☘ 틀린 단어 연습':state.easy?'🌱 쉬운 모드':'🔥 어려운 모드';
    $('questionNumber').textContent=`${state.index+1} / ${state.queue.length} 단어`;
    $('roundProgress').max=state.queue.length;$('roundProgress').value=state.index;
    $('sessionXp').textContent=state.mode==='practice'?'경험치·코인 없음':`${state.netXP>=0?'+':''}${state.netXP} XP · ${state.earnedCoins} 코인`;
    const fertilizerBoost=state.mode==='main'&&profile.garden.active?FERTILIZERS[profile.garden.active.kind].boost:0;
    const reviewing=!bonus&&memoryOf(word)&&(state.kind==='due'||isDue(memoryOf(word)));
    $('questionKind').textContent=bonus?`✦ 짝꿍어휘 보너스 · +${state.easy?EASY_RULES.bonusXP:RULES.bonusXP} XP`:(reviewing?'↺ 복습 단어 · ':memoryOf(word)?'기본 단어 · ':'✦ 새 단어 · ')+(state.mode==='main'?`+${state.easy?EASY_RULES.baseXP:RULES.baseXP} XP${fertilizerBoost?` + 비료 ${fertilizerBoost}`:''}`:'천천히 풀어요');
    $('questionInstruction').textContent=bonus?(state.directionNow==='zh-ko'?'이 짝꿍 표현의 뜻을 골라 주세요.':'이 뜻에 맞는 짝꿍 표현을 골라 주세요.'):state.directionNow==='zh-ko'?'이 단어의 뜻은 무엇일까요?':'이 뜻에 맞는 한자를 골라 주세요.';
    $('questionText').replaceChildren();
    if(state.directionNow==='zh-ko')$('questionText').append(pinyinToggle(e.hanzi,e.pinyin,'promptPinyin'));else $('questionText').textContent=e.meaning;
    $('quizHint').textContent=state.easy?'병음이 함께 보여요 · 보기 선택 또는 키보드 1–4':state.directionNow==='ko-zh'?'한자를 누르면 병음 · 선택 버튼 또는 키보드 1–4로 답하기':'문제의 한자를 누르면 병음 · 보기 선택 또는 키보드 1–4';
    $('questionText').classList.toggle('korean',state.directionNow==='ko-zh');
    $('questionText').lang=state.directionNow==='zh-ko'?'zh-CN':'ko';
    $('answers').replaceChildren();
    state.options.forEach((option,i)=>{
      if(state.directionNow==='ko-zh'){
        const card=document.createElement('div');card.className='answer answer-reading';card.dataset.option=option.id;card.append(pinyinToggle(label(option),option.pinyin,'choicePinyin'+i));
        const choose=document.createElement('button');choose.type='button';choose.className='answer-select';choose.textContent=`${i+1} · 선택`;choose.setAttribute('aria-label',`${i+1}번 ${label(option)} 선택`);choose.onclick=()=>answer(option.id);card.append(choose);$('answers').append(card);return;
      }
      const button=document.createElement('button');button.type='button';button.className='answer';button.dataset.option=option.id;
      const num=document.createElement('span');num.className='number';num.textContent=i+1;num.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=label(option);text.lang=state.directionNow==='ko-zh'?'zh-CN':'ko';
      button.append(num,text);button.addEventListener('click',()=>answer(option.id));$('answers').append(button);
    });
    $('timerBar').hidden=state.mode==='practice';$('timerText').classList.remove('urgent');
    if(state.mode==='practice'){$('timerText').textContent='시간제한 없음';}
    else {
      const seconds=questionSeconds(word,bonus);$('timerBar').max=seconds;
      state.deadline=performance.now()+seconds*1000;state.lastChime=seconds;
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
  let revealTimer=null;
  function answer(id) {
    if(!state||!['basic','bonus'].includes(state.phase)) return;
    if(state.mode==='main'&&performance.now()>=state.deadline)id=null;
    const bonus=state.phase==='bonus', correct=id===state.entry.id;
    const chosen=id&&!correct?state.options.find(o=>o.id===id):null;
    state.phase='feedback';clearTimer();
    $('answers').querySelectorAll('button').forEach(b=>b.disabled=true);
    // Show the result on the quiz itself first: my pick in red, the right answer in green.
    $('answers').querySelectorAll('[data-option]').forEach(el=>{
      el.classList.toggle('is-correct',el.dataset.option===state.entry.id);
      el.classList.toggle('is-wrong',!!chosen&&el.dataset.option===chosen.id);
      el.classList.toggle('is-dim',el.dataset.option!==state.entry.id&&!(chosen&&el.dataset.option===chosen.id));
    });
    $('answers').classList.add('answered');
    if(bonus){state.bonusAnswered++;if(correct)state.bonusCorrect++;}
    else{state.answered++;if(correct)state.correct++;recordStudy(state.word);rememberAnswer(state.word,correct);}
    if(!correct) state.mistakes.set(state.entry.id,{...state.entry,parent:state.word.id,bonus});
    const previousLevel=profile.level;
    const reward=gardenReward(correct,bonus);
    // Streak: every RULES.streakEvery basic answers in a row earns a small bonus. Mistakes cost nothing.
    let streakBonus=0;
    if(!bonus&&state.mode==='main'){
      state.streak=correct?state.streak+1:0;state.bestStreak=Math.max(state.bestStreak,state.streak);
      if(correct&&state.streak%RULES.streakEvery===0)streakBonus=state.easy?EASY_RULES.streakXP:RULES.streakXP;
    }
    const R=state.easy?EASY_RULES:RULES;
    const delta=changeXP(correct?(bonus?R.bonusXP:R.baseXP+reward.boost+streakBonus):(bonus?0:-RULES.penalty));
    state.earnedCoins+=reward.coins;state.fertilizerXP+=reward.boost;state.streakXP+=streakBonus;
    state.netXP+=delta;
    state.offerBonus=!bonus&&correct&&state.mode==='main'&&state.word.collocations.length>0;
    $('feedbackIcon').textContent=correct?'✓':id===null?'◷':'↻';
    $('feedback').dataset.result=correct?'correct':'wrong';
    $('feedbackTitle').textContent=correct?(streakBonus?`${state.streak}개 연속 정답!`:'정답이에요!'):id===null?'시간이 다 됐어요':'다시 익히면 괜찮아요';
    $('rewardText').textContent=correct?(state.mode==='practice'?'부담 없이 익히는 중':''):bonus?'보너스는 틀려도 괜찮아요':'다음 판에 다시 나와요';
    if(state.mode==='main'&&correct)$('rewardText').textContent=`+${delta} XP${reward.boost?` (비료 +${reward.boost})`:''}${streakBonus?` (연속 보너스 +${streakBonus})`:''} · +${reward.coins} 코인`;
    const koreanPrompt=state.directionNow==='ko-zh';
    $('answerHanzi').textContent=koreanPrompt?state.entry.meaning:state.entry.hanzi;
    $('answerHanzi').lang=koreanPrompt?'ko':'zh-CN';
    $('answerPinyin').textContent=state.entry.pinyin;
    $('answerMeaning').textContent=koreanPrompt?state.entry.hanzi:state.entry.meaning;
    $('answerMeaning').lang=koreanPrompt?'zh-CN':'ko';
    const details=$('answerMeaning').parentElement;
    if(koreanPrompt)details.insertBefore($('answerMeaning'),$('answerPinyin'));
    else details.insertBefore($('answerPinyin'),$('answerMeaning'));
    // A wrong answer shows everything at once; a right answer still invites recalling first.
    const reveal=!correct;
    $('answerPinyin').hidden=!reveal;$('answerMeaning').hidden=!reveal;$('answerHanzi').setAttribute('aria-expanded',String(reveal));
    $('pinyinHint').textContent=reveal?'정답 · 병음을 보며 소리 내어 읽어 보세요':koreanPrompt?'먼저 중국어로 말해 보세요 · 뜻을 누르면 한자와 병음이 보여요':'먼저 읽고 뜻을 떠올려 보세요 · 한자를 누르면 병음과 뜻이 보여요';
    const chosenBox=$('feedbackChosen');chosenBox.replaceChildren();chosenBox.hidden=!chosen;
    if(chosen){
      const label=document.createElement('span');label.textContent='내가 고른 답';
      const zh=document.createElement('strong');zh.lang='zh-CN';zh.textContent=chosen.hanzi;
      const py=document.createElement('small');py.textContent=chosen.pinyin||'';
      const ko=document.createElement('span');ko.textContent=chosen.meaning;
      chosenBox.append(label,zh,py,ko);
    }
    $('feedbackNote').textContent=state.offerBonus?'이 단어와 함께 쓰는 표현도 익혀 볼까요?':correct?'발음을 듣고 한 번 따라 말해 보세요.':'결과 화면에서도 틀린 단어를 다시 볼 수 있어요.';
    $('continueBtn').textContent=state.offerBonus?'짝꿍어휘 도전 · +3 XP':state.index===state.queue.length-1?'학습 결과 보기':'다음 단어 →';
    $('skipBonus').hidden=!state.offerBonus;
    if(profile.level>previousLevel){
      const gifts=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>accessoryAllowed(i[0])&&i[3]>previousLevel&&i[3]<=profile.level);
      $('feedbackNote').textContent=`레벨 ${profile.level} 달성! `+([2,3,4,5,10,15,20].includes(profile.level)?(profile.level===2?'마음씨가 마음싹로 자랐어요!':profile.level===3?'학습 후 성장 계열을 선택하세요!':profile.level===15?'새로운 두 갈래가 열렸어요! 학습 후 골라 주세요.':profile.level===20?'최종 진화! 학습 후 전설의 모습을 확인하세요!':'친구가 더 자랐어요! 학습 후 달라진 모습을 확인하세요.'):gifts.length?gifts.map(i=>i[1]).join(' · ')+' 선물이 열렸어요. 학습 후 꾸며 보세요!':'친구와 한 걸음 더 자랐어요!');
    }
    forestAudio.effect(correct?(bonus?'bonus':'correct'):'wrong');
    if(profile.level>previousLevel||streakBonus)forestAudio.effect('level',.32);
    // Let the colours on the quiz register before the answer card covers them.
    const current=state;clearTimeout(revealTimer);
    revealTimer=setTimeout(()=>{if(state!==current||state.phase!=='feedback'||$('feedback').open)return;$('feedback').showModal();$('continueBtn').focus();},correct?450:950);
    // Pronunciation is strictly manual: use the listen button, including after correct answers.
  }
  function advance(skip=false) {
    if(!state||state.phase!=='feedback')return;
    clearTimeout(revealTimer);$('feedback').close();stopSound();$('answers').classList.remove('answered');
    if(state.offerBonus&&!skip){showQuestion(true);return;}
    state.index++;
    if(state.index>=state.queue.length)finish();else showQuestion(false);
  }
  function finish() {
    if(!state||state.phase==='result')return;
    state.perfectXP=0;
    if(state.mode==='main'&&['10','20'].includes(state.roundChoice)&&state.answered===Number(state.roundChoice)&&state.correct===state.answered){state.perfectXP=state.easy?(state.answered===10?EASY_RULES.perfect10:EASY_RULES.perfect20):state.answered===10?10:25;state.netXP+=changeXP(state.perfectXP);}
    const celebrate=state.mode==='main'&&profile.level>state.startLevel&&!state.growthEventPlayed;
    clearTimer();stopSound();if(!celebrate)forestAudio.effect('finish');state.phase='result';screen('result');
    if($('feedback').open)$('feedback').close();
    $('resultSubtitle').textContent=`${state.answered}개의 기본 문제를 풀었어요.`+(state.perfectXP?` 전체 정답 보너스 +${state.perfectXP} XP!`:'')+(profile.level>state.startLevel?` 레벨 ${profile.level} 달성!`:'');
    // 물뿌리개 채우기
    const g=profile.garden,wrong=[...new Set([...state.mistakes.values()].filter(m=>!m.bonus).map(m=>m.parent))];
    const finished=state.index>=state.queue.length&&state.answered>0,before=g.canFull?1:g.can||0;let canLine='';
    if(finished&&(state.kind==='refill'||state.mode==='main')&&!g.canFull){
      if(!wrong.length){g.canFull=true;g.can=1;g.retry=[];canLine=state.kind==='refill'?'틀린 단어를 모두 맞혔어요! 물뿌리개가 가득 찼어요. 로비에서 물을 주세요.':'모두 맞혔어요! 물뿌리개가 가득 찼어요. 로비에서 물을 주세요.';}
      else{g.retry=wrong;g.can=Math.max(g.can||0,Math.min(.85,state.correct/state.answered));canLine=`틀린 단어 ${wrong.length}개를 다시 풀어 다 맞히면 물뿌리개가 가득 차요.`;}
      save();
    }else if(g.canFull)canLine='물뿌리개는 이미 가득 차 있어요. 로비에서 물을 주세요.';
    state.canJustFilled=g.canFull&&before<1;
    const rc=$('resultCan');rc.hidden=!canLine;$('resultCanText').textContent=canLine;rc.classList.toggle('full',g.canFull);
    rc.style.setProperty('--from',String(before));rc.style.setProperty('--to',String(g.canFull?1:g.can||0));rc.classList.remove('animate');void rc.offsetWidth;rc.classList.add('animate');
    const gardenLine=state.mode==='practice'?'틀린 단어 연습에서는 코인·경험치 변화와 비료 소모가 없어요.':`숲 코인 +${state.earnedCoins}`+(state.fertilizerXP?` · 비료 추가 +${state.fertilizerXP} XP`:'')+(state.streakXP?` · 연속 정답 보너스 +${state.streakXP} XP (최고 ${state.bestStreak}연속)`:'');
    $('resultGarden').textContent=gardenLine;
    const backSoon=[...state.mistakes.values()].filter(m=>!m.bonus).length;
    $('resultMemory').replaceChildren();
    const lines=[];
    if(state.reviews)lines.push(['↺',`복습 단어 ${state.reviews}개를 다시 만났어요.`]);
    if(backSoon)lines.push(['📌',`틀린 단어 ${backSoon}개는 다음 판에 먼저 나와요.`]);
    else if(state.answered)lines.push(['🌱','맞힌 단어는 며칠 뒤 복습으로 다시 만나요.']);
    lines.forEach(([icon,text])=>{const p=document.createElement('p');const i=document.createElement('span');i.textContent=icon;i.setAttribute('aria-hidden','true');p.append(i,document.createTextNode(text));$('resultMemory').append(p);});
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
    $('reviewBtn').hidden=g.canFull||!g.retry.length;
    $('reviewBtn').textContent=`💧 틀린 단어 ${g.retry.length}개 다시 풀고 물 채우기`;
    $('homeBtn').focus({preventScroll:true});
    const evolve=()=>{if(celebrate){state.growthEventPlayed=true;showEvolution();}};
    showPromotion('finish',()=>{if(state.perfectXP)showPerfect(evolve);else evolve();});
  }
  function syncDifficulty(){document.querySelectorAll('input[name="difficulty"]').forEach(r=>{r.checked=r.value===(profile.difficulty||'hard');});modeChanged();}
  function modeChanged(){
    const easy=difficulty()==='easy';
    if(profile.difficulty!==(easy?'easy':'hard')){profile.difficulty=easy?'easy':'hard';save();}
    $('ruleBox').innerHTML=easy
      ?'<b>쉬운 모드</b> · 두 방향이 섞여 나오고, 한자에 병음이 늘 함께 보여요.<br>기본 정답 <b>+3 XP · 1코인</b> · 5개 연속 정답마다 <b>+2 XP</b> · 짝꿍어휘 보너스 <b>+2 XP</b>'
      :'<b>어려운 모드</b> · 두 방향이 섞여 나오고, 병음은 한자를 눌러야 보여요.<br>기본 정답 <b>+5 XP · 2코인</b> · 5개 연속 정답마다 <b>+3 XP</b> · 짝꿍어휘 보너스 <b>+3 XP · 1코인</b>';
    $('startBtn').firstChild.textContent='모험 시작하기 ';
    $('startBtn').nextElementSibling.textContent='기본 문제를 맞히면 짝꿍어휘 보너스에 도전할 수 있어요.';
    if(levelReady(Number($('levelSelect').value)))updateCount();else renderStartCard();
  }
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();clearTimer();stopSound();state=null;screen('setup');refreshGarden();});
  $('startBtn').onclick=()=>start();$('continueBtn').onclick=()=>advance();$('skipBonus').onclick=()=>advance(true);
  $('feedback').addEventListener('cancel',e=>e.preventDefault());
  $('replayBtn').onclick=()=>{if(state)speak(state.entry);};
  $('quitBtn').onclick=finish;
  $('homeBtn').onclick=()=>{const filled=!!state?.canJustFilled;stopSound();state=null;screen('setup');refreshGarden();if(filled)friendSay('水壶满啦！快给我浇水吧！','물뿌리개가 가득 찼어! 나한테 물 줘!');(mobileLayout.matches?$('openAdventure'):$('startBtn')).focus();};
  $('reviewBtn').onclick=()=>start([...profile.garden.retry]);
  document.querySelectorAll('input[name="difficulty"]').forEach(r=>{r.checked=r.value===(profile.difficulty||'hard');r.addEventListener('change',modeChanged);});
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
  // 로비에서 캐릭터가 중국어로 말하고 아래에 번역을 보여 줘요. 문제 중이거나 창이 열려 있으면 로비로 돌아왔을 때 말해요.
  let pendingSay=null;
  function friendSay(zh,ko){
    const ready=!$('gameApp').hidden&&document.body.dataset.screen==='setup'&&!document.querySelector('dialog[open]');
    if(ready)setTimeout(()=>showFriendPhrase([zh,ko]),300);else pendingSay=[zh,ko];
  }
  function flushSay(){if(!pendingSay)return;const p=pendingSay;pendingSay=null;friendSay(...p);}
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>setTimeout(flushSay,200)));
  function showFriendPhrase([zh,ko],placement='above'){
    bubble.classList.toggle('bubble-below',placement==='below');
    $('friendChinese').textContent=zh;$('friendKorean').textContent=ko;
    clearTimeout(bubbleTimer);clearTimeout(bubbleEnd);bubble.hidden=false;positionBubble();
    requestAnimationFrame(()=>bubble.classList.add('bubble-visible'));
    bubbleTimer=setTimeout(hideBubble,Math.min(8000,3600+String(ko).length*70));
  }
  // 톡 누르면 인사말과 게임 도움말(중국어 + 번역)을 번갈아 들려줘요.
  const FRIEND_TIPS=[
    ['给我施肥，答对的时候能多得经验哦！','비료를 주면 기본 정답 경험치가 늘어나!'],
    ['一轮全部答对，水壶就满了！答错的词再做一次也可以哦。','한 판을 다 맞히면 물뿌리개가 가득 차! 틀리면 틀린 단어를 다시 풀면 돼.'],
    ['连续答对五个，还有奖励哦！','5개 연속으로 맞히면 보너스 경험치가 있어!'],
    ['错了也没关系，下次还会见到它。','틀려도 괜찮아. 다음 판에 또 만나게 될 거야.'],
    ['做完一轮，我就能喝饱水！','한 판을 끝내면 나도 물을 듬뿍 마셔!'],
    ['用金币可以买肥料和工具。','코인으로 비료와 돌봄 도구를 살 수 있어.']
  ];
  // 식물마다 들려주는 자기소개 (중국어 + 번역). 키: 씨앗/새싹, 계열(Lv.3~9), 길(Lv.10~14), 갈래(Lv.15~19), 갈래:20(Lv.20)
  const PLANT_INTROS={
    seed:['我是一颗小种子，正在做梦呢！','나는 작은 씨앗이야. 지금 꿈꾸는 중이야!'],
    sprout:['我刚发芽！每天学一点，我就长高一点。','나 막 싹이 텄어! 매일 조금씩 공부하면 나도 조금씩 자라.'],
    petal:['我是心花，喜欢阳光和新单词！','나는 마음꽃! 햇살이랑 새 단어를 좋아해!'],
    mushroom:['我是心菇，喜欢安静的树荫。','나는 마음송이. 조용한 나무 그늘을 좋아해.'],
    succulent:['我是心多肉，叶子里装满了水！','나는 마음담이. 잎 속에 물을 가득 담고 있어!'],
    clover:['我是心叶，找到我会有好运哦！','나는 마음잎! 나를 찾으면 행운이 온대!'],
    berry:['我是心果，越学越甜！','나는 마음열매. 공부할수록 달콤해져!'],
    tree:['我是心树，我会慢慢长得很高很高。','나는 마음나무. 천천히, 아주 높이 자랄 거야.'],
    sunflower:['我的脸总是跟着太阳转！','내 얼굴은 늘 해님을 따라 돌아가!'],
    rose:['我有刺，可是我很温柔哦。','나는 가시가 있지만 마음은 아주 부드러워.'],
    hibiscus:['我是韩国的国花，天天都开新花！','나는 한국의 나라꽃! 날마다 새 꽃을 피워!'],
    matsutake:['我是松茸，闻一闻，是秋天的味道！','나는 송이버섯! 킁킁, 가을 냄새가 나지?'],
    horn:['看我的角！是不是很帅？','내 뿔 좀 봐! 멋지지 않아?'],
    reishi:['我亮亮的，像涂了油一样！','나 반짝반짝하지? 기름을 바른 것 같대!'],
    undulata:['我的叶子像海浪，一波一波的！','내 잎은 파도처럼 물결물결 해!'],
    euphorbia:['别看我小，我可是很有个性的！','작다고 무시하지 마. 나 개성 넘친다고!'],
    cactus:['没有水我也不怕，我很有耐心！','물이 없어도 괜찮아. 나는 끈기가 대단하거든!'],
    lucky:['四片叶子，一片是你的好运！','잎이 네 장! 그중 한 장은 너의 행운이야!'],
    silver:['晚上我会发出银色的光。','밤이 되면 나는 은빛으로 빛나.'],
    crimson:['我开红色的小花，蜜蜂最喜欢我。','나는 빨간 꽃을 피워. 꿀벌이 나를 제일 좋아해.'],
    strawberry:['我的种子长在外面，你知道吗？','내 씨앗은 겉에 붙어 있어. 알고 있었어?'],
    blueberry:['吃我对眼睛好哦！','나를 먹으면 눈이 좋아진대!'],
    raspberry:['我小小的，可是很有活力！','나는 작지만 힘이 넘쳐!'],
    oak:['松鼠们都住在我这里。','다람쥐들이 모두 나한테 살고 있어.'],
    willow:['风一吹，我的长头发就跳舞。','바람이 불면 내 긴 머리카락이 춤을 춰.'],
    ginkgo:['秋天我会变成金黄色！','가을이 되면 나는 황금색으로 변해!'],
    twinsun:['我是世界上最大的花，味道有点臭哦！','나는 세상에서 가장 큰 꽃이야. 냄새는 조금 고약해!'],
    'twinsun:20':['我七年才开一次花，比你还高！','나는 7년에 한 번 꽃을 피워. 키는 너보다 커!'],
    moonflower:['我长得像一只飞鸟，你看出来了吗？','나는 날아가는 새를 닮았어. 알아봤어?'],
    'moonflower:20':['太阳每天早上从我的树枝上升起。','해님은 매일 아침 내 나뭇가지에서 떠올라.'],
    crimsonrose:['我会咬住小虫子！咔嚓！','나는 작은 벌레를 꽉 물어! 덥석!'],
    'crimsonrose:20':['我的大肚子里装得下一只老鼠！','내 커다란 통 속엔 생쥐도 들어가!'],
    bluerose:['我的花像一个钟，滴答滴答。','내 꽃은 시계를 닮았어. 째깍째깍.'],
    'bluerose:20':['我是从天上落下来的花。','나는 하늘에서 내려온 꽃이야.'],
    hongdansim:['我从泥里长出来，可是一点也不脏。','나는 진흙에서 자라지만 조금도 더럽지 않아.'],
    'hongdansim:20':['我睡了七百年才醒来！','나는 700년 동안 잠들었다가 깨어났어!'],
    baekdansim:['我的花像蝴蝶，要飞走了！','내 꽃은 나비 같아. 날아갈 것 같지?'],
    'baekdansim:20':['我的树上长着七种宝石。','내 나무엔 일곱 가지 보석이 열려.'],
    goldmatsutake:['冬天我是虫，夏天我是草！','겨울엔 벌레, 여름엔 풀! 나는 동충하초야!'],
    'goldmatsutake:20':['山神爷爷藏了我一千年。','산신령 할아버지가 나를 천 년 동안 숨겨 두셨어.'],
    twinmatsutake:['我穿着白色的蕾丝裙！','나는 하얀 레이스 치마를 입었어!'],
    'twinmatsutake:20':['月亮出来的时候，小精灵在我这里跳舞。','달이 뜨면 요정들이 내 고리 안에서 춤을 춰.'],
    firehorn:['关灯吧！我会自己发光！','불 꺼 봐! 나는 스스로 빛나!'],
    'firehorn:20':['很久很久以前，我比大树还高。','아주 먼 옛날, 나는 큰 나무보다 키가 컸어.'],
    icehorn:['碰我一下，噗！会冒出烟来！','나를 톡 건드리면 퐁! 먼지가 뿜어져 나와!'],
    'icehorn:20':['我在很冷很高的雪山上开花。','나는 아주 춥고 높은 눈산에서 꽃을 피워.'],
    redreishi:['我硬得像马蹄一样！','나는 말발굽처럼 단단해!'],
    'redreishi:20':['秦始皇找了我一辈子！','진시황이 평생 나를 찾아다녔대!'],
    nightreishi:['我害羞的时候，会流出黑墨水。','나는 부끄러우면 까만 먹물이 흘러나와.'],
    'nightreishi:20':['夜里，我是森林里的小灯笼。','밤이 되면 나는 숲속의 작은 등불이야.'],
    pinkwave:['我胖胖的，像一朵石头花。','나는 통통해. 돌로 만든 꽃 같지?'],
    'pinkwave:20':['我只有两片叶子，可是能活一千年！','나는 잎이 두 장뿐이지만 천 년을 살아!'],
    silverwave:['我是一串绿色的小珠子。','나는 초록 구슬 목걸이야.'],
    'silverwave:20':['恐龙出现以前，我就在这里了。','공룡이 나타나기 전부터 나는 여기 있었어.'],
    bloomeuphorbia:['沙漠里也能开出漂亮的花！','사막에서도 예쁜 꽃을 피울 수 있어!'],
    'bloomeuphorbia:20':['有人说我是倒着种的树。','사람들은 내가 거꾸로 심어진 나무래.'],
    violeteuphorbia:['嘘，我在假装是石头。','쉿, 나 지금 돌인 척하는 중이야.'],
    'violeteuphorbia:20':['我是地球上最早的植物之一！','나는 지구에서 가장 처음 생긴 식물 중 하나야!'],
    bloomcactus:['我像兔子的耳朵，软软的。','나는 토끼 귀를 닮았어. 폭신폭신해.'],
    'bloomcactus:20':['割开我，会流出红色的汁。','내 몸에선 빨간 수액이 흘러. 용의 피래!'],
    goldcactus:['我只在晚上开花，早上就睡了。','나는 밤에만 꽃을 피우고 아침엔 잠들어.'],
    'goldcactus:20':['我三千年才开一次花！','나는 삼천 년에 딱 한 번 꽃을 피워!'],
    fiveleaf:['我的叶子是心形的！爱你哦！','내 잎은 하트 모양이야! 사랑해!'],
    'fiveleaf:20':['吃了我的金苹果，就会变聪明！','내 황금사과를 먹으면 똑똑해질걸!'],
    goldclover:['我卷卷的，像一个问号？','나는 돌돌 말렸어. 물음표 같지?'],
    'goldclover:20':['恐龙以前在我下面睡午觉。','옛날에 공룡들이 내 밑에서 낮잠을 잤어.'],
    starclover:['我住在高高的山上，很勇敢！','나는 높은 산 위에 살아. 아주 용감해!'],
    'starclover:20':['我已经五千岁了！','나는 벌써 오천 살이야!'],
    frostclover:['土不一样，我的颜色也不一样！','흙이 달라지면 내 색깔도 달라져!'],
    'frostclover:20':['我从侏罗纪一直活到今天。','나는 쥐라기부터 오늘까지 살아왔어.'],
    bouquetclover:['摸摸我，像兔子尾巴一样软！','나를 만져 봐. 토끼 꼬리처럼 보송보송해!'],
    'bouquetclover:20':['吹一口气，说出你的愿望吧！','후~ 불면서 소원을 말해 봐!'],
    ringclover:['我的花像小小的心，一串一串的。','내 꽃은 작은 하트가 줄줄이 달려 있어.'],
    'ringclover:20':['两棵树手拉手，变成了我。','두 나무가 손을 잡고 하나가 된 게 나야.'],
    whiteberry:['我是一盏小灯笼，里面有果子。','나는 작은 등불이야. 안에 열매가 숨어 있어.'],
    'whiteberry:20':['神仙吃了我，就能长生不老。','신선이 나를 먹으면 늙지 않는대.'],
    berryfield:['夏天吃我最凉快了！','여름엔 나를 먹는 게 제일 시원해!'],
    'berryfield:20':['打开我，里面全是宝贝！','나를 열어 봐. 안에 보물이 가득해!'],
    violetberry:['我的果子一串一串的，数不清！','내 열매는 주렁주렁, 셀 수가 없어!'],
    'violetberry:20':['我和恐龙是老朋友。','나는 공룡이랑 오랜 친구야.'],
    frostberry:['我能变成你的棉被和衣服！','나는 너의 이불이랑 옷이 될 수 있어!'],
    'frostberry:20':['我的棉花飘到天上，变成了云。','내 목화솜이 하늘로 날아가 구름이 됐어.'],
    goldraspberry:['我戴着王冠，是水果里的王子！','나는 왕관을 썼어. 과일 나라 왕자님이야!'],
    'goldraspberry:20':['顺着我爬上去，就能到云上！','나를 타고 올라가면 구름 위에 닿아!'],
    blackberry:['我很辣！你敢吃我吗？','나는 엄청 매워! 먹을 수 있겠어?'],
    'blackberry:20':['凤凰最喜欢停在我的树上。','봉황은 내 나무에 앉는 걸 제일 좋아해.'],
    elderoak:['我的树枝会往下长根，一棵树变成一片森林！','내 가지에서 뿌리가 내려와 나무 하나가 숲이 돼!'],
    'elderoak:20':['我的根连着整个世界。','내 뿌리는 온 세상과 이어져 있어.'],
    maple:['秋天我会穿上红衣服。','가을이 되면 나는 빨간 옷으로 갈아입어.'],
    'maple:20':['我守护这个村子一千年了。','나는 천 년 동안 이 마을을 지켜 왔어.'],
    bamboo:['我一天能长这么高！快看！','나는 하루에 이만큼이나 자라! 봐 봐!'],
    'bamboo:20':['竹子一百年才开一次花，你真幸运！','대나무는 백 년에 한 번 꽃을 피워. 넌 정말 행운아야!'],
    weepingcherry:['春天到了，我下起了花瓣雨！','봄이 왔어! 꽃잎 비를 내려 줄게!'],
    'weepingcherry:20':['天神从天上来到了我的树下。','하늘의 환웅님이 내 아래로 내려오셨대.'],
    elderginkgo:['我是森林里的高个子！','나는 숲속의 키다리야!'],
    'elderginkgo:20':['很久以前，我是长着鳞片的大树。','아주 옛날, 나는 비늘 무늬가 있는 거대한 나무였어.'],
    moonginkgo:['冬天还没走，我就先开花了。','겨울이 가기도 전에 내가 먼저 꽃을 피워.'],
    'moonginkgo:20':['我住在月亮上，和小兔子一起。','나는 달나라에서 옥토끼랑 같이 살아.']
  };
  function plantIntro(){
    const pet=profile.look.pet,level=profile.level;
    if(level===1)return PLANT_INTROS.seed;if(level===2||!GROWTH[pet])return PLANT_INTROS.sprout;
    const route=routeFor(pet,profile.routes),br=level>=15?branchFor(pet,profile.routes,profile.branches):null;
    return (br&&PLANT_INTROS[br.id+(level>=20?':20':'')])||(level>=10&&route&&PLANT_INTROS[route.id])||PLANT_INTROS[pet];
  }
  let tipBag=[],chatCount=0;
  function chatWithFriend(){
    if(profile.garden.world.kind){showWorldHelp();return;}
    chatCount++;
    // 1번째·4번째… 톡: 나를 소개해요
    if(chatCount%3===1){showFriendPhrase(plantIntro());return;}
    const due=dueCount(forestLevels());
    if(due&&chatCount%2===1){showFriendPhrase([`有${due}个词在等你复习！`,`복습을 기다리는 단어가 ${due}개 있어!`]);return;}
    if(chatCount%2===0){if(!tipBag.length)tipBag=shuffle(FRIEND_TIPS);showFriendPhrase(tipBag.pop());return;}
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
    const level=Number($('levelSelect').value);
    if(!DATA_LEVELS.includes(level)){$('wordCount').textContent='어휘 준비 중';$('startBtn').disabled=true;$('ruleBox').textContent='이 숲의 단어는 아직 준비 중이에요. 초록빛 숲이나 살구빛 숲에서 먼저 공부해 주세요.';renderTimeLabels();renderStartCard();return;}
    if(!levelReady(level)&&levelState[level]!=='failed'){
      $('wordCount').textContent='단어를 불러오는 중…';$('startBtn').disabled=true;
      loadLevel(level).then(()=>{if(Number($('levelSelect').value)===level)updateCount();});return;
    }
    const pool=levelWords(level),count=pool.length;
    if(levelState[level]==='failed'){$('wordCount').textContent='단어 파일을 불러오지 못했어요';$('startBtn').disabled=true;$('ruleBox').textContent=`data/hsk${level}.js 파일을 불러오지 못했어요. 인터넷 연결과 파일 위치를 확인해 주세요.`;return;}
    const due=pool.filter(w=>isDue(memoryOf(w))).length,fresh=pool.filter(w=>!memoryOf(w)).length;
    $('wordCount').textContent=count?`${count}개의 단어`+(due?` · 복습 ${due}`:'')+(fresh<count?` · 새 단어 ${fresh}`:''):'어휘 준비 중';$('startBtn').disabled=count<4;
    const note=$('startBtn').nextElementSibling;
    if(document.querySelector('input[name="mode"]:checked').value==='main')note.textContent=due?`복습할 단어가 먼저 섞여 나와요 (최대 절반) · 나머지는 새 단어예요.`:'기본 문제를 맞히면 짝꿍어휘 보너스에 도전할 수 있어요.';
    renderStartCard();
  }
  function populateGrades(preferred){
    $('levelSelect').replaceChildren();
    const first=FORESTS[activeForest].start;
    for(let level=first;level<first+3;level++){
      const ready=DATA_LEVELS.includes(level);
      const option=document.createElement('option');option.value=String(level);option.disabled=!ready;
      option.textContent=`HSK ${level}급${ready?'':' · 준비 중'}`;$('levelSelect').append(option);
    }
    const available=[...$('levelSelect').options].filter(o=>!o.disabled);
    $('levelSelect').value=available.find(o=>o.value===String(preferred))?.value||available[0]?.value||String(first);
    updateCount();
  }
  function switchForest(index){
    if(index===activeForest||!FORESTS[index]||state&&['basic','bonus','feedback'].includes(state.phase))return;
    closeEvolution(false);save();stopSound();clearTimer();resetFriend();state=null;activeForest=index;profile=forestProfiles[index];$('careMessage').textContent='';
    forestAudio.setForest(index);screen('setup');populateGrades();loadLevels(forestLevels()).then(()=>renderCare());renderProfile();$('speechRate').value=profile.rate;populateVoices();syncDifficulty();refreshGarden();save();
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
      '오늘의 모험에서 쉬운 모드·어려운 모드, 급수, 문제 수를 정한 뒤 시작해요. 휴대폰에서는 상단 버튼을 누르면 열리고, 데스크톱에서는 모험 설정이 화면에 보여요.',
      '세 숲은 친구·경험치·코인·보관함을 각각 따로 관리해요. 다른 숲에서는 마음씨부터 새롭게 키워요.'],
    ['문제 풀기와 발음 듣기',
      '덩어리 숲속으로는 제한 시간(1~2급 7초, 3급 8초, 4급 10초, 5급 12초 · ‘여유롭게’는 +5초) 안에 답하는 본게임이에요. 기본 문제를 맞히면 짝꿍어휘 보너스에 도전해요. 두 모드 모두 한자→뜻, 뜻→한자 두 방향이 섞여 나와요. 쉬운 모드는 병음이 늘 함께 보이고, 어려운 모드는 한자를 눌러야 병음이 보여요.',
      '문제와 보기의 한자를 누르면 병음이 보여요. 한자 보기에서는 병음 확인과 정답 선택 버튼을 구분해 눌러 주세요. 답을 확인하는 팝업에서는 먼저 보이는 단어를 누르면 나머지 정보가 열려요.',
      '발음은 음성 듣기를 눌러 재생해요. 보통 또는 천천히를 선택할 수 있어요. 틀린 문제는 결과 화면에서 기본 단어로 다시 연습해 보세요.'],
    ['경험치·코인·학습 진행률',
      '어려운 모드 기본 정답은 +5 XP와 2코인, 보너스 정답은 +3 XP와 1코인이에요. 쉬운 모드는 기본 정답 +3 XP와 1코인, 보너스 +2 XP, 연속 정답 +2 XP, 전체 정답 +5/+12 XP로 조금 적어요. 틀리거나 시간이 지나도 경험치는 줄지 않아요. 기본 문제를 5개 연속으로 맞힐 때마다 +3 XP를 더 받아요. 기본 10문제 전체 정답은 +10 XP, 20문제는 +25 XP를 더 받아요.',
      '레벨이 높아질수록 필요한 경험치가 늘어요. 살구빛 숲과 보랏빛 숲은 초록빛 숲보다 더 천천히 자라요. 꾸준히 단어를 익히며 성장시켜 주세요.',
      '단어마다 맞힌 기록을 기억해요. 틀린 단어는 다음 판에 먼저 나오고, 맞힌 단어는 1일·3일·7일·14일·30일 뒤에 복습으로 다시 나와요. 한 판의 절반까지 복습 단어가 섞이고 나머지는 새 단어예요. 학습 진행률에서 급수별로 오래 기억하는 단어와 오늘 복습할 단어 수를 볼 수 있어요.'],
    ['친구 성장과 꾸미기',
      '레벨 1 마음씨에서 레벨 2 마음싹으로 자라요. 레벨 3에는 성장 계열을 고르고, 레벨 4부터 9까지 점차 성장해요. 레벨 10에 세 갈래, 레벨 15에 두 갈래 중 하나를 고르고, 레벨 20에 최종 진화해요.',
      '마음꽃·마음송이·마음담이는 모두 고를 수 있어요. 마음잎·마음열매·마음나무는 수강생판에서 열려요. 주요 진화는 한 판을 마친 뒤 연출 중에 선택하며, 선택 전 최종 모습은 실루엣으로 보여요.',
      '내 친구 꾸미기에서 해금된 장식을 골라 위치를 조절해요. 날개와 망토는 몸 뒤에 놓여요. 로비에서 친구를 톡 누르면 대화하고, 꾹 누르면 들어 올렸다 놓을 수 있어요.'],
    ['물을 주며 함께 자라기',
      '물주기는 물뿌리개로 해요. 한 판의 기본 문제를 모두 맞히면 물뿌리개가 가득 차요. 틀린 단어가 있으면 결과 화면이나 물주기 버튼에서 틀린 단어를 한 번 더 보고 다시 풀어요. 다 맞히면 물뿌리개가 가득 차고, 로비에서 물주기 버튼을 눌러 친구에게 물을 줘요.',
      '마지막 물주기에서 48시간이 지나면 −5 XP, 이후 24시간마다 −5 XP예요. 다시 물을 줄 때까지 최대 −20 XP이며 레벨은 내려가지 않아요. 물을 주면 이 차감 주기도 새로 시작해요.',
      '물 부족은 미접속 시간도 계산해요. 문제를 푸는 동안은 차감을 미뤘다가 학습 후 반영해요. 날씨·벌레 시간은 로비가 보일 때만 흘러요. 학습·팝업·다른 탭·미접속 중에는 멈춰요.'],
    ['숲 상점 사용법',
      '문제로 모은 코인으로 사요. 햇살 비료는 20코인, 든든 비료는 35코인이며 기본 정답 10회 동안 각각 +1 XP, +2 XP를 더 줘요. 반짝 비료는 50코인에 +3 XP예요. 구매 후 바구니에서 식물에게 주기를 눌러야 적용되고 한 번에 하나만 사용해요.',
      '살충제 10코인과 감기약 12코인은 한 번 쓰면 1개가 소모돼요. 우산 30코인, 부채 25코인, 난로 35코인은 한 번 사면 해당 숲에서 계속 쓸 수 있어요.',
      '오답·보너스·틀린 단어 연습에서는 비료 횟수가 줄지 않아요. 현금 결제는 없어요. 모바일은 상품 버튼을 눌러 살펴보고, 데스크톱은 상품 카드를 함께 볼 수 있어요. 도구 사용은 로비의 바구니에서 해요. 상황에 맞지 않으면 친구가 거절하며 소모품은 줄지 않아요.'],
    ['비·찬바람·감기 돌보기',
      '가랑비는 도움을 요청해도 경험치를 깎지 않아요. 폭우에는 번개가 치고 우산 안으로도 비가 튈 수 있어요. 1분 노출마다 감기 확률은 우산 없이 20%, 우산을 쓰면 5%예요.',
      '찬바람에는 1분마다 25% 확률로 감기에 걸려요. 난로를 놓으면 찬바람 감기를 예방해요. 이미 걸린 감기는 날씨가 맑아지거나 난로를 켜도 낫지 않으니 감기약을 먹여 주세요.',
      '감기 방치는 활성 로비 시간 2분마다 −1 XP예요. 치료 전 돌봄 차감은 최대 5회로 제한하고 레벨을 보호해요. 감기와 더위가 겹치면 차감 상한을 함께 사용해요.'],
    ['더위·벌레와 오래 즐기는 팁',
      '무더위 때 친구가 부채질을 부탁해요. 부채질하면 45초 동안 시원하고 무더위 이벤트는 계속돼요. 다시 더워진 뒤 45초 내 돌보지 않으면 −1 XP예요. 한 무더위의 돌봄 차감은 최대 5회예요.',
      '벌레는 90초 안에 살충제로 퇴치해요. 놓치면 한 번 −10 XP이며 처음에는 살충제 1개를 선물해요. 날씨는 로비에서 2분 동안 이어지고, 이벤트는 보통 2~4분 간격으로 찾아와요.',
      '감기약·살충제를 미리 준비하고, 먼저 문제를 풀어 코인을 모아 보세요. 기록은 이 브라우저에 저장돼요. 설정 › 기록 옮기기에서 기록 코드를 저장해 두면 사이트 데이터를 지우거나 기기를 바꿔도 이어서 할 수 있어요.']
  ];
  GUIDE_PAGES.splice(6,0,
    ['바구니와 귀여운 거절 반응',
      '상점은 구매만 하는 곳이에요. 물주기·숲 상점 옆 바구니에서 보유 수량을 확인하고 비료·살충제·감기약·우산·부채·난로를 사용해요. 비료·살충제·감기약은 소모품이며 우산·부채·난로는 계속 쓸 수 있어요.',
      '무더위에 난로를 놓으면 친구가 화내며 치워 달라고 해요. 난로를 먼저 치운 뒤 부채질해 주세요. 비가 오거나 찬바람이 불 때 부채질하면 춥다고 투덜거려요.',
      '감기가 없는데 약을 주거나 벌레가 없는데 살충제를 쓰면 거절해요. 비료가 이미 적용 중일 때도 새 비료를 거절해요. 거절한 소모품은 줄지 않고, 장난에 대한 추가 경험치 차감도 없어요.'],
    ['전체 정답 선물과 반짝 비료',
      '본게임에서 선택한 기본 10문제를 모두 맞히면 +10 XP, 20문제를 모두 맞히면 +25 XP를 한 번 더 받아요. 짝꿍어휘 정답 여부는 별개예요. 준비 운동·전체 단어 모드·기본 문제를 다 풀기 전 중도 종료에는 지급하지 않아요.',
      '전체 정답을 달성하면 친구가 중국어 격려 표현 5개 중 하나로 약 3초 동안 축하해 줘요. 레벨업도 했다면 이어서 진화 연출과 성장 선택을 진행해요.',
      '반짝 비료는 50코인에 구매해요. 바구니에서 먹이면 본게임 기본 정답 10회에 각각 +3 XP를 더 받아요. 오답·보너스·틀린 단어 연습에는 횟수가 줄지 않고, 전체 정답 보너스에는 비료 효과를 더하지 않아요.']
  );
  if(!STUDENT_BG)GUIDE_PAGES.push(['무료판과 기록 안내',
    '체험판(무료판)은 친구가 Lv.10까지 자라고, 성장 계열은 마음꽃·마음송이 두 가지 중에서 골라요. Lv.15 신기한 식물과 Lv.20 전설의 식물, 더 많은 성장 계열은 수강생판에서 만날 수 있어요.',
    '무료판은 한 판을 마친 뒤 결과 화면에서 진담중국어 소식이 한 번 나와요. 5초 뒤 닫고 결과를 볼 수 있어요.',
    '오른쪽 위 원형 타이머로 남은 시청 시간을 봐요. 다른 탭으로 이동하면 시청 시간이 멈추며, 홍보 중에는 문제 타이머도 흐르지 않아요. 결과 홍보를 닫으면 전체 정답 축하·진화가 있는 경우 순서대로 볼 수 있어요. 수강생판에는 홍보가 표시되지 않아요.',
    '캐릭터와 학습 기록은 이 브라우저에 저장해요. 다른 브라우저나 기기로 옮길 때는 설정 › 기록 옮기기에서 기록 코드를 만들어 붙여 넣어 주세요. 무료판과 수강생판 기록도 별개예요.']);
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
  ['gesturestart','gesturechange'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
  let lastTouchEnd=0;document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<320&&!e.target.closest('input,textarea,select'))e.preventDefault();lastTouchEnd=now;},{passive:false});
  const movable=[document.querySelector('.forest-selector'),$('setup'),...document.querySelectorAll('.audio-settings'),document.querySelector('.care-rules')];
  const anchors=movable.map(node=>{const anchor=document.createComment('desktop control');node.before(anchor);return anchor;});
  const closetAnchor=document.createComment('desktop closet');$('openCloset').before(closetAnchor);
  // 휴대폰 로비: 수분·코인·돌봄 버튼을 친구 창 위에 올려 한 화면에 모아요. (데스크톱에서는 원래 자리로 돌아가요)
  const hud=document.createElement('div');hud.className='lobby-hud';
  hud.innerHTML='<div class="hud-status"></div><div class="hud-coins"></div><div class="hud-dock" role="toolbar" aria-label="친구 돌보기"></div><div class="hud-world"></div>';
  const HUD_PARTS=[['.hud-status',[document.querySelector('.care-water-label'),$('waterBar'),$('fertilizerState')]],['.hud-coins',[document.querySelector('.coin-pill')]],
    ['.hud-dock',[$('waterPlant'),$('openShop'),$('openBasket')]],['.hud-world',[document.querySelector('.world-notice')]]];
  const hudHomes=new Map();HUD_PARTS.forEach(([,nodes])=>nodes.forEach(n=>{if(n){const m=document.createComment('hud home');n.before(m);hudHomes.set(n,m);}}));
  const lobbyCopy=document.querySelector('.lobby-copyright'),lobbyCopyHome=document.createComment('copyright home');lobbyCopy?.before(lobbyCopyHome);
  function placeHud(mobile){
    if(mobile){$('homeHabitat').append(hud);HUD_PARTS.forEach(([sel,nodes])=>hud.querySelector(sel).append(...nodes.filter(Boolean)));hud.querySelector('.hud-dock').append($('openCloset'));if(lobbyCopy)$('startCard').after(lobbyCopy);}
    else{hudHomes.forEach((m,n)=>m.after(n));hud.remove();if(lobbyCopy)lobbyCopyHome.after(lobbyCopy);}
  }
  document.body.dataset.screen='setup';
  function settingsTab(index){
    $('updateNotes').hidden=index!==3;$('backupPanel').hidden=index!==4;
    movable.slice(2).forEach((node,i)=>node.hidden=i!==index);
    document.querySelectorAll('[data-settings-tab]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.settingsTab)===index)));
  }
  function fitCompanion(){
    const height=$('homeHabitat').clientHeight;
    $('mascot').style.setProperty('--mobile-avatar-scale',String(Math.min(document.body.dataset.screen==='setup'?Math.min(1.8,($('homeHabitat').clientWidth-70)/180):1.15,Math.max(.48,(height-20)/210))));
    positionGround();placeAccessories($('mascot'),profile.look,profile.routes);
  }
  function arrangeLobby(){
    if(mobileLayout.matches){
      $('forestBody').append(movable[0]);$('adventureBody').append(movable[1]);
      $('settingsBody').append(...movable.slice(2));
      movable.slice(2).forEach(n=>n.open=true);settingsTab(0);
      placeHud(true);
    }else{
      ['adventureDialog','settingsDialog'].forEach(id=>$(id).close());
      if(!choosingEntryForest)$('forestDialog').close();
      movable.forEach((node,i)=>{anchors[i].after(node);if(i>=2){node.hidden=false;node.open=false;}});
      placeHud(false);closetAnchor.after($('openCloset'));
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
    dialog.classList.remove('evolution-revealed','evolution-choosing','evolution-legend');dialog.querySelector('.legend-show')?.remove();$('evolutionChoices').replaceChildren();$('evolutionChoices').hidden=true;$('evolutionChoiceHelp').hidden=true;$('evolutionBefore').replaceChildren();$('evolutionAfter').replaceChildren();
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
    $('evolutionTitle').textContent=profile.level>=20&&state.startLevel<20?'전설의 모습으로 최종 진화했어요!':profile.level>=15&&state.startLevel<15?'새로운 갈래로 자랐어요!':profile.level>=10&&state.startLevel<10?'눈부신 모습으로 자랐어요!':'함께 공부해서 자랐어요!';
    dialog.classList.toggle('evolution-legend',profile.level>=20&&state.startLevel<20);
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
  // Lv.20 최종 진화: 화면 번쩍임 · 빛기둥 · 꽃잎 불꽃놀이 · 진동 · 팡파르
  function startLegendShow(dialog){
    dialog.querySelector('.legend-show')?.remove();
    const show=document.createElement('div');show.className='legend-show';show.setAttribute('aria-hidden','true');
    const colors=['#ffe27a','#ffb3c7','#b8f0c8','#c9b8ff','#9fe0ff','#fff6d6'];
    let bits='<div class="legend-flash"></div><div class="legend-pillar"></div><div class="legend-ring"></div><div class="legend-ring r2"></div>';
    for(let burst=0;burst<3;burst++){const cx=[50,22,78][burst],cy=[38,24,26][burst];
      for(let i=0;i<22;i++){const a=i/22*Math.PI*2,d=90+Math.random()*70;bits+=`<i class="legend-spark" style="left:${cx}%;top:${cy}%;--dx:${Math.round(Math.cos(a)*d)}px;--dy:${Math.round(Math.sin(a)*d)}px;--c:${colors[(i+burst)%colors.length]};--d:${(1.6+burst*.55).toFixed(2)}s"></i>`;}}
    for(let i=0;i<26;i++)bits+=`<b class="legend-petal" style="left:${Math.round(Math.random()*100)}%;--c:${colors[i%colors.length]};--d:${(2.2+Math.random()*1.4).toFixed(2)}s;--w:${(Math.random()*.9).toFixed(2)}s;--x:${Math.round(Math.random()*80-40)}px"></b>`;
    bits+='<div class="legend-banner"><small>FINAL EVOLUTION</small><strong>전설의 식물</strong></div>';
    show.innerHTML=bits;dialog.append(show);
    if(!reducedMotion()){try{navigator.vibrate?.([60,40,60,40,220]);}catch{}}
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
    const legend=dialog.classList.contains('evolution-legend');
    forestAudio.effect(legend?'legend':'evolve');
    if(legend)startLegendShow(dialog);
    friendSay(...plantIntro());
    evolutionMorphTimer=setTimeout(()=>dialog.classList.add('evolution-revealed'),reducedMotion()?0:legend?1700:850);
    evolutionTimer=setTimeout(()=>closeEvolution(),legend?7000:3000);
  }
  function presentEvolutionChoice(){
    const pet=profile.look.pet,route=routeFor(pet,profile.routes);
    const familyChoice=profile.level>=3&&!profile.family;
    const routeChoice=!familyChoice&&profile.level>=10&&!route;
    const branchChoice=!familyChoice&&!routeChoice&&profile.level>=15&&route&&!branchFor(pet,profile.routes,profile.branches);
    if(!familyChoice&&!routeChoice&&!branchChoice){playEvolutionReveal();return;}
    const dialog=$('evolutionDialog'),choices=$('evolutionChoices');
    dialog.classList.add('evolution-choosing');choices.hidden=false;choices.replaceChildren();$('evolutionChoiceHelp').hidden=false;
    $('skipEvolution').textContent='나중에 고르기';
    $('evolutionTitle').textContent=familyChoice?'어떤 친구로 자라볼까요?':routeChoice?'Lv.10 · 세 갈래 중 하나를 골라 주세요':'Lv.15 · 두 갈래 중 하나를 골라 주세요';
    const options=familyChoice?Object.entries(GROWTH).map(([id,g])=>({id,name:g.name,locked:!petAllowed(id)}))
      :routeChoice?GROWTH[pet].routes.map(r=>({id:r.id,name:r.final}))
      :route.branches.map(b=>({id:b.id,name:b.name}));
    choices.classList.toggle('two-choices',Boolean(branchChoice));
    for(const option of options){
      const button=document.createElement('button');button.type='button';button.disabled=Boolean(option.locked);
      const art=document.createElement('span');
      art.innerHTML=familyChoice?creatureSVG(option.id,null,3,'#aac875',false)
        :routeChoice?creatureSVG(pet,option.id,10,'#aac875',true,null)
        :creatureSVG(pet,route.id,15,'#aac875',true,option.id);
      const label=document.createElement('strong');label.textContent=option.name;
      const note=document.createElement('small');note.textContent=option.locked?'잠김 · 수강생 전용':familyChoice?'이 친구로 성장':'선택하면 모습이 나타나요';
      button.append(art,label,note);choices.append(button);
      button.onclick=()=>{
        if(option.locked)return;
        if(familyChoice){profile.family=option.id;profile.look.pet=option.id;}
        else if(routeChoice)profile.routes[pet]=option.id;
        else{profile.branches=profile.branches||{};profile.branches[pet]=option.id;}
        save();renderProfile();
        $('evolutionTitle').textContent=growthName(profile.look.pet,profile.routes,profile.level)+'로 자랐어요!';
        // 한 판에 여러 레벨이 오르면 다음 갈래 선택까지 이어서 해요.
        const p2=profile.look.pet,r2=routeFor(p2,profile.routes);
        if(profile.level>=10&&!r2||profile.level>=15&&r2&&!branchFor(p2,profile.routes,profile.branches))presentEvolutionChoice();
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
          loss?friendSay(`虫子咬了我……经验少了${loss}点。`,`벌레한테 물렸어… 경험치가 ${loss} 줄었어. 다음엔 살충제를 뿌려 줘.`):friendSay('虫子来过了，还好没事。','벌레가 다녀갔지만 괜찮아. 레벨은 보호됐어.');
          hideBubble();renderProfile();
        }else{friendSay('天晴了！','날씨가 다시 맑아졌어!');hideBubble();clearThunder();}
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
      showFriendPhrase(['谢谢你，虫子飞走了！','고마워, 벌레가 날아갔어!'],'below');
    }else{
      showFriendPhrase(w.umbrellaOn?(w.kind==='heavyRain'?WEATHER_PHRASES.heavySheltered[Math.floor(Math.random()*5)]:['谢谢你，这下淋不到雨了！','고마워, 이제 비를 맞지 않아!']):['伞收好啦！','우산을 잘 접었어!'],'below');
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
    const loss=Math.min(1,Math.max(0,profile.xp-xpStart(profile.level)));profile.xp-=loss;h.loss++;renderProfile();loss?friendSay('我不舒服……经验少了1点。','몸이 안 좋아… 경험치가 1 줄었어.'):friendSay('我不舒服，照顾照顾我吧。','몸이 안 좋아, 나 좀 돌봐 줘.');
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
  $('waterPlant').onclick=()=>{
    if(gardenBusy())return;const g=profile.garden;
    if(g.canFull){waterPlant();return;}
    if(g.retry.length){openRetryStudy();return;}
    showFriendPhrase(['一轮全部答对，水壶就满啦！','한 판을 모두 맞히면 물뿌리개가 가득 차! 그때 나한테 물을 줘.']);
  };
  // 틀린 단어를 한 번 더 보고(한자·병음·뜻·발음) 다시 풀어요.
  function openRetryStudy(){
    const ids=profile.garden.retry,words=data.filter(w=>ids.includes(w.id));
    if(!words.length){loadLevels(forestLevels()).then(()=>{if(data.some(w=>ids.includes(w.id)))openRetryStudy();else{profile.garden.retry=[];save();renderCare();}});return;}
    const list=$('retryList');list.replaceChildren();
    for(const w of words){const row=document.createElement('div');row.className='review-item';const c=document.createElement('div');const zh=document.createElement('strong');zh.textContent=w.hanzi;zh.lang='zh-CN';const py=document.createElement('small');py.textContent=w.pinyin;const ko=document.createElement('small');ko.textContent=w.meaning;c.append(zh,py,ko);
      const btn=document.createElement('button');btn.className='secondary';btn.type='button';btn.textContent='🔊';btn.setAttribute('aria-label',`${w.hanzi} 발음 듣기`);btn.onclick=()=>speak(w);row.append(c,btn);list.append(row);}
    $('retryStudy').showModal();
  }
  $('retryGo').onclick=()=>{$('retryStudy').close();resetFriend();start([...profile.garden.retry]);};
  $('retryClose').onclick=()=>$('retryStudy').close();

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
  function renderTimeLabels(){
    const sel=$('timeSetting');if(!sel)return;
    const level=Number($('levelSelect').value),base=LEVEL_SECONDS[level]||RULES.seconds;
    sel.options[0].textContent=`기본 · ${base}초 (HSK ${level}급)`;
    sel.options[1].textContent=`여유롭게 · ${base+RULES.relaxedExtra}초`;
  }
  function renderStartCard(){
    renderTimeLabels();
    if(!$('quickStart'))return;
    const practice=document.querySelector('input[name="mode"]:checked')?.value==='practice';
    const level=$('levelSelect').value,size=$('roundSize').value;
    const due=levelReady(Number(level))?levelWords(Number(level)).filter(w=>isDue(memoryOf(w))).length:0;
    $('quickStartLabel').textContent='오늘의 모험 떠나기';
    $('quickStartInfo').textContent=(difficulty()==='easy'?'🌱 쉬운 모드':'🔥 어려운 모드')+` · HSK ${level}급 · ${size==='all'?'전체':size+'문제'}`;
    $('quickStart').disabled=$('startBtn').disabled&&levelState[Number(level)]!=='loading';
  }
  $('quickStart').onclick=()=>{
    resetFriend();
    const practice=document.querySelector('input[name="mode"]:checked')?.value==='practice';
    start();
  };
  $('quickSettings').onclick=()=>$('openAdventure').click();
  ['roundSize','direction','timeSetting'].forEach(id=>$(id).addEventListener('change',renderStartCard));

  /* 기록 옮기기: localStorage에 있는 이 게임의 기록 전체를 한 줄 코드로 만들어요. */
  const BACKUP_PREFIX='FOREST1-';
  const backupKeys=()=>{const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(KEY))keys.push(k);}if(localStorage.getItem('word-forest-audio-v1')!==null)keys.push('word-forest-audio-v1');return keys;};
  const toBase64=text=>{const bytes=new TextEncoder().encode(text);let bin='';bytes.forEach(b=>bin+=String.fromCharCode(b));return btoa(bin);};
  const fromBase64=code=>new TextDecoder().decode(Uint8Array.from(atob(code),c=>c.charCodeAt(0)));
  function makeBackup(){
    save();
    try{
      const payload={v:1,at:Date.now(),items:Object.fromEntries(backupKeys().map(k=>[k,localStorage.getItem(k)]))};
      const code=BACKUP_PREFIX+toBase64(JSON.stringify(payload));
      $('backupOut').hidden=false;$('backupOut').value=code;
      const done=()=>{$('backupOutNote').textContent=`복사했어요! 카톡 ‘나와의 채팅’이나 메모장에 붙여 넣어 두세요. (${new Date().toLocaleDateString('ko-KR')} 기록)`;};
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(code).then(done,()=>{$('backupOut').select();$('backupOutNote').textContent='위 코드를 길게 눌러 전체 선택한 뒤 복사해 주세요.';});
      else{$('backupOut').select();try{document.execCommand('copy');done();}catch{$('backupOutNote').textContent='위 코드를 길게 눌러 전체 선택한 뒤 복사해 주세요.';}}
    }catch{$('backupOutNote').textContent='이 브라우저에서는 기록을 읽을 수 없어요.';}
  }
  function loadBackup(){
    const raw=$('backupIn').value.replace(/\s+/g,'');
    let payload;
    try{if(!raw.startsWith(BACKUP_PREFIX))throw 0;payload=JSON.parse(fromBase64(raw.slice(BACKUP_PREFIX.length)));if(payload?.v!==1||typeof payload.items!=='object')throw 0;}
    catch{$('backupInNote').textContent='코드가 올바르지 않아요. FOREST1- 로 시작하는 코드 전체를 붙여 넣어 주세요.';return;}
    const keys=Object.keys(payload.items).filter(k=>k.startsWith(KEY)||k==='word-forest-audio-v1');
    if(!keys.length){$('backupInNote').textContent='코드 안에 기록이 없어요.';return;}
    const when=payload.at?new Date(payload.at).toLocaleString('ko-KR'):'';
    if(!confirm(`${when} 기록으로 바꿀까요?\n지금 이 브라우저의 기록은 코드의 기록으로 덮어써져요.`))return;
    try{backupKeys().forEach(k=>localStorage.removeItem(k));keys.forEach(k=>localStorage.setItem(k,String(payload.items[k])));}
    catch{$('backupInNote').textContent='이 브라우저에는 저장할 수 없어요. 시크릿 모드라면 일반 창에서 열어 주세요.';return;}
    $('backupInNote').textContent='불러왔어요! 잠시 후 새로 고칠게요.';
    setTimeout(()=>location.reload(),600);
  }
  $('makeBackup').onclick=makeBackup;$('loadBackup').onclick=loadBackup;
  if(window.__homeAppFresh){
    // 아이폰 홈 화면 앱은 기록 저장 공간이 따로라서, 처음 열면 기록 옮기기를 알려 줘요.
    $('inAppNotice').hidden=false;$('openOutside').hidden=true;$('copyLink').hidden=true;
    $('inAppText').textContent='홈 화면 앱으로 열었어요! 크롬에서 하던 기록이 안 보이면, 크롬에서 설정 › 기록 옮기기로 코드를 만들어 여기서 불러와 주세요.';
  }
  if(window.__openOutside){
    const o=window.__openOutside;$('inAppNotice').hidden=false;
    $('openOutside').onclick=()=>o.go();
    $('installChrome').href=o.ios?'https://apps.apple.com/app/id535886823':'https://play.google.com/store/apps/details?id=com.android.chrome';
    const missing=()=>{$('installChrome').hidden=false;$('inAppText').textContent='크롬이 열리지 않았다면 크롬을 설치한 뒤 다시 링크를 눌러 주세요. (기록은 크롬으로 넘어갈 때 함께 옮겨져요)';};
    if(window.__chromeMissing)missing();else setTimeout(()=>{if(window.__chromeMissing)missing();},2700);
    $('copyLink').onclick=async()=>{const url=location.href;let ok=false;try{await navigator.clipboard.writeText(url);ok=true;}catch{const t=document.createElement('textarea');t.value=url;document.body.append(t);t.select();try{ok=document.execCommand('copy');}catch{}t.remove();}$('copyLink').textContent=ok?'복사했어요! 크롬 주소창에 붙여 넣어 주세요':'주소창 링크를 길게 눌러 복사해 주세요';};
  }
  $('levelSelect').onchange=updateCount;
  populateGrades();
  updateCount();renderProfile();refreshGarden();save();populateVoices();syncDifficulty();
  loadLevels(forestLevels()).then(()=>renderCare());
})();
