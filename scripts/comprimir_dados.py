# Converte o #dados JSON de um painel em gzip+base64 e troca o leitor pelo do ANPD.
# Uso: python3 scripts/comprimir_dados.py entrada.html saida.html
import sys,re,gzip,base64,json
src,dst=sys.argv[1:3]
t=open(src,encoding='utf-8').read()
m=re.search(r'<script id="dados" type="application/json">(.*?)</script>',t,re.S)
raw=m.group(1).strip(); json.loads(raw)
b64=base64.b64encode(gzip.compress(raw.encode('utf-8'),9,mtime=0)).decode()
t=t[:m.start()]+'<script type="text/plain" id="dados">'+b64+'</script>'+t[m.end():]
def sub(old,new):
    global t
    assert t.count(old)==1,old; t=t.replace(old,new)
sub("<script>\n(function () {\n'use strict';","<script>\n(async function () {\n'use strict';")
sub("const D = JSON.parse(document.getElementById('dados').textContent);",
"""// O pacote vai em gzip e base64: o arquivo cai de ~11,8 MB para ~4,2 MB
async function lerDados() {
  const el = document.getElementById('dados');
  const b64 = el.textContent.trim();
  el.remove();
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
if (typeof DecompressionStream !== 'function') {
  document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">Este navegador é antigo demais para abrir o painel. Atualize o Chrome, o Safari (16.4 ou mais novo) ou o Firefox.</p>');
  return;
}
const D = JSON.parse(await lerDados());""")
open(dst,'w',encoding='utf-8').write(t)
print(len(open(src,'rb').read()),'->',len(t.encode()))
