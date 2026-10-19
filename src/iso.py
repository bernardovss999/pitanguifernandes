#!/usr/bin/env python3
"""Ilustrações isométricas do site (mesmo ângulo de 30° do monograma).
Gera SVGs com traço fino marinho, faces em três tons e cotas técnicas."""
import math, json, os

C, S = math.cos(math.radians(30)), 0.5
INK = '#0C2448'

# tons: topo / face da frente (y máx) / face da direita (x máx)
T_WALL = ('#FFFFFF', '#EDF0F5', '#D8DEE8')
T_SLAB = ('#FFFFFF', '#E6EAF0', '#D5DBE4')
T_PAVE = ('#F7F8FA', '#E9ECF1', '#DCE1E8')
T_GLASS = '#C9D7E5'
T_WOOD = ('#E8DCCB', '#D9C8B0', '#CBB89D')
T_EQUIP = ('#F4F6F9', '#E1E6EE', '#C9D1DD')
GRASS = '#E4EAE2'
LEAF = ('#D6DFD3', '#C9D4C5')
WATER = '#D3E1EC'

class Scene:
    def __init__(self, s=22):
        self.s = s
        self.out = []          # (grupo, svg)
        self.group = None
        self.pts = []
        self.order = []
    # projeção
    def p(self, x, y, z=0):
        X, Y = (x - y) * C * self.s, (x + y) * S * self.s - z * self.s
        self.pts.append((X, Y))
        return X, Y
    def fmt(self, pts):
        return ' '.join('%.1f,%.1f' % q for q in pts)
    def add(self, svg):
        self.out.append((self.group, svg))
    def poly(self, pts3, fill, line=True, extra=''):
        pts = [self.p(*q) for q in pts3]
        self.add('<polygon points="%s" fill="%s"%s%s/>' % (self.fmt(pts), fill, ' class="ln"' if line else '', extra))
    def line(self, a, b, cls='ln'):
        (x1, y1), (x2, y2) = self.p(*a), self.p(*b)
        self.add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" class="%s"/>' % (x1, y1, x2, y2, cls))
    def path(self, pts3, cls='ln', closed=False):
        pts = [self.p(*q) for q in pts3]
        d = 'M' + ' L'.join('%.1f %.1f' % q for q in pts) + (' Z' if closed else '')
        self.add('<path d="%s" class="%s" fill="none"/>' % (d, cls))
    # sólidos
    def box(self, x0, x1, y0, y1, z0, z1, tones=T_WALL, top=True):
        t, f, r = tones
        self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], r)   # direita
        self.poly([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], f)   # frente
        if top: self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], t)
    def top(self, x0, x1, y0, y1, z, fill, line=True):
        self.poly([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], fill, line)
    def front_rect(self, y, x0, x1, z0, z1, fill, line=True):
        self.poly([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], fill, line)
    def right_rect(self, x, y0, y1, z0, z1, fill, line=True):
        self.poly([(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], fill, line)
    def circle_pts(self, cx, cy, cz, r, plane='xy', n=40):
        o = []
        for i in range(n):
            a = 2 * math.pi * i / n
            if plane == 'xy': o.append((cx + r * math.cos(a), cy + r * math.sin(a), cz))
            elif plane == 'xz': o.append((cx + r * math.cos(a), cy, cz + r * math.sin(a)))
            else: o.append((cx, cy + r * math.cos(a), cz + r * math.sin(a)))
        return o
    def cylinder(self, cx, cy, r, z0, z1, side='#E1E6EE', top='#F7F8FA'):
        bot = [self.p(*q) for q in self.circle_pts(cx, cy, z0, r)]
        tp = [self.p(*q) for q in self.circle_pts(cx, cy, z1, r)]
        hull = convex_hull(bot + tp)
        self.add('<polygon points="%s" fill="%s" class="ln"/>' % (self.fmt(hull), side))
        self.add('<polygon points="%s" fill="%s" class="ln"/>' % (self.fmt(tp), top))
    def disc(self, cx, cy, cz, r, fill, plane='xy', cls='ln'):
        pts = [self.p(*q) for q in self.circle_pts(cx, cy, cz, r, plane)]
        self.add('<polygon points="%s" fill="%s" class="%s"/>' % (self.fmt(pts), fill, cls))
    def blob(self, cx, cy, cz, r, fill):
        """copa de árvore / arbusto: círculo de tela (sempre redondo, como no desenho à mão)"""
        X, Y = self.p(cx, cy, cz)
        self.pts += [(X - r * self.s, Y - r * self.s), (X + r * self.s, Y + r * self.s)]
        self.add('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" class="ln"/>' % (X, Y, r * self.s, fill))
    def svg(self, pad=18, cls='', label='', extra_defs=''):
        xs = [q[0] for q in self.pts]; ys = [q[1] for q in self.pts]
        x0, y0, x1, y1 = min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad
        body, cur = [], None
        for g, s in self.out:
            if g != cur:
                if cur is not None: body.append('</g>')
                if g is not None: body.append('<g data-sys="%s" style="--k:%d">' % (g, self.order.index(g) + 1 if g in self.order else 0))
                else: body.append('<g class="base">')
                cur = g
            body.append(s)
        body.append('</g>')
        self.vb = (x0, y0, x1 - x0, y1 - y0)
        role = ('role="img" aria-label="%s"' % label) if label else 'aria-hidden="true"'
        return ('<svg class="%s" viewBox="%.0f %.0f %.0f %.0f" %s>%s\n%s\n</svg>'
                % (cls, x0, y0, x1 - x0, y1 - y0, role, extra_defs, '\n'.join(body)))
    def rel(self, x, y, z):
        """posição relativa (%) de um ponto do mundo dentro da viewBox"""
        X, Y = (x - y) * C * self.s, (x + y) * S * self.s - z * self.s
        vx, vy, vw, vh = self.vb
        return round((X - vx) / vw * 100, 2), round((Y - vy) / vh * 100, 2)

def convex_hull(points):
    pts = sorted(set((round(a, 2), round(b, 2)) for a, b in points))
    if len(pts) <= 2: return pts
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for q in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]

def cota(sc, a, b, off, tick=0.35):
    """linha de cota entre a e b, deslocada por off (vetor no mundo)"""
    A = tuple(a[i] + off[i] for i in range(3)); Bp = tuple(b[i] + off[i] for i in range(3))
    sc.line(a, A, 'ct'); sc.line(b, Bp, 'ct'); sc.line(A, Bp, 'ct')
    # traços a 45° nas pontas, como em prancha de arquitetura
    for P in (A, Bp):
        sc.line((P[0] - tick, P[1] - tick, P[2]), (P[0] + tick, P[1] + tick, P[2]), 'ct')

# ======================================================================= CASA
SYS = [
 # id, rótulo, grupo de planos, ponto do mundo (x, y, z)
 ('eletrica', 'Elétrica', 'todos', (14.0, 6.7, 1.5)),
 ('hidraulica', 'Hidráulica', 'todos', (14.0, 7.9, 0.6)),
 ('ar-condicionado', 'Ar-condicionado', 'todos', (12.4, 3.0, 4.1)),
 ('bombas', 'Bombas', 'todos', (11.9, 12.4, 0.7)),
 ('gas', 'Gás', 'todos', (1.2, 13.3, 1.5)),
 ('piscina', 'Piscina', 'premium', (7.2, 12.2, -0.4)),
 ('jardim', 'Jardim', 'premium', (18.4, 5.2, 4.0)),
 ('automacao', 'Automação', 'premium', (13.0, 8.5, 1.5)),
 ('seguranca', 'Segurança eletrônica', 'premium', (10.5, 9.5, 6.1)),
 ('cobertura', 'Cobertura e caixa d’água', 'periodica', (8.6, 4.2, 7.7)),
 ('esquadrias', 'Esquadrias', 'periodica', (6.5, 9.5, 4.9)),
 ('areas-externas', 'Áreas externas', 'periodica', (12.0, 14.2, 0.05)),
]

def house():
    sc = Scene(22)
    sc.order = [i for i, *_ in SYS]
    W, D = 22, 15.5
    # lote como maquete: laje com grade de prancheta
    sc.group = None
    sc.box(0, W, 0, D, -0.6, 0, T_SLAB)
    for i in range(1, int(W)):
        sc.line((i, 0, 0), (i, D, 0), 'gr')
    for j in range(1, int(D)):
        sc.line((0, j, 0), (W, j, 0), 'gr')
    # gramado
    sc.group = 'jardim'
    sc.top(15.4, 21.6, 0.4, 15.1, 0.02, GRASS)
    sc.top(0.4, 2.6, 0.4, 11.4, 0.02, GRASS)
    # caminho de pedras até a porta
    sc.group = 'areas-externas'
    for k in range(6):
        y0 = 9.2 + k * 1.05
        sc.box(11.3, 12.7, y0, y0 + 0.75, 0, 0.08, T_PAVE)
    # muros do fundo
    sc.box(0, W, 0, 0.3, 0, 1.6, T_PAVE)
    sc.box(0, 0.3, 0.3, D, 0, 1.6, T_PAVE)
    # arbustos junto ao muro
    sc.group = 'jardim'
    for (x, y, r) in [(16.4, 1.1, .7), (17.6, 1.0, .55), (20.6, 1.2, .75), (1.3, 3.0, .6), (1.4, 6.6, .7), (1.2, 9.6, .55)]:
        sc.blob(x, y, 0.55, r, LEAF[1])
    # botijões de gás
    sc.group = 'gas'
    sc.box(0.6, 2.0, 12.4, 14.4, 0, 0.1, T_PAVE)
    for cy in (12.95, 13.85):
        sc.cylinder(1.25, cy, 0.38, 0.1, 1.35, '#E4E8EF', '#F7F8FA')
    # piscina rebaixada
    sc.group = 'piscina'
    px0, px1, py0, py1, dep = 3.4, 10.6, 10.6, 14.2, 1.1
    sc.top(px0 - .45, px1 + .45, py0 - .45, py1 + .45, 0.03, '#FBFAF7')
    sc.poly([(px0, py0, 0), (px1, py0, 0), (px1, py0, -dep), (px0, py0, -dep)], '#E3EDF2')   # parede do fundo
    sc.poly([(px0, py0, 0), (px0, py1, 0), (px0, py1, -dep), (px0, py0, -dep)], '#D7E5EC')   # parede lateral
    sc.top(px0, px1, py0, py1, -dep + 0.25, WATER)
    for k in range(3):   # reflexos
        y = py0 + 0.9 + k * 0.9
        sc.line((px0 + 1.2 + k * .8, y, -dep + .25), (px0 + 3.0 + k * .8, y, -dep + .25), 'wv')
    # bomba da piscina
    sc.group = 'bombas'
    sc.box(11.3, 12.5, 12.0, 12.9, 0, 0.7, T_EQUIP)
    sc.disc(11.9, 12.9, 0.38, 0.22, '#F7F8FA', 'xz')
    sc.path([(11.3, 12.45, 0.35), (10.6, 12.45, 0.35)], 'ln')
    # térreo
    sc.group = None
    A = (3, 14, 2, 8.5, 0, 3.2)
    sc.box(*A)
    # sombra do balanço sobre a fachada
    sc.front_rect(8.5, 3, 10.5, 2.55, 3.2, '#D4DBE5', False)
    # porta de entrada (madeira) e fechadura digital
    sc.front_rect(8.5, 11.4, 12.6, 0, 2.6, T_WOOD[1])
    sc.line((12.35, 8.5, 1.1), (12.35, 8.5, 1.5))
    sc.group = 'automacao'
    sc.front_rect(8.5, 12.85, 13.25, 1.15, 1.75, '#2A3D5C')
    sc.group = 'esquadrias'
    # portas de vidro do térreo
    sc.front_rect(8.5, 3.8, 10.0, 0.15, 2.45, T_GLASS)
    for x in (5.35, 6.9, 8.45):
        sc.line((x, 8.5, 0.15), (x, 8.5, 2.45))
    sc.line((4.4, 8.5, 0.5), (5.1, 8.5, 2.1), 'rf'); sc.line((7.3, 8.5, 0.6), (8.1, 8.5, 2.2), 'rf')
    # janela lateral do térreo
    sc.right_rect(14, 2.8, 5.4, 0.9, 2.5, T_GLASS)
    sc.line((14, 4.1, 0.9), (14, 4.1, 2.5))
    # quadro elétrico na lateral
    sc.group = 'eletrica'
    sc.box(14, 14.18, 6.2, 7.2, 0.9, 2.1, T_EQUIP)
    sc.line((14.18, 6.45, 1.7), (14.18, 6.95, 1.7)); sc.line((14.18, 6.45, 1.4), (14.18, 6.95, 1.4))
    # registro e tubulação
    sc.group = 'hidraulica'
    sc.path([(14.02, 7.9, 3.2), (14.02, 7.9, 0.0)], 'pp')
    sc.disc(14.02, 7.9, 0.75, 0.2, '#FFFFFF', 'yz')
    # pavimento superior em balanço
    sc.group = None
    B = (2.5, 10.5, 2, 9.5, 3.2, 6.4)
    sc.box(*B, top=False)
    sc.group = 'cobertura'
    sc.top(2.5, 10.5, 2, 9.5, 6.4, '#FFFFFF')
    sc.top(2.85, 10.15, 2.35, 9.15, 6.4, '#F4F6F9')   # platibanda
    sc.group = 'esquadrias'
    sc.front_rect(9.5, 3.3, 9.7, 4.15, 5.65, T_GLASS)
    for x in (4.9, 6.5, 8.1):
        sc.line((x, 9.5, 4.15), (x, 9.5, 5.65))
    sc.line((3.7, 9.5, 4.3), (4.4, 9.5, 5.5), 'rf'); sc.line((6.9, 9.5, 4.3), (7.6, 9.5, 5.5), 'rf')
    sc.right_rect(10.5, 3.2, 7.6, 4.1, 5.7, T_GLASS)
    sc.line((10.5, 5.4, 4.1), (10.5, 5.4, 5.7))
    # condensadoras de ar no terraço
    sc.group = 'ar-condicionado'
    for x0 in (11.1, 12.6):
        sc.box(x0, x0 + 1.2, 2.5, 3.35, 3.2, 4.15, T_EQUIP)
        sc.disc(x0 + 0.6, 3.35, 3.67, 0.33, '#F7F8FA', 'xz')
        sc.line((x0 + 0.27, 3.35, 3.67), (x0 + 0.93, 3.35, 3.67))
    # guarda-corpo do terraço (vidro)
    sc.group = 'esquadrias'
    sc.poly([(10.5, 8.5, 3.2), (14, 8.5, 3.2), (14, 8.5, 4.1), (10.5, 8.5, 4.1)], 'rgba(201,215,229,.55)')
    sc.poly([(14, 2, 3.2), (14, 8.5, 3.2), (14, 8.5, 4.1), (14, 2, 4.1)], 'rgba(201,215,229,.45)')
    # caixa d'água
    sc.group = 'cobertura'
    sc.box(7.7, 9.5, 3.3, 5.1, 6.4, 6.65, T_EQUIP)
    sc.cylinder(8.6, 4.2, 0.78, 6.65, 7.75, '#E4E8EF', '#F7F8FA')
    # câmera na quina
    sc.group = 'seguranca'
    sc.box(10.5, 10.75, 9.2, 9.5, 5.75, 6.05, T_EQUIP)
    sc.box(10.75, 11.15, 9.25, 9.55, 5.82, 6.0, ('#F7F8FA', '#2A3D5C', '#1E2F4B'))
    # árvores
    sc.group = 'jardim'
    for (x, y, h, r) in [(18.4, 5.2, 1.5, 1.9), (20.0, 11.2, 1.1, 1.4), (16.6, 13.7, 0.8, 1.0)]:
        sc.disc(x + .35, y - .2, 0.03, r * .78, '#CBD6BE', 'xy', 'none')   # sombra no gramado
        sc.line((x, y, 0), (x, y, h + r * .3), 'tk')
        sc.blob(x, y, h + r * .85, r, LEAF[0])
        X, Y = sc.p(x, y, h + r * .85)
        sc.add('<path d="M%.1f %.1f a%.1f %.1f 0 0 1 %.1f %.1f" class="hl" fill="none"/>' % (X - r * sc.s * .55, Y - r * sc.s * .2, r * sc.s * .6, r * sc.s * .6, r * sc.s * .45, -r * sc.s * .5))
    # cotas
    sc.group = None
    cota(sc, (0, D, -0.6), (W, D, -0.6), (0, 1.3, 0))
    cota(sc, (W, 0, -0.6), (W, D, -0.6), (1.3, 0, 0))
    cota(sc, (W, 0, -0.6), (W, 0, 7.75), (1.3, -1.3, 0))
    svg = sc.svg(pad=20, cls='house-art', label='Desenho de uma casa com os doze sistemas acompanhados pela Pitangui Fernandes')
    pts = [{'id': i, 'label': l, 'grupo': g, 'x': sc.rel(*w)[0], 'y': sc.rel(*w)[1]} for i, l, g, w in SYS]
    return svg, pts

# ======================================================================= PILARES (Governança)
def pillars():
    sc = Scene(24)
    sc.order = ['c0', 'c1', 'c2', 'c3', 'laje', 'casa']
    sc.box(0, 14, 0, 9, -0.5, 0, T_SLAB)
    for i in range(1, 14): sc.line((i, 0, 0), (i, 9, 0), 'gr')
    for j in range(1, 9): sc.line((0, j, 0), (14, j, 0), 'gr')
    cols = [(2.2, 2.0), (11.0, 2.0), (2.2, 6.2), (11.0, 6.2)]
    H = 5.2
    for k, (x, y) in enumerate(sorted(cols, key=lambda q: q[0] + q[1])):
        sc.group = 'c%d' % k
        sc.box(x, x + 0.9, y, y + 0.9, 0, H)
    sc.group = 'laje'
    sc.box(1.4, 12.7, 1.2, 7.9, H, H + 0.55)
    # casa sobre a laje
    sc.group = 'casa'
    sc.box(4.2, 9.8, 2.6, 6.4, H + 0.55, H + 3.0)
    sc.poly([(4.2, 6.4, H + 3.0), (9.8, 6.4, H + 3.0), (9.8, 4.5, H + 4.6), (4.2, 4.5, H + 4.6)], '#EDF0F5')
    sc.poly([(9.8, 2.6, H + 3.0), (9.8, 6.4, H + 3.0), (9.8, 4.5, H + 4.6)], '#D8DEE8')
    sc.front_rect(6.4, 5.0, 6.4, H + 0.55, H + 2.2, T_WOOD[1])
    sc.front_rect(6.4, 7.2, 9.0, H + 1.3, H + 2.3, T_GLASS)
    sc.group = None
    cota(sc, (14, 0, -0.5), (14, 0, H + 0.55), (1.2, -1.2, 0))
    return sc.svg(pad=16, cls='iso-art', label='Quatro pilares sustentam a casa')

# ======================================================================= ESCADA (Método)
def stairs():
    sc = Scene(24)
    sc.order = ['s0', 's1', 's2', 's3', 'trilha']
    sc.box(0, 13, 0, 7, -0.5, 0, T_SLAB)
    for i in range(1, 13): sc.line((i, 0, 0), (i, 7, 0), 'gr')
    for j in range(1, 7): sc.line((0, j, 0), (13, j, 0), 'gr')
    for k in range(4):
        sc.group = 's%d' % k
        x0 = 1 + k * 2.8
        sc.box(x0, x0 + 2.6, 1.2, 5.8, 0, 1.0 + k * 1.15)
    sc.group = 'trilha'
    # trilha tracejada subindo os degraus
    pts = []
    for k in range(4):
        x0 = 1 + k * 2.8; z = 1.0 + k * 1.15
        pts += [(x0 + 0.4, 3.5, z), (x0 + 2.2, 3.5, z)]
    sc.path(pts, 'tr')
    # marco no topo
    sc.cylinder(10.7, 3.5, 0.32, 4.45, 4.6, '#9C3B2E', '#B5503F')
    sc.group = None
    cota(sc, (13, 0, -0.5), (13, 0, 4.45), (1.2, -1.2, 0))
    return sc.svg(pad=16, cls='iso-art', label='Quatro degraus: conversa, diagnóstico, plano e rotina')

# ======================================================================= CONTRATO (Compromissos)
def contract():
    sc = Scene(24)
    sc.order = ['folhas', 'texto', 'selo', 'caneta']
    sc.box(0, 13, 0, 9, -0.5, 0, T_SLAB)
    for i in range(1, 13): sc.line((i, 0, 0), (i, 9, 0), 'gr')
    for j in range(1, 9): sc.line((0, j, 0), (13, j, 0), 'gr')
    # folhas empilhadas
    sc.group = 'folhas'
    sc.box(2.6, 9.4, 1.0, 8.4, 0, 0.12, ('#FFFFFF', '#EDF0F5', '#D8DEE8'))
    sc.box(2.3, 9.1, 0.8, 8.2, 0.12, 0.24, ('#FFFFFF', '#EDF0F5', '#D8DEE8'))
    z = 0.24
    sc.group = 'texto'
    sc.line((3.0, 1.5, z), (7.4, 1.5, z), 'tx2')
    for k in range(6):
        y = 2.4 + k * 0.95
        sc.line((3.0, y, z), (3.4, y, z), 'tx2')
        sc.line((3.8, y, z), (8.2, y, z), 'tx')
        sc.line((3.8, y + .35, z), (7.0, y + .35, z), 'tx')
    # selo com o monograma
    sc.group = 'selo'
    sc.disc(7.6, 7.3, z, 0.75, '#9C3B2E', 'xy', 'ln')
    sc.disc(7.6, 7.3, z, 0.55, 'none', 'xy', 'sl')
    # caneta
    sc.group = 'caneta'
    sc.box(9.9, 12.6, 2.2, 2.52, 0, 0.3, ('#3A4E70', '#0C2448', '#071B36'))
    sc.poly([(9.9, 2.2, 0.3), (9.9, 2.52, 0.3), (9.4, 2.36, 0.15)], '#C9D1DD')
    sc.group = None
    cota(sc, (13, 0, -0.5), (13, 9, -0.5), (1.2, 0, 0))
    return sc.svg(pad=16, cls='iso-art', label='Contrato com seis cláusulas e o selo da Pitangui Fernandes')

if __name__ == '__main__':
    B = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(B, 'art'), exist_ok=True)
    hs, pts = house()
    open(os.path.join(B, 'art', 'house.svg'), 'w').write(hs)
    json.dump(pts, open(os.path.join(B, 'art', 'house.json'), 'w'), ensure_ascii=False, indent=1)
    open(os.path.join(B, 'art', 'pillars.svg'), 'w').write(pillars())
    open(os.path.join(B, 'art', 'stairs.svg'), 'w').write(stairs())
    open(os.path.join(B, 'art', 'contract.svg'), 'w').write(contract())
    print('ok', len(hs))
