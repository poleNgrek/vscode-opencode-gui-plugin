"use strict";var Ee=Object.create;var I=Object.defineProperty;var $e=Object.getOwnPropertyDescriptor;var Ie=Object.getOwnPropertyNames;var De=Object.getPrototypeOf,Fe=Object.prototype.hasOwnProperty;var Ue=(t,e)=>{for(var r in e)I(t,r,{get:e[r],enumerable:!0})},be=(t,e,r,s)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of Ie(e))!Fe.call(t,i)&&i!==r&&I(t,i,{get:()=>e[i],enumerable:!(s=$e(e,i))||s.enumerable});return t};var z=(t,e,r)=>(r=t!=null?Ee(De(t)):{},be(e||!t||!t.__esModule?I(r,"default",{value:t,enumerable:!0}):r,t)),Me=t=>be(I({},"__esModule",{value:!0}),t);var Ye={};Ue(Ye,{activate:()=>Ge,deactivate:()=>Qe});module.exports=Me(Ye);var S=z(require("vscode"));var k=z(require("vscode"));var je=z(require("child_process")),Pe=z(require("net")),E=z(require("vscode"));var xe=({onSseError:t,onSseEvent:e,responseTransformer:r,responseValidator:s,sseDefaultRetryDelay:i,sseMaxRetryAttempts:l,sseMaxRetryDelay:o,sseSleepFn:n,url:c,...a})=>{let f,m=n??(d=>new Promise(u=>setTimeout(u,d)));return{stream:async function*(){let d=i??3e3,u=0,v=a.signal??new AbortController().signal;for(;!v.aborted;){u++;let _=a.headers instanceof Headers?a.headers:new Headers(a.headers);f!==void 0&&_.set("Last-Event-ID",f);try{let y=await fetch(c,{...a,headers:_,signal:v});if(!y.ok)throw new Error(`SSE failed: ${y.status} ${y.statusText}`);if(!y.body)throw new Error("No body in SSE response");let b=y.body.pipeThrough(new TextDecoderStream).getReader(),h="",w=()=>{try{b.cancel()}catch{}};v.addEventListener("abort",w);try{for(;;){let{done:ze,value:Oe}=await b.read();if(ze)break;h+=Oe;let he=h.split(`

`);h=he.pop()??"";for(let Te of he){let Ae=Te.split(`
`),$=[],fe;for(let x of Ae)if(x.startsWith("data:"))$.push(x.replace(/^data:\s*/,""));else if(x.startsWith("event:"))fe=x.replace(/^event:\s*/,"");else if(x.startsWith("id:"))f=x.replace(/^id:\s*/,"");else if(x.startsWith("retry:")){let ge=Number.parseInt(x.replace(/^retry:\s*/,""),10);Number.isNaN(ge)||(d=ge)}let C,me=!1;if($.length){let x=$.join(`
`);try{C=JSON.parse(x),me=!0}catch{C=x}}me&&(s&&await s(C),r&&(C=await r(C))),e?.({data:C,event:fe,id:f,retry:d}),$.length&&(yield C)}}}finally{v.removeEventListener("abort",w),b.releaseLock()}break}catch(y){if(t?.(y),l!==void 0&&u>=l)break;let b=Math.min(d*2**(u-1),o??3e4);await m(b)}}}()}};var ye=async(t,e)=>{let r=typeof e=="function"?await e(t):e;if(r)return t.scheme==="bearer"?`Bearer ${r}`:t.scheme==="basic"?`Basic ${btoa(r)}`:r};var B={bodySerializer:t=>JSON.stringify(t,(e,r)=>typeof r=="bigint"?r.toString():r)};var Ne=t=>{switch(t){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},We=t=>{switch(t){case"form":return",";case"pipeDelimited":return"|";case"spaceDelimited":return"%20";default:return","}},qe=t=>{switch(t){case"label":return".";case"matrix":return";";case"simple":return",";default:return"&"}},D=({allowReserved:t,explode:e,name:r,style:s,value:i})=>{if(!e){let n=(t?i:i.map(c=>encodeURIComponent(c))).join(We(s));switch(s){case"label":return`.${n}`;case"matrix":return`;${r}=${n}`;case"simple":return n;default:return`${r}=${n}`}}let l=Ne(s),o=i.map(n=>s==="label"||s==="simple"?t?n:encodeURIComponent(n):P({allowReserved:t,name:r,value:n})).join(l);return s==="label"||s==="matrix"?l+o:o},P=({allowReserved:t,name:e,value:r})=>{if(r==null)return"";if(typeof r=="object")throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");return`${e}=${t?r:encodeURIComponent(r)}`},F=({allowReserved:t,explode:e,name:r,style:s,value:i,valueOnly:l})=>{if(i instanceof Date)return l?i.toISOString():`${r}=${i.toISOString()}`;if(s!=="deepObject"&&!e){let c=[];Object.entries(i).forEach(([f,m])=>{c=[...c,f,t?m:encodeURIComponent(m)]});let a=c.join(",");switch(s){case"form":return`${r}=${a}`;case"label":return`.${a}`;case"matrix":return`;${r}=${a}`;default:return a}}let o=qe(s),n=Object.entries(i).map(([c,a])=>P({allowReserved:t,name:s==="deepObject"?`${r}[${c}]`:c,value:a})).join(o);return s==="label"||s==="matrix"?o+n:n};var Be=/\{[^{}]+\}/g,He=({path:t,url:e})=>{let r=e,s=e.match(Be);if(s)for(let i of s){let l=!1,o=i.substring(1,i.length-1),n="simple";o.endsWith("*")&&(l=!0,o=o.substring(0,o.length-1)),o.startsWith(".")?(o=o.substring(1),n="label"):o.startsWith(";")&&(o=o.substring(1),n="matrix");let c=t[o];if(c==null)continue;if(Array.isArray(c)){r=r.replace(i,D({explode:l,name:o,style:n,value:c}));continue}if(typeof c=="object"){r=r.replace(i,F({explode:l,name:o,style:n,value:c,valueOnly:!0}));continue}if(n==="matrix"){r=r.replace(i,`;${P({name:o,value:c})}`);continue}let a=encodeURIComponent(n==="label"?`.${c}`:c);r=r.replace(i,a)}return r},ve=({baseUrl:t,path:e,query:r,querySerializer:s,url:i})=>{let l=i.startsWith("/")?i:`/${i}`,o=(t??"")+l;e&&(o=He({path:e,url:o}));let n=r?s(r):"";return n.startsWith("?")&&(n=n.substring(1)),n&&(o+=`?${n}`),o};var we=({allowReserved:t,array:e,object:r}={})=>i=>{let l=[];if(i&&typeof i=="object")for(let o in i){let n=i[o];if(n!=null)if(Array.isArray(n)){let c=D({allowReserved:t,explode:!0,name:o,style:"form",value:n,...e});c&&l.push(c)}else if(typeof n=="object"){let c=F({allowReserved:t,explode:!0,name:o,style:"deepObject",value:n,...r});c&&l.push(c)}else{let c=P({allowReserved:t,name:o,value:n});c&&l.push(c)}}return l.join("&")},Se=t=>{if(!t)return"stream";let e=t.split(";")[0]?.trim();if(e){if(e.startsWith("application/json")||e.endsWith("+json"))return"json";if(e==="multipart/form-data")return"formData";if(["application/","audio/","image/","video/"].some(r=>e.startsWith(r)))return"blob";if(e.startsWith("text/"))return"text"}},Re=(t,e)=>e?!!(t.headers.has(e)||t.query?.[e]||t.headers.get("Cookie")?.includes(`${e}=`)):!1,ke=async({security:t,...e})=>{for(let r of t){if(Re(e,r.name))continue;let s=await ye(r,e.auth);if(!s)continue;let i=r.name??"Authorization";switch(r.in){case"query":e.query||(e.query={}),e.query[i]=s;break;case"cookie":e.headers.append("Cookie",`${i}=${s}`);break;case"header":default:e.headers.set(i,s);break}}},H=t=>ve({baseUrl:t.baseUrl,path:t.path,query:t.query,querySerializer:typeof t.querySerializer=="function"?t.querySerializer:we(t.querySerializer),url:t.url}),R=(t,e)=>{let r={...t,...e};return r.baseUrl?.endsWith("/")&&(r.baseUrl=r.baseUrl.substring(0,r.baseUrl.length-1)),r.headers=U(t.headers,e.headers),r},U=(...t)=>{let e=new Headers;for(let r of t){if(!r||typeof r!="object")continue;let s=r instanceof Headers?r.entries():Object.entries(r);for(let[i,l]of s)if(l===null)e.delete(i);else if(Array.isArray(l))for(let o of l)e.append(i,o);else l!==void 0&&e.set(i,typeof l=="object"?JSON.stringify(l):l)}return e},O=class{_fns;constructor(){this._fns=[]}clear(){this._fns=[]}getInterceptorIndex(e){return typeof e=="number"?this._fns[e]?e:-1:this._fns.indexOf(e)}exists(e){let r=this.getInterceptorIndex(e);return!!this._fns[r]}eject(e){let r=this.getInterceptorIndex(e);this._fns[r]&&(this._fns[r]=null)}update(e,r){let s=this.getInterceptorIndex(e);return this._fns[s]?(this._fns[s]=r,e):!1}use(e){return this._fns=[...this._fns,e],this._fns.length-1}},_e=()=>({error:new O,request:new O,response:new O}),Le=we({allowReserved:!1,array:{explode:!0,style:"form"},object:{explode:!0,style:"deepObject"}}),Ve={"Content-Type":"application/json"},T=(t={})=>({...B,headers:Ve,parseAs:"auto",querySerializer:Le,...t});var A=(t={})=>{let e=R(T(),t),r=()=>({...e}),s=c=>(e=R(e,c),r()),i=_e(),l=async c=>{let a={...e,...c,fetch:c.fetch??e.fetch??globalThis.fetch,headers:U(e.headers,c.headers),serializedBody:void 0};a.security&&await ke({...a,security:a.security}),a.requestValidator&&await a.requestValidator(a),a.body&&a.bodySerializer&&(a.serializedBody=a.bodySerializer(a.body)),(a.serializedBody===void 0||a.serializedBody==="")&&a.headers.delete("Content-Type");let f=H(a);return{opts:a,url:f}},o=async c=>{let{opts:a,url:f}=await l(c),m={redirect:"follow",...a,body:a.serializedBody},g=new Request(f,m);for(let h of i.request._fns)h&&(g=await h(g,a));let j=a.fetch,d=await j(g);for(let h of i.response._fns)h&&(d=await h(d,g,a));let u={request:g,response:d};if(d.ok){if(d.status===204||d.headers.get("Content-Length")==="0")return a.responseStyle==="data"?{}:{data:{},...u};let h=(a.parseAs==="auto"?Se(d.headers.get("Content-Type")):a.parseAs)??"json",w;switch(h){case"arrayBuffer":case"blob":case"formData":case"json":case"text":w=await d[h]();break;case"stream":return a.responseStyle==="data"?d.body:{data:d.body,...u}}return h==="json"&&(a.responseValidator&&await a.responseValidator(w),a.responseTransformer&&(w=await a.responseTransformer(w))),a.responseStyle==="data"?w:{data:w,...u}}let v=await d.text(),_;try{_=JSON.parse(v)}catch{}let y=_??v,b=y;for(let h of i.error._fns)h&&(b=await h(y,d,g,a));if(b=b||{},a.throwOnError)throw b;return a.responseStyle==="data"?void 0:{error:b,...u}},n=c=>{let a=f=>o({...f,method:c});return a.sse=async f=>{let{opts:m,url:g}=await l(f);return xe({...m,body:m.body,headers:m.headers,method:c,url:g})},a};return{buildUrl:H,connect:n("CONNECT"),delete:n("DELETE"),get:n("GET"),getConfig:r,head:n("HEAD"),interceptors:i,options:n("OPTIONS"),patch:n("PATCH"),post:n("POST"),put:n("PUT"),request:o,setConfig:s,trace:n("TRACE")}};var Je={$body_:"body",$headers_:"headers",$path_:"path",$query_:"query"},ht=Object.entries(Je);var Ce=A(T({baseUrl:"http://localhost:4096"}));var p=class{_client=Ce;constructor(e){e?.client&&(this._client=e.client)}},L=class extends p{event(e){return(e?.client??this._client).get.sse({url:"/global/event",...e})}},V=class extends p{list(e){return(e?.client??this._client).get({url:"/project",...e})}current(e){return(e?.client??this._client).get({url:"/project/current",...e})}},J=class extends p{list(e){return(e?.client??this._client).get({url:"/pty",...e})}create(e){return(e?.client??this._client).post({url:"/pty",...e,headers:{"Content-Type":"application/json",...e?.headers}})}remove(e){return(e.client??this._client).delete({url:"/pty/{id}",...e})}get(e){return(e.client??this._client).get({url:"/pty/{id}",...e})}update(e){return(e.client??this._client).put({url:"/pty/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}connect(e){return(e.client??this._client).get({url:"/pty/{id}/connect",...e})}},K=class extends p{get(e){return(e?.client??this._client).get({url:"/config",...e})}update(e){return(e?.client??this._client).patch({url:"/config",...e,headers:{"Content-Type":"application/json",...e?.headers}})}providers(e){return(e?.client??this._client).get({url:"/config/providers",...e})}},G=class extends p{ids(e){return(e?.client??this._client).get({url:"/experimental/tool/ids",...e})}list(e){return(e.client??this._client).get({url:"/experimental/tool",...e})}},Q=class extends p{dispose(e){return(e?.client??this._client).post({url:"/instance/dispose",...e})}},Y=class extends p{get(e){return(e?.client??this._client).get({url:"/path",...e})}},X=class extends p{get(e){return(e?.client??this._client).get({url:"/vcs",...e})}},Z=class extends p{list(e){return(e?.client??this._client).get({url:"/session",...e})}create(e){return(e?.client??this._client).post({url:"/session",...e,headers:{"Content-Type":"application/json",...e?.headers}})}status(e){return(e?.client??this._client).get({url:"/session/status",...e})}delete(e){return(e.client??this._client).delete({url:"/session/{id}",...e})}get(e){return(e.client??this._client).get({url:"/session/{id}",...e})}update(e){return(e.client??this._client).patch({url:"/session/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}children(e){return(e.client??this._client).get({url:"/session/{id}/children",...e})}todo(e){return(e.client??this._client).get({url:"/session/{id}/todo",...e})}init(e){return(e.client??this._client).post({url:"/session/{id}/init",...e,headers:{"Content-Type":"application/json",...e.headers}})}fork(e){return(e.client??this._client).post({url:"/session/{id}/fork",...e,headers:{"Content-Type":"application/json",...e.headers}})}abort(e){return(e.client??this._client).post({url:"/session/{id}/abort",...e})}unshare(e){return(e.client??this._client).delete({url:"/session/{id}/share",...e})}share(e){return(e.client??this._client).post({url:"/session/{id}/share",...e})}diff(e){return(e.client??this._client).get({url:"/session/{id}/diff",...e})}summarize(e){return(e.client??this._client).post({url:"/session/{id}/summarize",...e,headers:{"Content-Type":"application/json",...e.headers}})}messages(e){return(e.client??this._client).get({url:"/session/{id}/message",...e})}prompt(e){return(e.client??this._client).post({url:"/session/{id}/message",...e,headers:{"Content-Type":"application/json",...e.headers}})}message(e){return(e.client??this._client).get({url:"/session/{id}/message/{messageID}",...e})}promptAsync(e){return(e.client??this._client).post({url:"/session/{id}/prompt_async",...e,headers:{"Content-Type":"application/json",...e.headers}})}command(e){return(e.client??this._client).post({url:"/session/{id}/command",...e,headers:{"Content-Type":"application/json",...e.headers}})}shell(e){return(e.client??this._client).post({url:"/session/{id}/shell",...e,headers:{"Content-Type":"application/json",...e.headers}})}revert(e){return(e.client??this._client).post({url:"/session/{id}/revert",...e,headers:{"Content-Type":"application/json",...e.headers}})}unrevert(e){return(e.client??this._client).post({url:"/session/{id}/unrevert",...e})}},ee=class extends p{list(e){return(e?.client??this._client).get({url:"/command",...e})}},te=class extends p{authorize(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/authorize",...e,headers:{"Content-Type":"application/json",...e.headers}})}callback(e){return(e.client??this._client).post({url:"/provider/{id}/oauth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}},re=class extends p{list(e){return(e?.client??this._client).get({url:"/provider",...e})}auth(e){return(e?.client??this._client).get({url:"/provider/auth",...e})}oauth=new te({client:this._client})},se=class extends p{text(e){return(e.client??this._client).get({url:"/find",...e})}files(e){return(e.client??this._client).get({url:"/find/file",...e})}symbols(e){return(e.client??this._client).get({url:"/find/symbol",...e})}},ie=class extends p{list(e){return(e.client??this._client).get({url:"/file",...e})}read(e){return(e.client??this._client).get({url:"/file/content",...e})}status(e){return(e?.client??this._client).get({url:"/file/status",...e})}},ne=class extends p{log(e){return(e?.client??this._client).post({url:"/log",...e,headers:{"Content-Type":"application/json",...e?.headers}})}agents(e){return(e?.client??this._client).get({url:"/agent",...e})}},M=class extends p{remove(e){return(e.client??this._client).delete({url:"/mcp/{name}/auth",...e})}start(e){return(e.client??this._client).post({url:"/mcp/{name}/auth",...e})}callback(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/callback",...e,headers:{"Content-Type":"application/json",...e.headers}})}authenticate(e){return(e.client??this._client).post({url:"/mcp/{name}/auth/authenticate",...e})}set(e){return(e.client??this._client).put({url:"/auth/{id}",...e,headers:{"Content-Type":"application/json",...e.headers}})}},ae=class extends p{status(e){return(e?.client??this._client).get({url:"/mcp",...e})}add(e){return(e?.client??this._client).post({url:"/mcp",...e,headers:{"Content-Type":"application/json",...e?.headers}})}connect(e){return(e.client??this._client).post({url:"/mcp/{name}/connect",...e})}disconnect(e){return(e.client??this._client).post({url:"/mcp/{name}/disconnect",...e})}auth=new M({client:this._client})},oe=class extends p{status(e){return(e?.client??this._client).get({url:"/lsp",...e})}},ce=class extends p{status(e){return(e?.client??this._client).get({url:"/formatter",...e})}},le=class extends p{next(e){return(e?.client??this._client).get({url:"/tui/control/next",...e})}response(e){return(e?.client??this._client).post({url:"/tui/control/response",...e,headers:{"Content-Type":"application/json",...e?.headers}})}},de=class extends p{appendPrompt(e){return(e?.client??this._client).post({url:"/tui/append-prompt",...e,headers:{"Content-Type":"application/json",...e?.headers}})}openHelp(e){return(e?.client??this._client).post({url:"/tui/open-help",...e})}openSessions(e){return(e?.client??this._client).post({url:"/tui/open-sessions",...e})}openThemes(e){return(e?.client??this._client).post({url:"/tui/open-themes",...e})}openModels(e){return(e?.client??this._client).post({url:"/tui/open-models",...e})}submitPrompt(e){return(e?.client??this._client).post({url:"/tui/submit-prompt",...e})}clearPrompt(e){return(e?.client??this._client).post({url:"/tui/clear-prompt",...e})}executeCommand(e){return(e?.client??this._client).post({url:"/tui/execute-command",...e,headers:{"Content-Type":"application/json",...e?.headers}})}showToast(e){return(e?.client??this._client).post({url:"/tui/show-toast",...e,headers:{"Content-Type":"application/json",...e?.headers}})}publish(e){return(e?.client??this._client).post({url:"/tui/publish",...e,headers:{"Content-Type":"application/json",...e?.headers}})}control=new le({client:this._client})},pe=class extends p{subscribe(e){return(e?.client??this._client).get.sse({url:"/event",...e})}},N=class extends p{postSessionIdPermissionsPermissionId(e){return(e.client??this._client).post({url:"/session/{id}/permissions/{permissionID}",...e,headers:{"Content-Type":"application/json",...e.headers}})}global=new L({client:this._client});project=new V({client:this._client});pty=new J({client:this._client});config=new K({client:this._client});tool=new G({client:this._client});instance=new Q({client:this._client});path=new Y({client:this._client});vcs=new X({client:this._client});session=new Z({client:this._client});command=new ee({client:this._client});provider=new re({client:this._client});find=new se({client:this._client});file=new ie({client:this._client});app=new ne({client:this._client});mcp=new ae({client:this._client});lsp=new oe({client:this._client});formatter=new ce({client:this._client});tui=new de({client:this._client});auth=new M({client:this._client});event=new pe({client:this._client})};function ue(t){t?.fetch||(t={...t,fetch:s=>(s.timeout=!1,fetch(s))}),t?.directory&&(t.headers={...t.headers,"x-opencode-directory":encodeURIComponent(t.directory)});let e=A(t);return new N({client:e})}var W=class{constructor(){this.serverProcess=null;this.sdkClient=null;this.promptAbort=null}async getClient(){if(this.sdkClient)return this.sdkClient;let e=E.workspace.getConfiguration("opencode"),r=e.get("serverUrl")||"",s=e.get("port")||4096,i=e.get("probePorts")||[],l=e.get("cliPath")||"opencode",o=[];if(r)o.push(r.replace(/\/$/,""));else{o.push(`http://127.0.0.1:${s}`);for(let n of i)o.push(`http://127.0.0.1:${n}`)}for(let n of o)if(await this.isReachable(n))return this.sdkClient=this.makeClient(n),this.sdkClient;return await this.spawnServer(l,s),this.sdkClient=this.makeClient(`http://127.0.0.1:${s}`),this.sdkClient}makeClient(e){return ue({baseUrl:e})}isReachable(e){return new Promise(r=>{try{let s=new URL(e),i=parseInt(s.port||"80",10),l=Pe.createConnection({host:s.hostname,port:i},()=>{l.destroy(),r(!0)});l.setTimeout(1200),l.on("timeout",()=>{l.destroy(),r(!1)}),l.on("error",()=>r(!1))}catch{r(!1)}})}spawnServer(e,r){return new Promise((s,i)=>{let l=E.workspace.workspaceFolders?.[0]?.uri.fsPath||process.cwd();this.serverProcess=je.spawn(e,["serve","--port",String(r)],{cwd:l,shell:!1,detached:!1}),this.serverProcess.on("error",c=>{i(new Error(`Failed to start opencode server: ${c.message}. Make sure opencode is installed or configure opencode.cliPath.`))});let o=0,n=setInterval(async()=>{o++,await this.isReachable(`http://127.0.0.1:${r}`)?(clearInterval(n),s()):o>40&&(clearInterval(n),i(new Error(`opencode server did not start after 20s on port ${r}.`)))},500)})}async createSession(){let s=(await(await this.getClient()).session.create({body:{}}))?.data?.id;if(!s)throw new Error("opencode server did not return a session ID.");return s}async send(e,r,s,i,l,o){this.abort();let n=new AbortController;this.promptAbort=n;let c;try{c=await this.getClient()}catch(d){o(String(d)),l();return}let a=[];if(s.length>0){let d=require("fs");for(let u of s)try{let v=d.readFileSync(u,"utf8"),_=E.workspace.asRelativePath(u);a.push({type:"text",text:`<file path="${_}">
${v}
</file>`})}catch{}}a.push({type:"text",text:r});let m=E.workspace.getConfiguration("opencode").get("model")||"",g;if(m){let d=m.indexOf("/");d>0&&(g={providerID:m.slice(0,d),modelID:m.slice(d+1)})}let j=null;try{j=(await c.event.subscribe({signal:n.signal})).stream}catch{}j&&(async()=>{try{for await(let d of j){if(n.signal.aborted)break;if(d?.type==="message.part.updated"&&d?.properties?.part?.sessionID===e&&d?.properties?.part?.type==="text"){let u=d.properties.delta??d.properties.part.text??"";u&&i(u)}}}catch{}})();try{await c.session.prompt({path:{id:e},body:{parts:a,...g?{model:g}:{}}})}catch(d){n.signal.aborted||o(String(d))}n.abort(),this.promptAbort=null,l()}abort(){this.promptAbort&&(this.promptAbort.abort(),this.promptAbort=null)}async abortSession(e){this.abort();try{await(await this.getClient()).session.abort({path:{id:e}})}catch{}}dispose(){this.abort(),this.serverProcess&&(this.serverProcess.kill(),this.serverProcess=null),this.sdkClient=null}};var q=class{constructor(e){this.context=e;this.remoteSessionId=null;this.isStreaming=!1;this.client=new W,this.session=this.makeLocalSession()}makeLocalSession(){return{id:Date.now().toString(),messages:[],contextFiles:[]}}resolveWebviewView(e){this.view=e,e.webview.options={enableScripts:!0,localResourceRoots:[this.context.extensionUri]},e.webview.html=this.getHtml(e.webview),e.webview.onDidReceiveMessage(r=>{switch(r.type){case"ready":this.syncState();break;case"send":this.handleSend(r.text);break;case"newSession":this.newSession();break;case"abort":this.remoteSessionId?this.client.abortSession(this.remoteSessionId).catch(()=>{}):this.client.abort(),this.isStreaming=!1,this.post({type:"streamEnd"});break;case"removeFile":this.removeFileContext(r.filePath);break;case"pickFiles":this.pickFiles();break}})}post(e){this.view?.webview.postMessage(e)}syncState(){this.post({type:"restore",session:this.session,isStreaming:this.isStreaming})}newSession(){this.client.abort(),this.isStreaming=!1,this.remoteSessionId=null,this.session=this.makeLocalSession(),this.post({type:"newSession"})}addFileContext(e){this.session.contextFiles.includes(e)||(this.session.contextFiles.push(e),this.post({type:"updateFiles",files:this.session.contextFiles})),k.commands.executeCommand("opencode.chatView.focus")}removeFileContext(e){this.session.contextFiles=this.session.contextFiles.filter(r=>r!==e),this.post({type:"updateFiles",files:this.session.contextFiles})}async pickFiles(){let e=await k.window.showOpenDialog({canSelectMany:!0,openLabel:"Add to context",filters:{"All files":["*"]},defaultUri:k.workspace.workspaceFolders?.[0]?.uri});if(e)for(let r of e)this.addFileContext(r.fsPath)}async handleSend(e){if(this.isStreaming||!e.trim())return;let r={id:Date.now().toString(),role:"user",content:e,timestamp:Date.now()};this.session.messages.push(r),this.post({type:"userMessage",message:r}),this.isStreaming=!0;let s=(Date.now()+1).toString();this.post({type:"streamStart",id:s});try{this.remoteSessionId||(this.post({type:"status",text:"Connecting to opencode server\u2026"}),this.remoteSessionId=await this.client.createSession(),this.post({type:"status",text:""}));let i="",l=!1,o=e.trim();await this.client.send(this.remoteSessionId,e,this.session.contextFiles,n=>{if(i+=n,!l){if(i.trimStart().startsWith(o)){let c=i.trimStart().slice(o.length).replace(/^\s*\n?/,"");l=!0,i=c,c&&this.post({type:"streamChunk",id:s,chunk:c})}else i.length>=o.length&&(l=!0,this.post({type:"streamChunk",id:s,chunk:i}));return}this.post({type:"streamChunk",id:s,chunk:n})},()=>{this.isStreaming=!1;let n={id:s,role:"assistant",content:i,timestamp:Date.now()};this.session.messages.push(n),this.post({type:"streamEnd",id:s})},n=>{this.isStreaming=!1,this.post({type:"error",message:n}),this.post({type:"streamEnd",id:s})})}catch(i){this.isStreaming=!1,this.post({type:"error",message:String(i)}),this.post({type:"streamEnd",id:s})}}dispose(){this.client.dispose()}getHtml(e){let r=e.asWebviewUri(k.Uri.joinPath(this.context.extensionUri,"media","main.js")),s=Ke();return`<!DOCTYPE html>
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

<script nonce="${s}" src="${r}"></script>
</body>
</html>`}};function Ke(){let t="",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";for(let r=0;r<32;r++)t+=e.charAt(Math.floor(Math.random()*e.length));return t}function Ge(t){let e=new q(t);t.subscriptions.push(S.window.registerWebviewViewProvider("opencode.chatView",e,{webviewOptions:{retainContextWhenHidden:!0}})),t.subscriptions.push(S.commands.registerCommand("opencode.newSession",()=>{e.newSession()})),t.subscriptions.push(S.commands.registerCommand("opencode.addCurrentFile",()=>{let r=S.window.activeTextEditor;if(!r){S.window.showWarningMessage("No active file to add.");return}e.addFileContext(r.document.uri.fsPath)})),t.subscriptions.push(S.commands.registerCommand("opencode.focus",()=>{S.commands.executeCommand("opencode.chatView.focus")}))}function Qe(){}0&&(module.exports={activate,deactivate});
