from PIL import Image
import numpy as np
from collections import deque

im = Image.open('assets/axolotl.webp').convert('RGBA')
a = np.array(im).astype(np.int16)
h, w, _ = a.shape
r, g, b = a[:,:,0], a[:,:,1], a[:,:,2]
mx = a[:,:,:3].max(axis=2); mn = a[:,:,:3].min(axis=2)
# 棋盤格：接近無彩色（R≈G≈B）且偏亮
bgish = ((mx - mn) < 26) & (mn > 178)
print('候選背景像素比例:', round(bgish.mean()*100,1), '%')

# 從四邊往內 flood fill，只清掉「和外框相連」的部分，蠑螈肚子的白不會被吃掉
vis = np.zeros((h,w), bool)
q = deque()
for x in range(w):
    for y in (0, h-1):
        if bgish[y,x] and not vis[y,x]: vis[y,x]=True; q.append((y,x))
for y in range(h):
    for x in (0, w-1):
        if bgish[y,x] and not vis[y,x]: vis[y,x]=True; q.append((y,x))
while q:
    y,x = q.popleft()
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny,nx = y+dy, x+dx
        if 0<=ny<h and 0<=nx<w and not vis[ny,nx] and bgish[ny,nx]:
            vis[ny,nx]=True; q.append((ny,nx))
print('清掉:', round(vis.mean()*100,1), '%')

out = np.array(im)
out[vis,3] = 0
img = Image.fromarray(out)

# 邊緣再柔一點：半透明像素往內收一格，去掉殘留的灰邊
alpha = np.array(img)[:,:,3]
edge = (alpha > 0)
ys, xs = np.where(edge)
img = img.crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
img.save('assets/axolotl_cut.png')
img.save('assets/axolotl_cut.webp', quality=92, method=6)
import os
for f in ('assets/axolotl_cut.png','assets/axolotl_cut.webp'):
    print(f, round(os.path.getsize(f)/1024,1), 'KB', img.size)
