# Builds the NFT pictures that wallets and explorers show (nft/spirits, nft/badges). MIT, art from Ninja Adventure (CC0).
import json, re, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = lambda s: ImageFont.truetype(os.path.join(ROOT, 'assets/fonts/joystix.ttf'), s)
src = open(os.path.join(ROOT, 'shared/rules.js')).read()
SPECIES = re.findall(r"\{ sprite: '(\w+)', name: '([^']+)', el: (\d), rar: (\d)", src)
EL = [((255,122,60),'FIRE'), ((107,200,255),'WATER'), ((201,240,255),'WIND'), ((217,160,102),'EARTH'), ((142,230,138),'NATURE'), ((185,168,232),'SPIRIT'), ((154,107,217),'DARK')]
RAR = [((138,127,179),'COMMON'), ((143,224,255),'UNCOMMON'), ((255,154,213),'RARE'), ((255,216,107),'LEGENDARY')]
S = 512
def bg(col, shiny=False):
    im = Image.new('RGB', (S, S), (18, 14, 31)); d = ImageDraw.Draw(im)
    for r in range(300, 0, -6):
        a = 1 - r / 300; c = tuple(int(18 + (col[i] - 18) * a * .45) for i in range(3)); d.ellipse((S/2-r, S/2-30-r, S/2+r, S/2-30+r), fill=c)
    return im
def face(name, size):
    f = Image.open(os.path.join(ROOT, 'assets/spirits/f_' + name + '.png')).convert('RGBA')
    bgc = f.getpixel((0, 0)); px = f.load()
    # clear the portrait's dark backdrop, flood-filling from the edges only
    from collections import deque
    seen = set(); q = deque([(x, y) for x in range(f.width) for y in (0, f.height - 1)] + [(x, y) for y in range(f.height) for x in (0, f.width - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < f.width and 0 <= y < f.height): continue
        seen.add((x, y))
        if sum(abs(a - b) for a, b in zip(px[x, y][:3], bgc[:3])) > 24: continue
        px[x, y] = (0, 0, 0, 0); q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return f.resize((size, size), Image.NEAREST)
for sprite, name, el, rar in SPECIES:
    el, rar = int(el), int(rar); col, eln = EL[el]; rc, rn = RAR[rar]
    for shiny in (False, True):
        im = bg(col); d = ImageDraw.Draw(im)
        fc = face(sprite, 304)
        if shiny:
            glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow); gd.ellipse((96, 46, 416, 366), fill=(255, 233, 160, 120))
            im.paste(glow.filter(ImageFilter.GaussianBlur(30)), (0, 0), glow.filter(ImageFilter.GaussianBlur(30)))
        im.paste(fc, ((S - 304) // 2, 50), fc)
        if shiny:
            for (x, y, r) in [(110, 90, 10), (400, 120, 14), (380, 330, 9), (130, 320, 12), (256, 40, 8)]:
                d.polygon([(x, y - r * 2), (x + r / 2, y), (x, y + r * 2), (x - r / 2, y)], fill=(255, 250, 220)); d.polygon([(x - r * 2, y), (x, y + r / 2), (x + r * 2, y), (x, y - r / 2)], fill=(255, 250, 220))
        border = (255, 216, 107) if shiny else rc
        d.rounded_rectangle((8, 8, S - 9, S - 9), radius=28, outline=border, width=10)
        t = ('SHINY ' if shiny else '') + name.upper(); f = F(34 if len(t) < 16 else 26)
        d.text(((S - d.textlength(t, font=f)) / 2, 378), t, font=f, fill=(255, 243, 214))
        sub = f'{eln}  ·  {"SHINY" if shiny else rn}'; f2 = F(20)
        d.text(((S - d.textlength(sub, font=f2)) / 2, 428), sub, font=f2, fill=col)
        f3 = F(14); w = 'LANTERN ISLES · PIXEL BAZAAR'; d.text(((S - d.textlength(w, font=f3)) / 2, 466), w, font=f3, fill=(185, 168, 232))
        im.save(os.path.join(ROOT, 'nft/spirits', sprite + ('_shiny' if shiny else '') + '.png'), optimize=True)
BADGES = dict(re.findall(r"(\w+): '([^']+)'", src[src.index('const BADGES = {'):src.index('};', src.index('const BADGES = {'))]))
ICON = {'first_harvest': 'Mushroom', 'green_thumb': 'Bamboo', 'jade_hunter': 'Mole', 'angler': 'Octopus', 'x10_survivor': 'Flam2', 'faded_rita': 'Snake2', 'beat_kaito': 'GoldRacoon',
        'debt_free': 'Racoon', 'early_bird': 'Owl', 'restorer': 'KappaGreen', 'best_friend': 'Spirit', 'first_spirit': 'Spirit', 'spirit_tamer': 'LanternGreen', 'shiny_hunter': 'Butterfly',
        'legend_tamer': 'GiantSpirit', 'wallet_linked': 'Eye', 'lantern_seeker': 'LanternRed', 'lantern_keeper': 'Dragon', 'spirit_champion': 'Spirit2', 'fishing_legend': 'Legend4', 'stall_owner': 'GoldRacoon', 'bazaar_keeper': 'Dragon', 'island_oracle': 'Eye2', 'boss_slayer': 'DragonYellow'}
for key, title in BADGES.items():
    im = bg((255, 216, 107)); d = ImageDraw.Draw(im)
    d.ellipse((76, 36, 436, 396), fill=(255, 216, 107)); d.ellipse((96, 56, 416, 376), fill=(42, 35, 70))
    fc = face(ICON.get(key, 'Spirit'), 228); im.paste(fc, (142, 102), fc)
    d.rounded_rectangle((8, 8, S - 9, S - 9), radius=28, outline=(255, 216, 107), width=10)
    t = title.upper(); f = F(26 if len(t) < 20 else 20)
    d.text(((S - d.textlength(t, font=f)) / 2, 414), t, font=f, fill=(255, 243, 214))
    f3 = F(14); w = 'BADGE · PIXEL BAZAAR ON NEAR'; d.text(((S - d.textlength(w, font=f3)) / 2, 462), w, font=f3, fill=(185, 168, 232))
    im.save(os.path.join(ROOT, 'nft/badges', key + '.png'), optimize=True)
print(len(SPECIES), 'spirits', len(BADGES), 'badges')

# legendary fish
LEG = re.findall(r"\{ name: '([^']+)', chance: \d+, tint: '#(\w{6})'", src)
os.makedirs(os.path.join(ROOT, 'nft/fish'), exist_ok=True)
for k, (name, tint) in enumerate(LEG):
    col = tuple(int(tint[i:i + 2], 16) for i in (0, 2, 4))
    im = bg(col); d = ImageDraw.Draw(im)
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow); gd.ellipse((96, 46, 416, 366), fill=col + (110,))
    im.paste(glow.filter(ImageFilter.GaussianBlur(34)), (0, 0), glow.filter(ImageFilter.GaussianBlur(34)))
    fc = face('Legend%d' % k, 304); im.paste(fc, ((S - 304) // 2, 50), fc)
    d.rounded_rectangle((8, 8, S - 9, S - 9), radius=28, outline=(255, 216, 107), width=10)
    t = name.upper(); f = F(34 if len(t) < 14 else 28)
    d.text(((S - d.textlength(t, font=f)) / 2, 378), t, font=f, fill=(255, 243, 214))
    f2 = F(16); sub = 'LEGENDARY FISH · ONE OF ONE'; d.text(((S - d.textlength(sub, font=f2)) / 2, 428), sub, font=f2, fill=col)
    f3 = F(14); w = 'LANTERN ISLES · PIXEL BAZAAR'; d.text(((S - d.textlength(w, font=f3)) / 2, 466), w, font=f3, fill=(185, 168, 232))
    im.save(os.path.join(ROOT, 'nft/fish', '%d.png' % k), optimize=True)
print(len(LEG), 'fish')

# baron stalls (one per good: tea, honey, carrot, fish, jade)
os.makedirs(os.path.join(ROOT, 'nft/stalls'), exist_ok=True)
def good_icon(gid):
    if gid in ('tea', 'fish', 'honey'): return Image.open(os.path.join(ROOT, 'assets/items', {'tea': 'TeaLeaf', 'fish': 'Fish', 'honey': 'Honey'}[gid] + '.png')).convert('RGBA')
    if gid == 'carrot': return Image.open(os.path.join(ROOT, 'assets/crops/crops.png')).convert('RGBA').crop((64, 0, 80, 16))
    return Image.open(os.path.join(ROOT, 'assets/crops/icons.png')).convert('RGBA').crop((0, 0, 16, 16))
STALLS = [('tea', 'KAITO', (127, 191, 90)), ('honey', 'RITA', (232, 184, 74)), ('carrot', 'GRANNY PELL', (232, 136, 74)), ('fish', 'BOLT-9', (90, 168, 232)), ('jade', 'LUNA', (74, 192, 160))]
for gid, baron, col in STALLS:
    im = bg(col); d = ImageDraw.Draw(im)
    x0, x1, y0 = 96, 416, 70
    for i in range(8):  # striped awning
        d.rectangle((x0 - 16 + i * 44, y0, x0 - 16 + (i + 1) * 44, y0 + 60), fill=col if i % 2 == 0 else (255, 243, 214))
    d.rectangle((x0 - 16, y0 + 60, x1 + 16, y0 + 72), fill=(0, 0, 0))
    d.rectangle((x0, y0 + 72, x0 + 14, 330), fill=(90, 58, 34)); d.rectangle((x1 - 14, y0 + 72, x1, 330), fill=(90, 58, 34))
    d.rectangle((x0 - 10, 262, x1 + 10, 330), fill=(138, 90, 50)); d.rectangle((x0 - 10, 318, x1 + 10, 330), fill=(106, 66, 36))
    ic = good_icon(gid).resize((72, 72), Image.NEAREST)
    for k in range(3): im.paste(ic, (130 + k * 90, 182), ic)
    d.rounded_rectangle((8, 8, S - 9, S - 9), radius=28, outline=(255, 216, 107), width=10)
    t = gid.upper() + ' STALL'; f = F(36); d.text(((S - d.textlength(t, font=f)) / 2, 360), t, font=f, fill=(255, 243, 214))
    sub = 'WON FROM ' + baron; f2 = F(20); d.text(((S - d.textlength(sub, font=f2)) / 2, 414), sub, font=f2, fill=col)
    f3 = F(14); w = 'BARON STALL · PIXEL BAZAAR ON NEAR'; d.text(((S - d.textlength(w, font=f3)) / 2, 462), w, font=f3, fill=(185, 168, 232))
    im.save(os.path.join(ROOT, 'nft/stalls', gid + '.png'), optimize=True)
print(len(STALLS), 'stalls')
