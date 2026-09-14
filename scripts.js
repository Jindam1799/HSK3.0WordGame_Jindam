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
  const LOOK_DEFAULT = Object.freeze({pet:'sprout', color:'mint', head:'none', face:'none', neck:'none', scene:'meadow', name:''});
  // [id, label, icon or color, required level]. Unlocks never consume XP.
  const WARDROBE = {
    pet: {label:'01 · 함께할 친구',items:[['sprout','새싹이','🌱',1],['bunny','토끼','🐰',1],['cat','고양이','🐱',1],['bear','곰돌이','🐻',1]]},
    color: {label:'02 · 좋아하는 색',items:[['mint','민트','#aac875',1],['peach','복숭아','#efb69f',1],['cream','바닐라','#eed594',1],['sky','하늘','#9cc9de',1],['lavender','라벤더','#c2acd9',3],['rose','장미','#df9eae',5]]},
    head: {label:'03 · 머리 장식',items:[['none','없음','—',1],['ribbon','리본','🎀',1],['flower','꽃','🌼',2],['cap','모자','🧢',3],['crown','왕관','👑',5],['wizard','마법 모자','🧙',8]]},
    face: {label:'04 · 얼굴 장식',items:[['none','없음','—',1],['glasses','동글 안경','👓',2],['stars','스타 안경','⭐',4]]},
    neck: {label:'05 · 목 장식',items:[['none','없음','—',1],['bow','나비넥타이','🎀',2],['scarf','목도리','🧣',3],['medal','성장 메달','🏅',6]]},
    scene: {label:'06 · 친구의 정원',items:[['meadow','초록 들판','🌿',1],['sunset','노을 정원','🌅',2],['night','별빛 정원','🌙',4],['rainbow','무지개 정원','🌈',7]]}
  };
  function safeLook(raw,level) {
    const look={...LOOK_DEFAULT};
    for(const [key,group] of Object.entries(WARDROBE)) {
      if(group.items.some(item=>item[0]===raw?.[key]&&item[3]<=level))look[key]=raw[key];
    }
    if(typeof raw?.name==='string')look.name=raw.name.trim().slice(0,12);
    return look;
  }
  let profile = {xp:0,level:1,voice:'',rate:0.9,auto:true,look:{...LOOK_DEFAULT}};
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(saved && Number.isSafeInteger(saved.xp) && saved.xp>=0) {
      profile = {...profile,xp:saved.xp,level:Math.floor(saved.xp/RULES.perLevel)+1,
        voice:typeof saved.voice==='string'?saved.voice:'',
        rate:[0.75,0.9,1].includes(saved.rate)?saved.rate:0.9,auto:saved.auto!==false,look:safeLook(saved.look,Math.floor(saved.xp/RULES.perLevel)+1)};
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
    const stage=profile.level>=10?3:profile.level>=5?2:profile.level>=3?1:0;
    $('characterName').textContent=profile.look.name || WARDROBE.pet.items.find(i=>i[0]===profile.look.pet)[1];
    $('characterMessage').textContent=['첫 단어부터 함께 시작해요.','배운 표현이 쑥쑥 자라고 있어요.','꾸준한 배움이 뿌리를 내렸어요.','오늘도 새로운 단어를 만나 볼까요?'][stage];
    renderLook($('mascot'),$('homeHabitat'),profile.look);
    renderUnlockHint();
    document.querySelectorAll('.growth-path>span').forEach((el,i)=>el.classList.toggle('active',i<=stage));
  }
  function renderLook(avatar,habitat,look) {
    avatar.dataset.pet=look.pet;
    avatar.style.background=WARDROBE.color.items.find(i=>i[0]===look.color)[2];
    habitat.dataset.scene=look.scene;
    for(const key of ['head','face','neck']) {
      const slot=avatar.querySelector('.wear-'+key);
      slot.dataset.item=look[key];
      const item=WARDROBE[key].items.find(i=>i[0]===look[key]);
      slot.textContent=look[key]==='none'?'':look[key]==='wizard'?'✦':look[key]==='stars'?'★ ★':item[2];
    }
  }
  function renderUnlockHint() {
    const locked=Object.values(WARDROBE).flatMap(g=>g.items).filter(i=>i[3]>profile.level).sort((a,b)=>a[3]-b[3]);
    const next=locked[0];
    $('unlockHint').textContent=next?`Lv.${next[3]}에 ${next[1]} 등 새 꾸미기가 열려요!`:'모든 꾸미기 선물을 모았어요! ✦';
  }
  let draftLook=null;
  function updatePreview() {
    renderLook($('previewAvatar'),$('previewHabitat'),draftLook);
    $('previewName').textContent=draftLook.name || WARDROBE.pet.items.find(i=>i[0]===draftLook.pet)[1];
    $('closetOptions').querySelectorAll('button[data-group]').forEach(button=>{
      button.setAttribute('aria-pressed',String(draftLook[button.dataset.group]===button.dataset.item));
    });
  }
  function openCloset() {
    // Avoid opening another dialog while a timed question is running.
    if(state && !['result'].includes(state.phase))return;
    draftLook={...profile.look};
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
        if(key==='color'){art.classList.add('swatch');art.style.background=icon;}else art.textContent=icon;
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
  function closeCloset(){draftLook=null;$('closet').close();$('openCloset').focus();}
  $('openCloset').onclick=openCloset;
  $('closeCloset').onclick=closeCloset;
  $('closet').addEventListener('cancel',e=>{e.preventDefault();closeCloset();});
  $('petName').addEventListener('input',()=>{if(draftLook){draftLook.name=$('petName').value.slice(0,12);updatePreview();}});
  $('resetLook').onclick=()=>{draftLook={...LOOK_DEFAULT};$('petName').value='';updatePreview();};
  $('saveLook').onclick=()=>{
    if(!draftLook)return;
    profile.look=safeLook(draftLook,profile.level);save();renderProfile();closeCloset();
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
      $('feedbackNote').textContent=`레벨 ${profile.level} 달성! `+(gifts.length?gifts.map(i=>i[1]).join(' · ')+' 선물이 열렸어요. 학습 후 꾸며 보세요!':'친구와 한 걸음 더 자랐어요!');
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
