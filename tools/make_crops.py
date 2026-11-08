"""Draw the crop sprites (16x16, 4 growth stages each) and the harvest icons.
Output: assets/crops/crops.png  (rows = crops, cols = stage 0..3, then the harvest icon in col 4)
        assets/crops/apple_tree.png (2x2 tiles: growing, with apples)
All art in this file is original, made for Pixel Bazaar (MIT, like the code)."""
from PIL import Image
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'crops'); os.makedirs(OUT, exist_ok=True)
PAL = {'.': None, 'o': (42,30,23), 'g': (52,112,44), 'G': (96,178,58), 'l': (166,224,90), 'r': (200,40,50), 'R': (255,104,94),
       'y': (246,213,92), 'Y': (255,240,160), 'O': (226,120,40), 'P': (255,176,74), 'p': (100,58,150), 'q': (152,104,214),
       'b': (122,74,42), 's': (88,58,36), 'S': (120,84,56), 'w': (255,255,255), 'k': (60,40,30), 'L': (200,190,225)}
def grid(rows):
    im = Image.new('RGBA', (16, 16))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(16, '.')):
            c = PAL[ch]
            if c: im.putpixel((x, y), c + (255,))
    return im
E = '................'
SEED = [E]*10 + ['....oooooooo....', '...oSSSSSSSSo...', '..oSSsSSSSsSSo..', '..oSSSSSySSSSo..', '...oSSSSSSSSo...', '....oooooooo....']
SPROUT = [E]*6 + ['.......oo.......', '.....ooGGo......', '....oGlGo.oo....', '.....oo.oGlGo...', '.......oGoo.....', '.......oGo......', '....oooooooo....', '...oSSSSSSSSo...', '...oSSSsSSSSo...', '....oooooooo....']
LEAFY = [E]*3 + ['......o..o......', '.....oGooGo.....', '....oGlGoGlGo...', '...oGGlGGGlGGo..', '..oGGGGoGGGGGo..', '...ooGGGGGGoo...', '....oGGoGGGo....', '.....ooGGoo.....', '.......oGo......', '....oooooooo....', '...oSSSSSSSSo...', '...oSsSSSSsSo...', '....oooooooo....']
CROPS = {
 'carrot': [E]*2 + ['.....o.o.o......', '....oGoGoGo.....', '....oGlGlGo.....', '...oGGlGlGGo....', '....oGGGGGo.....', '.....oGGGo......', '....oOPPPOo.....', '...ooOPPPOoo....', '..oSSoOOOoSSo...', '..oSSSoOoSSSo...', '...oSSSoSSSo....', '....oooooooo....', E, E],
 'strawberry': [E]*3 + ['....o..oo..o....', '...oGooGGooGo...', '..oGlGGlGGlGGo..', '..oGGoRRoGGGGo..', '...oRRrRRooRRo..', '..oRyRRyRoRRyRo.', '..oRRrRRoRyRRo..', '...ooRRo.oRRo...', '....oooooooo....', '...oSSSSSSSSo...', '....oooooooo....', E, E],
 'pumpkin': [E]*3 + ['.......oo.......', '......obbo......', '.....oGobGGo....', '..oooGlGoooo....', '.oOPPoOPPoOPo...', 'oOPPPOPPPOPPPo..', 'oOPYPOPYPOPYPo..', 'oOPPPOPPPOPPPo..', 'oOOPPOOPPOOPOo..', '.oOOOOOOOOOOo...', '..oooooooooo....', E, E],
 'tomato': [E] + ['.......o........', '......oGo.......', '.....oGlGo..o...', '..oo.oGGo.oGo...', '.oRRo.oGooGlGo..', 'oRwRRo.oGoGGo...', 'oRRRRooGGo.o....', '.oRRo.oGoooRRo..', '..oo..oGooRwRRo.', '......oGooRRRRo.', '......oGo.oRRo..', '....oooooooo....', '...oSSSSSSSSo...', '....oooooooo....', E],
 'corn': ['......oo........', '.....oGGo.......', '.....oGlo.......', '..o..oGGo..o....', '.oGo.oGGo.oGo...', '.oGGooYyoooGo...', '..oGoYYyYoGo....', '...ooYyYyoo.....', '....oYYyYo......', '....oYyYYo......', '...oGoYyoGo.....', '..oGo.oGo.oGo...', '.......oGo......', '....oooooooo....', '...oSSSSSSSSo...', '....oooooooo....'],
 'eggplant': [E]*3 + ['.....o...o......', '....oGo.oGo.....', '...oGlGoGlGo....', '..oGGGGoGGGGo...', '...oGGoGoGGo....', '....oooGooq.....', '...oqqoGoqqqo...', '..oqqqpooqqqpo..', '..oqpqpo.oqqpo..', '...oppo..oppo...', '....oooooooo....', '...oSSSSSSSSo...', '....oooooooo....'],
}
ICONS = {
 'carrot': ['.........o.o....', '........oGoGo...', '.......oGlGlo...', '......ooGGGo....', '.....oPPoGo.....', '....oPPPPo......', '...oOPPPo.......', '..oOPPPo........', '..oOPPo.........', '.oOPPo..........', '.oOOo...........', '.oOo............', '..o.............', E, E, E],
 'strawberry': [E, '.....o.o.o......', '....oGoGoGo.....', '...ooGGlGGoo....', '..oRRoGGGoRRo...', '.oRRyRRoRRyRRo..', '.oRRRRRyRRRRRo..', '.oRyRRRRRRRyRo..', '.oRRRRyRRRRRRo..', '..oRRRRRRyRRo...', '..oRyRRRRRRRo...', '...oRRRyRRRo....', '....oRRRRRo.....', '.....oRRRo......', '......ooo.......', E],
 'pumpkin': [E, E, '.......oo.......', '......obbo......', '.....oGobGo.....', '..oooooooooooo..', '.oOPPOPPPPOPPOo.', 'oOPPPOPYPPOPPPOo', 'oOPYPOPPPPOPYPOo', 'oOPPPOPPPPOPPPOo', 'oOPPPOPPPPOPPPOo', 'oOOPPOOPPOOPPOOo', '.oOOOOOOOOOOOOo.', '..oooooooooooo..', E, E],
 'tomato': [E, E, '......o.o.......', '.....oGoGo......', '...oooGlGooo....', '..oRRoGGGoRRo...', '.oRwRRoooRRRRo..', '.oRwRRRRRRRRRo..', '.oRRRRRRRRRRRo..', '.oRRRRRRRRRRRo..', '.oRRRRRRRRRRRo..', '..oRrRRRRRRro...', '...oorrrrrroo...', '.....oooooo.....', E, E],
 'corn': ['.........oo.....', '........oGGo....', '.......oYYGo....', '......oYyYYo....', '.....oYYyYo.....', '....oYyYYyo.....', '...oYYyYyo......', '..oYyYYyo.......', '..oYYyYo........', '.oGYyYo.........', '.oGGYo..........', 'oGlGo...........', 'oGGo............', '.oo.............', E, E],
 'eggplant': [E, '..........oo....', '.........oGGo...', '........oGlGo...', '.......oqoGo....', '......oqqqo.....', '.....oqqqqpo....', '....oqqqqqpo....', '...oqqqqqppo....', '..oqqqqqppo.....', '..oqqqqppo......', '..oqqpppo.......', '...oppppo.......', '....oooo........', E, E],
 'apple': [E, E, '.......oo.......', '.......ob.oo....', '.....ooobooGo...', '....oRRRoRGlo...', '...oRwRRRRoo....', '...oRwRRRRRo....', '...oRRRRRRRo....', '...oRRRRRRRo....', '...oRRRRRRro....', '....oRRRRrro....', '.....oorrro.....', '.......ooo......', E, E],
}
names = list(CROPS)
sheet = Image.new('RGBA', (16 * 5, 16 * len(names)))
for r, n in enumerate(names):
    for c, rows in enumerate([SEED, SPROUT, LEAFY, CROPS[n]]):
        sheet.alpha_composite(grid(rows), (c * 16, r * 16))
    sheet.alpha_composite(grid(ICONS[n]), (64, r * 16))
sheet.save(os.path.join(OUT, 'crops.png'))
grid(ICONS['apple']).save(os.path.join(OUT, 'apple_icon.png'))
# apple tree: the Ninja Adventure tree with apples added
nat = Image.open(os.path.join(os.path.dirname(__file__), '..', 'assets', 'tiles', 'TilesetNature.png')).convert('RGBA')
tree = nat.crop((0, 0, 32, 32)); fruit = tree.copy()
for (x, y) in [(7, 6), (14, 4), (21, 7), (10, 12), (18, 13), (24, 11), (5, 15), (15, 9)]:
    for dx, dy, col in [(0, 0, 'r'), (1, 0, 'R'), (0, 1, 'r'), (1, 1, 'r'), (-1, 0, 'o'), (2, 0, 'o'), (0, -1, 'o'), (1, -1, 'o'), (0, 2, 'o'), (1, 2, 'o'), (-1, 1, 'o'), (2, 1, 'o')]:
        fruit.putpixel((x + dx, y + dy), PAL[col] + (255,))
out = Image.new('RGBA', (64, 32)); out.alpha_composite(tree, (0, 0)); out.alpha_composite(fruit, (32, 0))
out.save(os.path.join(OUT, 'apple_tree.png'))
print('crops:', names)

# extra icons: jade, ore, seed bag, heart, empty heart (assets/crops/icons.png, 16px each)
EXTRA = {
 'jade': [E, E, '.......oo.......', '......oGGo......', '.....oGllGo.....', '....oGllGGGo....', '...oGlGGGGGGo...', '..oGGGGGGGGgGo..', '..oGGGGGGGgGGo..', '...oGGGGGgGGo...', '....oGGGgGGo....', '.....oGgGGo.....', '......oGgo......', '.......oo.......', E, E],
 'ore': [E, E, E, '.....oooooo.....', '....okkSSkko....', '...okSkkkSkko...', '..okkkYkkkSkko..', '..okSkkkkYkkko..', '..okkkSkkkkSko..', '..okYkkkSkkkko..', '...okkkkkkYko...', '....oooooooo....', E, E, E, E],
 'seeds': [E, '......oooo......', '.....obbbbo.....', '......oyyo......', '.....oSSSSo.....', '....oSSSSSSo....', '...oSSSySSSSo...', '...oSSSSSSySo...', '...oSySSSSSSo...', '...oSSSSySSSo...', '...oSSSSSSSSo...', '....oSSSSSSo....', '.....oooooo.....', E, E, E],
 'heart': [E, E, E, '...oo....oo.....', '..oRRo..oRRo....', '.oRwRRooRRRRo...', '.oRwRRRRRRRRo...', '.oRRRRRRRRRRo...', '..oRRRRRRRRo....', '...oRRRRRRo.....', '....oRRRRo......', '.....oRRo.......', '......oo........', E, E, E],
 'heart0': [E, E, E, '...LL....LL.....', '..L..L..L..L....', '.L....LL....L...', '.L..........L...', '.L..........L...', '..L........L....', '...L......L.....', '....L....L......', '.....L..L.......', '......LL........', E, E, E],
}
icons = Image.new('RGBA', (16 * len(EXTRA), 16))
for i, k in enumerate(EXTRA): icons.alpha_composite(grid(EXTRA[k]), (i * 16, 0))
icons.save(os.path.join(OUT, 'icons.png'))
print('icons:', list(EXTRA))
