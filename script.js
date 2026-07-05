/* ============================================================
   FIREBASE SETUP
   ------------------------------------------------------------
   1) Go to https://console.firebase.google.com -> create a project
   2) Project settings -> General -> "Your apps" -> add a Web app
      -> copy the config object and paste it below, replacing the
      placeholder values.
   3) Authentication -> Sign-in method -> enable "Email/Password"
   4) Firestore Database -> Create database
   5) Firestore -> Rules -> paste rules restricting each user to
      their own data (see the message in chat for the exact rules)
============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, getDocs, documentId
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHpkVX4_551Lj5lpJDuVIk-2JLTw2dIlQ",
  authDomain: "study-tracker-96014.firebaseapp.com",
  projectId: "study-tracker-96014",
  storageBucket: "study-tracker-96014.firebasestorage.app",
  messagingSenderId: "138456732275",
  appId: "1:138456732275:web:7f17c59bbc227571705006"
};

const firebaseReady = firebaseConfig.apiKey !== "YOUR_API_KEY";
let fbApp, auth, db, firebaseInitError = null;
if(firebaseReady){
  try{
    fbApp = initializeApp(firebaseConfig);
    auth = getAuth(fbApp);
    db = getFirestore(fbApp);
  }catch(e){
    firebaseInitError = e;
    console.error("Firebase init error:", e);
    document.getElementById("loadingText").innerHTML =
      '⚠️ Firebase failed to start.<br>Error: '+ (e && e.message ? e.message : e) +
      '<br><br>Tip: this usually happens when the file is opened directly (file://). '+
      'Try serving it from a local server (e.g. <code>python3 -m http.server</code>) or hosting it online.';
  }
}else{
  document.getElementById("loadingText").innerHTML =
    '⚠️ Firebase is not configured yet.<br>Open the HTML file and paste your Firebase project config into <code>firebaseConfig</code> near the top of the script.';
}

// Safety net: if we're still stuck on the loading screen after 10s, something went wrong silently — say so.
setTimeout(()=>{
  const loadingEl = document.getElementById("loadingScreen");
  if(loadingEl && !loadingEl.classList.contains("hidden") && !firebaseInitError && firebaseReady){
    document.getElementById("loadingText").innerHTML =
      '⚠️ This is taking too long.<br>Possible causes: the page is opened as a local file (file://) instead of being served over http/https, '+
      'an ad-blocker is blocking Firebase, Email/Password sign-in isn\'t enabled, or Firestore database hasn\'t been created yet.<br><br>'+
      'Open your browser console (F12) to see the exact error.';
  }
}, 10000);

/* ============================================================
   DATA — DEFAULT WEEKLY & MOCK SCHEDULE (used to seed new accounts)
   type: lecture | practice | notes | revision | current-affairs | skill | break
============================================================ */
const DEFAULT_WEEKDAY_SCHEDULE = [
  { time:"09:00 - 10:30", subject:"Morning Study Session",  duration:90,  type:"lecture",  icon:"📘", tag:"study" },
  { time:"10:30 - 10:45", subject:"Short Break",             duration:15,  type:"break",    icon:"☕", tag:"break" },
  { time:"10:45 - 12:15", subject:"Practice",                duration:90,  type:"practice", icon:"✍️", tag:"study" },
  { time:"17:00 - 18:00", subject:"Revision",                duration:60,  type:"revision", icon:"🔁", tag:"study" },
];

const DEFAULT_SUNDAY_SCHEDULE = [
  { time:"10:00 - 11:30", subject:"Weekly Revision",         duration:90,  type:"revision", icon:"🔁", tag:"study" },
  { time:"11:30 - 12:00", subject:"Plan Next Week",          duration:30,  type:"notes",    icon:"📝", tag:"study" },
];

let userRoutine = null; // { "0": [...tasks for Sunday], "1": [...Monday], ... "6": [...Saturday] }

function defaultScheduleForDow(dow){ return dow === 0 ? DEFAULT_SUNDAY_SCHEDULE : DEFAULT_WEEKDAY_SCHEDULE; }
function seedDefaultRoutine(){
  const r = {};
  for(let d=0; d<7; d++) r[String(d)] = JSON.parse(JSON.stringify(defaultScheduleForDow(d)));
  return r;
}
function scheduleForDow(dow){
  if(userRoutine && userRoutine[String(dow)]) return userRoutine[String(dow)];
  return defaultScheduleForDow(dow);
}

/* ============================================================
   MOTIVATIONAL QUOTES (100+ original lines)
============================================================ */
const QUOTES = (function(){
  const base = [
    "Discipline is the bridge between today's effort and tomorrow's success.",
    "Small consistent steps beat big occasional bursts.",
    "Your future self is built by what you do in this very hour.",
    "Focus on progress, not perfection.",
    "Every topic you revise today is a doubt you won't carry tomorrow.",
    "Success is boring on the outside and exciting on the inside.",
    "Study like your dream job is watching.",
    "The exam doesn't test luck, it tests preparation.",
    "One more page today is one less regret tomorrow.",
    "Consistency compounds — trust the process.",
    "You don't need motivation, you need a routine.",
    "Silence your doubts with your results.",
    "Hard days build strong toppers.",
    "Every hour of practice is a deposit in your future.",
    "The syllabus doesn't care about your mood — show up anyway.",
    "Champions are made in the hours nobody sees.",
    "Your only competition is who you were yesterday.",
    "A calm mind absorbs more than a rushed one.",
    "Revision is where knowledge becomes memory.",
    "Don't count the hours, make the hours count.",
    "Great scores are just small habits repeated daily.",
    "Tired today, proud tomorrow.",
    "Study smart, revise smarter, sleep well.",
    "Your notebook is the proof of your discipline.",
    "Nobody drowns in sweat, they only drown in excuses.",
    "The pain of discipline weighs ounces, the pain of regret weighs tons.",
    "Keep your goal bigger than your excuses.",
    "Master the basics, the advanced will follow.",
    "One focused hour beats three distracted ones.",
    "Every mock test is a mirror — look closely and improve.",
    "The gap between dreams and reality is called action.",
    "Your rank is written in your daily routine.",
    "Practice until it becomes instinct.",
    "Effort never goes unnoticed by the results.",
    "Stay patient — preparation is a marathon, not a sprint.",
    "Turn 'I have to study' into 'I get to study'.",
    "Errors today are lessons for the final day.",
    "Your only job today is to be 1% better than yesterday.",
    "Don't wait for motivation, create momentum.",
    "The mind grows where attention flows.",
    "You are one revision away from clarity.",
    "Victory starts with a single solved question — keep going.",
    "Every subject mastered is a door opened.",
    "A distracted hour is a wasted hour — protect your focus.",
    "Study today so you don't have to explain tomorrow.",
    "The best investment is the one you make in your own mind.",
    "Set the bar high and don't apologize for it.",
    "Speed comes from accuracy, accuracy comes from practice.",
    "Your notes today are your confidence tomorrow.",
    "Stay hungry for knowledge, stay humble in practice.",
    "A clear routine builds a clear mind.",
    "Every rejected excuse is a step closer to selection.",
    "Trust your preparation more than your nerves.",
    "The best time to revise was yesterday, the next best time is now.",
    "Push through the boring parts — that's where growth hides.",
    "Discipline chooses between what you want now and what you want most.",
    "Your current affairs today, your general knowledge tomorrow.",
    "Every completed task is a brick in your success wall.",
    "Study with the intensity of someone who has something to prove.",
    "The syllabus is long, but so is your determination.",
    "Don't just read, understand — don't just understand, retain.",
    "A well-planned day defeats a thousand random hours.",
    "Give your goals the same energy as your excuses.",
    "The strongest candidates are simply the most consistent ones.",
    "Sharpen your basics daily — advanced problems fear strong basics.",
    "Every checkbox you tick today is a promise kept to yourself.",
    "Preparation removes the fear of the unknown.",
    "You are not behind, you are exactly where your effort has placed you.",
    "Own your mornings and your exams will own themselves.",
    "The desk is where dreams get their daily deposit.",
    "Study hours build the confidence exam halls can't shake.",
    "Consistency is a quiet superpower — use it daily.",
    "A tired body with a trained mind still wins.",
    "Every revision cycle locks knowledge a little deeper.",
    "Focus turns hours into results.",
    "Your goals don't expire just because you're tired today — rest, then return.",
    "Great results are simply good habits, repeated relentlessly.",
    "The version of you that clears this exam is built today.",
    "Test yourself before the test does.",
    "Slow progress is still progress — keep the streak alive.",
    "Your dedication today writes your success story tomorrow.",
    "Study sessions are conversations with your future self.",
    "Discipline today, freedom tomorrow.",
    "Attack your weak topics before they attack your score.",
    "Growth lives right outside your comfort zone — one more question, keep pushing.",
    "The scoreboard rewards those who never stopped showing up.",
    "Believe in the compound interest of daily effort.",
    "Your only real deadline is the one you set for yourself.",
    "Strong foundations make advanced topics feel simple.",
    "Today's focus is tomorrow's freedom.",
    "The mind remembers what the hand writes and repeats.",
    "Aim for understanding first, speed will follow naturally.",
    "Every streak day is a promise you kept to yourself.",
    "Preparation is the quiet confidence before the loud result.",
    "Read less, revise more — retention beats repetition of new content.",
    "Your notes are a letter to your future, exam-ready self.",
    "The exam hall rewards the version of you built in this chair.",
    "Progress hides inside routine, not inside motivation.",
    "Every mock score is feedback, not a verdict.",
    "The one who revises daily fears the exam the least.",
    "Turn today's target into tomorrow's strength.",
    "Consistency beats intensity when intensity fades and consistency doesn't.",
    "Your seat at the top is reserved by your daily habits.",
    "A focused hour today is worth three panicked hours later.",
    "The results follow the routine, not the other way around."
  ];
  return base;
})();

/* ============================================================
   STORAGE — synced with Firebase (Firestore) per logged-in user
============================================================ */
let store = { days:{}, longestStreak:0 };
let currentUser = null;
let userDisplayName = "there";

// Persist one day's completion record to Firestore (fire-and-forget)
async function saveDayRecord(key, rec){
  if(!currentUser) return;
  try{
    await setDoc(doc(db,"users",currentUser.uid,"days",key), { completed: rec.completed }, { merge:true });
  }catch(e){ console.warn("Could not sync today's progress to the cloud", e); }
}

// Persist longest streak to the user's profile doc
async function saveLongestStreak(val){
  if(!currentUser) return;
  try{ await updateDoc(doc(db,"users",currentUser.uid), { longestStreak: val }); }
  catch(e){ console.warn("Could not sync streak to the cloud", e); }
}

// Persist the whole custom routine (all 7 days) to Firestore
async function saveRoutineToCloud(){
  if(!currentUser) return;
  try{ await setDoc(doc(db,"users",currentUser.uid,"routine","config"), { schedule: userRoutine }); }
  catch(e){ console.warn("Could not sync routine to the cloud", e); }
}

// Load (or seed) the user's profile document
async function loadUserProfile(uid, fallbackName){
  const ref = doc(db,"users",uid);
  const snap = await getDoc(ref);
  if(snap.exists()){
    const d = snap.data();
    userDisplayName = d.name || fallbackName || "there";
    store.longestStreak = d.longestStreak || 0;
  }else{
    userDisplayName = fallbackName || "there";
    await setDoc(ref, { name: userDisplayName, email: currentUser.email, longestStreak: 0, createdAt: new Date().toISOString() });
  }
}

// Load (or seed) the user's custom routine
async function loadRoutine(uid){
  const ref = doc(db,"users",uid,"routine","config");
  const snap = await getDoc(ref);
  if(snap.exists() && snap.data().schedule){
    userRoutine = snap.data().schedule;
  }else{
    userRoutine = seedDefaultRoutine();
    await setDoc(ref, { schedule: userRoutine });
  }
}

// Load the last ~60 days of progress records in a single range query
async function loadRecentDays(uid){
  store.days = {};
  const start = new Date(); start.setDate(start.getDate() - 60);
  const startKey = dateKey(start);
  const endKey = todayKey();
  const colRef = collection(db,"users",uid,"days");
  const q = query(colRef, where(documentId(), ">=", startKey), where(documentId(), "<=", endKey));
  const snaps = await getDocs(q);
  snaps.forEach(s => { store.days[s.id] = s.data(); });
}

// ---- Mock test marks ----
let marksEntries = []; // [{ id, subject, obtained, total, date }]

async function loadMarks(uid){
  marksEntries = [];
  const snaps = await getDocs(collection(db,"users",uid,"marks"));
  snaps.forEach(s => marksEntries.push({ id: s.id, ...s.data() }));
  marksEntries.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
}

async function addMarksEntry(subject, obtained, total, dateStr){
  if(!currentUser) return;
  const entry = { subject, obtained, total, date: dateStr || todayKey() };
  const ref = await addDoc(collection(db,"users",currentUser.uid,"marks"), entry);
  marksEntries.unshift({ id: ref.id, ...entry });
  marksEntries.sort((a,b)=> (b.date||"").localeCompare(a.date||""));
}

async function deleteMarksEntry(id){
  if(!currentUser) return;
  marksEntries = marksEntries.filter(m => m.id !== id);
  renderMarks();
  try{ await deleteDoc(doc(db,"users",currentUser.uid,"marks",id)); }
  catch(e){ console.warn("Could not delete mark from the cloud", e); }
}

function pad(n){ return n < 10 ? "0"+n : ""+n; }
function dateKey(d){ return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
function todayKey(){ return dateKey(new Date()); }

function getDayRecord(key, taskCount){
  if(!store.days[key]){
    store.days[key] = { completed: new Array(taskCount).fill(false) };
  }
  // ensure array length matches (in case schedule differs by day-of-week)
  const rec = store.days[key];
  if(rec.completed.length !== taskCount){
    const arr = new Array(taskCount).fill(false);
    for(let i=0;i<Math.min(taskCount, rec.completed.length);i++) arr[i] = rec.completed[i];
    rec.completed = arr;
  }
  return rec;
}

function dayPercent(key){
  const dow = new Date(key+"T00:00:00").getDay();
  const sched = scheduleForDow(dow);
  if(!store.days[key]) return null; // no record
  const rec = getDayRecord(key, sched.length);
  const done = rec.completed.filter(Boolean).length;
  return sched.length ? Math.round((done/sched.length)*100) : 0;
}

/* ============================================================
   HEADER: clock / date / greeting
============================================================ */
const DOW_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function updateHeader(){
  const now = new Date();
  document.getElementById("liveDay").textContent = DOW_NAMES[now.getDay()];
  document.getElementById("liveDate").textContent = pad(now.getDate())+" "+MONTH_NAMES[now.getMonth()]+" "+now.getFullYear();
  document.getElementById("liveClock").textContent = pad(now.getHours())+":"+pad(now.getMinutes())+":"+pad(now.getSeconds());

  const h = now.getHours();
  const name = userDisplayName || "there";
  let emoji, phrase, sub;
  if(h < 12){ emoji="🌅"; phrase="Good Morning"; sub="Let's make today count."; }
  else if(h < 17){ emoji="☀️"; phrase="Good Afternoon"; sub="Keep the momentum going."; }
  else if(h < 21){ emoji="🌇"; phrase="Good Evening"; sub="Finish strong today."; }
  else { emoji="🌙"; phrase="Good Night"; sub="Wrap up and rest well."; }
  document.getElementById("greetEmoji").textContent = emoji;
  document.getElementById("greetText").textContent = phrase + " ";
  document.getElementById("greetName").textContent = name;
  document.getElementById("greetSub").textContent = sub;
}
updateHeader();
setInterval(updateHeader, 1000);

/* ============================================================
   RENDER: TASK CARDS
============================================================ */
let confettiFired = false; // guard so confetti doesn't refire every render this session unless newly completed

function renderSchedule(){
  const now = new Date();
  const dow = now.getDay();
  const key = todayKey();
  const sched = scheduleForDow(dow);
  const rec = getDayRecord(key, sched.length);

  document.getElementById("scheduleTitle").textContent = dow === 0 ? "Sunday Mock Schedule" : "Today's Schedule — "+DOW_NAMES[dow];
  document.getElementById("scheduleHint").textContent = sched.length + " tasks planned";

  const grid = document.getElementById("taskGrid");
  grid.innerHTML = "";

  if(sched.length === 0){
    grid.innerHTML = '<div class="empty-state">No tasks scheduled for today. Enjoy your rest! 🌤️</div>';
    return;
  }

  sched.forEach((task, i) => {
    const done = !!rec.completed[i];
    const card = document.createElement("div");
    card.className = "glass task-card" + (done ? " done" : "");
    card.setAttribute("data-type", task.type);
    card.innerHTML = `
      <div class="task-top">
        <span class="task-time">${task.time}</span>
      </div>
      <div class="task-subject"><span class="task-type-icon">${task.icon}</span>${task.subject}</div>
      <div class="task-meta">
        <span class="task-duration">${formatDuration(task.duration)}</span>
        <span class="task-status ${done ? 'status-done' : 'status-pending'}">${done ? 'Done' : 'Pending'}</span>
      </div>
      <div class="checkbox ${done ? 'checked' : ''}" data-idx="${i}" role="button" aria-label="Mark ${task.subject} complete">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".checkbox").forEach(cb => {
    cb.addEventListener("click", () => toggleTask(parseInt(cb.dataset.idx, 10)));
  });
}

function formatDuration(mins){
  const h = Math.floor(mins/60), m = mins % 60;
  if(h && m) return h+"h "+m+"m";
  if(h) return h+"h";
  return m+"m";
}

let lastCelebratedDayKey = null;
function toggleTask(idx){
  const key = todayKey();
  const dow = new Date().getDay();
  const sched = scheduleForDow(dow);
  const rec = getDayRecord(key, sched.length);
  rec.completed[idx] = !rec.completed[idx];
  saveDayRecord(key, rec);

  renderSchedule();
  const cbEls = document.querySelectorAll(".checkbox");
  const cb = document.querySelector('.checkbox[data-idx="'+idx+'"]');
  if(cb && rec.completed[idx]){ cb.classList.add("pulse"); setTimeout(()=>cb.classList.remove("pulse"), 500); }

  renderAll(true);

  const allDone = rec.completed.every(Boolean) && sched.length > 0;
  if(allDone && rec.completed[idx] && lastCelebratedDayKey !== key){
    lastCelebratedDayKey = key;
    celebrate();
  }
  if(!allDone){
    lastCelebratedDayKey = null; // allow celebrating again if they complete the day a second time
  }
}

/* ============================================================
   PROGRESS RING
============================================================ */
const RING_CIRC = 2 * Math.PI * 86;
function renderRing(){
  const key = todayKey();
  const dow = new Date().getDay();
  const sched = scheduleForDow(dow);
  const rec = getDayRecord(key, sched.length);
  const done = rec.completed.filter(Boolean).length;
  const pct = sched.length ? Math.round((done/sched.length)*100) : 0;

  const fg = document.getElementById("ringFg");
  const offset = RING_CIRC - (pct/100)*RING_CIRC;
  fg.setAttribute("stroke-dasharray", RING_CIRC.toFixed(2));
  fg.style.strokeDashoffset = offset;

  document.getElementById("ringPct").textContent = pct + "%";
  document.getElementById("ringLbl").textContent = done + " / " + sched.length + " tasks";
  document.getElementById("ringFoot").textContent =
    pct === 100 ? "🎉 Perfect day — every task complete!" :
    pct === 0 ? "Complete today's tasks to fill the ring" :
    (sched.length - done) + " task" + ((sched.length-done)===1?"":"s") + " remaining today";
}

/* ============================================================
   ANALYTICS
============================================================ */
const STUDY_TYPES = ["lecture","practice","notes","revision","current-affairs","skill"];

function computeAnalytics(){
  const key = todayKey();
  const dow = new Date().getDay();
  const sched = scheduleForDow(dow);
  const rec = getDayRecord(key, sched.length);

  let targetMins = 0, completedMins = 0;
  let lecCount=0, pracCount=0, noteCount=0, revCount=0, skillMins=0;

  sched.forEach((t,i)=>{
    if(STUDY_TYPES.includes(t.type)){
      targetMins += t.duration;
      if(rec.completed[i]){
        completedMins += t.duration;
        if(t.type==="lecture") lecCount++;
        if(t.type==="practice") pracCount++;
        if(t.type==="notes") noteCount++;
        if(t.type==="revision") revCount++;
        if(t.type==="skill") skillMins += t.duration;
      }
    }
  });

  const remainingMins = Math.max(targetMins - completedMins, 0);
  const pct = targetMins ? Math.round((completedMins/targetMins)*100) : 0;

  // streak calculation
  let streak = 0;
  let cursor = new Date();
  while(true){
    const k = dateKey(cursor);
    const p = dayPercent(k);
    if(p === null) break;
    if(p >= 80){ streak++; cursor.setDate(cursor.getDate()-1); }
    else break;
  }
  if(streak > (store.longestStreak||0)){ store.longestStreak = streak; saveLongestStreak(streak); }

  return { targetMins, completedMins, remainingMins, pct, lecCount, pracCount, noteCount, revCount, skillMins, streak, longestStreak: store.longestStreak||0 };
}

function renderAnalytics(){
  const a = computeAnalytics();
  const cards = [
    { icon:"🎯", val: formatDuration(a.targetMins), label:"Target Study Hours", color:"#3D5CFF" },
    { icon:"📖", val: formatDuration(a.completedMins), label:"Completed Hours", color:"#12B981" },
    { icon:"⌛", val: formatDuration(a.remainingMins), label:"Remaining Hours", color:"#F5A524" },
    { icon:"📊", val: a.pct+"%", label:"Percentage", color:"#6C4CF1" },
    { icon:"🔥", val: a.streak+" day"+(a.streak===1?"":"s"), label:"Today's Streak", color:"#F15B6C" },
    { icon:"🏆", val: a.longestStreak+" day"+(a.longestStreak===1?"":"s"), label:"Longest Streak", color:"#F7B733" },
    { icon:"📘", val: a.lecCount, label:"Lectures Completed", color:"#06B6D4" },
    { icon:"✍️", val: a.pracCount, label:"Practice Completed", color:"#EC4899" },
    { icon:"📝", val: a.noteCount, label:"Notes Completed", color:"#8B5CF6" },
    { icon:"🔁", val: a.revCount, label:"Revision Completed", color:"#F5A524" },
    { icon:"💻", val: formatDuration(a.skillMins), label:"Skill Hours", color:"#12B981" },
  ];
  const grid = document.getElementById("analyticsGrid");
  grid.innerHTML = cards.map(c => `
    <div class="glass stat-card" style="--stat-color:${c.color}">
      <div class="stat-icon" style="background:color-mix(in srgb, ${c.color} 16%, white); color:${c.color}">${c.icon}</div>
      <div class="stat-value">${c.val}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join("");
}

/* ============================================================
   WEEKLY PROGRESS
============================================================ */
function renderWeekly(){
  const now = new Date();
  const curDow = now.getDay(); // 0 Sun .. 6 Sat
  // Monday-start week
  const mondayOffset = curDow === 0 ? -6 : 1 - curDow;
  const monday = new Date(now); monday.setDate(now.getDate()+mondayOffset);

  const order = [1,2,3,4,5,6,0]; // Mon..Sun
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const barColors = ["#3D5CFF","#06B6D4","#8B5CF6","#EC4899","#F5A524","#F15B6C","#6C4CF1"];

  let html = "";
  for(let i=0;i<7;i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const k = dateKey(d);
    const isToday = k === todayKey();
    const p = dayPercent(k);
    const pct = p === null ? 0 : p;
    const barStyle = isToday ? "" : `--bar-color:${barColors[i]}; --bar-glow:${barColors[i]}55;`;
    html += `
      <div class="week-row${isToday?' today':''}">
        <span class="wday">${labels[i]}</span>
        <div class="week-bar-track"><div class="week-bar-fill" data-pct="${pct}" style="width:0%;${barStyle}"></div></div>
        <span class="wpct">${pct}%</span>
      </div>`;
  }
  document.getElementById("weeklyCard").innerHTML = html;
  requestAnimationFrame(()=>{
    document.querySelectorAll(".week-bar-fill").forEach(el=>{
      el.style.width = el.dataset.pct + "%";
    });
  });
}

/* ============================================================
   MONTHLY HEATMAP
============================================================ */
function renderHeatmap(){
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  document.getElementById("heatmapMonth").textContent = MONTH_NAMES[month]+" "+year+" Heatmap";

  const dowRow = document.getElementById("heatDow");
  dowRow.innerHTML = ["S","M","T","W","T","F","S"].map(d=>`<div class="heat-dow">${d}</div>`).join("");

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();

  let cells = "";
  for(let i=0;i<startOffset;i++) cells += '<div class="heat-cell blank"></div>';

  const tKey = todayKey();
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    const k = dateKey(d);
    let cls = "n";
    if(d > now && k !== tKey){ cls = "blank"; }
    else{
      const p = dayPercent(k);
      if(p === null) cls = "n";
      else if(p >= 80) cls = "g";
      else if(p > 0) cls = "y";
      else cls = "n";
    }
    const todayCls = k === tKey ? " today-cell" : "";
    cells += `<div class="heat-cell ${cls}${todayCls}" title="${k}"></div>`;
  }
  document.getElementById("heatGrid").innerHTML = cells;
}

/* ============================================================
   PRODUCTIVITY GAUGE
============================================================ */
const GAUGE_LEN = 314; // approx path length for the semicircle
function renderGauge(){
  const now = new Date();
  let sum = 0, count = 0;
  for(let i=0;i<7;i++){
    const d = new Date(now); d.setDate(now.getDate()-i);
    const p = dayPercent(dateKey(d));
    if(p !== null){ sum += p; count++; }
  }
  const score = count ? Math.round(sum/count) : 0;

  let label = "Needs Improvement", advice = "No data yet — start checking off tasks to see your guidance here.";
  if(count === 0){
    label = "Needs Improvement";
  }else if(score >= 90){
    label = "Excellent";
    advice = "You're on track — just keep this consistency going.";
  }else if(score >= 75){
    label = "Very Good";
    advice = "Good pace. Stay consistent and avoid skipping days.";
  }else if(score >= 60){
    label = "Good";
    advice = "You're doing okay, but push a bit more to build a stronger streak.";
  }else{
    label = "Needs Improvement";
    advice = "You need to study more — try completing every task for a few days straight.";
  }

  const arc = document.getElementById("gaugeArc");
  const offset = GAUGE_LEN - (score/100)*GAUGE_LEN;
  arc.style.strokeDashoffset = offset;
  document.getElementById("gaugeVal").textContent = score + "%";
  document.getElementById("gaugeLabel").textContent = label;
  document.getElementById("gaugeAdvice").textContent = advice;
}

/* ============================================================
   BADGES
============================================================ */
function computeBadgeState(){
  const a = computeAnalytics();
  const key = todayKey();
  const dow = new Date().getDay();
  const sched = scheduleForDow(dow);
  const rec = getDayRecord(key, sched.length);

  const perfectDay = sched.length > 0 && rec.completed.every(Boolean);

  function typeFullyDone(type){
    let any = false, allDone = true;
    sched.forEach((t,i)=>{
      if(t.type === type){ any = true; if(!rec.completed[i]) allDone = false; }
    });
    return any && allDone;
  }
  const practiceDone = typeFullyDone("practice");
  const revisionDone = typeFullyDone("revision");

  // cumulative study hours across all stored days
  let totalMins = 0;
  Object.keys(store.days).forEach(k=>{
    const kd = new Date(k+"T00:00:00").getDay();
    const ksched = scheduleForDow(kd);
    const rec2 = store.days[k];
    ksched.forEach((t,i)=>{
      if(STUDY_TYPES.includes(t.type) && rec2.completed[i]) totalMins += t.duration;
    });
  });
  const hundredHours = totalMins >= 100*60;

  return [
    { emoji:"🔥", name:"3 Day Streak", unlocked: a.streak >= 3, color:"#F15B6C" },
    { emoji:"🚀", name:"7 Day Streak", unlocked: a.streak >= 7, color:"#3D5CFF" },
    { emoji:"💯", name:"Perfect Day", unlocked: perfectDay, color:"#12B981" },
    { emoji:"✍️", name:"Practice Pro", unlocked: practiceDone, color:"#EC4899" },
    { emoji:"🔁", name:"Revision Champ", unlocked: revisionDone, color:"#8B5CF6" },
    { emoji:"🏆", name:"100 Study Hours", unlocked: hundredHours, color:"#F7B733" },
  ];
}

function renderBadges(){
  const badges = computeBadgeState();
  document.getElementById("badgeGrid").innerHTML = badges.map(b=>`
    <div class="glass badge-card ${b.unlocked?'unlocked':''}" style="--badge-color:${b.color}">
      <div class="badge-emoji">${b.emoji}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-state">${b.unlocked ? "Unlocked" : "Locked"}</div>
    </div>
  `).join("");
}

/* ============================================================
   QUOTE
============================================================ */
function renderQuote(){
  const q = QUOTES[Math.floor(Math.random()*QUOTES.length)];
  document.getElementById("quoteText").textContent = q;
}
document.getElementById("refreshQuoteBtn").addEventListener("click", renderQuote);

/* ============================================================
   CELEBRATION: confetti + sound + modal
============================================================ */
function playSuccessSound(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i)=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i*0.12);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i*0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.12 + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i*0.12);
      osc.stop(ctx.currentTime + i*0.12 + 0.4);
    });
  }catch(e){ /* audio not available, ignore silently */ }
}

let confettiParticles = [];
let confettiGen = 0;
function fireConfetti(){
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ["#3D5CFF","#6C4CF1","#12B981","#F5A524","#F15B6C","#EC4899","#F7B733"];
  const myGen = ++confettiGen; // invalidates any older, still-running animation loop
  confettiParticles = [];
  for(let i=0;i<320;i++){
    // most particles start already spread across the screen (instant burst),
    // a smaller share start just above the top edge to keep replenishing the fall
    const startsOnScreen = Math.random() < 0.75;
    confettiParticles.push({
      x: Math.random()*canvas.width,
      y: startsOnScreen ? Math.random()*canvas.height*0.85 : -20 - Math.random()*canvas.height*0.15,
      r: 4 + Math.random()*6,
      c: colors[Math.floor(Math.random()*colors.length)],
      vy: 2.5 + Math.random()*3.5,
      vx: -1.5 + Math.random()*3,
      rot: Math.random()*360,
      vr: -6 + Math.random()*12,
      shape: Math.random() > 0.5 ? "rect" : "circle"
    });
  }
  let start = performance.now();
  function frame(t){
    if(myGen !== confettiGen) return; // a newer celebration took over — stop quietly
    ctx.clearRect(0,0,canvas.width,canvas.height);
    confettiParticles.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI/180);
      ctx.fillStyle = p.c;
      if(p.shape === "rect") ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
      else{ ctx.beginPath(); ctx.arc(0,0,p.r/2,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });
    if(t - start < 3400){
      requestAnimationFrame(frame);
    }else if(myGen === confettiGen){
      ctx.clearRect(0,0,canvas.width,canvas.height);
    }
  }
  requestAnimationFrame(frame);
}

function celebrate(){
  const h3 = document.querySelector("#celebrateModal h3");
  if(h3) h3.textContent = "Excellent Work "+(userDisplayName||"there")+"!";
  fireConfetti();
  playSuccessSound();
  const modal = document.getElementById("celebrateModal");
  modal.classList.add("show");
}
document.getElementById("closeModalBtn").addEventListener("click", ()=>{
  document.getElementById("celebrateModal").classList.remove("show");
});

/* ============================================================
   FOOTER YEAR
============================================================ */
document.getElementById("footYear").textContent = new Date().getFullYear();

/* ============================================================
   MASTER RENDER
============================================================ */
function renderAll(skipSchedule){
  if(!currentUser) return;
  if(!skipSchedule) renderSchedule();
  renderRing();
  renderAnalytics();
  renderWeekly();
  renderHeatmap();
  renderGauge();
  renderBadges();
}

/* ============================================================
   ROUTINE BUILDER
============================================================ */
let selectedBuilderDow = new Date().getDay();
const DOW_TAB_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function renderDayTabs(){
  const tabs = document.getElementById("dayTabs");
  tabs.innerHTML = DOW_TAB_LABELS.map((l,i)=>
    `<button type="button" class="day-tab ${i===selectedBuilderDow?'active':''}" data-dow="${i}">${l}</button>`
  ).join("");
  tabs.querySelectorAll(".day-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      selectedBuilderDow = parseInt(btn.dataset.dow, 10);
      renderDayTabs();
      renderRoutineTaskList();
    });
  });
}

function renderRoutineTaskList(){
  const sched = (userRoutine && userRoutine[String(selectedBuilderDow)]) || [];
  const list = document.getElementById("routineTaskList");
  if(sched.length === 0){
    list.innerHTML = '<div class="empty-state">No tasks yet for this day. Add your first task below 👇</div>';
    return;
  }
  list.innerHTML = sched.map((t,i)=>`
    <div class="routine-task-row">
      <span class="rt-time">${t.time}</span>
      <span class="rt-icon">${t.icon||"📌"}</span>
      <span class="rt-subject">${t.subject}</span>
      <span class="rt-duration">${formatDuration(t.duration)}</span>
      <span class="rt-type">${t.type}</span>
      <button type="button" class="rt-delete" data-idx="${i}" aria-label="Delete task">✕</button>
    </div>
  `).join("");
  list.querySelectorAll(".rt-delete").forEach(btn=>{
    btn.addEventListener("click", ()=> deleteRoutineTask(parseInt(btn.dataset.idx, 10)));
  });
}

function afterRoutineChange(){
  saveRoutineToCloud();
  renderRoutineTaskList();
  // if the edited day is today, refresh the live schedule/analytics right away
  if(selectedBuilderDow === new Date().getDay()){
    renderSchedule();
    renderAll(true);
  }
}

function deleteRoutineTask(idx){
  userRoutine[String(selectedBuilderDow)].splice(idx, 1);
  afterRoutineChange();
}

document.getElementById("addTaskForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const time = document.getElementById("taskTime").value.trim();
  const subject = document.getElementById("taskSubject").value.trim();
  const duration = parseInt(document.getElementById("taskDuration").value, 10);
  const type = document.getElementById("taskType").value;
  let icon = document.getElementById("taskIcon").value.trim();
  if(!icon){
    const iconMap = { lecture:"📘", practice:"✍️", notes:"📝", revision:"🔁", skill:"💻", "current-affairs":"📰", "break":"☕" };
    icon = iconMap[type] || "📌";
  }
  if(!time || !subject || !duration) return;
  if(!userRoutine[String(selectedBuilderDow)]) userRoutine[String(selectedBuilderDow)] = [];
  userRoutine[String(selectedBuilderDow)].push({ time, subject, duration, type, icon, tag:type });
  e.target.reset();
  afterRoutineChange();
});

document.getElementById("resetDayBtn").addEventListener("click", ()=>{
  userRoutine[String(selectedBuilderDow)] = JSON.parse(JSON.stringify(defaultScheduleForDow(selectedBuilderDow)));
  afterRoutineChange();
});

document.getElementById("resetAllBtn").addEventListener("click", ()=>{
  if(!confirm("Reset every day's routine back to the default? This replaces all your custom tasks.")) return;
  userRoutine = seedDefaultRoutine();
  afterRoutineChange();
});

document.getElementById("toggleRoutineBtn").addEventListener("click", ()=>{
  const box = document.getElementById("routineEditorBox");
  const btn = document.getElementById("toggleRoutineBtn");
  const nowHidden = box.classList.toggle("hidden");
  btn.textContent = nowHidden ? "✏️ Edit Routine" : "✕ Close Editor";
});

/* ============================================================
   MOCK TEST MARKS
============================================================ */
function suggestionForPercent(pct){
  if(pct >= 85) return { label:"Excellent", advice:"You're scoring well — just maintain this consistency.", color:"#12B981" };
  if(pct >= 70) return { label:"Good", advice:"Decent score. A bit more practice will push this higher.", color:"#3D5CFF" };
  if(pct >= 50) return { label:"Needs Work", advice:"You need to put in more effort here — revise the weak topics.", color:"#F5A524" };
  return { label:"Weak Area", advice:"This needs serious attention — increase study hours on this subject.", color:"#F15B6C" };
}

function computeSubjectSummaries(){
  const bySubject = {};
  marksEntries.forEach(m=>{
    if(!bySubject[m.subject]) bySubject[m.subject] = { obtained:0, total:0, count:0 };
    bySubject[m.subject].obtained += Number(m.obtained)||0;
    bySubject[m.subject].total += Number(m.total)||0;
    bySubject[m.subject].count += 1;
  });
  return Object.keys(bySubject).map(subject=>{
    const s = bySubject[subject];
    const pct = s.total ? Math.round((s.obtained/s.total)*100) : 0;
    return { subject, ...s, pct };
  }).sort((a,b)=> a.pct - b.pct); // weakest first, so it's the first thing they see
}

function renderMarks(){
  // subject datalist
  const subjects = [...new Set(marksEntries.map(m=>m.subject))];
  document.getElementById("subjectList").innerHTML = subjects.map(s=>`<option value="${s}"></option>`).join("");

  const summaries = computeSubjectSummaries();
  const summaryGrid = document.getElementById("subjectSummaryGrid");

  if(summaries.length === 0){
    summaryGrid.innerHTML = '<div class="empty-state">Add your first mock score below to get personalized guidance.</div>';
  }else{
    let overallObtained = 0, overallTotal = 0;
    summaries.forEach(s=>{ overallObtained += s.obtained; overallTotal += s.total; });
    const overallPct = overallTotal ? Math.round((overallObtained/overallTotal)*100) : 0;
    const overallSug = suggestionForPercent(overallPct);

    const overallCard = `
      <div class="subject-card overall" style="--sub-color:${overallSug.color}">
        <div class="sc-head"><span class="sc-name">Overall</span><span class="sc-pct">${overallPct}%</span></div>
        <div class="sc-bar-track"><div class="sc-bar-fill" style="width:${overallPct}%"></div></div>
        <div class="sc-advice">${overallSug.advice}</div>
        <div class="sc-meta">${marksEntries.length} score${marksEntries.length===1?"":"s"} across ${summaries.length} subject${summaries.length===1?"":"s"}</div>
      </div>`;

    const subjectCards = summaries.map(s=>{
      const sug = suggestionForPercent(s.pct);
      return `
        <div class="subject-card" style="--sub-color:${sug.color}">
          <div class="sc-head"><span class="sc-name">${s.subject}</span><span class="sc-pct">${s.pct}%</span></div>
          <div class="sc-bar-track"><div class="sc-bar-fill" style="width:${s.pct}%"></div></div>
          <div class="sc-advice">${sug.advice}</div>
          <div class="sc-meta">${s.obtained} / ${s.total} across ${s.count} attempt${s.count===1?"":"s"}</div>
        </div>`;
    }).join("");

    summaryGrid.innerHTML = overallCard + subjectCards;
  }

  const list = document.getElementById("marksList");
  if(marksEntries.length === 0){
    list.innerHTML = "";
  }else{
    list.innerHTML = marksEntries.map(m=>{
      const pct = m.total ? Math.round((m.obtained/m.total)*100) : 0;
      return `
        <div class="marks-row">
          <span class="mr-subject">${m.subject}</span>
          <span class="mr-score">${m.obtained}/${m.total} (${pct}%)</span>
          <span class="mr-date">${m.date||""}</span>
          <span></span>
          <button type="button" class="mr-delete" data-id="${m.id}" aria-label="Delete entry">✕</button>
        </div>`;
    }).join("");
    list.querySelectorAll(".mr-delete").forEach(btn=>{
      btn.addEventListener("click", ()=> deleteMarksEntry(btn.dataset.id));
    });
  }
}

document.getElementById("addMarksForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const subject = document.getElementById("marksSubject").value.trim();
  const obtained = parseFloat(document.getElementById("marksObtained").value);
  const total = parseFloat(document.getElementById("marksTotal").value);
  const dateVal = document.getElementById("marksDate").value;
  if(!subject || isNaN(obtained) || isNaN(total) || total <= 0) return;
  await addMarksEntry(subject, obtained, total, dateVal);
  e.target.reset();
  renderMarks();
});

/* ============================================================
   AUTH — Register / Login / Logout
============================================================ */
function showLoading(show, text){
  const el = document.getElementById("loadingScreen");
  if(text) document.getElementById("loadingText").textContent = text;
  el.classList.toggle("hidden", !show);
}
function showAuthOverlay(show){ document.getElementById("authOverlay").classList.toggle("hidden", !show); }
function showAppShell(show){ document.getElementById("appShell").classList.toggle("hidden", !show); }
function clearAuthError(){ document.getElementById("authError").textContent = ""; }
function showAuthError(msg){ document.getElementById("authError").textContent = msg; }
function setAuthSubmitting(isSubmitting){
  document.getElementById("loginSubmitBtn").disabled = isSubmitting;
  document.getElementById("registerSubmitBtn").disabled = isSubmitting;
}
function friendlyAuthError(err){
  const code = (err && err.code) || "";
  const map = {
    "auth/email-already-in-use": "This email is already registered — try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with this email. Try registering.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection."
  };
  return map[code] || "Something went wrong. Please try again.";
}
function switchAuthTab(tab){
  clearAuthError();
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("tabLoginBtn").classList.toggle("active", tab === "login");
  document.getElementById("tabRegisterBtn").classList.toggle("active", tab === "register");
}
document.getElementById("tabLoginBtn").addEventListener("click", ()=> switchAuthTab("login"));
document.getElementById("tabRegisterBtn").addEventListener("click", ()=> switchAuthTab("register"));

document.getElementById("registerForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAuthError();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  if(!name){ showAuthError("Please enter your name."); return; }
  setAuthSubmitting(true);
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    userDisplayName = name; // used immediately once onAuthStateChanged loads the rest
  }catch(err){
    showAuthError(friendlyAuthError(err));
  }
  setAuthSubmitting(false);
});

document.getElementById("loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAuthError();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  setAuthSubmitting(true);
  try{
    await signInWithEmailAndPassword(auth, email, password);
  }catch(err){
    showAuthError(friendlyAuthError(err));
  }
  setAuthSubmitting(false);
});

document.getElementById("logoutBtn").addEventListener("click", async ()=>{
  try{ await signOut(auth); }catch(e){ console.warn("Logout failed", e); }
});

function applyUserBranding(){
  const initials = (userDisplayName||"?").trim().charAt(0).toUpperCase() || "?";
  document.getElementById("userAvatar").textContent = initials;
  document.getElementById("userNameLabel").textContent = userDisplayName;
}

function boot(){
  renderDayTabs();
  renderRoutineTaskList();
  renderMarks();
  renderSchedule();
  renderAll(true);
  renderQuote();
}

if(firebaseReady){
  onAuthStateChanged(auth, async (user)=>{
    if(user){
      currentUser = user;
      showLoading(true, "Loading your planner…");
      showAuthOverlay(false);
      try{
        await Promise.all([
          loadUserProfile(user.uid, user.displayName),
          loadRoutine(user.uid),
          loadRecentDays(user.uid),
          loadMarks(user.uid)
        ]);
        applyUserBranding();
        document.getElementById("userBadge").style.display = "flex";
        showAppShell(true);
        boot();
        showLoading(false);
      }catch(e){
        console.error(e);
        currentUser = null;
        showAppShell(false);
        showLoading(false);
        showAuthOverlay(true);
        showAuthError("Could not load your data. Check your internet connection and try again.");
      }
    }else{
      currentUser = null;
      showAppShell(false);
      showLoading(false);
      showAuthOverlay(true);
    }
  });
}

// keep clock-driven sections (greeting, today's card set) fresh across midnight rollover
let lastKey = todayKey();
setInterval(()=>{
  const k = todayKey();
  if(k !== lastKey){
    lastKey = k;
    renderAll(false);
  }
}, 30000);

window.addEventListener("resize", ()=>{
  const canvas = document.getElementById("confetti-canvas");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
});

/* ============================================================
   LOGIN SCREEN BUBBLES — fully JS-driven (no dependency on CSS
   animations loading correctly, and unaffected by OS-level
   "reduce motion" CSS overrides since we set transform directly)
============================================================ */
(function initBubbles(){
  const bubbles = document.querySelectorAll(".bubble");
  if(!bubbles.length) return;

  const specs = Array.from(bubbles).map(el=>{
    const size = parseFloat(el.dataset.size) || 24;
    const color = el.dataset.color || "#3D5CFF";
    el.style.left = (el.dataset.left || 50) + "%";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.background = `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.9), ${color} 55%, ${color} 100%)`;
    el.style.boxShadow = `0 0 18px ${color}`;
    el.style.willChange = "transform, opacity";
    return {
      el,
      duration: parseFloat(el.dataset.duration) || 14,
      delay: parseFloat(el.dataset.delay) || 0,
      drift: -20 + Math.random()*40
    };
  });

  const start = performance.now();
  function frame(t){
    const elapsed = (t - start) / 1000;
    const riseDistance = window.innerHeight + 200;
    specs.forEach(s=>{
      let phase = ((elapsed - s.delay) % s.duration) / s.duration;
      if(phase < 0) phase += 1;
      const y = -phase * riseDistance;
      const x = Math.sin(phase * Math.PI * 2) * s.drift;
      const scale = 0.85 + Math.sin(phase * Math.PI) * 0.25;
      let opacity;
      if(phase < 0.1) opacity = (phase/0.1) * 0.6;
      else if(phase > 0.88) opacity = ((1-phase)/0.12) * 0.6;
      else opacity = 0.6;
      s.el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      s.el.style.opacity = opacity;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();