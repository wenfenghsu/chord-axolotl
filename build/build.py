# 把 build/ 裡的分段檔組成單一 HTML，並內嵌蠑螈圖
import os, re
parts = ['01_head.html','02_body.html','03_data.js','03_originals.js','04_audio.js','05_game.js','05_media.js','06_ui.js']
d = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(d)
html = ''.join(open(os.path.join(d,p), encoding='utf-8').read() for p in parts)

def rep(a, b, why):
    global html
    assert a in html, 'MISS: ' + why
    html = html.replace(a, b, 1)

# 重複 id：#meter 出現兩次 → 改 class
rep('#meter{height:12px', '.meterbox{height:12px', 'css meter')
rep('<div id="meter" style="margin:12px 0"><div id="meterBar">',
    '<div class="meterbox" style="margin:12px 0"><div id="meterBar">', 'setup meter')
rep('<div id="meter" style="margin-top:10px"><div id="meterBar2"',
    '<div class="meterbox" style="margin-top:10px"><div id="meterBar2"', 'play meter')
rep('<p style="margin-top:8px" class="mono" style="font-size:12px">',
    '<p class="mono" style="margin-top:8px;font-size:12px">', 'dup style')
rep('<label class="sub" style="margin-left:14px"><input type="checkbox" id="clickOn" checked> 節拍器聲音</label>',
    '<label class="sub" style="margin-left:14px" title="用喇叭外放又靠麥克風收音時，節拍器聲會被聽成刷弦，建議戴耳機或關掉">'
    '<input type="checkbox" id="clickOn" checked> 節拍器聲音</label>', 'metronome hint')

b64 = open(os.path.join(root,'assets/axolotl.b64'), encoding='ascii').read().strip()
html = html.replace('__AXO__', 'data:image/webp;base64,' + b64)

out = os.path.join(root, 'index.html')
open(out,'w',encoding='utf-8').write(html)
js = re.search(r'<script>(.*)</script>', html, re.S).group(1)
open(os.path.join(d,'check.js'),'w',encoding='utf-8').write(js)
print('built:', round(os.path.getsize(out)/1024,1), 'KB ·', js.count('\n'), 'lines of JS')
