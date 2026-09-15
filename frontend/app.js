let currentSession='s-'+Date.now();
let isGenerating=false;
let currentPath='';
let fileHistory=[];
let fileHistIdx=-1;
let fileAllEntries=[];
let currentImage=null;

const $=id=>document.getElementById(id);
const messages=$('messages');
const welcome=$('welcome');
const msgInput=$('msgInput');
const sendBtn=$('sendBtn');
const providerSelect=$('providerSelect');
const modelSelect=$('modelSelect');

let API=localStorage.getItem('serverUrl')||'http://localhost:5001/api';

document.addEventListener('DOMContentLoaded',()=>{
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    initCyberBg();
    checkStatus();
    loadModels();
    setupEvents();
    const startPath=navigator.platform.includes('Win')?'C:\\':navigator.platform.includes('iPhone')||navigator.platform.includes('iPad')?'/':'/';
    fileNavigate(startPath);
    msgInput.focus();
});

function setupEvents(){
    msgInput.addEventListener('input',()=>{
        msgInput.style.height='auto';
        msgInput.style.height=Math.min(msgInput.scrollHeight,100)+'px';
        sendBtn.classList.toggle('active',msgInput.value.trim().length>0);
    });
    msgInput.addEventListener('keydown',e=>{
        if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}
    });
    sendBtn.addEventListener('click',sendMessage);
    $('newChatBtn').addEventListener('click',()=>{currentSession='s-'+Date.now();messages.innerHTML='';welcome.style.display='flex'});
    $('clearBtn').addEventListener('click',()=>{messages.innerHTML='';welcome.style.display='flex'});
    $('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
    providerSelect.addEventListener('change',loadModels);
    modelSelect.addEventListener('change',changeModel);
    $('termInput').addEventListener('keydown',e=>{
        if(e.key==='Enter')execTerminal();
    });
    $('binaryDrop').addEventListener('click',()=>$('binaryFile').click());
    $('binaryFile').addEventListener('change',analyzeBinary);
    $('attachBtn').addEventListener('click',()=>{
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
        inp.onchange=async e=>{
            const file=e.target.files[0];if(!file)return;
            const fd=new FormData();fd.append('file',file);
            const r=await fetch(`${API}/upload`,{method:'POST',body:fd});
            const j=await r.json();
            if(j.base64){currentImage=j.base64;$('previewImg').src='data:image/png;base64,'+j.base64;$('imagePreview').style.display='flex';}
        };inp.click();
    });
    document.addEventListener('click',e=>{
        if(window.innerWidth<=768&&!$('sidebar').contains(e.target)&&!$('menuToggle').contains(e.target))
            $('sidebar').classList.remove('open');
    });
}

// ============ CHAT (STREAMING) ============
function removeImage(){currentImage=null;$('imagePreview').style.display='none';}

async function sendMessage(){
    const msg=msgInput.value.trim();
    if(!msg||isGenerating)return;
    welcome.style.display='none';
    let displayMsg=msg;
    if(currentImage){displayMsg='[Image attached] '+msg;}
    addMsg('user',displayMsg);
    const imageToSend=currentImage;
    removeImage();
    msgInput.value='';msgInput.style.height='auto';sendBtn.classList.remove('active');
    isGenerating=true;

    // Create assistant message element for streaming
    const d=document.createElement('div');
    d.className='msg assistant';
    const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    d.innerHTML=`<div class="msg-avatar">HX</div><div class="msg-body"><div class="msg-header"><span class="msg-name">HexCore</span><span class="msg-time">${time}</span></div><div class="msg-text"></div></div>`;
    messages.appendChild(d);
    const textEl=d.querySelector('.msg-text');
    let fullText='';

    try{
        const payload={message:msg,conversation_id:currentSession,model:modelSelect.value,provider:providerSelect.value};
        if(imageToSend)payload.image=imageToSend;
        const response=await fetch(`${API}/chat`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload)
        });

        const reader=response.body.getReader();
        const decoder=new TextDecoder();
        let buffer='';

        while(true){
            const{done,value}=await reader.read();
            if(done)break;
            buffer+=decoder.decode(value,{stream:true});
            const lines=buffer.split('\n');
            buffer=lines.pop();

            for(const line of lines){
                if(line.startsWith('data: ')){
                    try{
                        const data=JSON.parse(line.slice(6));
                        if(data.error){
                            textEl.innerHTML=`<span style="color:var(--red)">${esc(data.error)}</span>`;
                        }else if(data.content){
                            fullText+=data.content;
                            textEl.innerHTML=fmtMsg(fullText);
                            scrollBottom();
                        }
                    }catch(e){}
                }
            }
        }
    }catch(e){
        textEl.innerHTML=`<span style="color:var(--red)">Connection failed. Is server running?</span>`;
    }
    isGenerating=false;
}

function addMsg(role,content){
    const d=document.createElement('div');d.className=`msg ${role}`;
    const av=role==='user'?'YOU':'HX';
    const name=role==='user'?'You':'HexCore';
    const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    d.innerHTML=`<div class="msg-avatar">${av}</div><div class="msg-body"><div class="msg-header"><span class="msg-name">${name}</span><span class="msg-time">${time}</span></div><div class="msg-text">${fmtMsg(content)}</div></div>`;
    messages.appendChild(d);scrollBottom();
}

function fmtMsg(c){
    c=c.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,code)=>`<pre><code class="lang-${l}">${esc(code.trim())}</code></pre>`);
    c=c.replace(/`([^`]+)`/g,'<code>$1</code>');
    c=c.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    c=c.replace(/\n/g,'<br>');return c;
}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function showTyping(){const id='t'+Date.now();const d=document.createElement('div');d.className='msg assistant';d.id=id;d.innerHTML=`<div class="msg-avatar">HX</div><div class="msg-body"><div class="typing"><span></span><span></span><span></span></div></div>`;messages.appendChild(d);scrollBottom();return id}
function removeTyping(id){const e=document.getElementById(id);if(e)e.remove()}
function addError(e){const d=document.createElement('div');d.className='error-msg';d.textContent=e;messages.appendChild(d);scrollBottom()}
function scrollBottom(){$('chatArea').scrollTop=$('chatArea').scrollHeight}
function quickAction(t){msgInput.value=t;msgInput.focus();msgInput.dispatchEvent(new Event('input'))}

// ============ MODELS ============
async function loadModels(){
    const provider=providerSelect.value;
    modelSelect.innerHTML='';
    if(provider==='ollama'){
        try{const res=await fetch(`${API}/models`);const data=await res.json();
            if(data.models&&data.models.length>0){
                data.models.forEach(m=>{const o=document.createElement('option');o.value=m.name;o.textContent=m.name;modelSelect.appendChild(o)});
            }else{
                const o=document.createElement('option');o.value='';o.textContent='No models found - run: ollama pull qwen2.5:7b';modelSelect.appendChild(o);
            }
        }catch(e){
            const o=document.createElement('option');o.value='';o.textContent='Cannot connect to Ollama';modelSelect.appendChild(o);
        }
    }else if(provider==='groq'){
        ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'].forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;modelSelect.appendChild(o)});
    }else{
        ['meta-llama/llama-3.3-70b-instruct:free','mistralai/mistral-7b-instruct:free','google/gemma-2-9b-it:free'].forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;modelSelect.appendChild(o)});
    }
}
async function changeModel(){await fetch(`${API}/model`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:modelSelect.value,provider:providerSelect.value})})}

// ============ STATUS ============
async function checkStatus(){
    try{const res=await fetch(`${API}/status`);const data=await res.json();
        const online=data.ollama_running||data.groq_key||data.openrouter_key;
        $('statusDot').classList.toggle('on',online);
        let statusText=data.active_provider==='ollama'?(data.ollama_running?`Ollama OK`:'Ollama offline'):`${data.active_provider.charAt(0).toUpperCase()+data.active_provider.slice(1)} ${data.active_provider==='groq'?data.groq_key?'OK':'No key':data.openrouter_key?'OK':'No key'}`;
        $('statusText').textContent=statusText;
        $('platformInfo').textContent=data.platform||'--';
        $('modelInfo').textContent=`${data.active_provider} / ${data.active_model}`;
    }catch(e){$('statusText').textContent='Server offline'}
}

// ============ FILE EXPLORER ============
function fileNavigate(path){
    openDir(path);
}
async function openDir(path){
    try{
        const res=await fetch(`${API}/fs/list`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});
        const data=await res.json();
        if(data.error){addError(data.error);return}
        if(fileHistory[fileHistIdx]!==data.path){
            fileHistory=fileHistory.slice(0,fileHistIdx+1);
            fileHistory.push(data.path);
            fileHistIdx=fileHistory.length-1;
        }
        currentPath=data.path;
        $('filePathInput').value=data.path;
        renderFileList(data.entries,data.path);
    }catch(e){addError('Failed to load directory')}
}

function renderFileList(entries,basePath){
    const list=$('fileList');list.innerHTML='';
    fileAllEntries=entries;
    // Parent directory
    if(basePath!=='C:\\'&&basePath!=='/'&&basePath!=='\\'&&basePath.length>1){
        const up=document.createElement('div');
        up.className='file-entry dir';
        up.innerHTML=`<span class="icon">📁</span><span class="name">..</span><span class="size"></span><span class="date"></span>`;
        up.onclick=()=>{const parent=basePath.replace(/[\\\/][^\\\/]+$/,'');openDir(parent||'C:\\')};
        list.appendChild(up);
    }
    entries.forEach(e=>{
        const d=document.createElement('div');
        const ext=e.ext||'';
        const isImg=['.png','.jpg','.jpeg','.gif','.bmp','.svg','.webp'].includes(ext);
        const isExe=['.exe','.msi','.bat','.cmd','.ps1','.sh'].includes(ext);
        const cls=e.is_dir?'dir':isExe?'exe':isImg?'img':'file';
        const icon=e.is_dir?'📁':isExe?'⚙️':isImg?'🖼️':'📄';
        const size=e.is_dir?'':fmtSize(e.size);
        const date=e.modified?new Date(e.modified).toLocaleDateString():'';
        const access=e.no_access?'<span class="access-badge">🔒</span>':'';
        d.className=`file-entry ${cls}${e.no_access?' no-access':''}`;
        d.innerHTML=`<span class="icon">${icon}</span><span class="name">${esc(e.name)}</span><span class="size">${size}</span><span class="date">${date}</span>${access}`;
        if(e.no_access){
            d.onclick=()=>{msgInput.value=`Explain the contents of ${e.path}`;msgInput.focus();msgInput.dispatchEvent(new Event('input'));closePanel('filePanel')};
        }else if(e.is_dir){
            d.onclick=()=>openDir(e.path);
        }else{
            d.ondblclick=()=>{openFile(e.path)};
            d.onclick=()=>{msgInput.value=`Analyze file: ${e.path}`;msgInput.focus();msgInput.dispatchEvent(new Event('input'))};
        }
        list.appendChild(d);
    });
}

async function openFile(path){
    try{
        const res=await fetch(`${API}/fs/read`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});
        const data=await res.json();
        if(data.error){addError(data.error);return}
        msgInput.value=`File: ${path}\n\n${data.content.substring(0,3000)}`;
        msgInput.focus();msgInput.dispatchEvent(new Event('input'));closePanel('filePanel');
    }catch(e){addError('Failed to read file')}
}

function fileGoBack(){if(fileHistIdx>0){fileHistIdx--;openDir(fileHistory[fileHistIdx])}}
function fileGoForward(){if(fileHistIdx<fileHistory.length-1){fileHistIdx++;openDir(fileHistory[fileHistIdx])}}
function fileGoUp(){if(currentPath!=='C:\\'&&currentPath!=='/'&&currentPath.length>1){const parent=currentPath.replace(/[\\\/][^\\\/]+$/,'');openDir(parent||'/')}}
function fileRefresh(){openDir(currentPath)}
function fileCreateFolder(){const name=prompt('Folder name:');if(name)fetch(`${API}/fs/mkdir`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:currentPath+'\\'+name})}).then(()=>fileRefresh())}
function filterFiles(q){
    const filtered=q?fileAllEntries.filter(e=>e.name.toLowerCase().includes(q.toLowerCase())):fileAllEntries;
    renderFileList(filtered,currentPath);
}

function fmtSize(b){if(!b)return'';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB'}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}

// ============ TERMINAL ============
async function execTerminal(){
    const input=$('termInput');const cmd=input.value.trim();if(!cmd)return;
    input.value='';
    const out=$('termOutput');
    out.innerHTML+=`<div class="cmd">$ ${esc(cmd)}</div>`;
    try{
        const res=await fetch(`${API}/terminal/exec`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:currentPath})});
        const data=await res.json();
        if(data.stdout)out.innerHTML+=`<div class="stdout">${esc(data.stdout)}</div>`;
        if(data.stderr)out.innerHTML+=`<div class="stderr">${esc(data.stderr)}</div>`;
        if(data.error)out.innerHTML+=`<div class="stderr">${esc(data.error)}</div>`;
    }catch(e){out.innerHTML+=`<div class="stderr">Connection error</div>`}
    out.scrollTop=out.scrollHeight;
}

// ============ BINARY ANALYSIS ============
async function analyzeBinary(e){
    const file=e.target.files[0];if(!file)return;
    // Upload first, then analyze
    const formData=new FormData();formData.append('file',file);
    const results=$('binaryResults');results.innerHTML='<div style="color:var(--text3)">Uploading...</div>';
    try{
        const upRes=await fetch(`${API}/fs/upload`,{method:'POST',body:formData});
        const upData=await upRes.json();
        if(upData.error){results.innerHTML=`<div class="error-msg">${esc(upData.error)}</div>`;return}
        results.innerHTML='<div style="color:var(--text3)">Analyzing...</div>';
        const res=await fetch(`${API}/fs/binary`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:upData.path})});
        const data=await res.json();
        if(data.error){results.innerHTML=`<div class="error-msg">${esc(data.error)}</div>`;return}
        results.innerHTML=`
            <div class="info-row"><span class="info-label">Type</span><span class="info-value">${data.file_type}</span></div>
            <div class="info-row"><span class="info-label">Size</span><span class="info-value">${fmtSize(data.size)}</span></div>
            <div class="info-row"><span class="info-label">MD5</span><span class="info-value">${data.md5}</span></div>
            <div class="info-row"><span class="info-label">SHA1</span><span class="info-value">${data.sha1}</span></div>
            <div class="info-row"><span class="info-label">SHA256</span><span class="info-value">${data.sha256}</span></div>
            <div class="info-row"><span class="info-label">Entropy</span><span class="info-value">${data.entropy} / 8.0</span></div>
            <div class="info-row"><span class="info-label">Magic</span><span class="info-value">${data.magic_hex}</span></div>
            <div class="info-row"><span class="info-label">Strings</span><span class="info-value">${data.strings.length} found</span></div>
            <div style="margin-top:10px;font-size:10px;color:var(--text3);letter-spacing:1px">EXTRACTED STRINGS</div>
            <div class="strings-list">${data.strings.map(s=>`<div class="string-item">${esc(s)}</div>`).join('')}</div>`;
    }catch(err){results.innerHTML=`<div class="error-msg">Analysis failed: ${err.message}</div>`}
}

// ============ TOOLS ============
async function generateHash(){
    const text=$('hashInput').value;if(!text)return;
    try{const res=await fetch(`${API}/tools/hash`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
        const data=await res.json();
        $('hashResults').innerHTML=Object.entries(data).map(([k,v])=>`<div class="hash-row"><span class="hash-label">${k.toUpperCase()}</span><span class="hash-value">${v}</span></div>`).join('');
    }catch(e){}
}
async function doEncode(type){
    const text=$('encodeInput').value;if(!text)return;
    try{const res=await fetch(`${API}/tools/encode`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,encoding:type})});
        const data=await res.json();
        $('encodeResults').innerHTML=data.error?`<div class="error-msg">${esc(data.error)}</div>`:`<div class="hash-row"><span class="hash-value" style="word-break:break-all">${esc(data.result)}</span></div>`;
    }catch(e){}
}

// ============ SYSTEM INFO ============
async function loadSysInfo(){
    const c=$('sysContent');c.innerHTML='Loading...';
    try{const res=await fetch(`${API}/system/info`);const data=await res.json();
        c.innerHTML=`
            <div class="sys-row"><span class="sys-label">OS</span><span class="sys-value">${data.os} ${data.os_version||''}</span></div>
            <div class="sys-row"><span class="sys-label">Machine</span><span class="sys-value">${data.machine||'--'}</span></div>
            <div class="sys-row"><span class="sys-label">Hostname</span><span class="sys-value">${data.hostname||'--'}</span></div>
            <div class="sys-row"><span class="sys-label">Python</span><span class="sys-value">${data.python||'--'}</span></div>
            <div class="sys-row"><span class="sys-label">CPU</span><span class="sys-value">${data.cpu_cores||'--'} cores (${data.cpu_percent||0}%)</span></div>
            <div class="bar"><div class="bar-fill" style="width:${data.cpu_percent||0}%"></div></div>
            <div class="sys-row"><span class="sys-label">RAM</span><span class="sys-value">${fmtSize(data.ram_used||0)} / ${fmtSize(data.ram_total||0)} (${data.ram_percent||0}%)</span></div>
            <div class="bar"><div class="bar-fill" style="width:${data.ram_percent||0}%"></div></div>
            <div class="sys-row"><span class="sys-label">Disk</span><span class="sys-value">${fmtSize(data.disk_used||0)} / ${fmtSize(data.disk_total||0)} (${data.disk_percent||0}%)</span></div>
            <div class="bar"><div class="bar-fill" style="width:${data.disk_percent||0}%"></div></div>
            <div class="sys-row"><span class="sys-label">IP</span><span class="sys-value">${data.ip||'--'}</span></div>`;
    }catch(e){c.innerHTML='Failed to load'}
}
async function loadProcesses(){
    const c=$('sysContent');c.innerHTML='Loading...';
    try{const res=await fetch(`${API}/system/processes`);const data=await res.json();
        c.innerHTML=`<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:9px;color:var(--text3)"><span style="width:50px">PID</span><span style="flex:1">NAME</span><span style="width:60px;text-align:right">MEM%</span></div>`+
            data.processes.map(p=>`<div class="process-item"><span class="pid">${p.pid}</span><span class="pname">${esc(p.name)}</span><span class="pmem">${p.mem}%</span></div>`).join('');
    }catch(e){c.innerHTML='Failed to load'}
}
async function loadNetwork(){
    const c=$('sysContent');c.innerHTML='Loading...';
    try{const res=await fetch(`${API}/system/network`);const data=await res.json();
        c.innerHTML=Object.entries(data.interfaces||{}).map(([name,ips])=>`<div class="sys-row"><span class="sys-label">${esc(name)}</span><span class="sys-value">${ips.join(', ')}</span></div>`).join('')+
            `<div style="margin-top:12px;font-size:10px;color:var(--accent);letter-spacing:1px">TRAFFIC</div>`+
            `<div class="sys-row"><span class="sys-label">Sent</span><span class="sys-value">${fmtSize(data.bytes_sent||0)}</span></div>`+
            `<div class="sys-row"><span class="sys-label">Received</span><span class="sys-value">${fmtSize(data.bytes_recv||0)}</span></div>`;
    }catch(e){c.innerHTML='Failed to load'}
}
async function loadPorts(){
    const c=$('sysContent');c.innerHTML='Loading...';
    try{const res=await fetch(`${API}/system/ports`);const data=await res.json();
        c.innerHTML=`<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:9px;color:var(--text3)"><span style="flex:1">LOCAL</span><span style="flex:1">REMOTE</span><span style="width:60px">STATUS</span></div>`+
            data.ports.map(p=>`<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--border);font-size:10px"><span style="flex:1;color:var(--accent)">${esc(p.local)}</span><span style="flex:1;color:var(--text2)">${esc(p.remote||'--')}</span><span style="width:60px;color:${p.status==='ESTABLISHED'?'var(--accent)':'var(--text3)'}">${p.status}</span></div>`).join('');
    }catch(e){c.innerHTML='Failed to load'}
}

// ============ PANELS ============
function togglePanel(id){
    const p=$(id);const was=p.classList.contains('open');
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('open'));
    if(!was){p.classList.add('open');if(id==='filePanel')openDir(currentPath||'C:\\');if(id==='sysPanel')loadSysInfo()}
}
function closePanel(id){$(id).classList.remove('open')}
function openSettings(){loadSettings();toggleModal('settingsModal')}
function toggleModal(id){$(id).classList.toggle('open')}
function closeModal(id){$(id).classList.remove('open')}

async function loadSettings(){
    try{
        const savedUrl=localStorage.getItem('serverUrl');
        if(savedUrl)$('serverUrl').value=savedUrl;
        $('groqKey').value=localStorage.getItem('groqKey')||'';
        $('openrouterKey').value=localStorage.getItem('openrouterKey')||'';
        const res=await fetch(`${API}/prompt`);
        const data=await res.json();
        $('systemPrompt').value=data.system_prompt||'';
    }catch(e){}
}
async function saveSettings(){
    const serverUrl=$('serverUrl').value.trim();
    if(serverUrl){localStorage.setItem('serverUrl',serverUrl);API=serverUrl;}
    else{localStorage.removeItem('serverUrl');API='http://localhost:5001/api';}
    const groqKey=$('groqKey').value.trim();
    const openrouterKey=$('openrouterKey').value.trim();
    if(groqKey)localStorage.setItem('groqKey',groqKey);else localStorage.removeItem('groqKey');
    if(openrouterKey)localStorage.setItem('openrouterKey',openrouterKey);else localStorage.removeItem('openrouterKey');
    await fetch(`${API}/prompt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_prompt:$('systemPrompt').value})});
    await fetch(`${API}/keys`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groq_key:groqKey,openrouter_key:openrouterKey})});
    closeModal('settingsModal');
}

// ============ CYBER BACKGROUND ============
function initCyberBg(){
    const canvas=$('gridCanvas');
    const ctx=canvas.getContext('2d');
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;

    // Grid with hexagons
    function drawGrid(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle='rgba(0,255,136,0.15)';
        ctx.lineWidth=0.5;
        // Horizontal lines
        for(let y=0;y<canvas.height;y+=40){
            ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();
        }
        // Vertical lines
        for(let x=0;x<canvas.width;x+=40){
            ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();
        }
        // Hexagons
        ctx.strokeStyle='rgba(0,255,136,0.08)';
        ctx.lineWidth=1;
        const size=30;
        for(let row=0;row<canvas.height/(size*2);row++){
            for(let col=0;col<canvas.width/(size*1.73);col++){
                const x=col*size*1.73+(row%2?size*0.865:0);
                const y=row*size*1.5;
                drawHex(ctx,x,y,size);
            }
        }
    }

    function drawHex(ctx,cx,cy,r){
        ctx.beginPath();
        for(let i=0;i<6;i++){
            const angle=Math.PI/180*(60*i-30);
            const x=cx+r*Math.cos(angle);
            const y=cy+r*Math.sin(angle);
            if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.closePath();ctx.stroke();
    }

    // Data stream effect
    const stream=$('dataStream');
    const chars='01アイウエオカキクケコサシスセソ{}[]<>/:;@#$%^&*';
    function updateStream(){
        let text='';
        for(let i=0;i<50;i++){
            let line='';
            for(let j=0;j<120;j++){
                line+=Math.random()>0.92?chars[Math.floor(Math.random()*chars.length)]:' ';
            }
            text+=line+'\n';
        }
        stream.textContent=text;
    }

    // Particle effect
    const particles=[];
    class Particle{
        constructor(){this.reset()}
        reset(){
            this.x=Math.random()*canvas.width;
            this.y=Math.random()*canvas.height;
            this.vx=(Math.random()-0.5)*0.3;
            this.vy=(Math.random()-0.5)*0.3;
            this.size=Math.random()*2+0.5;
            this.alpha=Math.random()*0.5+0.1;
        }
        update(){
            this.x+=this.vx;this.y+=this.vy;
            if(this.x<0||this.x>canvas.width||this.y<0||this.y>canvas.height)this.reset();
        }
        draw(){
            ctx.fillStyle=`rgba(0,255,136,${this.alpha})`;
            ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
        }
    }

    for(let i=0;i<50;i++)particles.push(new Particle());

    function animate(){
        drawGrid();
        particles.forEach(p=>{p.update();p.draw()});
        // Draw connections
        ctx.strokeStyle='rgba(0,255,136,0.03)';
        ctx.lineWidth=0.5;
        for(let i=0;i<particles.length;i++){
            for(let j=i+1;j<particles.length;j++){
                const dx=particles[i].x-particles[j].x;
                const dy=particles[i].y-particles[j].y;
                const dist=Math.sqrt(dx*dx+dy*dy);
                if(dist<150){
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x,particles[i].y);
                    ctx.lineTo(particles[j].x,particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }

    drawGrid();
    animate();
    updateStream();
    setInterval(updateStream,3000);
    window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;});
}

setInterval(checkStatus,30000);
