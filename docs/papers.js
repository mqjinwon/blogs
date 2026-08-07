/* Papers dashboard: multi-filter table (AND). Map lives on post pages. */
(function () {
  const root = document.getElementById("papers-root");
  if (!root) return;

  const dataUrl = new URL("data/posts.json", window.location.href).href;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "." + m[2] + "." + m[3];
    return iso;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  function collectFacets(posts) {
    const tags = [];
    const venues = [];
    const years = [];
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        tags.push(t);
      });
      if (p.venue) venues.push(p.venue);
      if (p.year) years.push(String(p.year));
    });
    return {
      tags: uniqueSorted(tags),
      venues: uniqueSorted(venues),
      years: uniqueSorted(years).sort().reverse(),
    };
  }

  function render(allPosts) {
    const posts = allPosts.filter(function (p) {
      return p.is_paper;
    });
    const selected = { tags: {}, venues: {}, years: {} };
    let query = "";

    root.innerHTML =
      '<div class="papers-filters" id="papers-filters"></div>' +
      '<div class="papers-toolbar-row">' +
      '  <div class="papers-active" id="papers-active"></div>' +
      '  <button type="button" class="papers-clear" id="papers-clear" hidden>clear</button>' +
      '  <input type="search" class="papers-search" id="papers-search" ' +
      '         placeholder="" autocomplete="off" />' +
      "</div>" +
      '<div class="papers-count" id="papers-count"></div>' +
      '<div class="papers-table-wrap">' +
      '  <table class="papers-table">' +
      "    <thead><tr>" +
      '      <th class="col-date">date</th>' +
      '      <th class="col-title">title</th>' +
      '      <th class="col-tags">tags</th>' +
      "    </tr></thead>" +
      '    <tbody id="papers-tbody"></tbody>' +
      "  </table>" +
      "</div>" +
      '<p class="papers-empty" id="papers-empty" hidden></p>';

    const filtersEl = document.getElementById("papers-filters");
    const activeEl = document.getElementById("papers-active");
    const clearBtn = document.getElementById("papers-clear");
    const searchEl = document.getElementById("papers-search");
    const tbody = document.getElementById("papers-tbody");
    const countEl = document.getElementById("papers-count");
    const emptyEl = document.getElementById("papers-empty");
    const facets = collectFacets(posts);

    function selectedList(dim) {
      return Object.keys(selected[dim]).filter(function (k) {
        return selected[dim][k];
      });
    }

    function toggle(dim, value) {
      if (selected[dim][value]) delete selected[dim][value];
      else selected[dim][value] = true;
      paintAll();
    }

    function clearAll() {
      selected.tags = {};
      selected.venues = {};
      selected.years = {};
      query = "";
      searchEl.value = "";
      paintAll();
    }

    function paintFilterRow(label, dim, values) {
      if (!values.length) return "";
      let html =
        '<div class="papers-filter-row">' +
        '<span class="papers-filter-label">' +
        esc(label) +
        "</span>" +
        '<div class="papers-chips">';
      values.forEach(function (v) {
        const on = !!selected[dim][v];
        html +=
          '<button type="button" class="papers-chip' +
          (on ? " active" : "") +
          '" data-dim="' +
          esc(dim) +
          '" data-value="' +
          esc(v) +
          '">' +
          esc(v) +
          "</button>";
      });
      html += "</div></div>";
      return html;
    }

    function paintFilters() {
      filtersEl.innerHTML =
        paintFilterRow("tag", "tags", facets.tags) +
        paintFilterRow("venue", "venues", facets.venues) +
        paintFilterRow("year", "years", facets.years);
      filtersEl.querySelectorAll(".papers-chip").forEach(function (btn) {
        btn.addEventListener("click", function () {
          toggle(btn.getAttribute("data-dim"), btn.getAttribute("data-value"));
        });
      });
    }

    function paintActive() {
      const parts = []
        .concat(selectedList("tags"))
        .concat(selectedList("venues"))
        .concat(selectedList("years"));
      if (parts.length) {
        activeEl.textContent = parts.join(" · ");
        clearBtn.hidden = false;
      } else {
        activeEl.textContent = "";
        clearBtn.hidden = true;
      }
    }

    function filtered() {
      const tags = selectedList("tags");
      const venues = selectedList("venues");
      const years = selectedList("years");
      const q = query.trim().toLowerCase();

      return posts.filter(function (p) {
        for (let i = 0; i < tags.length; i++) {
          if (!(p.tags || []).includes(tags[i])) return false;
        }
        for (let i = 0; i < venues.length; i++) {
          if (p.venue !== venues[i]) return false;
        }
        for (let i = 0; i < years.length; i++) {
          if (String(p.year || "") !== years[i]) return false;
        }
        if (!q) return true;
        const hay = [
          p.title,
          p.arxiv || "",
          p.venue || "",
          p.year || "",
          (p.tags || []).join(" "),
          p.one_liner || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }

    function paintRows() {
      const rows = filtered();
      countEl.textContent =
        posts.length === 0 ? "" : rows.length + " / " + posts.length;

      if (posts.length === 0 || rows.length === 0) {
        tbody.innerHTML = "";
        emptyEl.hidden = true;
        emptyEl.textContent = "";
        return;
      }

      emptyEl.hidden = true;
      tbody.innerHTML = rows
        .map(function (p) {
          const one = p.one_liner
            ? '<div class="papers-oneliner">' + esc(p.one_liner) + "</div>"
            : "";
          const tags = (p.tags || [])
            .map(function (t) {
              return (
                '<button type="button" class="papers-tag" data-tag="' +
                esc(t) +
                '">' +
                esc(t) +
                "</button>"
              );
            })
            .join("");
          return (
            "<tr>" +
            '<td class="col-date">' +
            esc(formatDate(p.date)) +
            "</td>" +
            '<td class="col-title">' +
            '<a class="papers-title" href="' +
            esc(p.href) +
            '">' +
            esc(p.title) +
            "</a>" +
            one +
            "</td>" +
            '<td class="col-tags">' +
            (tags || "—") +
            "</td>" +
            "</tr>"
          );
        })
        .join("");

      tbody.querySelectorAll(".papers-tag").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          toggle("tags", btn.getAttribute("data-tag"));
        });
      });
    }

    function paintAll() {
      paintFilters();
      paintActive();
      paintRows();
    }

    searchEl.addEventListener("input", function () {
      query = searchEl.value || "";
      paintRows();
    });
    clearBtn.addEventListener("click", clearAll);
    paintAll();
  }

  fetch(dataUrl)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      render(Array.isArray(data.posts) ? data.posts : []);
    })
    .catch(function (err) {
      root.innerHTML = "";
      console.error(err);
    });
})();
