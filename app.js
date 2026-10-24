const socket = io();
const $ = id => document.getElementById(id);
const avatarChoices = ["🧑‍🎓","👩‍🎓","👨‍🎓","🧑‍🚀","👩‍🔬","👨‍💻","🦊","🐼","🐯","🦄","🤖","🧙","🦸","🥷","🐸","🐱"];
let selectedAvatar = avatarChoices[0], myId = null, isHost = false, roomCode = "", currentQuestion = null, timerInterval = null, myScore = 0, answered = false;
const sampleQuestions = [
 {text:"Kompyuterning asosiy hisoblash qurilmasi qaysi?",options:["Monitor","Protsessor","Klaviatura","Sichqoncha"],correct:2},
 {text:"Internet sahifalarini ko‘rish uchun nima ishlatiladi?",options:["Brauzer","Kalkulyator","Paint","Bloknot"],correct:1},
 {text:"Algoritm nima?",options:["Kompyuter qismi","Rasm turi","Masalani yechish ketma-ketligi","Internet kabeli"],correct:3}
];
$("questionsJson").value = JSON.stringify(sampleQuestions, null, 2);
const avatarBox = $("avatars");
avatarChoices.forEach((av,i)=>{const b=document.createElement("button");b.className="avatar"+(i===0?" selected":"");b.textContent=av;b.title="Avatar "+(i+1);b.onclick=()=>{selectedAvatar=av;document.querySelectorAll(".avatar").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")};avatarBox.appendChild(b)});
socket.on("connect",()=>{$("connection").textContent="● Serverga ulandi";$("connection").style.color="#6cffb4";myId=socket.id});
socket.on("disconnect",()=>{$("connection").textContent="● Aloqa uzildi";$("connection").style.color="#ff829e"});
$("joinBtn").onclick=()=>{roomCode=$("roomCode").value.trim().toUpperCase()||"BILIM";socket.emit("joinRoom",{name:$("playerName").value.trim()||"Talaba",avatar:selectedAvatar,roomCode})};
socket.on("joined",data=>{isHost=data.isHost;roomCode=data.roomCode;$("setup").classList.add("hidden");$("game").classList.remove("hidden");$("hostPanel").classList.toggle("hidden",!isHost);$("hostBadge").textContent=isHost?"SIZ — TASHKILOTCHISIZ":"XONA: "+roomCode;});
socket.on("notice",msg=>{ $("feedback").textContent=msg; });
$("saveQuestions").onclick=()=>{try{socket.emit("setQuestions",JSON.parse($("questionsJson").value))}catch(e){$("feedback").textContent="JSON formatini tekshiring."}};
$("startBtn").onclick=()=>socket.emit("startGame");
$("againBtn").onclick=()=>{$("result").classList.add("hidden");socket.emit("startGame")};
socket.on("state",state=>{
 $("playerCount").textContent=state.players.length+" / 40";
 const me=state.players.find(p=>p.id===myId);if(me){myScore=me.score;$("myScore").textContent=me.score}
 const lb=$("leaderboard");lb.innerHTML="";
 state.players.slice(0,40).forEach((p,i)=>{const li=document.createElement("li");li.textContent=`${["🥇","🥈","🥉"][i]||"🏁"} ${p.avatar} ${p.name}`;const s=document.createElement("span");s.textContent=p.score+" ball";li.appendChild(s);lb.appendChild(li)});
});
socket.on("question",q=>{
 currentQuestion=q;answered=false;$("questionNumber").textContent=(q.index+1)+" / "+q.total;$("questionText").textContent=q.text;$("feedback").textContent="Javobni tanlang!";$("answers").innerHTML="";
 q.options.forEach((opt,i)=>{const b=document.createElement("button");b.className="answer";const letter=document.createElement("span");letter.className="letter";letter.textContent=["A","B","C","D"][i];b.append(letter,document.createTextNode(opt));b.onclick=()=>{if(answered)return;answered=true;document.querySelectorAll(".answer").forEach(x=>x.disabled=true);socket.emit("answer",i)};$("answers").appendChild(b)});
 clearInterval(timerInterval);timerInterval=setInterval(()=>{const left=Math.max(0,Math.ceil((q.endsAt-Date.now())/1000));$("timer").textContent=left;if(left<=0)clearInterval(timerInterval)},150);
});
socket.on("answerResult",r=>{$("feedback").textContent=r.message;$("feedback").style.color=r.correct?"#6cffb4":"#ff8da5"});
socket.on("questionEnded",data=>{clearInterval(timerInterval);$("timer").textContent="0";$("feedback").textContent="Vaqt tugadi! Keyingi savol tayyorlanmoqda.";});
socket.on("gameOver",data=>{const players=data.players||[];const winner=players[0];$("result").classList.remove("hidden");$("winner").textContent=winner?`G‘olib: ${winner.avatar} ${winner.name} — ${winner.score} ball!`:"O‘yin yakunlandi.";});
/* Lightweight 3D arena background */
(function(){
 const mount=$("scene");if(!window.THREE){mount.style.display="none";return}
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x091329,18,70);
 const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,100);camera.position.set(0,9,25);camera.lookAt(0,1,0);
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);mount.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0x9bdfff,0x201044,2));
 const light1=new THREE.PointLight(0x4de5ff,35,55);light1.position.set(-9,9,5);scene.add(light1);
 const light2=new THREE.PointLight(0xff68bd,32,55);light2.position.set(9,8,-3);scene.add(light2);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x101a38,metalness:.35,roughness:.65}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.2;scene.add(floor);
 const grid=new THREE.GridHelper(90,45,0x3d8bff,0x23345d);grid.position.y=-1.17;scene.add(grid);
 const mats=[0x4de5ff,0xff68bd,0x9c7bff,0x6cffb4,0xffd76b];
 for(let i=0;i<24;i++){const h=1+Math.random()*4;const geo=new THREE.BoxGeometry(.18,h,.18);const m=new THREE.MeshStandardMaterial({color:mats[i%mats.length],emissive:mats[i%mats.length],emissiveIntensity:.35});const bar=new THREE.Mesh(geo,m);bar.position.set((Math.random()-.5)*32,-1.2+h/2,-10-Math.random()*18);scene.add(bar)}
 const ringGeo=new THREE.TorusGeometry(8,.07,8,100);const ringMat=new THREE.MeshBasicMaterial({color:0x4de5ff,transparent:true,opacity:.65});const ring=new THREE.Mesh(ringGeo,ringMat);ring.position.set(0,2,-7);scene.add(ring);
 const particles=new THREE.Group();for(let i=0;i<130;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.035,6,6),new THREE.MeshBasicMaterial({color:mats[i%mats.length]}));p.position.set((Math.random()-.5)*45,Math.random()*15-1,(Math.random()-.5)*40);particles.add(p)}scene.add(particles);
 function animate(t){requestAnimationFrame(animate);ring.rotation.z=t*.00012;particles.rotation.y=t*.000015;camera.position.x=Math.sin(t*.00012)*.7;camera.lookAt(0,1,0);renderer.render(scene,camera)}animate(0);
 addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();