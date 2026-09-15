let currentSession='s-'+Date.now();
let isGenerating=false;
let currentPath='';
let fileHistory=[];
let fileHistIdx=-1;
let fileAllEntries=[];
let currentImage=null;
let API=localStorage.getItem('serverUrl')||'http://localhost:5001/api';

const $=id=>document.getElementById(id);

function init(){
    const messages=$('messages');
    const welcome=$('welcome');
    const msgInput=$('msgInput');
    const sendBtn=$('sendBtn');
    const providerSelect=$('providerSelect');
    const modelSelect=$('modelSelect');

    // Unregister old service workers immediately
    if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));caches.keys().then(k=>k.forEach(x=>caches.delete(x)));}

    // === EVENTS ===
    msgInput.addEventListener('input',()=>{
        msgInput.style.height='auto';
        msgInput.style.height=Math.min(msgInput.scrollHeight,100)+'px';
        sendBtn.classList.toggle('active',msgInput.value.trim().length>0);
    });
    msgInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
    sendBtn.addEventListener('click',sendMessage);
    $('newChatBtn').addEventListener('click',()=>{currentSession='s-'+Date.now();messages.innerHTML='';welcome.style.display='flex'});
    $('clearBtn').addEventListener('click',()=>{messages.innerHTML='';welcome.style.display='flex'});
    $('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
    providerSelect.addEventListener('change',()=>loadModels(providerSelect,modelSelect));
    modelSelect.addEventListener('change',()=>changeModel(providerSelect,modelSelect));
    $('termInput').addEventListener('keydown',e=>{if(e.key==='Enter')execTerminal()});
    $('binaryDrop').addEventListener('click',()=>$('binaryFile').click());
    $('binaryFile').addEventListener('change',analyzeBinary);
    $('attachBtn').addEventListener('click',()=>{
        const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
        inp.onchange=async e=>{
            const file=e.target.files[0];if(!file)return;
            const fd=new FormData();fd.append('file',file);
            try{const r=await fetch(API+'/upload',{method:'POST',body:fd});const j=await r.json();
            if(j.base64){currentImage=j.base64;$('previewImg').src='data:image/png;base64,'+j.base64;$('imagePreview').style.display='flex';}}catch(e){}
        };inp.click();
    });
    document.addEventListener('click',e=>{
        if(window.innerWidth<=768&&!$('sidebar').contains(e.target)&&!$('menuToggle').contains(e.target))
            $('sidebar').classList.remove('open');
    });

    // === CHAT ===
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
        const d=document.createElement('div');
        d.className='msg assistant';
        const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        d.innerHTML='<div class="msg-avatar">HX</div><div class="msg-body"><div class="msg-header"><span class="msg-name">HexCore</span><span class="msg-time">'+time+'</span></div><div class="msg-text"></div></div>';
        messages.appendChild(d);
        const textEl=d.querySelector('.msg-text');
        let fullText='';
        try{
            const payload={message:msg,conversation_id:currentSession,model:modelSelect.value,provider:providerSelect.value};
            if(imageToSend)payload.image=imageToSend;
            const response=await fetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
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
                            if(data.error){textEl.innerHTML='<span style="color:var(--red)">'+esc(data.error)+'</span>';}
                            else if(data.content){fullText+=data.content;textEl.innerHTML=fmtMsg(fullText);scrollBottom();}
                        }catch(e){}
                    }
                }
            }
        }catch(e){textEl.innerHTML='<span style="color:var(--red)">Connection failed. Is server running?</span>';}
        isGenerating=false;
    }

    function addMsg(role,content){
        const d=document.createElement('div');d.className='msg '+role;
        const av=role==='user'?'YOU':'HX';
        const name=role==='user'?'You':'HexCore';
        const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        d.innerHTML='<div class="msg-avatar">'+av+'</div><div class="msg-body"><div class="msg-header"><span class="msg-name">'+name+'</span><span class="msg-time">'+time+'</span></div><div class="msg-text">'+fmtMsg(content)+'</div></div>';
        messages.appendChild(d);scrollBottom();
    }

    function fmtMsg(c){
        c=c.replace(/```(\w*)\n([\s\S]*?)```/g,(_,l,code)=>'<pre><code class="lang-'+l+'">'+esc(code.trim())+'</code></pre>');
        c=c.replace(/`([^`]+)`/g,'<code>$1</code>');
        c=c.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
        c=c.replace(/\n/g,'<br>');return c;
    }
    function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
    function scrollBottom(){$('chatArea').scrollTop=$('chatArea').scrollHeight}
    function showToast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.classList.add('show'),10);setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3000)}
    function quickAction(t){msgInput.value=t;msgInput.focus();msgInput.dispatchEvent(new Event('input'))}

    // === MODELS ===
    async function loadModels(sel,mSel){
        const provider=sel.value;
        mSel.innerHTML='';
        if(provider==='ollama'){
            try{const res=await fetch(API+'/models');const data=await res.json();
                if(data.models&&data.models.length>0){
                    data.models.forEach(m=>{const o=document.createElement('option');o.value=m.name;o.textContent=m.name;mSel.appendChild(o)});
                }else{
                    const o=document.createElement('option');o.value='';o.textContent='No models found';mSel.appendChild(o);
                }
            }catch(e){
                const o=document.createElement('option');o.value='';o.textContent='Cannot connect to Ollama';mSel.appendChild(o);
            }
        }else if(provider==='groq'){
            ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'].forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;mSel.appendChild(o)});
        }else{
            ['meta-llama/llama-3.3-70b-instruct:free','mistralai/mistral-7b-instruct:free','google/gemma-2-9b-it:free'].forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;mSel.appendChild(o)});
        }
    }
    async function changeModel(sel,mSel){await fetch(API+'/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:mSel.value,provider:sel.value})})}

    // === STATUS ===
    async function checkStatus(){
        try{const res=await fetch(API+'/status');const data=await res.json();
            const online=data.ollama_running||data.groq_key||data.openrouter_key;
            $('statusDot').classList.toggle('on',online);
            let st=data.active_provider==='ollama'?(data.ollama_running?'Ollama OK':'Ollama offline'):(data.active_provider.charAt(0).toUpperCase()+data.active_provider.slice(1)+' '+(data.active_provider==='groq'?(data.groq_key?'OK':'No key'):(data.openrouter_key?'OK':'No key')));
            $('statusText').textContent=st;
            $('platformInfo').textContent=data.platform||'--';
            $('modelInfo').textContent=data.active_provider+' / '+data.active_model;
        }catch(e){$('statusText').textContent='Server offline'}
    }

    // === FILE EXPLORER ===
    function fileNavigate(path){openDir(path)}
    async function openDir(path){
        try{
            const res=await fetch(API+'/fs/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path})});
            const data=await res.json();
            if(data.error){$('statusText').textContent=data.error;return}
            if(fileHistory[fileHistIdx]!==data.path){fileHistory=fileHistory.slice(0,fileHistIdx+1);fileHistory.push(data.path);fileHistIdx=fileHistory.length-1;}
            currentPath=data.path;
            $('filePathInput').value=data.path;
            renderFileList(data.entries,data.path);
        }catch(e){}
    }
    function renderFileList(entries,basePath){
        const list=$('fileList');list.innerHTML='';fileAllEntries=entries;
        if(basePath!=='C:\\'&&basePath!=='/'&&basePath!=='\\'&&basePath.length>1){
            const up=document.createElement('div');up.className='file-entry dir';
            up.innerHTML='<span class="icon">\uD83D\uDCC1</span><span class="name">..</span><span class="size"></span><span class="date"></span>';
            up.onclick=()=>{const parent=basePath.replace(/[\\\/][^\\\/]+$/,'');openDir(parent||'/')};
            list.appendChild(up);
        }
        entries.forEach(e=>{
            const d=document.createElement('div');
            const ext=e.ext||'';
            const isImg=['.png','.jpg','.jpeg','.gif','.bmp','.svg','.webp'].includes(ext);
            const isExe=['.exe','.msi','.bat','.cmd','.ps1','.sh'].includes(ext);
            d.className='file-entry '+(e.is_dir?'dir':isExe?'exe':isImg?'img':'file');
            const icon=e.is_dir?'\uD83D\uDCC1':isExe?'\u2699\uFE0F':isImg?'\uD83D\uDDBC\uFE0F':'\uD83D\uDCC4';
            d.innerHTML='<span class="icon">'+icon+'</span><span class="name">'+esc(e.name)+'</span><span class="size">'+(e.is_dir?'':fmtSize(e.size))+'</span><span class="date">'+(e.modified?new Date(e.modified).toLocaleDateString():'')+'</span>';
            if(e.is_dir){d.onclick=()=>openDir(e.path);}
            else{d.onclick=()=>{msgInput.value='Analyze file: '+e.path;msgInput.focus();msgInput.dispatchEvent(new Event('input'));closePanel('filePanel')};}
            list.appendChild(d);
        });
    }
    function fileGoBack(){if(fileHistIdx>0){fileHistIdx--;openDir(fileHistory[fileHistIdx])}}
    function fileGoForward(){if(fileHistIdx<fileHistory.length-1){fileHistIdx++;openDir(fileHistory[fileHistIdx])}}
    function fileGoUp(){if(currentPath!=='C:\\'&&currentPath!=='/'&&currentPath.length>1){const parent=currentPath.replace(/[\\\/][^\\\/]+$/,'');openDir(parent||'/')}}
    function fileRefresh(){openDir(currentPath)}
    function fileCreateFolder(){const name=prompt('Folder name:');if(name)fetch(API+'/fs/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:currentPath+'/'+name})}).then(()=>fileRefresh())}
    function filterFiles(q){const filtered=q?fileAllEntries.filter(e=>e.name.toLowerCase().includes(q.toLowerCase())):fileAllEntries;renderFileList(filtered,currentPath);}
    function fmtSize(b){if(!b)return'';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB'}

    // === TERMINAL ===
    async function execTerminal(){
        const input=$('termInput');const cmd=input.value.trim();if(!cmd)return;input.value='';
        const out=$('termOutput');
        out.innerHTML+='<div class="cmd">$ '+esc(cmd)+'</div>';
        try{const res=await fetch(API+'/terminal/exec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd,cwd:currentPath||'/'})});const data=await res.json();
            if(data.stdout)out.innerHTML+='<div class="stdout">'+esc(data.stdout)+'</div>';
            if(data.stderr)out.innerHTML+='<div class="stderr">'+esc(data.stderr)+'</div>';
            if(data.error)out.innerHTML+='<div class="stderr">'+esc(data.error)+'</div>';
        }catch(e){out.innerHTML+='<div class="stderr">Connection error</div>';}
        out.scrollTop=out.scrollHeight;
    }

    // === BINARY ===
    async function analyzeBinary(e){
        const file=e.target.files[0];if(!file)return;
        const formData=new FormData();formData.append('file',file);
        const results=$('binaryResults');results.innerHTML='<div style="color:var(--text3)">Uploading...</div>';
        try{const upRes=await fetch(API+'/fs/upload',{method:'POST',body:formData});const upData=await upRes.json();
            if(upData.error){results.innerHTML='<div class="error-msg">'+esc(upData.error)+'</div>';return}
            results.innerHTML='<div style="color:var(--text3)">Analyzing...</div>';
            const res=await fetch(API+'/fs/binary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:upData.path})});const data=await res.json();
            if(data.error){results.innerHTML='<div class="error-msg">'+esc(data.error)+'</div>';return}
            results.innerHTML='<div class="info-row"><span class="info-label">Type</span><span class="info-value">'+data.file_type+'</span></div><div class="info-row"><span class="info-label">Size</span><span class="info-value">'+fmtSize(data.size)+'</span></div><div class="info-row"><span class="info-label">SHA256</span><span class="info-value">'+data.sha256+'</span></div><div class="info-row"><span class="info-label">Entropy</span><span class="info-value">'+data.entropy+'</span></div>';
        }catch(err){results.innerHTML='<div class="error-msg">Failed</div>';}
    }

    // === TOOLS ===
    async function generateHash(){
        const text=$('hashInput').value;if(!text)return;
        try{const res=await fetch(API+'/tools/hash',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})});const data=await res.json();
            $('hashResults').innerHTML=Object.entries(data).map(([k,v])=>'<div class="hash-row"><span class="hash-label">'+k.toUpperCase()+'</span><span class="hash-value">'+v+'</span></div>').join('');
        }catch(e){}
    }
    async function doEncode(type){
        const text=$('encodeInput').value;if(!text)return;
        try{const res=await fetch(API+'/tools/encode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,encoding:type})});const data=await res.json();
            $('encodeResults').innerHTML=data.error?'<div class="error-msg">'+esc(data.error)+'</div>':'<div class="hash-row"><span class="hash-value" style="word-break:break-all">'+esc(data.result)+'</span></div>';
        }catch(e){}
    }

    // === PANELS ===
    function togglePanel(id){const p=$(id);const was=p.classList.contains('open');document.querySelectorAll('.panel').forEach(x=>x.classList.remove('open'));if(!was)p.classList.add('open');}
    function closePanel(id){$(id).classList.remove('open')}
    function openSettings(){loadSettings();$('settingsModal').classList.add('open')}
    function closeModal(id){$(id).classList.remove('open')}

    async function loadSettings(){
        try{
            const savedUrl=localStorage.getItem('serverUrl');
            if(savedUrl)$('serverUrl').value=savedUrl;
            $('groqKey').value=localStorage.getItem('groqKey')||'';
            $('openrouterKey').value=localStorage.getItem('openrouterKey')||'';
            try{const res=await fetch(API+'/prompt');const data=await res.json();$('systemPrompt').value=data.system_prompt||'';}catch(e){}
        }catch(e){}
    }
    async function saveSettings(){
        const serverUrl=$('serverUrl').value.trim();
        if(serverUrl){localStorage.setItem('serverUrl',serverUrl);API=serverUrl;}
        else{localStorage.removeItem('serverUrl');API='http://localhost:5001/api';}
        localStorage.setItem('groqKey',$('groqKey').value.trim());
        localStorage.setItem('openrouterKey',$('openrouterKey').value.trim());
        $('settingsModal').classList.remove('open');
        showToast('Settings saved!');
        try{
            await fetch(API+'/prompt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_prompt:$('systemPrompt').value})});
            await fetch(API+'/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groq_key:$('groqKey').value.trim(),openrouter_key:$('openrouterKey').value.trim())});
            checkStatus();loadModels(providerSelect,modelSelect);
        }catch(e){showToast('Cannot reach server');}
    }

    // === SYSTEM ===
    async function loadSysInfo(){
        const c=$('sysContent');c.innerHTML='Loading...';
        try{const res=await fetch(API+'/system/info');const data=await res.json();
            c.innerHTML='<div class="sys-row"><span class="sys-label">OS</span><span class="sys-value">'+data.os+'</span></div><div class="sys-row"><span class="sys-label">CPU</span><span class="sys-value">'+(data.cpu_cores||'?')+' cores</span></div><div class="sys-row"><span class="sys-label">RAM</span><span class="sys-value">'+fmtSize(data.ram_used||0)+' / '+fmtSize(data.ram_total||0)+'</span></div><div class="sys-row"><span class="sys-label">IP</span><span class="sys-value">'+(data.ip||'--')+'</span></div>';
        }catch(e){c.innerHTML='Failed';}
    }
    async function loadProcesses(){
        const c=$('sysContent');c.innerHTML='Loading...';
        try{const res=await fetch(API+'/system/processes');const data=await res.json();
            c.innerHTML=data.processes.map(p=>'<div class="process-item"><span class="pid">'+p.pid+'</span><span class="pname">'+esc(p.name)+'</span><span class="pmem">'+p.mem+'%</span></div>').join('');
        }catch(e){c.innerHTML='Failed';}
    }
    async function loadNetwork(){
        const c=$('sysContent');c.innerHTML='Loading...';
        try{const res=await fetch(API+'/system/network');const data=await res.json();
            c.innerHTML=Object.entries(data.interfaces||{}).map(([n,ips])=>'<div class="sys-row"><span class="sys-label">'+esc(n)+'</span><span class="sys-value">'+ips.join(', ')+'</span></div>').join('');
        }catch(e){c.innerHTML='Failed';}
    }
    async function loadPorts(){
        const c=$('sysContent');c.innerHTML='Loading...';
        try{const res=await fetch(API+'/system/ports');const data=await res.json();
            c.innerHTML=data.ports.map(p=>'<div style="font-size:10px;padding:2px 0;border-bottom:1px solid var(--border)"><span style="color:var(--accent)">'+esc(p.local)+'</span> → <span style="color:var(--text2)">'+esc(p.remote||'--')+'</span> <span style="color:var(--text3)">'+p.status+'</span></div>').join('');
        }catch(e){c.innerHTML='Failed';}
    }

    // === CYBER BG ===
    function initCyberBg(){
        const canvas=$('gridCanvas');if(!canvas)return;
        const ctx=canvas.getContext('2d');
        canvas.width=window.innerWidth;canvas.height=window.innerHeight;
        function drawGrid(){
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.strokeStyle='rgba(255,34,68,0.12)';ctx.lineWidth=0.5;
            for(let y=0;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
            for(let x=0;x<canvas.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
        }
        drawGrid();
        window.addEventListener('resize',()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;drawGrid();});
    }

    // === INIT ===
    initCyberBg();
    checkStatus();
    loadModels(providerSelect,modelSelect);
    const startPath='/';
    fileNavigate(startPath);

    window.togglePanel=togglePanel;
    window.closePanel=closePanel;
    window.openSettings=openSettings;
    window.closeModal=closeModal;
    window.fileGoBack=fileGoBack;
    window.fileGoForward=fileGoForward;
    window.fileGoUp=fileGoUp;
    window.fileRefresh=fileRefresh;
    window.fileCreateFolder=fileCreateFolder;
    window.fileNavigate=fileNavigate;
    window.filterFiles=filterFiles;
    window.generateHash=generateHash;
    window.doEncode=doEncode;
    window.loadSysInfo=loadSysInfo;
    window.loadProcesses=loadProcesses;
    window.loadNetwork=loadNetwork;
    window.loadPorts=loadPorts;
    window.quickAction=quickAction;
    window.removeImage=removeImage;
    window.saveSettings=saveSettings;
}

document.addEventListener('DOMContentLoaded',init);
