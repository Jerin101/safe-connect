"""M1.2 T2 fix: simplify polygons WITHOUT opening gaps or overlaps between neighbours.

Simplifying every polygon on its own moves a shared border differently for each side, which leaves slivers (gaps) and
double cover (overlaps). Here a border shared by two units is cut into an "arc" (the same trick TopoJSON uses), the arc is
simplified ONCE, and both units get the identical simplified arc. Rings with no shared border are simplified on their own.
Python standard library only. Used by tools/build_district_polygons.py.
"""
import math
import m12_polygon_pilot as P


def _mpd(lat):
    return 111320.0 * math.cos(math.radians(lat)), 110574.0


def dp_open(pts, tol_m):
    """Douglas-Peucker on an OPEN line; both end points are always kept."""
    n = len(pts)
    if n <= 2:
        return list(pts)
    mx, my = _mpd(sum(p[1] for p in pts) / n)
    xy = [(p[0] * mx, p[1] * my) for p in pts]
    keep = {0, n - 1}
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = xy[a]; bx, by = xy[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        worst, wi = -1.0, None
        for i in range(a + 1, b):
            px, py = xy[i]
            d = abs(dx * (py - ay) - dy * (px - ax)) / L if L else math.hypot(px - ax, py - ay)
            if d > worst:
                worst, wi = d, i
        if wi is not None and worst > tol_m:
            keep.add(wi); stack.append((a, wi)); stack.append((wi, b))
    return [pts[i] for i in sorted(keep)]


def simplify_shared(units, tol_m):
    """units = {code: [polygon, ...]}, polygon = [ring, hole, ...], ring = closed list of (x, y).
    -> ({code: [polygon, ...]}, stats). Shared borders get one identical simplified arc on both sides."""
    rings = {}                       # rid -> open point list (no closing duplicate)
    for code, polys in units.items():
        for pi, poly in enumerate(polys):
            for ri, ring in enumerate(poly):
                rings[(code, pi, ri)] = list(ring[:-1])
    owners = {}                      # vertex -> set of ring ids that contain it
    for rid, pts in rings.items():
        for p in pts:
            owners.setdefault(p, set()).add(rid)
    arcs_of = {}                     # rid -> list of (canonical key, reversed?) in ring order, or None for a free ring
    arc_pts = {}                     # canonical key -> points (canonical orientation)
    stats = {'rings': len(rings), 'free_rings': 0, 'arcs': 0, 'shared_arcs': 0}
    for rid, pts in rings.items():
        n = len(pts)
        sig = [frozenset(owners[p]) for p in pts]
        junction = [sig[i] != sig[i - 1] or sig[i] != sig[(i + 1) % n] for i in range(n)]
        if not any(junction):
            arcs_of[rid] = None; stats['free_rings'] += 1
            continue
        start = junction.index(True)
        order = [(start + k) % n for k in range(n)]
        cuts = [k for k, i in enumerate(order) if junction[i]]
        lst = []
        for ci, k in enumerate(cuts):
            k2 = cuts[(ci + 1) % len(cuts)]
            seg = [pts[order[j % n]] for j in range(k, (k2 if k2 > k else k2 + n) + 1)]
            fwd = tuple(seg); bwd = tuple(reversed(seg))
            if bwd < fwd:
                key, rev = bwd, True
            else:
                key, rev = fwd, False
            if key in arc_pts:
                stats['shared_arcs'] += 1
            else:
                arc_pts[key] = list(key)
            lst.append((key, rev))
        arcs_of[rid] = lst
    stats['arcs'] = len(arc_pts)
    factor = {key: 1.0 for key in arc_pts}      # tolerance divisor per arc (halved when a ring would cross itself)
    simp = {}

    def arc_simple(key):
        if key not in simp:
            simp[key] = dp_open(arc_pts[key], tol_m / factor[key])
        return simp[key]

    def build(rid):
        lst = arcs_of[rid]
        if lst is None:
            ring = rings[rid] + [rings[rid][0]]
            s = P.douglas_peucker(ring, tol_m)
            return s, None
        pts = []
        for key, rev in lst:
            a = arc_simple(key)
            a = list(reversed(a)) if rev else list(a)
            pts.extend(a[:-1])
        pts.append(pts[0])
        return pts, lst

    out_rings, retried = {}, 0
    for rid in rings:
        for attempt in range(8):
            r, lst = build(rid)
            ok = len(r) >= 4 and abs(P.ring_area(r)) > 0 and P.self_intersections([r], 1) == 0
            if ok or lst is None and attempt >= 3:
                break
            if lst is None:
                break
            for key, _ in lst:                  # make every arc of this ring finer, for both of its neighbours
                factor[key] *= 2; simp.pop(key, None)
            retried += 1
        out_rings[rid] = r
    stats['retried_rings'] = retried
    # a retried arc changed after a neighbour was already built: rebuild every ring from the final arcs
    for rid in rings:
        if arcs_of[rid] is not None:
            out_rings[rid] = build(rid)[0]
    out = {}
    for code, polys in units.items():
        out[code] = [[out_rings[(code, pi, ri)] for ri in range(len(poly))] for pi, poly in enumerate(polys)]
    return out, stats
