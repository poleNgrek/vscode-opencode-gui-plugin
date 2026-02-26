"use strict";var Oe=Object.create;var E=Object.defineProperty;var Te=Object.getOwnPropertyDescriptor;var $e=Object.getOwnPropertyNames;var Ee=Object.getPrototypeOf,Me=Object.prototype.hasOwnProperty;var Fe=(r,e)=>{for(var t in e)E(r,t,{get:e[t],enumerable:!0})},xe=(r,e,t,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of $e(e))!Me.call(r,i)&&i!==t&&E(r,i,{get:()=>e[i],enumerable:!(s=Te(e,i))||s.enumerable});return r};var A=(r,e,t)=>(t=r!=null?Oe(Ee(r)):{},xe(e||!r||!r.__esModule?E(t,"default",{value:r,enumerable:!0}):t,r)),Ue=r=>xe(E({},"__esModule",{value:!0}),r);var Ye={};Fe(Ye,{activate:()=>Ge,deactivate:()=>Qe});module.exports=Ue(Ye);var C=A(require("vscode"));var _=A(require("vscode"));var je=A(require("child_process")),Ae=A(require("net")),O=A(require("vscode"));var ye=({onSseError:r,onSseEvent:e,responseTransformer:t,responseValidator:s,sseDefaultRetryDelay:i,sseMaxRetryAttempts:o,sseMaxRetryDelay:a,sseSleepFn:n,url:c,...l})=>{let g,y=n??(p=>new Promise(x=>setTimeout(x,p)));return{stream:async function*(){let p=i??3e3,x=0,v=l.signal??new AbortController().signal;for(;!v.aborted;){x++;let u=l.headers instanceof Headers?l.headers:new Headers(l.headers);g!==void 0&&u.set("Last-Event-ID",g);try{let m=await fetch(c,{...l,headers:u,signal:v});if(!m.ok)throw new Error(`SSE failed: ${m.status} ${m.statusText}`);if(!m.body)throw new Error("No body in SSE response");let b=m.body.pipeThrough(new TextDecoderStream).getReader(),f="",w=()=>{try{b.cancel()}catch{}};v.addEventListener("abort",w);try{for(;;){let{done:T,value:ze}=await b.read();if(T)break;f+=ze;let fe=f.split(`

`);f=fe.pop()??"";for(let Ie of fe){let De=Ie.split(`
`),$=[],ge;for(let S of De)if(S.startsWith("data:"))$.push(S.replace(/^data:\s*/,""));else if(S.startsWith("event:"))ge=S.replace(/^event:\s*/,"");else if(S.startsWith("id:"))g=S.replace(/^id:\s*/,"");else if(S.startsWith("retry:")){let be=Number.parseInt(S.replace(/^retry:\s*/,""),10);Number.isNaN(be)||(p=be)}let P,me=!1;if($.length){let S=$.join(`
`);try{P=JSON.parse(S),me=!0}catch{P=S}}me&&(s&&await s(P),t&&(P=await t(P))),e?.({data:P,event:ge,id:g,retry:p}),$.length&&(yield P)}}}finally{v.removeEventListener("abort",w),b.releaseLock()}break}catch(m){if(r?.(m),o!==void 0&&x>=o)break;let b=Math.min(p*2**(x-1),a??3e4);await y(b)}}}()}};var ve=async(r,e)=>{let t=typeof e=="function"?await e(r):e;if(t)return r.scheme==="bearer"?`Bearer ${t}`:r.scheme==="basic"?`Basic ${btoa(t)}`:t};var q={bodySerializer:r=>JSON.stringify(r,(e,t)=>typeof t=="bigint"?t.toString():t)};var Re=r=>{switch(r){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},Ne=r=>{switch(r){case"form":return",";case"pipeDelimited":return"|";case"spaceDelimited":return"%20";default:return","}},We=r=>{switch(r){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},M=({allowReserved:r,explode:e,name:t,style:s,value:i})=>{if(!e){let n=(r?i:i.map(c=>encodeURIComponent(c))).join(Ne(s));switch(s){case"label":return`.${n}`;case"matrix":return`;${t}=${n}`;case"simple":return n;default:return`${t}=${n}`}}let o=Re(s),a=i.map(n=>s==="label"||s==="simple"?r?n:encodeURIComponent(n):j({allowReserved:r,name:t,value:n})).join(o);return s==="label"||s==="matrix"?o+a:a},j=({allowReserved:r,name:e,value:t})=>{if(t==null)return"";if(typeof t=="object")throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");return`${e}=${r?t:encodeURIComponent(t)}`},F=({allowReserved:r,explode:e,name:t,style:s,value:i,valueOnly:o})=>{if(i instanceof Date)return o?i.toISOString():`${t}=${i.toISOString()}`;if(s!=="deepObject"&&!e){let c=[];Object.entries(i).forEach(([g,y])=>{c=[...c,g,r?y:encodeURIComponent(y)]});let l=c.join(",");switch(s){case"form":return`${t}=${l}`;case"label":return`.${l}`;case"matrix":return`;${t}=${l}`;default:return l}}let a=We(s),n=Object.entries(i).map(([c,l])=>j({allowReserved:r,name:s==="deepObject"?`${t}[${c}]`:c,value:l})).join(a);return s==="label"||s==="matrix"?a+n:n};var Be=/\{[^{}]+\}/g,qe=({path:r,url:e})=>{let t=e,s=e.match(Be);if(s)for(let i of s){let o=!1,a=i.substring(1,i.length-1),n="simple";a.endsWith("*")&&(o=!0,a=a.substring(0,a.length-1)),a.startsWith(".")?(a=a.substring(1),n="label"):a.startsWith(";")&&(a=a.substring(1),n="matrix");let c=r[a];if(c==null)continue;if(Array.isArray(c)){t=t.replace(i,M({explode:o,name:a,style:n,value:c}));continue}if(typeof c=="object"){t=t.replace(i,F({explode:o,name:a,style:n,value:c,valueOnly:!0}));continue}if(n==="matrix"){t=t.replace(i,`;${j({name:a,value:c})}`);continue}let l=encodeURIComponent(n==="label"?`.${c}`:c);t=t.replace(i,l)}return t},we=({baseUrl:r,path:e,query:t,querySerializer:s,url:i})=>{let o=i.startsWith("/")?i:`/${i}`,a=(r??"")+o;e&&(a=qe({path:e,url:a}));let n=t?s(t):"";return n.startsWith("?")&&(n=n.substring(1)),n&&(a+=`?${n}`),a};var Se=({allowReserved:r,array:e,object:t}={})=>i=>{let o=[];if(i&&typeof i=="object")for(let a in i){let n=i[a];if(n!=null)if(Array.isArray(n)){let c=M({allowReserved:r,explode:!0,name:a,style:"form",value:n,...e});c&&o.push(c)}else if(typeof n=="object"){let c=F({allowReserved:r,explode:!0,name:a,style:"deepObject",value:n,...t});c&&o.push(c)}else{let c=j({allowReserved:r,name:a,value:n});c&&o.push(c)}}return o.join("&")},ke=r=>{if(!r)return"stream";let e=r.split(";")[0]?.trim();if(e){if(e.startsWith("application/json")||e.endsWith("+json"))return"json";if(e==="multipart/form-data")return"formData";if(["application/","audio/","image/","video/"].some(t=>e.startsWith(t)))return"blob";if(e.startsWith("text/"))return"text"}},Le=(r,e)=>e?!!(r.headers.has(e)||r.query?.[e]||r.headers.get("Cookie")?.includes(`${e}=`)):!1,Ce=async({security:r,...e})=>{for(let t of r){if(Le(e,t.name))continue;let s=await ve(t,e.auth);if(!s)continue;let i=t.name??"Authorization";switch(t.in){case"query":e.query||(e.query={}),e.query[i]=s;break;case"cookie":e.headers.append("Cookie",`${i}=${s}`);break;case"header":default:e.headers.set(i,s);break}}},L=r=>we({baseUrl:r.baseUrl,path:r.path,query:r.query,querySerializer:typeof r.querySerializer=="function"?r.querySerializer:Se(r.querySerializer),url:r.url}),H=(r,e)=>{let t={...r,...e};return t.baseUrl?.endsWith("/")&&(t.baseUrl=t.baseUrl.substring(0,t.baseUrl.length-1)),t.headers=U(r.headers,e.headers),t},U=(...r)=>{let e=new Headers;for(let t of r){if(!t||typeof t!="object")continue;let s=t instanceof Headers?t.entries():Object.entries(t);for(let[i,o]of s)if(o===null)e.delete(i);else if(Array.isArray(o))for(let a of o)e.append(i,a);else o!==void 0&&e.set(i,typeof o=="object"?JSON.stringify(o):o)}return e},z=class{_fns;constructor(){this._fns=[]}clear(){this._fns=[]}getInterceptorIndex(e){return typeof e=="number"?this._fns[e]?e:-1:this._fns.indexOf(e)}exists(e){let t=this.getInterceptorIndex(e);return!!this._fns[t]}eject(e){let t=this.getInterceptorIndex(e);this._fns[t]&&(this._fns[t]=null)}update(e,t){let s=this.getInterceptorIndex(e);return this._fns[s]?(this._fns[s]=t,e):!1}use(e){return this._fns=[...this._fns,e],this._fns.length-1}},_e=()=>({error:new z,request:new z,response:new z}),He=Se({allowReserved:!1,array:{explode:!0,style:"form"},object:{explode:!0,style:"deepObject"}}),Ve={"Content-Type":"application/json"},I=(r={})=>({...q,headers:Ve,parseAs:"auto",querySerializer:He,...r});var D=(r={})=>{let e=H(I(),r),t=()=>({...e}),s=c=>(e=H(e,c),t()),i=_e(),o=async c=>{let l={...e,...c,fetch:c.fetch??e.fetch??globalThis.fetch,headers:U(e.headers,c.headers),serializedBody:void 0};l.security&&await Ce({...l,security:l.security}),l.requestValidator&&await l.requestValidator(l),l.body&&l.bodySerializer&&(l.serializedBody=l.bodySerializer(l.body)),(l.serializedBody===void 0||l.serializedBody==="")&&l.headers.delete("Content-Type");let g=L(l);return{opts:l,url:g}},a=async c=>{let{opts:l,url:g}=await o(c),y={redirect:"follow",...l,body:l.serializedBody},h=new Request(g,y);for(let f of i.request._fns)f&&(h=await f(h,l));let k=l.fetch,p=await k(h);for(let f of i.response._fns)f&&(p=await f(p,h,l));let x={request:h,response:p};if(p.ok){if(p.status===204||p.headers.get("Content-Length")==="0")return l.responseStyle==="data"?{}:{data:{},...x};let f=(l.parseAs==="auto"?ke(p.headers.get("Content-Type")):l.parseAs)??"json",w;switch(f){case"arrayBuffer":case"blob":case"formData":case"json":case"text":w=await p[f]();break;case"stream":return l.responseStyle==="data"?p.body:{data:p.body,...x}}return f==="json"&&(l.responseValidator&&await l.responseValidator(w),l.responseTransformer&&(w=await l.responseTransformer(w))),l.responseStyle==="data"?w:{data:w,...x}}let v=await p.text(),u;try{u=JSON.parse(v)}catch{}let m=u??v,b=m;for(let f of i.error._fns)f&&(b=await f(m,p,h,l));if(b=b||{},l.throwOnError)throw b;return l.responseStyle==="data"?void 0:{error:b,...x}},n=c=>{let l=g=>a({...g,method:c});return l.sse=async g=>{let{opts:y,url:h}=await o(g);return ye({...y,body:y.body,headers:y.headers,method:c,url:h})},l};return{buildUrl:L,connect:n("CONNECT"),delete:n("DELETE"),get:n("GET"),getConfig:t,head:n("HEAD"),interceptors:i,options:n("OPTIONS"),patch:n("PATCH"),post:n("POST"),put:n("PUT"),request:a,setConfig:s,trace:n("TRACE")}};var Je={$body_:"body",$headers_:"headers",$path_:"path",$query_:"query"},ht=Object.entries(Je);var Pe=D(I({baseUrl:"http://localhost:4096"}));var d=class{_client=Pe;constructor(e){e?.client&&(this._client=e.client)}},V=class extends d{event(e){return(e?.client??this._client).get.sse({url:"/global/event",...e})}},J=class extends d{list(e){return(e?.client??this._client).get({url:"/project",...e})}current(e){return(e?.client??this._client).get({url:"/project/current",...e})}},K=class extends d{list(e){return(e?.client??this._client).get({url:"/pty",...e})}create(e){return(e?.client??this._client).post({url:"/pty",...e,headers:{"Content-Type":"application/json",...e?.headers}})}remove(e){return(e.client??this._client).delete({url:"/pty/{id}",...e})}get(e){return(e.client??this._client).get({url:"/pty/{id}",...e})}update(e){return(e.client??this._client).put({url:"/pty/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}connect(e){return(e.client??this._client).get({url:"/pty/{id}/connect",...e})}},G=class extends d{get(e){return(e?.client??this._client).get({url:"/config",...e})}update(e){return(e?.client??this._client).patch({url:"/config",...e,headers:{"Content-Type":"application/json",...e?.headers}})}providers(e){return(e?.client??this._client).get({url:"/config/providers",...e})}},Q=class extends d{ids(e){return(e?.client??this._client).get({url:"/experimental/tool/ids",...e})}list(e){return(e.client??this._client).get({url:"/experimental/tool",...e})}},Y=class extends d{dispose(e){return(e?.client??this._client).post({url:"/instance/dispose",...e})}},X=class extends d{get(e){return(e?.client??this._client).get({url:"/path",...e})}},Z=class extends d{get(e){return(e?.client??this._client).get({url:"/vcs",...e})}},ee=class extends d{list(e){return(e?.client??this._client).get({url:"/session",...e})}create(e){return(e?.client??this._client).post({url:"/session",...e,headers:{"Content-Type":"application/json",...e?.headers}})}status(e){return(e?.client??this._client).get({url:"/session/status",...e})}delete(e){return(e.client??this._client).delete({url:"/session/{id}",...e})}get(e){return(e.client??this._client).get({url:"/session/{id}",...e})}update(e){return(e.client??this._client).patch({url:"/session/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}children(e){return(e.client??this._client).get({url:"/session/{id}/children",...e})}todo(e){return(e.client??this._client).get({url:"/session/{id}/todo",...e})}init(e){return(e.client??this._client).post({url:"/session/{id}/init",...e,headers:{"Content-Type":"application/json",...e.headers}})}fork(e){return(e.client??this._client).post({url:"/session/{id}/fork",...e,headers:{"Content-Type":"application/json",...e.headers}})}abort(e){return(e.client??this._client).post({url:"/session/{id}/abort",...e})}unshare(e){return(e.client??this._client).delete({url:"/session/{id}/share",...e})}share(e){return(e.client??this._client).post({url:"/session/{id}/share",...e})}diff(e){return(e.client??this._client).get({url:"/session/{id}/diff",...e})}summarize(e){return(e.client??this._client).post({url:"/session/{id}/summarize",...e,headers:{"Content-Type":"application/json",...e.headers}})}messages(e){return(e.client??this._client).get({url:"/session/{id}/message",...e})}prompt(e){return(e.client??this._client).post({url:"/session/{id}/message",...e,headers:{"Content-Type":"application/json",...e.headers}})}message(e){return(e.client??this._client).get({url:"/session/{id}/message/{messageID}",...e})}promptAsync(e){return(e.client??this._client).post({url:"/session/{id}/prompt_async",...e,headers:{"Content-Type":"application/json",...e.headers}})}command(e){return(e.client??this._client).post({url:"/session/{id}/command",...e,headers:{"Content-Type":"application/json",...e.headers}})}shell(e){return(e.client??this._client).post({url:"/session/{id}/shell",...e,headers:{"Content-Type":"application/json",...e.headers}})}revert(e){return(e.client??this._client).post({url:"/session/{id}/revert",...e,headers:{"Content-Type":"application/json",...e.headers}})}unrevert(e){return(e.client??this._client).post({url:"/session/{id}/unrevert",...e})}},te=class extends d{list(e){return(e?.client??this._client).get({url:"/command",...e})}},re=class extends d{authorize(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/authorize",...e,headers:{"Content-Type":"application/json",...e.headers}})}callback(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}},se=class extends d{list(e){return(e?.client??this._client).get({url:"/provider",...e})}auth(e){return(e?.client??this._client).get({url:"/provider/auth",...e})}oauth=new re({client:this._client})},ie=class extends d{text(e){return(e.client??this._client).get({url:"/find",...e})}files(e){return(e.client??this._client).get({url:"/find/file",...e})}symbols(e){return(e.client??this._client).get({url:"/find/symbol",...e})}},ne=class extends d{list(e){return(e.client??this._client).get({url:"/file",...e})}read(e){return(e.client??this._client).get({url:"/file/content",...e})}status(e){return(e?.client??this._client).get({url:"/file/status",...e})}},oe=class extends d{log(e){return(e?.client??this._client).post({url:"/log",...e,headers:{"Content-Type":"application/json",...e?.headers}})}agents(e){return(e?.client??this._client).get({url:"/agent",...e})}},R=class extends d{remove(e){return(e.client??this._client).delete({url:"/mcp/{name}/auth",...e})}start(e){return(e.client??this._client).post({url:"/mcp/{name}/auth",...e})}callback(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}authenticate(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/authenticate",...e})}set(e){return(e.client??this._client).put({url:"/auth/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}},ae=class extends d{status(e){return(e?.client??this._client).get({url:"/mcp",...e})}add(e){return(e?.client??this._client).post({url:"/mcp",...e,headers:{"Content-Type":"application/json",...e?.headers}})}connect(e){return(e.client??this._client).post({url:"/mcp/{name}/connect",...e})}disconnect(e){return(e.client??this._client).post({url:"/mcp/{name}/disconnect",...e})}auth=new R({client:this._client})},le=class extends d{status(e){return(e?.client??this._client).get({url:"/lsp",...e})}},ce=class extends d{status(e){return(e?.client??this._client).get({url:"/formatter",...e})}},de=class extends d{next(e){return(e?.client??this._client).get({url:"/tui/control/next",...e})}response(e){return(e?.client??this._client).post({url:"/tui/control/response",...e,headers:{"Content-Type":"application/json",...e?.headers}})}},pe=class extends d{appendPrompt(e){return(e?.client??this._client).post({url:"/tui/append-prompt",...e,headers:{"Content-Type":"application/json",...e?.headers}})}openHelp(e){return(e?.client??this._client).post({url:"/tui/open-help",...e})}openSessions(e){return(e?.client??this._client).post({url:"/tui/open-sessions",...e})}openThemes(e){return(e?.client??this._client).post({url:"/tui/open-themes",...e})}openModels(e){return(e?.client??this._client).post({url:"/tui/open-models",...e})}submitPrompt(e){return(e?.client??this._client).post({url:"/tui/submit-prompt",...e})}clearPrompt(e){return(e?.client??this._client).post({url:"/tui/clear-prompt",...e})}executeCommand(e){return(e?.client??this._client).post({url:"/tui/execute-command",...e,headers:{"Content-Type":"application/json",...e?.headers}})}showToast(e){return(e?.client??this._client).post({url:"/tui/show-toast",...e,headers:{"Content-Type":"application/json",...e?.headers}})}publish(e){return(e?.client??this._client).post({url:"/tui/publish",...e,headers:{"Content-Type":"application/json",...e?.headers}})}control=new de({client:this._client})},ue=class extends d{subscribe(e){return(e?.client??this._client).get.sse({url:"/event",...e})}},N=class extends d{postSessionIdPermissionsPermissionId(e){return(e.client??this._client).post({url:"/session/{id}/permissions/{permissionID}",...e,headers:{"Content-Type":"application/json",...e.headers}})}global=new V({client:this._client});project=new J({client:this._client});pty=new K({client:this._client});config=new G({client:this._client});tool=new Q({client:this._client});instance=new Y({client:this._client});path=new X({client:this._client});vcs=new Z({client:this._client});session=new ee({client:this._client});command=new te({client:this._client});provider=new se({client:this._client});find=new ie({client:this._client});file=new ne({client:this._client});app=new oe({client:this._client});mcp=new ae({client:this._client});lsp=new le({client:this._client});formatter=new ce({client:this._client});tui=new pe({client:this._client});auth=new R({client:this._client});event=new ue({client:this._client})};function he(r){r?.fetch||(r={...r,fetch:s=>(s.timeout=!1,fetch(s))}),r?.directory&&(r.headers={...r.headers,"x-opencode-directory":encodeURIComponent(r.directory)});let e=D(r);return new N({client:e})}var W=class{constructor(){this.serverProcess=null;this.sdkClient=null;this.promptAbort=null;this.cachedDefaultModel=null;this.bgAbort=null}async getClient(){if(this.sdkClient)return this.sdkClient;let e=O.workspace.getConfiguration("opencode"),t=(e.get("serverUrl")||"").replace(/\/$/,""),s=e.get("port")||4096,i=e.get("probePorts")||[],o=e.get("cliPath")||"opencode",a=[];if(t)a.push(t);else{a.push(`http://127.0.0.1:${s}`);for(let n of i)a.push(`http://127.0.0.1:${n}`)}for(let n of a)if(await this.isReachable(n))return this.sdkClient=this.makeClient(n),this.sdkClient;return await this.spawnServer(o,s),this.sdkClient=this.makeClient(`http://127.0.0.1:${s}`),this.sdkClient}makeClient(e){return he({baseUrl:e})}isReachable(e){return new Promise(t=>{try{let s=new URL(e),i=parseInt(s.port||"80",10),o=Ae.createConnection({host:s.hostname,port:i},()=>{o.destroy(),t(!0)});o.setTimeout(1200),o.on("timeout",()=>{o.destroy(),t(!1)}),o.on("error",()=>t(!1))}catch{t(!1)}})}spawnServer(e,t){return new Promise((s,i)=>{let o=O.workspace.workspaceFolders?.[0]?.uri.fsPath||process.cwd();this.serverProcess=je.spawn(e,["serve","--port",String(t)],{cwd:o,shell:!1,detached:!1}),this.serverProcess.on("error",c=>{i(new Error(`Failed to start opencode server: ${c.message}. Make sure opencode is installed or configure opencode.cliPath.`))});let a=0,n=setInterval(async()=>{a++,await this.isReachable(`http://127.0.0.1:${t}`)?(clearInterval(n),s()):a>40&&(clearInterval(n),i(new Error(`opencode server did not start after 20s on port ${t}.`)))},500)})}async listSessions(){let s=(await(await this.getClient()).session.list())?.data;return Array.isArray(s)?s.map(i=>({id:i.id,title:i.title||"Untitled",updatedAt:i.time?.updated??Date.now()})).sort((i,o)=>o.updatedAt-i.updatedAt):[]}async loadMessages(e){let i=(await(await this.getClient()).session.messages({path:{id:e}}))?.data;return Array.isArray(i)?i.map(o=>{let a=o.parts.filter(n=>n.type==="text"&&typeof n.text=="string").map(n=>n.text??"").join("");return{role:o.info.role==="user"?"user":"assistant",text:a,timestamp:o.info.time?.created??Date.now()}}).filter(o=>o.text.length>0):[]}async createSession(){let s=(await(await this.getClient()).session.create({body:{}}))?.data;if(!s?.id)throw new Error("opencode server did not return a session ID.");return{id:s.id,title:s.title||"New Session",updatedAt:s.time?.updated??Date.now()}}async deleteSession(e){await(await this.getClient()).session.delete({path:{id:e}})}async renameSession(e,t){await(await this.getClient()).session.update({path:{id:e},body:{title:t}})}async startBackgroundWatch(){if(this.bgAbort)return;let e=new AbortController;this.bgAbort=e;try{let s=await(await this.getClient()).event.subscribe({signal:e.signal});(async()=>{try{for await(let i of s.stream){if(e.signal.aborted)break;let o=i?.type??"";(o==="session.updated"||o==="session.created"||o==="session.deleted")&&this.onSessionsChanged?.()}}catch{}})()}catch{}}stopBackgroundWatch(){this.bgAbort&&(this.bgAbort.abort(),this.bgAbort=null)}async resolveModel(e){let t=(O.workspace.getConfiguration("opencode").get("model")??"").trim();if(t){let s=t.indexOf("/");if(s>0)return{providerID:t.slice(0,s),modelID:t.slice(s+1)};let i=await this.splitModelId(e,t);if(i)return i}if(this.cachedDefaultModel)return this.cachedDefaultModel;try{let i=(await e.config.providers())?.data?.default??{},o=Object.keys(i);if(o.length>0){let a=o[0],n=i[a];return this.cachedDefaultModel={providerID:a,modelID:n},this.cachedDefaultModel}}catch{}}async splitModelId(e,t){try{let o=(await e.config.providers())?.data?.providers??[];for(let a of o)for(let n of a.models??[])if(`${a.id}.${n.id}`===t||n.id===t)return{providerID:a.id,modelID:n.id}}catch{}let s=t.lastIndexOf(".");if(s>0)return{providerID:t.slice(0,s),modelID:t.slice(s+1)}}async send(e,t,s,i,o,a){this.abort();let n=new AbortController;this.promptAbort=n;let c;try{c=await this.getClient()}catch(h){a(String(h)),o();return}let l=[];if(s.length>0){let h=require("fs");for(let k of s)try{let p=h.readFileSync(k,"utf8"),x=O.workspace.asRelativePath(k);l.push({type:"text",text:`<file path="${x}">
${p}
</file>`})}catch{}}l.push({type:"text",text:t});let g=await this.resolveModel(c),y=null;try{y=(await c.event.subscribe({signal:n.signal})).stream}catch{}y&&(async()=>{let h=null,k=new Map;try{for await(let p of y){if(n.signal.aborted)break;let x=p?.type??"",v=p?.properties;if(x==="message.updated"){let u=v?.info;u?.role==="user"&&u?.sessionID===e&&(h=u.id)}if(x==="session.error"&&v?.sessionID===e){let u=v?.error,m=u?.data?.message??u?.name??"Unknown server error";a(String(m))}if(x==="message.part.updated"){let u=v?.part;if(u?.sessionID===e&&u?.type==="text"&&u?.messageID!==h){let m=v?.delta,b=u?.id??"";if(typeof m=="string"&&m.length>0)i(m),b&&k.set(b,(k.get(b)??0)+m.length);else if(typeof u?.text=="string"&&u.text.length>0){let f=u.text,w=k.get(b)??0,T=f.slice(w);T.length>0&&(k.set(b,f.length),i(T))}}}}}catch{}})();try{await c.session.prompt({path:{id:e},body:{parts:l,...g?{model:g}:{}}})}catch(h){n.signal.aborted||a(String(h))}n.abort(),this.promptAbort=null,o()}abort(){this.promptAbort&&(this.promptAbort.abort(),this.promptAbort=null)}async abortSession(e){this.abort();try{await(await this.getClient()).session.abort({path:{id:e}})}catch{}}dispose(){this.abort(),this.stopBackgroundWatch(),this.serverProcess&&(this.serverProcess.kill(),this.serverProcess=null),this.sdkClient=null,this.cachedDefaultModel=null}};var B=class{constructor(e){this.context=e;this.remoteSessionId=null;this.contextFiles=[];this.isStreaming=!1;this.client=new W,this.client.onSessionsChanged=()=>{this.pushSessionList().catch(()=>{})}}resolveWebviewView(e){this.view=e,e.webview.options={enableScripts:!0,localResourceRoots:[this.context.extensionUri]},e.webview.html=this.getHtml(e.webview),e.webview.onDidReceiveMessage(t=>{switch(t.type){case"ready":this.onReady();break;case"send":this.handleSend(t.text);break;case"abort":this.handleAbort();break;case"newSession":this.newSession();break;case"switchSession":this.switchSession(t.id);break;case"deleteSession":this.deleteSession(t.id);break;case"removeFile":this.removeFileContext(t.filePath);break;case"pickFiles":this.pickFiles();break}})}post(e){this.view?.webview.postMessage(e)}async onReady(){this.post({type:"updateFiles",files:this.contextFiles}),await this.pushSessionList(),this.client.startBackgroundWatch().catch(()=>{}),this.remoteSessionId&&await this.loadAndShowMessages(this.remoteSessionId)}async pushSessionList(){try{this.post({type:"status",text:"Loading sessions\u2026"});let e=await this.client.listSessions();this.post({type:"sessionList",sessions:e,activeId:this.remoteSessionId}),this.post({type:"status",text:""})}catch(e){this.post({type:"status",text:""}),this.post({type:"error",message:`Could not reach opencode server: ${e}`})}}async loadAndShowMessages(e){try{let t=await this.client.loadMessages(e);this.post({type:"loadMessages",messages:t})}catch(t){this.post({type:"error",message:`Could not load messages: ${t}`})}}async newSession(){this.handleAbort();try{this.post({type:"status",text:"Creating session\u2026"});let e=await this.client.createSession();this.remoteSessionId=e.id,this.post({type:"status",text:""}),this.post({type:"newSession"}),await this.pushSessionList()}catch(e){this.post({type:"status",text:""}),this.post({type:"error",message:String(e)})}}async switchSession(e){this.handleAbort(),this.remoteSessionId=e,this.post({type:"switchSession",id:e}),await this.loadAndShowMessages(e)}async deleteSession(e){try{await this.client.deleteSession(e),this.remoteSessionId===e&&(this.remoteSessionId=null,this.post({type:"newSession"})),await this.pushSessionList()}catch(t){this.post({type:"error",message:`Delete failed: ${t}`})}}addFileContext(e){this.contextFiles.includes(e)||(this.contextFiles.push(e),this.post({type:"updateFiles",files:this.contextFiles})),_.commands.executeCommand("opencode.chatView.focus")}removeFileContext(e){this.contextFiles=this.contextFiles.filter(t=>t!==e),this.post({type:"updateFiles",files:this.contextFiles})}async pickFiles(){let e=await _.window.showOpenDialog({canSelectMany:!0,openLabel:"Add to context",filters:{"All files":["*"]},defaultUri:_.workspace.workspaceFolders?.[0]?.uri});if(e)for(let t of e)this.addFileContext(t.fsPath)}handleAbort(){this.remoteSessionId?this.client.abortSession(this.remoteSessionId).catch(()=>{}):this.client.abort(),this.isStreaming=!1,this.post({type:"streamEnd"})}async handleSend(e){if(this.isStreaming||!e.trim())return;if(!this.remoteSessionId)try{this.post({type:"status",text:"Connecting to opencode server\u2026"});let s=await this.client.createSession();this.remoteSessionId=s.id,this.post({type:"status",text:""}),await this.pushSessionList()}catch(s){this.post({type:"status",text:""}),this.post({type:"error",message:String(s)});return}this.post({type:"userMessage",text:e,timestamp:Date.now()}),this.isStreaming=!0;let t=String(Date.now()+1);this.post({type:"streamStart",id:t}),await this.client.send(this.remoteSessionId,e,this.contextFiles,s=>{this.post({type:"streamChunk",id:t,chunk:s})},()=>{this.isStreaming=!1,this.post({type:"streamEnd",id:t}),this.pushSessionList().catch(()=>{})},s=>{this.isStreaming=!1,this.post({type:"error",message:s}),this.post({type:"streamEnd",id:t})})}dispose(){this.client.dispose()}getHtml(e){let t=e.asWebviewUri(_.Uri.joinPath(this.context.extensionUri,"media","main.js")),s=Ke();return`<!DOCTYPE html>
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

    /* \u2500\u2500 Header \u2500\u2500 */
    #header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0;
    }
    #header-left { display: flex; align-items: center; gap: 7px; }
    #header-title { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-hi); }
    #status-dot { width: 7px; height: 7px; border-radius: 50%; display: none; flex-shrink: 0; }
    #status-dot.connecting { background: #f59e0b; display: block; animation: pulse 1s ease-in-out infinite; }
    #status-dot.connected  { background: #22c55e; display: block; }
    #status-dot.error      { background: #ef4444; display: block; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.3} }
    #btn-new {
      background: none; border: 1px solid var(--border); color: var(--fg-muted);
      border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
      display: flex; align-items: center; gap: 4px; transition: all .15s;
    }
    #btn-new:hover { border-color: var(--accent); color: var(--accent-hi); }

    /* \u2500\u2500 Status bar \u2500\u2500 */
    #status-bar { font-size: 11px; color: var(--fg-muted); padding: 3px 12px; background: var(--bg); border-bottom: 1px solid var(--border); display: none; flex-shrink: 0; }
    #status-bar.visible { display: block; }

    /* \u2500\u2500 Session list \u2500\u2500 */
    #session-section { flex-shrink: 0; border-bottom: 1px solid var(--border); }
    #session-toggle {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 12px; cursor: pointer; user-select: none;
      background: var(--bg); font-size: 10px; font-weight: 700;
      letter-spacing: .1em; text-transform: uppercase; color: var(--fg-muted);
      transition: color .15s;
    }
    #session-toggle:hover { color: var(--fg); }
    #session-toggle-icon { font-size: 9px; transition: transform .2s; }
    #session-toggle-icon.open { transform: rotate(90deg); }
    #session-list-wrap { max-height: 180px; overflow-y: auto; display: none; }
    #session-list-wrap.open { display: block; }
    #session-list-wrap::-webkit-scrollbar { width: 3px; }
    #session-list-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .session-item {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 12px; cursor: pointer; transition: background .1s;
      border-left: 2px solid transparent;
    }
    .session-item:hover { background: rgba(255,255,255,.04); }
    .session-item.active { border-left-color: var(--accent); background: rgba(59,130,246,.08); }
    .session-item-body { flex: 1; min-width: 0; }
    .session-title { font-size: 12px; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-time { font-size: 10px; color: var(--fg-muted); }
    .session-delete {
      opacity: 0; background: none; border: none; cursor: pointer;
      color: var(--fg-muted); padding: 2px 4px; border-radius: 4px;
      font-size: 13px; line-height: 1; transition: all .1s; flex-shrink: 0;
    }
    .session-item:hover .session-delete { opacity: 1; }
    .session-delete:hover { color: #ef4444; background: rgba(239,68,68,.1); }
    #session-empty { padding: 10px 12px; font-size: 11px; color: var(--fg-muted); }

    /* \u2500\u2500 Context bar \u2500\u2500 */
    #context-bar {
      padding: 5px 10px; border-bottom: 1px solid var(--border);
      display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
      flex-shrink: 0; min-height: 34px;
    }
    #context-bar.empty { display: none; }
    .file-chip {
      display: flex; align-items: center; gap: 3px;
      background: #1e2433; border: 1px solid #2d3a55;
      border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #93b4e8; max-width: 160px;
    }
    .file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip .remove { cursor: pointer; color: #5a6a8a; font-size: 13px; line-height: 1; flex-shrink: 0; transition: color .1s; }
    .file-chip .remove:hover { color: #ef4444; }
    #btn-pick { background: none; border: 1px dashed var(--border); color: var(--fg-muted); border-radius: 4px; padding: 1px 7px; font-size: 11px; cursor: pointer; transition: all .15s; }
    #btn-pick:hover { border-color: var(--accent); color: var(--accent); }

    /* \u2500\u2500 Messages \u2500\u2500 */
    #messages { flex: 1; overflow-y: auto; padding: 12px 10px; display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth; }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .message { display: flex; flex-direction: column; gap: 3px; animation: fadeUp .18s ease; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none} }
    .message.user { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }
    .bubble { max-width: 90%; padding: 8px 12px; border-radius: var(--radius); font-size: 13px; line-height: 1.65; word-break: break-word; white-space: pre-wrap; }
    .user .bubble { background: var(--user-bg); border: 1px solid #2d3a55; border-bottom-right-radius: 3px; color: #c8d8f5; }
    .assistant .bubble { background: var(--ai-bg); border: 1px solid var(--border); border-bottom-left-radius: 3px; color: var(--fg); }
    .assistant .bubble code { font-family: var(--font-mono); font-size: 12px; background: #0d0d0f; padding: 1px 5px; border-radius: 4px; }
    .assistant .bubble pre { background: #0d0d0f; border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; overflow-x: auto; margin: 6px 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; }
    .assistant .bubble pre code { background: none; padding: 0; }
    .role-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 0 3px; }
    .user .role-label { color: #4e6fa0; }
    .assistant .role-label { color: #3b6e3b; }
    .streaming-cursor::after { content: '\u258B'; animation: blink .8s step-end infinite; color: var(--accent); }
    @keyframes blink { 50%{opacity:0} }
    #empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--fg-muted); text-align: center; padding: 20px; }
    #empty svg { opacity: .25; }
    #empty h3 { font-size: 14px; font-weight: 600; color: var(--fg); opacity: .6; }
    #empty p { font-size: 12px; max-width: 200px; line-height: 1.5; }
    .error-msg { background: #2d1212; border: 1px solid #5a2020; color: #f87171; border-radius: var(--radius); padding: 8px 12px; font-size: 12px; align-self: stretch; }

    /* \u2500\u2500 Input \u2500\u2500 */
    #input-area { flex-shrink: 0; padding: 8px 10px 10px; border-top: 1px solid var(--border); background: var(--bg); }
    #input-row { display: flex; gap: 7px; align-items: flex-end; background: var(--input-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 7px 9px; transition: border-color .2s; }
    #input-row:focus-within { border-color: var(--accent); }
    #input { flex: 1; background: none; border: none; outline: none; color: var(--fg); font-family: inherit; font-size: 13px; resize: none; line-height: 1.5; max-height: 140px; overflow-y: auto; min-height: 20px; }
    #input::placeholder { color: var(--fg-muted); }
    #input-actions { display: flex; gap: 5px; align-items: center; }
    #btn-context { background: none; border: none; cursor: pointer; color: var(--fg-muted); padding: 2px 3px; border-radius: 4px; font-size: 15px; line-height: 1; transition: color .15s; }
    #btn-context:hover { color: var(--accent-hi); }
    #btn-send, #btn-stop { border: none; border-radius: 7px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: all .15s; flex-shrink: 0; }
    #btn-send { background: var(--accent); color: #fff; }
    #btn-send:hover { background: var(--accent-hi); }
    #btn-send:disabled { opacity: .35; cursor: default; }
    #btn-stop { background: #3d1515; color: #f87171; border: 1px solid #5a2020; display: none; }
    #btn-stop:hover { background: #5a1f1f; }
    #hint { font-size: 10px; color: var(--fg-muted); text-align: right; padding: 3px 1px 0; }
  </style>
</head>
<body>
<div id="app">

  <!-- Header -->
  <div id="header">
    <div id="header-left">
      <div id="status-dot"></div>
      <span id="header-title">\u2B21 OpenCode</span>
    </div>
    <button id="btn-new" title="New session">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7 5h2v2h2v2H9v2H7v-2H5V7h2V5z"/>
      </svg>
      New
    </button>
  </div>

  <!-- Status bar -->
  <div id="status-bar"></div>

  <!-- Session list -->
  <div id="session-section">
    <div id="session-toggle">
      <span>Sessions</span>
      <span id="session-toggle-icon">\u25B6</span>
    </div>
    <div id="session-list-wrap">
      <div id="session-list"></div>
      <div id="session-empty" style="display:none">No sessions yet</div>
    </div>
  </div>

  <!-- Context bar -->
  <div id="context-bar" class="empty">
    <button id="btn-pick">+ Add files</button>
  </div>

  <!-- Messages -->
  <div id="messages">
    <div id="empty">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h3>OpenCode</h3>
      <p>Select a session or create a new one to start chatting.</p>
    </div>
  </div>

  <!-- Input -->
  <div id="input-area">
    <div id="input-row">
      <textarea id="input" placeholder="Ask opencode\u2026" rows="1"></textarea>
      <div id="input-actions">
        <button id="btn-context" title="Add file context">\u{1F4CE}</button>
        <button id="btn-send" title="Send (Enter)">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 13.5l12-5.5-12-5.5v4l8 1.5-8 1.5v4z"/>
          </svg>
        </button>
        <button id="btn-stop" title="Stop">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
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
</html>`}};function Ke(){let r="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let t=0;t<32;t++)r+=e.charAt(Math.floor(Math.random()*e.length));return r}function Ge(r){let e=new B(r);r.subscriptions.push(C.window.registerWebviewViewProvider("opencode.chatView",e,{webviewOptions:{retainContextWhenHidden:!0}})),r.subscriptions.push(C.commands.registerCommand("opencode.newSession",()=>{e.newSession()})),r.subscriptions.push(C.commands.registerCommand("opencode.addCurrentFile",()=>{let t=C.window.activeTextEditor;if(!t){C.window.showWarningMessage("No active file to add.");return}e.addFileContext(t.document.uri.fsPath)})),r.subscriptions.push(C.commands.registerCommand("opencode.focus",()=>{C.commands.executeCommand("opencode.chatView.focus")}))}function Qe(){}0&&(module.exports={activate,deactivate});
