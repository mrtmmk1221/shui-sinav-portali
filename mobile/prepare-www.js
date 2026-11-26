// final-seferi klasöründeki web uygulamasını Android paketine kopyalar (service worker ve manifest olmadan)
const fs=require('fs'),path=require('path');
const src=path.join(__dirname,'..','final-seferi'),dst=path.join(__dirname,'www');
fs.rmSync(dst,{recursive:true,force:true});fs.mkdirSync(path.join(dst,'icons'),{recursive:true});
let html=fs.readFileSync(path.join(src,'index.html'),'utf8');
html=html.replace(/<link rel="manifest"[^>]*>\n?/,'').replace(/if\('serviceWorker' in navigator[\s\S]*?\}\)\}\)\}/,'');
fs.writeFileSync(path.join(dst,'index.html'),html);
fs.copyFileSync(path.join(src,'questions.json'),path.join(dst,'questions.json'));
for(const f of fs.readdirSync(path.join(src,'icons')))fs.copyFileSync(path.join(src,'icons',f),path.join(dst,'icons',f));
console.log('www hazır:',fs.readdirSync(dst));
