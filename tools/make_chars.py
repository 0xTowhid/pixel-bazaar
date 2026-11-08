"""Build the character sprite sheets from LPC layers.

Usage: python3 tools/make_chars.py <path-to-Universal-LPC-Spritesheet-Character-Generator>
Writes assets/chars/<name>.png (walk sheet: 9 frames x 4 rows, 64px; rows = up, left, down, right)
and CREDITS-characters.csv with the authors/licenses of every layer used.
"""
import colorsys, csv, os, sys
from PIL import Image

LPC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'chars')
os.makedirs(OUT, exist_ok=True)

# layer = (path under spritesheets, hue or None, saturation, lightness multiplier)
def L(p, h=None, s=.55, l=.85): return (p, h, s, l)

M_BODY = ['body/bodies/male', 'feet/shoes/basic/male']
F_BODY = ['body/bodies/female']
CHARS = {
    'player': M_BODY + [L('legs/pants/male', .6), L('torso/clothes/longsleeve/longsleeve/male', .58), 'head/heads/human/male', L('hair/plain/adult', .08, .45, .55)],
    'mei':    F_BODY + [L('legs/skirts/plain/thin', .9), L('torso/clothes/longsleeve/longsleeve/female', .92), 'head/heads/human/female', L('hair/long/adult', .13, .7, 1.05)],
    'bram':   M_BODY + [L('legs/pants/male', .08), L('torso/clothes/longsleeve/longsleeve/male', .3), 'head/heads/human/male', L('hair/plain/adult', 0, 0, 1.0), L('beards/beard/medium', 0, 0, 1.0)],
    'rita':   F_BODY + [L('legs/skirts/plain/thin', .0), L('torso/clothes/longsleeve/longsleeve2_cardigan/female', .75), 'head/heads/human/female', L('hair/long/adult', .75, .3, .45)],
    'tomo':   M_BODY + [L('legs/pants/male', .1, .3, .6), L('torso/clothes/longsleeve/longsleeve/male', .1, .35, .9), 'head/heads/human/male', L('hair/messy1/adult', .07, .5, .5), L('hat/cloth/bandana/adult', 0, .65, .8)],
    'v1':     F_BODY + [L('legs/skirts/plain/thin', .55), L('torso/clothes/longsleeve/longsleeve/female', .5), 'head/heads/human/female', L('hair/bob/adult', .08, .5, .4)],
    'v2':     M_BODY + [L('legs/pants/male', .12, .25, .55), L('torso/clothes/longsleeve/longsleeve/male', .33, .4, .8), 'head/heads/human/male', L('hair/buzzcut/adult', .1, .3, .35)],
    'sailor': M_BODY + [L('legs/pants/male', .62, .35, .5), L('torso/clothes/longsleeve/longsleeve/male', .6, .1, 1.1), 'head/heads/human/male', L('beards/beard/basic', .08, .4, .45), L('hat/pirate/bandana/adult', .62, .6, .7)],
    'farmer': M_BODY + [L('legs/pants/male', .09, .45, .55), L('torso/clothes/longsleeve/longsleeve/male', .2, .45, .85), 'head/heads/human/male', L('hair/plain/adult', .1, .5, .6), L('hat/cloth/leather_cap/adult', .11, .5, .8)],
    'hermit': M_BODY + [L('legs/pants/male', .55, .15, .6), L('torso/clothes/longsleeve/longsleeve/male', .55, .25, .7), 'head/heads/human/male', L('beards/beard/medium', 0, 0, 1.15), L('hat/cloth/hood/adult', .55, .3, .75)],
    'seer':   F_BODY + [L('legs/skirts/plain/thin', .78, .5, .5), L('torso/clothes/longsleeve/longsleeve/female', .78, .5, .55), 'head/heads/human/female', L('hair/long/adult', 0, 0, .3), L('hat/cloth/hood/adult', .8, .55, .5)],
    'kaito':  M_BODY + [L('legs/pants/male', 0, 0, .3), L('torso/clothes/longsleeve/formal/male', .13, .75, .9), 'head/heads/human/male', L('hair/plain/adult', 0, 0, .25), L('hat/formal/tophat/adult', .13, .8, .7)],
    'master': M_BODY + [L('legs/pants/male', 0, 0, .35), L('torso/clothes/longsleeve/longsleeve/male', 0, 0, .4), 'head/heads/human/male', L('beards/beard/medium', .08, .2, .7), L('hat/formal/tophat/adult', 0, 0, .3)],
}

def load(path, hue, sat, lm):
    im = Image.open(os.path.join(LPC, 'spritesheets', path, 'walk.png')).convert('RGBA')
    if hue is not None:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a:
                    _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                    rr, gg, bb = colorsys.hls_to_rgb(hue, min(1, l * lm), sat)
                    px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return im

used = set()
for name, layers in CHARS.items():
    sheet = Image.new('RGBA', (576, 256))
    for layer in layers:
        p, h, s, l = layer if isinstance(layer, tuple) else (layer, None, 0, 1)
        sheet.alpha_composite(load(p, h, s, l))
        used.add(p + '/walk.png')
    sheet.save(os.path.join(OUT, name + '.png'))

with open(os.path.join(LPC, 'CREDITS.csv'), newline='') as f, \
     open(os.path.join(os.path.dirname(__file__), '..', 'CREDITS-characters.csv'), 'w', newline='') as o:
    r = csv.reader(f); w = csv.writer(o)
    w.writerow(next(r))
    for row in r:
        if row and row[0].strip() in used: w.writerow([c.strip() for c in row])
print('built', list(CHARS), 'from', len(used), 'layers')
