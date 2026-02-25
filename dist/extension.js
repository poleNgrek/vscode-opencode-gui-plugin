"use strict";var Ee=Object.create;var $=Object.defineProperty;var $e=Object.getOwnPropertyDescriptor;var Ie=Object.getOwnPropertyNames;var De=Object.getPrototypeOf,Fe=Object.prototype.hasOwnProperty;var Ue=(r,e)=>{for(var t in e)$(r,t,{get:e[t],enumerable:!0})},be=(r,e,t,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of Ie(e))!Fe.call(r,i)&&i!==t&&$(r,i,{get:()=>e[i],enumerable:!(s=$e(e,i))||s.enumerable});return r};var P=(r,e,t)=>(t=r!=null?Ee(De(r)):{},be(e||!r||!r.__esModule?$(t,"default",{value:r,enumerable:!0}):t,r)),Me=r=>be($({},"__esModule",{value:!0}),r);var Ye={};Ue(Ye,{activate:()=>Ge,deactivate:()=>Qe});module.exports=Me(Ye);var w=P(require("vscode"));var S=P(require("vscode"));var je=P(require("child_process")),Pe=P(require("net")),N=P(require("vscode"));var xe=({onSseError:r,onSseEvent:e,responseTransformer:t,responseValidator:s,sseDefaultRetryDelay:i,sseMaxRetryAttempts:o,sseMaxRetryDelay:c,sseSleepFn:n,url:l,...a})=>{let h,p=n??(u=>new Promise(x=>setTimeout(x,u)));return{stream:async function*(){let u=i??3e3,x=0,k=a.signal??new AbortController().signal;for(;!k.aborted;){x++;let j=a.headers instanceof Headers?a.headers:new Headers(a.headers);h!==void 0&&j.set("Last-Event-ID",h);try{let y=await fetch(l,{...a,headers:j,signal:k});if(!y.ok)throw new Error(`SSE failed: ${y.status} ${y.statusText}`);if(!y.body)throw new Error("No body in SSE response");let g=y.body.pipeThrough(new TextDecoderStream).getReader(),f="",v=()=>{try{g.cancel()}catch{}};k.addEventListener("abort",v);try{for(;;){let{done:ze,value:Oe}=await g.read();if(ze)break;f+=Oe;let he=f.split(`

`);f=he.pop()??"";for(let Te of he){let Ae=Te.split(`
`),E=[],fe;for(let b of Ae)if(b.startsWith("data:"))E.push(b.replace(/^data:\s*/,""));else if(b.startsWith("event:"))fe=b.replace(/^event:\s*/,"");else if(b.startsWith("id:"))h=b.replace(/^id:\s*/,"");else if(b.startsWith("retry:")){let ge=Number.parseInt(b.replace(/^retry:\s*/,""),10);Number.isNaN(ge)||(u=ge)}let _,me=!1;if(E.length){let b=E.join(`
`);try{_=JSON.parse(b),me=!0}catch{_=b}}me&&(s&&await s(_),t&&(_=await t(_))),e?.({data:_,event:fe,id:h,retry:u}),E.length&&(yield _)}}}finally{k.removeEventListener("abort",v),g.releaseLock()}break}catch(y){if(r?.(y),o!==void 0&&x>=o)break;let g=Math.min(u*2**(x-1),c??3e4);await p(g)}}}()}};var ye=async(r,e)=>{let t=typeof e=="function"?await e(r):e;if(t)return r.scheme==="bearer"?`Bearer ${t}`:r.scheme==="basic"?`Basic ${btoa(t)}`:t};var B={bodySerializer:r=>JSON.stringify(r,(e,t)=>typeof t=="bigint"?t.toString():t)};var Ne=r=>{switch(r){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},We=r=>{switch(r){case"form":return",";case"pipeDelimited":return"|";case"spaceDelimited":return"%20";default:return","}},qe=r=>{switch(r){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},I=({allowReserved:r,explode:e,name:t,style:s,value:i})=>{if(!e){let n=(r?i:i.map(l=>encodeURIComponent(l))).join(We(s));switch(s){case"label":return`.${n}`;case"matrix":return`;${t}=${n}`;case"simple":return n;default:return`${t}=${n}`}}let o=Ne(s),c=i.map(n=>s==="label"||s==="simple"?r?n:encodeURIComponent(n):C({allowReserved:r,name:t,value:n})).join(o);return s==="label"||s==="matrix"?o+c:c},C=({allowReserved:r,name:e,value:t})=>{if(t==null)return"";if(typeof t=="object")throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");return`${e}=${r?t:encodeURIComponent(t)}`},D=({allowReserved:r,explode:e,name:t,style:s,value:i,valueOnly:o})=>{if(i instanceof Date)return o?i.toISOString():`${t}=${i.toISOString()}`;if(s!=="deepObject"&&!e){let l=[];Object.entries(i).forEach(([h,p])=>{l=[...l,h,r?p:encodeURIComponent(p)]});let a=l.join(",");switch(s){case"form":return`${t}=${a}`;case"label":return`.${a}`;case"matrix":return`;${t}=${a}`;default:return a}}let c=qe(s),n=Object.entries(i).map(([l,a])=>C({allowReserved:r,name:s==="deepObject"?`${t}[${l}]`:l,value:a})).join(c);return s==="label"||s==="matrix"?c+n:n};var Be=/\{[^{}]+\}/g,He=({path:r,url:e})=>{let t=e,s=e.match(Be);if(s)for(let i of s){let o=!1,c=i.substring(1,i.length-1),n="simple";c.endsWith("*")&&(o=!0,c=c.substring(0,c.length-1)),c.startsWith(".")?(c=c.substring(1),n="label"):c.startsWith(";")&&(c=c.substring(1),n="matrix");let l=r[c];if(l==null)continue;if(Array.isArray(l)){t=t.replace(i,I({explode:o,name:c,style:n,value:l}));continue}if(typeof l=="object"){t=t.replace(i,D({explode:o,name:c,style:n,value:l,valueOnly:!0}));continue}if(n==="matrix"){t=t.replace(i,`;${C({name:c,value:l})}`);continue}let a=encodeURIComponent(n==="label"?`.${l}`:l);t=t.replace(i,a)}return t},ve=({baseUrl:r,path:e,query:t,querySerializer:s,url:i})=>{let o=i.startsWith("/")?i:`/${i}`,c=(r??"")+o;e&&(c=He({path:e,url:c}));let n=t?s(t):"";return n.startsWith("?")&&(n=n.substring(1)),n&&(c+=`?${n}`),c};var we=({allowReserved:r,array:e,object:t}={})=>i=>{let o=[];if(i&&typeof i=="object")for(let c in i){let n=i[c];if(n!=null)if(Array.isArray(n)){let l=I({allowReserved:r,explode:!0,name:c,style:"form",value:n,...e});l&&o.push(l)}else if(typeof n=="object"){let l=D({allowReserved:r,explode:!0,name:c,style:"deepObject",value:n,...t});l&&o.push(l)}else{let l=C({allowReserved:r,name:c,value:n});l&&o.push(l)}}return o.join("&")},Se=r=>{if(!r)return"stream";let e=r.split(";")[0]?.trim();if(e){if(e.startsWith("application/json")||e.endsWith("+json"))return"json";if(e==="multipart/form-data")return"formData";if(["application/","audio/","image/","video/"].some(t=>e.startsWith(t)))return"blob";if(e.startsWith("text/"))return"text"}},Re=(r,e)=>e?!!(r.headers.has(e)||r.query?.[e]||r.headers.get("Cookie")?.includes(`${e}=`)):!1,ke=async({security:r,...e})=>{for(let t of r){if(Re(e,t.name))continue;let s=await ye(t,e.auth);if(!s)continue;let i=t.name??"Authorization";switch(t.in){case"query":e.query||(e.query={}),e.query[i]=s;break;case"cookie":e.headers.append("Cookie",`${i}=${s}`);break;case"header":default:e.headers.set(i,s);break}}},H=r=>ve({baseUrl:r.baseUrl,path:r.path,query:r.query,querySerializer:typeof r.querySerializer=="function"?r.querySerializer:we(r.querySerializer),url:r.url}),R=(r,e)=>{let t={...r,...e};return t.baseUrl?.endsWith("/")&&(t.baseUrl=t.baseUrl.substring(0,t.baseUrl.length-1)),t.headers=F(r.headers,e.headers),t},F=(...r)=>{let e=new Headers;for(let t of r){if(!t||typeof t!="object")continue;let s=t instanceof Headers?t.entries():Object.entries(t);for(let[i,o]of s)if(o===null)e.delete(i);else if(Array.isArray(o))for(let c of o)e.append(i,c);else o!==void 0&&e.set(i,typeof o=="object"?JSON.stringify(o):o)}return e},z=class{_fns;constructor(){this._fns=[]}clear(){this._fns=[]}getInterceptorIndex(e){return typeof e=="number"?this._fns[e]?e:-1:this._fns.indexOf(e)}exists(e){let t=this.getInterceptorIndex(e);return!!this._fns[t]}eject(e){let t=this.getInterceptorIndex(e);this._fns[t]&&(this._fns[t]=null)}update(e,t){let s=this.getInterceptorIndex(e);return this._fns[s]?(this._fns[s]=t,e):!1}use(e){return this._fns=[...this._fns,e],this._fns.length-1}},_e=()=>({error:new z,request:new z,response:new z}),Le=we({allowReserved:!1,array:{explode:!0,style:"form"},object:{explode:!0,style:"deepObject"}}),Ve={"Content-Type":"application/json"},O=(r={})=>({...B,headers:Ve,parseAs:"auto",querySerializer:Le,...r});var T=(r={})=>{let e=R(O(),r),t=()=>({...e}),s=l=>(e=R(e,l),t()),i=_e(),o=async l=>{let a={...e,...l,fetch:l.fetch??e.fetch??globalThis.fetch,headers:F(e.headers,l.headers),serializedBody:void 0};a.security&&await ke({...a,security:a.security}),a.requestValidator&&await a.requestValidator(a),a.body&&a.bodySerializer&&(a.serializedBody=a.bodySerializer(a.body)),(a.serializedBody===void 0||a.serializedBody==="")&&a.headers.delete("Content-Type");let h=H(a);return{opts:a,url:h}},c=async l=>{let{opts:a,url:h}=await o(l),p={redirect:"follow",...a,body:a.serializedBody},m=new Request(h,p);for(let f of i.request._fns)f&&(m=await f(m,a));let A=a.fetch,u=await A(m);for(let f of i.response._fns)f&&(u=await f(u,m,a));let x={request:m,response:u};if(u.ok){if(u.status===204||u.headers.get("Content-Length")==="0")return a.responseStyle==="data"?{}:{data:{},...x};let f=(a.parseAs==="auto"?Se(u.headers.get("Content-Type")):a.parseAs)??"json",v;switch(f){case"arrayBuffer":case"blob":case"formData":case"json":case"text":v=await u[f]();break;case"stream":return a.responseStyle==="data"?u.body:{data:u.body,...x}}return f==="json"&&(a.responseValidator&&await a.responseValidator(v),a.responseTransformer&&(v=await a.responseTransformer(v))),a.responseStyle==="data"?v:{data:v,...x}}let k=await u.text(),j;try{j=JSON.parse(k)}catch{}let y=j??k,g=y;for(let f of i.error._fns)f&&(g=await f(y,u,m,a));if(g=g||{},a.throwOnError)throw g;return a.responseStyle==="data"?void 0:{error:g,...x}},n=l=>{let a=h=>c({...h,method:l});return a.sse=async h=>{let{opts:p,url:m}=await o(h);return xe({...p,body:p.body,headers:p.headers,method:l,url:m})},a};return{buildUrl:H,connect:n("CONNECT"),delete:n("DELETE"),get:n("GET"),getConfig:t,head:n("HEAD"),interceptors:i,options:n("OPTIONS"),patch:n("PATCH"),post:n("POST"),put:n("PUT"),request:c,setConfig:s,trace:n("TRACE")}};var Je={$body_:"body",$headers_:"headers",$path_:"path",$query_:"query"},ht=Object.entries(Je);var Ce=T(O({baseUrl:"http://localhost:4096"}));var d=class{_client=Ce;constructor(e){e?.client&&(this._client=e.client)}},L=class extends d{event(e){return(e?.client??this._client).get.sse({url:"/global/event",...e})}},V=class extends d{list(e){return(e?.client??this._client).get({url:"/project",...e})}current(e){return(e?.client??this._client).get({url:"/project/current",...e})}},J=class extends d{list(e){return(e?.client??this._client).get({url:"/pty",...e})}create(e){return(e?.client??this._client).post({url:"/pty",...e,headers:{"Content-Type":"application/json",...e?.headers}})}remove(e){return(e.client??this._client).delete({url:"/pty/{id}",...e})}get(e){return(e.client??this._client).get({url:"/pty/{id}",...e})}update(e){return(e.client??this._client).put({url:"/pty/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}connect(e){return(e.client??this._client).get({url:"/pty/{id}/connect",...e})}},K=class extends d{get(e){return(e?.client??this._client).get({url:"/config",...e})}update(e){return(e?.client??this._client).patch({url:"/config",...e,headers:{"Content-Type":"application/json",...e?.headers}})}providers(e){return(e?.client??this._client).get({url:"/config/providers",...e})}},G=class extends d{ids(e){return(e?.client??this._client).get({url:"/experimental/tool/ids",...e})}list(e){return(e.client??this._client).get({url:"/experimental/tool",...e})}},Q=class extends d{dispose(e){return(e?.client??this._client).post({url:"/instance/dispose",...e})}},Y=class extends d{get(e){return(e?.client??this._client).get({url:"/path",...e})}},X=class extends d{get(e){return(e?.client??this._client).get({url:"/vcs",...e})}},Z=class extends d{list(e){return(e?.client??this._client).get({url:"/session",...e})}create(e){return(e?.client??this._client).post({url:"/session",...e,headers:{"Content-Type":"application/json",...e?.headers}})}status(e){return(e?.client??this._client).get({url:"/session/status",...e})}delete(e){return(e.client??this._client).delete({url:"/session/{id}",...e})}get(e){return(e.client??this._client).get({url:"/session/{id}",...e})}update(e){return(e.client??this._client).patch({url:"/session/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}children(e){return(e.client??this._client).get({url:"/session/{id}/children",...e})}todo(e){return(e.client??this._client).get({url:"/session/{id}/todo",...e})}init(e){return(e.client??this._client).post({url:"/session/{id}/init",...e,headers:{"Content-Type":"application/json",...e.headers}})}fork(e){return(e.client??this._client).post({url:"/session/{id}/fork",...e,headers:{"Content-Type":"application/json",...e.headers}})}abort(e){return(e.client??this._client).post({url:"/session/{id}/abort",...e})}unshare(e){return(e.client??this._client).delete({url:"/session/{id}/share",...e})}share(e){return(e.client??this._client).post({url:"/session/{id}/share",...e})}diff(e){return(e.client??this._client).get({url:"/session/{id}/diff",...e})}summarize(e){return(e.client??this._client).post({url:"/session/{id}/summarize",...e,headers:{"Content-Type":"application/json",...e.headers}})}messages(e){return(e.client??this._client).get({url:"/session/{id}/message",...e})}prompt(e){return(e.client??this._client).post({url:"/session/{id}/message",...e,headers:{"Content-Type":"application/json",...e.headers}})}message(e){return(e.client??this._client).get({url:"/session/{id}/message/{messageID}",...e})}promptAsync(e){return(e.client??this._client).post({url:"/session/{id}/prompt_async",...e,headers:{"Content-Type":"application/json",...e.headers}})}command(e){return(e.client??this._client).post({url:"/session/{id}/command",...e,headers:{"Content-Type":"application/json",...e.headers}})}shell(e){return(e.client??this._client).post({url:"/session/{id}/shell",...e,headers:{"Content-Type":"application/json",...e.headers}})}revert(e){return(e.client??this._client).post({url:"/session/{id}/revert",...e,headers:{"Content-Type":"application/json",...e.headers}})}unrevert(e){return(e.client??this._client).post({url:"/session/{id}/unrevert",...e})}},ee=class extends d{list(e){return(e?.client??this._client).get({url:"/command",...e})}},te=class extends d{authorize(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/authorize",...e,headers:{"Content-Type":"application/json",...e.headers}})}callback(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}},re=class extends d{list(e){return(e?.client??this._client).get({url:"/provider",...e})}auth(e){return(e?.client??this._client).get({url:"/provider/auth",...e})}oauth=new te({client:this._client})},se=class extends d{text(e){return(e.client??this._client).get({url:"/find",...e})}files(e){return(e.client??this._client).get({url:"/find/file",...e})}symbols(e){return(e.client??this._client).get({url:"/find/symbol",...e})}},ie=class extends d{list(e){return(e.client??this._client).get({url:"/file",...e})}read(e){return(e.client??this._client).get({url:"/file/content",...e})}status(e){return(e?.client??this._client).get({url:"/file/status",...e})}},ne=class extends d{log(e){return(e?.client??this._client).post({url:"/log",...e,headers:{"Content-Type":"application/json",...e?.headers}})}agents(e){return(e?.client??this._client).get({url:"/agent",...e})}},U=class extends d{remove(e){return(e.client??this._client).delete({url:"/mcp/{name}/auth",...e})}start(e){return(e.client??this._client).post({url:"/mcp/{name}/auth",...e})}callback(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}authenticate(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/authenticate",...e})}set(e){return(e.client??this._client).put({url:"/auth/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}},ae=class extends d{status(e){return(e?.client??this._client).get({url:"/mcp",...e})}add(e){return(e?.client??this._client).post({url:"/mcp",...e,headers:{"Content-Type":"application/json",...e?.headers}})}connect(e){return(e.client??this._client).post({url:"/mcp/{name}/connect",...e})}disconnect(e){return(e.client??this._client).post({url:"/mcp/{name}/disconnect",...e})}auth=new U({client:this._client})},oe=class extends d{status(e){return(e?.client??this._client).get({url:"/lsp",...e})}},ce=class extends d{status(e){return(e?.client??this._client).get({url:"/formatter",...e})}},le=class extends d{next(e){return(e?.client??this._client).get({url:"/tui/control/next",...e})}response(e){return(e?.client??this._client).post({url:"/tui/control/response",...e,headers:{"Content-Type":"application/json",...e?.headers}})}},de=class extends d{appendPrompt(e){return(e?.client??this._client).post({url:"/tui/append-prompt",...e,headers:{"Content-Type":"application/json",...e?.headers}})}openHelp(e){return(e?.client??this._client).post({url:"/tui/open-help",...e})}openSessions(e){return(e?.client??this._client).post({url:"/tui/open-sessions",...e})}openThemes(e){return(e?.client??this._client).post({url:"/tui/open-themes",...e})}openModels(e){return(e?.client??this._client).post({url:"/tui/open-models",...e})}submitPrompt(e){return(e?.client??this._client).post({url:"/tui/submit-prompt",...e})}clearPrompt(e){return(e?.client??this._client).post({url:"/tui/clear-prompt",...e})}executeCommand(e){return(e?.client??this._client).post({url:"/tui/execute-command",...e,headers:{"Content-Type":"application/json",...e?.headers}})}showToast(e){return(e?.client??this._client).post({url:"/tui/show-toast",...e,headers:{"Content-Type":"application/json",...e?.headers}})}publish(e){return(e?.client??this._client).post({url:"/tui/publish",...e,headers:{"Content-Type":"application/json",...e?.headers}})}control=new le({client:this._client})},pe=class extends d{subscribe(e){return(e?.client??this._client).get.sse({url:"/event",...e})}},M=class extends d{postSessionIdPermissionsPermissionId(e){return(e.client??this._client).post({url:"/session/{id}/permissions/{permissionID}",...e,headers:{"Content-Type":"application/json",...e.headers}})}global=new L({client:this._client});project=new V({client:this._client});pty=new J({client:this._client});config=new K({client:this._client});tool=new G({client:this._client});instance=new Q({client:this._client});path=new Y({client:this._client});vcs=new X({client:this._client});session=new Z({client:this._client});command=new ee({client:this._client});provider=new re({client:this._client});find=new se({client:this._client});file=new ie({client:this._client});app=new ne({client:this._client});mcp=new ae({client:this._client});lsp=new oe({client:this._client});formatter=new ce({client:this._client});tui=new de({client:this._client});auth=new U({client:this._client});event=new pe({client:this._client})};function ue(r){r?.fetch||(r={...r,fetch:s=>(s.timeout=!1,fetch(s))}),r?.directory&&(r.headers={...r.headers,"x-opencode-directory":encodeURIComponent(r.directory)});let e=T(r);return new M({client:e})}var W=class{constructor(){this.serverProcess=null;this.sdkClient=null;this.promptAbort=null}async getClient(){if(this.sdkClient)return this.sdkClient;let e=N.workspace.getConfiguration("opencode"),t=e.get("serverUrl")||"",s=e.get("port")||4096,i=e.get("probePorts")||[],o=e.get("cliPath")||"opencode",c=[];if(t)c.push(t.replace(/\/$/,""));else{c.push(`http://127.0.0.1:${s}`);for(let n of i)c.push(`http://127.0.0.1:${n}`)}for(let n of c)if(await this.isReachable(n))return this.sdkClient=this.makeClient(n),this.sdkClient;return await this.spawnServer(o,s),this.sdkClient=this.makeClient(`http://127.0.0.1:${s}`),this.sdkClient}makeClient(e){return ue({baseUrl:e})}isReachable(e){return new Promise(t=>{try{let s=new URL(e),i=parseInt(s.port||"80",10),o=Pe.createConnection({host:s.hostname,port:i},()=>{o.destroy(),t(!0)});o.setTimeout(1200),o.on("timeout",()=>{o.destroy(),t(!1)}),o.on("error",()=>t(!1))}catch{t(!1)}})}spawnServer(e,t){return new Promise((s,i)=>{let o=N.workspace.workspaceFolders?.[0]?.uri.fsPath||process.cwd();this.serverProcess=je.spawn(e,["serve","--port",String(t)],{cwd:o,shell:!1,detached:!1}),this.serverProcess.on("error",l=>{i(new Error(`Failed to start opencode server: ${l.message}. Make sure opencode is installed or configure opencode.cliPath.`))});let c=0,n=setInterval(async()=>{c++,await this.isReachable(`http://127.0.0.1:${t}`)?(clearInterval(n),s()):c>40&&(clearInterval(n),i(new Error(`opencode server did not start after 20s on port ${t}.`)))},500)})}async createSession(){let t=await(await this.getClient()).session.create({body:{}}),s=t?.data?.id??t?.id;if(!s)throw new Error("opencode server did not return a session ID.");return s}async send(e,t,s,i,o,c){this.abort();let n=new AbortController;this.promptAbort=n;let l;try{l=await this.getClient()}catch(p){c(String(p)),o();return}let a=[];if(s.length>0){let p=require("fs");for(let m of s)try{let A=p.readFileSync(m,"utf8"),u=N.workspace.asRelativePath(m);a.push({type:"text",text:`<file path="${u}">
${A}
</file>`})}catch{}}a.push({type:"text",text:t});let h=null;try{h=(await l.event.subscribe({signal:n.signal})).stream}catch{}h&&(async()=>{try{for await(let p of h){if(n.signal.aborted)break;p?.sessionID===e&&p?.type==="text"&&p?.part?.type==="text"&&typeof p?.part?.text=="string"&&i(p.part.text)}}catch{}})();try{await l.session.prompt({path:{id:e},body:{parts:a}})}catch(p){n.signal.aborted||c(String(p))}n.abort(),this.promptAbort=null,o()}abort(){this.promptAbort&&(this.promptAbort.abort(),this.promptAbort=null)}async abortSession(e){this.abort();try{await(await this.getClient()).session.abort({path:{id:e}})}catch{}}dispose(){this.abort(),this.serverProcess&&(this.serverProcess.kill(),this.serverProcess=null),this.sdkClient=null}};var q=class{constructor(e){this.context=e;this.remoteSessionId=null;this.isStreaming=!1;this.client=new W,this.session=this.makeLocalSession()}makeLocalSession(){return{id:Date.now().toString(),messages:[],contextFiles:[]}}resolveWebviewView(e){this.view=e,e.webview.options={enableScripts:!0,localResourceRoots:[this.context.extensionUri]},e.webview.html=this.getHtml(e.webview),e.webview.onDidReceiveMessage(t=>{switch(t.type){case"ready":this.syncState();break;case"send":this.handleSend(t.text);break;case"newSession":this.newSession();break;case"abort":this.remoteSessionId?this.client.abortSession(this.remoteSessionId).catch(()=>{}):this.client.abort(),this.isStreaming=!1,this.post({type:"streamEnd"});break;case"removeFile":this.removeFileContext(t.filePath);break;case"pickFiles":this.pickFiles();break}})}post(e){this.view?.webview.postMessage(e)}syncState(){this.post({type:"restore",session:this.session,isStreaming:this.isStreaming})}newSession(){this.client.abort(),this.isStreaming=!1,this.remoteSessionId=null,this.session=this.makeLocalSession(),this.post({type:"newSession"})}addFileContext(e){this.session.contextFiles.includes(e)||(this.session.contextFiles.push(e),this.post({type:"updateFiles",files:this.session.contextFiles})),S.commands.executeCommand("opencode.chatView.focus")}removeFileContext(e){this.session.contextFiles=this.session.contextFiles.filter(t=>t!==e),this.post({type:"updateFiles",files:this.session.contextFiles})}async pickFiles(){let e=await S.window.showOpenDialog({canSelectMany:!0,openLabel:"Add to context",filters:{"All files":["*"]},defaultUri:S.workspace.workspaceFolders?.[0]?.uri});if(e)for(let t of e)this.addFileContext(t.fsPath)}async handleSend(e){if(this.isStreaming||!e.trim())return;let t={id:Date.now().toString(),role:"user",content:e,timestamp:Date.now()};this.session.messages.push(t),this.post({type:"userMessage",message:t}),this.isStreaming=!0;let s=(Date.now()+1).toString();this.post({type:"streamStart",id:s});try{this.remoteSessionId||(this.post({type:"status",text:"Connecting to opencode server\u2026"}),this.remoteSessionId=await this.client.createSession(),this.post({type:"status",text:""}));let i="";await this.client.send(this.remoteSessionId,e,this.session.contextFiles,o=>{i+=o,this.post({type:"streamChunk",id:s,chunk:o})},()=>{this.isStreaming=!1;let o={id:s,role:"assistant",content:i,timestamp:Date.now()};this.session.messages.push(o),this.post({type:"streamEnd",id:s})},o=>{this.isStreaming=!1,this.post({type:"error",message:o}),this.post({type:"streamEnd",id:s})})}catch(i){this.isStreaming=!1,this.post({type:"error",message:String(i)}),this.post({type:"streamEnd",id:s})}}dispose(){this.client.dispose()}getHtml(e){let t=e.asWebviewUri(S.Uri.joinPath(this.context.extensionUri,"media","main.js")),s=Ke();return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${s}';
             style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenCode</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        var(--vscode-sideBar-background, #0f0f10);
      --surface:   var(--vscode-editor-background, #151517);
      --border:    var(--vscode-panel-border, #2a2a2d);
      --accent:    #3b82f6;
      --accent-hi: #60a5fa;
      --fg:        var(--vscode-foreground, #e2e2e5);
      --fg-muted:  var(--vscode-descriptionForeground, #888893);
      --user-bg:   #1e2433;
      --ai-bg:     var(--surface);
      --input-bg:  var(--vscode-input-background, #1a1a1d);
      --radius:    10px;
      --font-mono: var(--vscode-editor-font-family, 'JetBrains Mono', 'Fira Code', monospace);
    }

    html, body { height: 100%; background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family, system-ui); font-size: 13px; line-height: 1.6; }

    #app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    /* Header */
    #header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px; border-bottom: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0;
    }
    #header-left { display: flex; align-items: center; gap: 8px; }
    #header-title { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-hi); }
    #status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #22c55e; flex-shrink: 0; display: none;
    }
    #status-dot.connecting { background: #f59e0b; display: block; animation: pulse 1s ease-in-out infinite; }
    #status-dot.connected  { background: #22c55e; display: block; }
    #status-dot.error      { background: #ef4444; display: block; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }

    #btn-new {
      background: none; border: 1px solid var(--border); color: var(--fg-muted);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; gap: 5px; transition: all .15s;
    }
    #btn-new:hover { border-color: var(--accent); color: var(--accent-hi); }

    /* Status bar */
    #status-bar {
      font-size: 11px; color: var(--fg-muted); padding: 4px 14px;
      background: var(--bg); border-bottom: 1px solid var(--border);
      display: none; flex-shrink: 0;
    }
    #status-bar.visible { display: block; }

    /* Context files */
    #context-bar {
      padding: 6px 10px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; gap: 5px; align-items: center;
      flex-shrink: 0; min-height: 36px;
    }
    #context-bar.empty { display: none; }
    .file-chip {
      display: flex; align-items: center; gap: 4px;
      background: #1e2433; border: 1px solid #2d3a55;
      border-radius: 5px; padding: 2px 7px; font-size: 11px;
      color: #93b4e8; max-width: 180px;
    }
    .file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip .remove { cursor: pointer; color: #5a6a8a; font-size: 13px; line-height: 1; flex-shrink: 0; transition: color .1s; }
    .file-chip .remove:hover { color: #ef4444; }
    #btn-pick {
      background: none; border: 1px dashed var(--border); color: var(--fg-muted);
      border-radius: 5px; padding: 2px 8px; font-size: 11px; cursor: pointer; transition: all .15s;
    }
    #btn-pick:hover { border-color: var(--accent); color: var(--accent); }

    /* Messages */
    #messages {
      flex: 1; overflow-y: auto; padding: 14px 10px;
      display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .message { display: flex; flex-direction: column; gap: 4px; animation: fadeUp .2s ease; }
    @keyframes fadeUp { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
    .message.user { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }

    .bubble {
      max-width: 90%; padding: 9px 13px; border-radius: var(--radius);
      font-size: 13px; line-height: 1.65; word-break: break-word; white-space: pre-wrap;
    }
    .user .bubble { background: var(--user-bg); border: 1px solid #2d3a55; border-bottom-right-radius: 3px; color: #c8d8f5; }
    .assistant .bubble { background: var(--ai-bg); border: 1px solid var(--border); border-bottom-left-radius: 3px; color: var(--fg); }
    .assistant .bubble code { font-family: var(--font-mono); font-size: 12px; background: #0d0d0f; padding: 1px 5px; border-radius: 4px; }
    .assistant .bubble pre { background: #0d0d0f; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; }
    .assistant .bubble pre code { background: none; padding: 0; }

    .role-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fg-muted); padding: 0 3px; }
    .user .role-label { color: #4e6fa0; }
    .assistant .role-label { color: #3b6e3b; }

    .streaming-cursor::after { content: '\u258B'; animation: blink .8s step-end infinite; color: var(--accent); }
    @keyframes blink { 50% { opacity: 0; } }

    #empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 10px; color: var(--fg-muted); text-align: center; padding: 20px;
    }
    #empty svg { opacity: .3; }
    #empty h3 { font-size: 14px; font-weight: 600; color: var(--fg); opacity: .7; }
    #empty p { font-size: 12px; max-width: 200px; line-height: 1.5; }

    .error-msg {
      background: #2d1212; border: 1px solid #5a2020; color: #f87171;
      border-radius: var(--radius); padding: 9px 13px; font-size: 12px; align-self: stretch;
    }

    /* Input */
    #input-area { flex-shrink: 0; padding: 10px; border-top: 1px solid var(--border); background: var(--bg); }
    #input-row {
      display: flex; gap: 8px; align-items: flex-end;
      background: var(--input-bg); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 8px 10px; transition: border-color .2s;
    }
    #input-row:focus-within { border-color: var(--accent); }
    #input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--fg); font-family: inherit; font-size: 13px;
      resize: none; line-height: 1.5; max-height: 160px; overflow-y: auto; min-height: 22px;
    }
    #input::placeholder { color: var(--fg-muted); }
    #input-actions { display: flex; gap: 6px; align-items: center; }
    #btn-context { background: none; border: none; cursor: pointer; color: var(--fg-muted); padding: 2px 4px; border-radius: 5px; font-size: 16px; line-height: 1; transition: color .15s; }
    #btn-context:hover { color: var(--accent-hi); }
    #btn-send, #btn-stop {
      border: none; border-radius: 7px; cursor: pointer;
      width: 30px; height: 30px; display: flex; align-items: center;
      justify-content: center; transition: all .15s; flex-shrink: 0;
    }
    #btn-send { background: var(--accent); color: #fff; }
    #btn-send:hover { background: var(--accent-hi); }
    #btn-send:disabled { opacity: .35; cursor: default; }
    #btn-stop { background: #3d1515; color: #f87171; border: 1px solid #5a2020; display: none; }
    #btn-stop:hover { background: #5a1f1f; }
    #hint { font-size: 10px; color: var(--fg-muted); text-align: right; padding: 4px 2px 0; }
  </style>
</head>
<body>
<div id="app">
  <div id="header">
    <div id="header-left">
      <div id="status-dot" title="Server status"></div>
      <span id="header-title">\u2B21 OpenCode</span>
    </div>
    <button id="btn-new" title="New session">
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7 5h2v2h2v2H9v2H7v-2H5V7h2V5z"/>
      </svg>
      New
    </button>
  </div>

  <div id="status-bar"></div>

  <div id="context-bar" class="empty">
    <button id="btn-pick" title="Add files to context">+ Add files</button>
  </div>

  <div id="messages">
    <div id="empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h3>OpenCode</h3>
      <p>Ask anything about your code. Add files for context.</p>
    </div>
  </div>

  <div id="input-area">
    <div id="input-row">
      <textarea id="input" placeholder="Ask opencode\u2026" rows="1"></textarea>
      <div id="input-actions">
        <button id="btn-context" title="Add file context">\u{1F4CE}</button>
        <button id="btn-send" title="Send (Enter)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 13.5l12-5.5-12-5.5v4l8 1.5-8 1.5v4z"/>
          </svg>
        </button>
        <button id="btn-stop" title="Stop generation">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="1"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="hint">Enter to send \xB7 Shift+Enter for newline</div>
  </div>
</div>

<script nonce="${s}" src="${t}"></script>
</body>
</html>`}};function Ke(){let r="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let t=0;t<32;t++)r+=e.charAt(Math.floor(Math.random()*e.length));return r}function Ge(r){let e=new q(r);r.subscriptions.push(w.window.registerWebviewViewProvider("opencode.chatView",e,{webviewOptions:{retainContextWhenHidden:!0}})),r.subscriptions.push(w.commands.registerCommand("opencode.newSession",()=>{e.newSession()})),r.subscriptions.push(w.commands.registerCommand("opencode.addCurrentFile",()=>{let t=w.window.activeTextEditor;if(!t){w.window.showWarningMessage("No active file to add.");return}e.addFileContext(t.document.uri.fsPath)})),r.subscriptions.push(w.commands.registerCommand("opencode.focus",()=>{w.commands.executeCommand("opencode.chatView.focus")}))}function Qe(){}0&&(module.exports={activate,deactivate});
