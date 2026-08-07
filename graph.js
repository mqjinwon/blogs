/* Interactive backlink map on every post — smooth drag via attribute updates */
(function () {
  function currentPostId() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const m = path.match(/\/posts\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function dataUrl() {
    return new URL("../../data/posts.json", window.location.href).href;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shortTitle(title, n) {
    n = n || 22;
    const t = String(title || "");
    return t.length <= n ? t : t.slice(0, n - 1) + "…";
  }

  function hrefFor(id) {
    return "../" + encodeURIComponent(id) + "/";
  }

  function buildEdges(posts) {
    const byId = {};
    posts.forEach(function (p) {
      byId[p.id] = p;
    });
    const edgeMap = {};

    function add(a, b, kind, w) {
      if (!a || !b || a === b || !byId[a] || !byId[b]) return;
      const lo = a < b ? a : b;
      const hi = a < b ? b : a;
      const key = lo + "||" + hi;
      if (!edgeMap[key]) edgeMap[key] = { source: lo, target: hi, kinds: {}, weight: 0 };
      edgeMap[key].kinds[kind] = true;
      edgeMap[key].weight += w;
    }

    posts.forEach(function (p) {
      (p.related || []).forEach(function (rid) {
        add(p.id, rid, "related", 3);
      });
    });

    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const a = posts[i];
        const b = posts[j];
        const ta = new Set(a.tags || []);
        let shared = 0;
        (b.tags || []).forEach(function (t) {
          if (ta.has(t)) shared++;
        });
        if (shared > 0) add(a.id, b.id, "tag", shared);
        if (a.venue && b.venue && a.venue === b.venue) add(a.id, b.id, "venue", 1);
      }
    }

    return Object.keys(edgeMap).map(function (k) {
      const e = edgeMap[k];
      return {
        source: e.source,
        target: e.target,
        weight: e.weight,
        kinds: Object.keys(e.kinds),
      };
    });
  }

  function localSubgraph(posts, edges, focusId) {
    const neighbor = {};
    neighbor[focusId] = true;
    edges.forEach(function (e) {
      if (e.source === focusId) neighbor[e.target] = true;
      if (e.target === focusId) neighbor[e.source] = true;
    });
    return {
      nodes: posts.filter(function (p) {
        return neighbor[p.id];
      }),
      edges: edges.filter(function (e) {
        return neighbor[e.source] && neighbor[e.target];
      }),
    };
  }

  function svgPoint(svgEl, clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function run(posts, focusId) {
    const host = document.getElementById("post-graph-root");
    if (!host || !focusId) return;

    const focus = posts.find(function (p) {
      return p.id === focusId;
    });
    if (!focus) {
      host.hidden = true;
      return;
    }

    host.innerHTML =
      '<div class="post-graph">' +
      '  <h2 class="post-graph-title">Linked</h2>' +
      '  <div class="post-graph-wrap">' +
      '    <svg class="post-graph-svg" id="post-graph-svg"></svg>' +
      "  </div>" +
      '  <ul class="post-graph-list" id="post-graph-list"></ul>' +
      "</div>";

    const svg = document.getElementById("post-graph-svg");
    const listEl = document.getElementById("post-graph-list");
    const allEdges = buildEdges(posts);
    const sub = localSubgraph(posts, allEdges, focusId);

    const neighbors = sub.nodes.filter(function (p) {
      return p.id !== focusId;
    });
    if (neighbors.length === 0) {
      listEl.innerHTML = "";
      listEl.hidden = true;
    } else {
      listEl.hidden = false;
      listEl.innerHTML = neighbors
        .map(function (p) {
          return (
            "<li><a href=\"" +
            esc(hrefFor(p.id)) +
            '">' +
            esc(p.title) +
            "</a></li>"
          );
        })
        .join("");
    }

    const width = svg.clientWidth || (svg.parentElement && svg.parentElement.clientWidth) || 900;
    const height = 280;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", String(height));

    const NS = "http://www.w3.org/2000/svg";
    const nodes = sub.nodes.map(function (p, i) {
      const n = sub.nodes.length;
      const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
      const r0 = n <= 1 ? 0 : Math.min(width, height) * 0.28;
      return {
        id: p.id,
        title: p.title,
        isFocus: p.id === focusId,
        isPaper: !!p.is_paper,
        r: p.id === focusId ? 9 : 6,
        x: width / 2 + r0 * Math.cos(angle),
        y: height / 2 + r0 * Math.sin(angle),
        vx: 0,
        vy: 0,
        el: null,
        circle: null,
        text: null,
      };
    });
    const nodeById = {};
    nodes.forEach(function (n) {
      nodeById[n.id] = n;
    });
    const edges = sub.edges.map(function (e) {
      return {
        source: e.source,
        target: e.target,
        weight: e.weight,
        kinds: e.kinds,
        line: null,
      };
    });

    // Build DOM once
    const edgeLayer = document.createElementNS(NS, "g");
    const nodeLayer = document.createElementNS(NS, "g");
    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    edges.forEach(function (e) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute(
        "class",
        "post-graph-edge" + (e.kinds.indexOf("related") >= 0 ? " related" : "")
      );
      line.setAttribute("stroke-width", String(Math.min(2.4, 0.6 + e.weight * 0.3)));
      edgeLayer.appendChild(line);
      e.line = line;
    });

    nodes.forEach(function (n) {
      const g = document.createElementNS(NS, "g");
      g.setAttribute(
        "class",
        "post-graph-node" +
          (n.isFocus ? " focus" : "") +
          (n.isPaper ? " paper" : "")
      );
      g.setAttribute("data-id", n.id);
      g.style.cursor = "grab";

      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("r", String(n.r));

      const text = document.createElementNS(NS, "text");
      text.textContent = shortTitle(n.title, n.isFocus ? 32 : 20);

      const title = document.createElementNS(NS, "title");
      title.textContent = n.title || n.id;

      g.appendChild(circle);
      g.appendChild(text);
      g.appendChild(title);
      nodeLayer.appendChild(g);

      n.el = g;
      n.circle = circle;
      n.text = text;
    });

    function paintPositions() {
      edges.forEach(function (e) {
        const a = nodeById[e.source];
        const b = nodeById[e.target];
        if (!a || !b || !e.line) return;
        e.line.setAttribute("x1", a.x.toFixed(1));
        e.line.setAttribute("y1", a.y.toFixed(1));
        e.line.setAttribute("x2", b.x.toFixed(1));
        e.line.setAttribute("y2", b.y.toFixed(1));
      });
      nodes.forEach(function (n) {
        n.circle.setAttribute("cx", n.x.toFixed(1));
        n.circle.setAttribute("cy", n.y.toFixed(1));
        n.text.setAttribute("x", n.x.toFixed(1));
        n.text.setAttribute("y", (n.y - n.r - 6).toFixed(1));
      });
    }

    function step() {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = 900 / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
          if (nodes[i] !== drag.node) {
            nodes[i].vx -= dx;
            nodes[i].vy -= dy;
          }
          if (nodes[j] !== drag.node) {
            nodes[j].vx += dx;
            nodes[j].vy += dy;
          }
        }
      }
      edges.forEach(function (e) {
        const a = nodeById[e.source];
        const b = nodeById[e.target];
        if (!a || !b) return;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist - 100) * 0.05 * (0.5 + e.weight * 0.12);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        if (a !== drag.node) {
          a.vx += dx;
          a.vy += dy;
        }
        if (b !== drag.node) {
          b.vx -= dx;
          b.vy -= dy;
        }
      });
      nodes.forEach(function (n) {
        if (n === drag.node) return;
        if (n.isFocus) {
          n.vx += (width / 2 - n.x) * 0.04;
          n.vy += (height / 2 - n.y) * 0.04;
        } else {
          n.vx += (width / 2 - n.x) * 0.008;
          n.vy += (height / 2 - n.y) * 0.008;
        }
        n.vx *= 0.72;
        n.vy *= 0.72;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(36, Math.min(width - 36, n.x));
        n.y = Math.max(22, Math.min(height - 22, n.y));
      });
    }

    const drag = { node: null, moved: false, pointerId: null };

    // Warm layout (no DOM thrash)
    for (let i = 0; i < 80; i++) step();
    paintPositions();

    let rafId = 0;
    let settleLeft = 0;

    function loop() {
      rafId = 0;
      if (drag.node) {
        // while dragging only pin that node; light settle on others
        step();
        paintPositions();
        rafId = requestAnimationFrame(loop);
        return;
      }
      if (settleLeft > 0) {
        step();
        paintPositions();
        settleLeft--;
        rafId = requestAnimationFrame(loop);
      }
    }

    function kick(frames) {
      settleLeft = Math.max(settleLeft, frames || 40);
      if (!rafId) rafId = requestAnimationFrame(loop);
    }

    nodes.forEach(function (n) {
      n.el.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        drag.node = n;
        drag.moved = false;
        drag.pointerId = ev.pointerId;
        n.el.style.cursor = "grabbing";
        try {
          n.el.setPointerCapture(ev.pointerId);
        } catch (e) {}
        n.vx = 0;
        n.vy = 0;
        kick(1);
      });
    });

    // Document-level move/up so we don't lose tracking when DOM would have been rebuilt
    function onMove(ev) {
      if (!drag.node) return;
      const pt = svgPoint(svg, ev.clientX, ev.clientY);
      const n = drag.node;
      const nx = Math.max(36, Math.min(width - 36, pt.x));
      const ny = Math.max(22, Math.min(height - 22, pt.y));
      if (Math.abs(nx - n.x) > 1.5 || Math.abs(ny - n.y) > 1.5) drag.moved = true;
      n.x = nx;
      n.y = ny;
      n.vx = 0;
      n.vy = 0;
      // Immediate visual follow (no waiting for rAF)
      paintPositions();
      if (!rafId) rafId = requestAnimationFrame(loop);
    }

    function onUp(ev) {
      if (!drag.node) return;
      const n = drag.node;
      const id = n.id;
      const moved = drag.moved;
      try {
        if (drag.pointerId != null) n.el.releasePointerCapture(drag.pointerId);
      } catch (e) {}
      n.el.style.cursor = "grab";
      drag.node = null;
      drag.pointerId = null;
      kick(50);
      if (!moved && id !== focusId) {
        window.location.href = hrefFor(id);
      }
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    kick(90);
  }

  const focusId = currentPostId();
  if (!focusId) return;

  let host = document.getElementById("post-graph-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "post-graph-root";
    const main =
      document.querySelector("main#quarto-document-content") ||
      document.querySelector("main") ||
      document.body;
    main.appendChild(host);
  }

  fetch(dataUrl())
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      run(Array.isArray(data.posts) ? data.posts : [], focusId);
    })
    .catch(function (err) {
      console.warn("post graph:", err);
      host.innerHTML = "";
      host.hidden = true;
    });
})();
