const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem("sbb_token") || "";
let currentUser = JSON.parse(localStorage.getItem("sbb_user") || "null");
let quizQuestions = [], quizAnswers = [], quizIndex = 0, quizTimer = null;

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
function authHeaders() { return token ? { Authorization: `Bearer ${token}` } : {}; }
async function api(url, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authHeaders(), ...(options.headers || {}) };
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function requireLogin() {
  if (!token) { openAuth("login"); toast("Please sign in to use this feature."); return false; }
  return true;
}
function setUser(user) {
  currentUser = user; localStorage.setItem("sbb_user", JSON.stringify(user));
  $("#userNameMini").textContent = user.name; $("#userEmailMini").textContent = user.email;
  $("#userAvatar").textContent = user.name.charAt(0).toUpperCase(); $("#logoutBtn").hidden = false;
  $("#accountStatus").textContent = "Active";
}
function clearUser() {
  token = ""; currentUser = null; localStorage.removeItem("sbb_token"); localStorage.removeItem("sbb_user");
  $("#userNameMini").textContent = "Guest student"; $("#userEmailMini").textContent = "Sign in to save progress";
  $("#userAvatar").textContent = "S"; $("#logoutBtn").hidden = true; $("#accountStatus").textContent = "Guest";
}
if (currentUser && token) setUser(currentUser);

const pageNames = { home:"Dashboard", chat:"AI Study Assistant", math:"Math Solver", language:"Language Learning", quiz:"MCQs & Quizzes", evaluate:"Answer Evaluator", progress:"My Progress" };
function showPage(name) {
  if (!pageNames[name]) return;
  $$(".page").forEach(p => p.classList.toggle("active", p.id === `page-${name}`));
  $$(".nav-item[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  $("#pageCrumb").textContent = pageNames[name]; $("#sidebar").classList.remove("open");
  if (name === "progress") loadProgress();
  window.scrollTo({ top:0, behavior:"smooth" });
}
$$("[data-page]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => showPage(b.dataset.go)));
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));

function openAuth(mode="login") {
  $("#authModal").hidden = false; setAuthMode(mode);
}
function closeAuth() { $("#authModal").hidden = true; $("#authMessage").textContent = ""; }
function setAuthMode(mode) {
  const register = mode === "register";
  $$(".auth-tabs button").forEach(b => b.classList.toggle("selected", b.dataset.auth === mode));
  $("#authTitle").textContent = register ? "Create your account" : "Welcome back";
  $("#authSubtitle").textContent = register ? "Start your learning journey today." : "Sign in to save your learning progress.";
  $("#nameField").hidden = !register; $("#authName").required = register;
  $("#authSubmit").textContent = register ? "Create account" : "Sign in";
  $("#authPassword").autocomplete = register ? "new-password" : "current-password";
}
$("#authOpen").addEventListener("click", () => openAuth());
$("#authClose").addEventListener("click", closeAuth);
$("#authModal").addEventListener("click", e => { if (e.target.id === "authModal") closeAuth(); });
$$("[data-auth]").forEach(b => b.addEventListener("click", () => setAuthMode(b.dataset.auth)));
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault(); const mode = $(".auth-tabs .selected").dataset.auth;
  const body = { email:$("#authEmail").value, password:$("#authPassword").value };
  if (mode === "register") body.name = $("#authName").value;
  $("#authSubmit").disabled = true; $("#authMessage").textContent = "Please wait...";
  try {
    const data = await api(`/api/auth/${mode}`, { method:"POST", body:JSON.stringify(body) });
    token = data.token; localStorage.setItem("sbb_token", token); setUser(data.user); closeAuth(); toast("You're signed in. Happy learning!");
    loadProgress();
  } catch(err) { $("#authMessage").textContent = err.message; }
  finally { $("#authSubmit").disabled = false; }
});
$("#logoutBtn").addEventListener("click", () => { clearUser(); toast("You have been signed out."); });

function addMessage(text, who) {
  const row = document.createElement("div"); row.className = `message ${who}`;
  const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.textContent = who === "assistant" ? "✦" : (currentUser?.name?.[0] || "Y");
  const bubble = document.createElement("div"); bubble.className = "bubble"; bubble.textContent = text;
  row.append(avatar,bubble); $("#chatMessages").append(row); $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  return bubble;
}
$("#chatForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!requireLogin()) return;
  const input = $("#chatInput"), message = input.value.trim(); if (!message) return;
  addMessage(message,"user"); input.value = ""; const bubble = addMessage("Thinking through that for you...","assistant");
  try { const data = await api("/api/ai/chat",{method:"POST",body:JSON.stringify({message,language:$("#chatLanguage").value})}); bubble.textContent = data.reply; }
  catch(err) { bubble.textContent = err.message; }
});
$$(".suggestions button").forEach(b => b.addEventListener("click", () => { $("#chatInput").value = b.textContent; $("#chatForm").requestSubmit(); }));

function showResult(el, text, title="Your learning result") {
  el.hidden = false; el.innerHTML = ""; const heading = document.createElement("div"); heading.className = "result-title"; heading.textContent = title;
  const body = document.createElement("div"); body.textContent = text; el.append(heading,body); el.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function loading(el, title="Your AI tutor is working...") { el.hidden = false; el.classList.add("loading"); el.textContent = title; }
function doneLoading(el) { el.classList.remove("loading"); }
$("#mathImage").addEventListener("change", () => $("#imageName").textContent = $("#mathImage").files[0]?.name || "");
$("#mathForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!requireLogin()) return;
  const file = $("#mathImage").files[0], question = $("#mathQuestion").value.trim();
  if (!file && !question) return toast("Enter a problem or upload an image.");
  if (file && file.size > 5*1024*1024) return toast("Image must be smaller than 5MB.");
  const fd = new FormData(); fd.append("question",question); if(file) fd.append("image",file);
  const result=$("#mathResult"); loading(result);
  try { const data=await api("/api/ai/math",{method:"POST",body:fd}); doneLoading(result); showResult(result,data.reply,"Step-by-step solution"); }
  catch(err){doneLoading(result);showResult(result,err.message,"Something needs attention");}
});
$$("[data-math]").forEach(b=>b.addEventListener("click",()=>{$("#mathQuestion").value=b.dataset.math;$("#mathQuestion").focus()}));

$("#languageForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!requireLogin()) return;
  const result=$("#languageResult"); loading(result);
  try {
    const data=await api("/api/ai/language",{method:"POST",body:JSON.stringify({
      text:$("#languageInput").value,source:$("#sourceLanguage").value,target:$("#targetLanguage").value,
      level:$("#languageLevel").value,mode:$("#languageMode").value
    })}); doneLoading(result);showResult(result,data.reply,"Your language lesson");
  } catch(err){doneLoading(result);showResult(result,err.message,"Something needs attention");}
});
$("#evaluateForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!requireLogin()) return;
  const result=$("#evaluateResult"); loading(result);
  try {
    const data=await api("/api/ai/evaluate",{method:"POST",body:JSON.stringify({subject:$("#evalSubject").value,question:$("#evalQuestion").value,answer:$("#evalAnswer").value})});
    doneLoading(result);showResult(result,data.reply,"Your feedback");
  } catch(err){doneLoading(result);showResult(result,err.message,"Something needs attention");}
});

$("#startQuiz").addEventListener("click", async () => {
  try {
    const params=new URLSearchParams({subject:$("#quizSubject").value,difficulty:$("#quizDifficulty").value});
    quizQuestions=await api(`/api/quizzes?${params}`);
    if(!quizQuestions.length) return toast("No questions match those filters yet.");
    quizAnswers=[];quizIndex=0;$("#quizSetup").hidden=true;$("#quizResult").hidden=true;$("#quizArea").hidden=false;renderQuestion();
  } catch(err){toast(err.message);}
});
function renderQuestion(){
  const q=quizQuestions[quizIndex], area=$("#quizArea");area.innerHTML="";
  const progress=document.createElement("div");progress.className="quiz-progress";progress.innerHTML=`<span>QUESTION ${quizIndex+1} OF ${quizQuestions.length}</span><span>${q.subject} · ${q.difficulty}</span>`;
  const title=document.createElement("div");title.className="quiz-question";title.textContent=q.question;
  const options=document.createElement("div");options.className="option-list";
  q.options.forEach((opt,i)=>{const b=document.createElement("button");b.className="quiz-option"+(quizAnswers[quizIndex]===i?" selected":"");b.textContent=`${String.fromCharCode(65+i)}.  ${opt}`;b.addEventListener("click",()=>{quizAnswers[quizIndex]=i;renderQuestion()});options.append(b)});
  const controls=document.createElement("div");controls.className="quiz-controls";
  const prev=document.createElement("button");prev.className="btn";prev.textContent="← Previous";prev.disabled=quizIndex===0;prev.addEventListener("click",()=>{quizIndex--;renderQuestion()});
  const next=document.createElement("button");next.className="btn btn-primary";next.textContent=quizIndex===quizQuestions.length-1?"Submit quiz":"Next question →";next.addEventListener("click",()=>{if(quizAnswers[quizIndex]===undefined)return toast("Choose an answer first.");if(quizIndex<quizQuestions.length-1){quizIndex++;renderQuestion()}else submitQuiz()});
  controls.append(prev,next);area.append(progress,title,options,controls);
}
async function submitQuiz(){
  if(!requireLogin())return;
  try{
    const answers=quizQuestions.map((q,i)=>({id:q.id,selected:quizAnswers[i]}));
    const data=await api("/api/quizzes/submit",{method:"POST",body:JSON.stringify({topic:$("#quizSubject").value,answers})});
    $("#quizArea").hidden=true;const result=$("#quizResult");result.hidden=false;result.innerHTML="";
    const h=document.createElement("h2");h.textContent=`You scored ${data.score} out of ${data.total}`;
    const p=document.createElement("p");p.textContent=`That's ${data.percentage}%. Every attempt is a chance to improve.`;
    result.append(h,p);
    data.results.forEach((r,i)=>{const q=quizQuestions.find(x=>x.id===r.id);const item=document.createElement("div");item.className="review-item";item.innerHTML=`<strong>${i+1}. ${escapeHTML(q.question)}</strong><br><span class="${r.isCorrect?"correct":"incorrect"}">${r.isCorrect?"Correct":"Not quite"}.</span> ${escapeHTML(r.explanation)}`;result.append(item)});
    const again=document.createElement("button");again.className="btn btn-primary";again.textContent="Try another quiz";again.style.marginTop="16px";again.addEventListener("click",()=>{$("#quizResult").hidden=true;$("#quizSetup").hidden=false});result.append(again);
    loadProgress();
  }catch(err){toast(err.message)}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

async function loadProgress(){
  if(!token){$("#totalQuizzes").textContent="0";$("#averageScore").textContent="0%";$("#accountStatus").textContent="Guest";$("#attemptList").textContent="Sign in and complete a quiz to see your learning history here.";return}
  try{
    const data=await api("/api/progress");$("#totalQuizzes").textContent=data.totalQuizzes;$("#averageScore").textContent=`${data.average}%`;$("#accountStatus").textContent="Active";
    const list=$("#attemptList");list.innerHTML="";
    if(!data.attempts.length){list.textContent="No saved quiz attempts yet. Try a quiz to get started.";return}
    data.attempts.forEach(a=>{const row=document.createElement("div");row.className="attempt-row";const left=document.createElement("div");left.textContent=a.topic||"Quiz";const date=document.createElement("small");date.textContent=new Date(a.createdAt).toLocaleString();left.append(date);const score=document.createElement("span");score.className="attempt-score";score.textContent=`${a.score}/${a.total}`;row.append(left,score);list.append(row)});
  }catch(err){toast(err.message)}
}
