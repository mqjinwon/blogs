/* Show post frontmatter fields under the title block */
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

  function arxivUrl(id) {
    return "https://arxiv.org/abs/" + encodeURIComponent(id);
  }

  function ensureHost() {
    var host = document.getElementById("post-meta-root");
    if (host) return host;
    host = document.createElement("div");
    host.id = "post-meta-root";
    host.className = "post-meta-root";
    var header = document.getElementById("title-block-header");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(host, header.nextSibling);
    } else {
      var main =
        document.querySelector("main#quarto-document-content") ||
        document.querySelector("main");
      if (main) main.insertBefore(host, main.firstChild);
    }
    return host;
  }

  function render(post) {
    var host = ensureHost();
    if (!post) {
      host.hidden = true;
      return;
    }

    var rows = [];
    if (post.venue) {
      rows.push(["venue", esc(post.venue), null, false]);
    }
    if (post.year) {
      rows.push(["year", esc(String(post.year)), null, false]);
    }
    if (post.arxiv) {
      rows.push(["arxiv", esc(post.arxiv), arxivUrl(post.arxiv), false]);
    }
    if (post.one_liner) {
      rows.push(["summary", esc(post.one_liner), null, false]);
    }
    if (post.tags && post.tags.length) {
      rows.push(["tags", esc(post.tags.join(", ")), null, false]);
    }
    if (post.related && post.related.length) {
      var relHtml = post.related
        .map(function (rid) {
          return (
            '<a class="post-meta-related" href="../' +
            encodeURIComponent(rid) +
            '/">' +
            esc(rid) +
            "</a>"
          );
        })
        .join(", ");
      rows.push(["related", relHtml, null, true]);
    }

    // only when custom paper/meta fields exist
    var hasExtra =
      post.venue ||
      post.year ||
      post.arxiv ||
      post.one_liner ||
      post.is_paper ||
      (post.related && post.related.length);
    if (!hasExtra || rows.length === 0) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }

    host.hidden = false;
    host.innerHTML =
      '<dl class="post-meta">' +
      rows
        .map(function (r) {
          var val;
          if (r[3]) {
            val = r[1]; // prebuilt html
          } else if (r[2] != null) {
            val =
              '<a href="' +
              esc(r[2]) +
              '" target="_blank" rel="noopener">' +
              r[1] +
              "</a>";
          } else {
            val = r[1];
          }
          return (
            '<div class="post-meta-row">' +
            "<dt>" +
            esc(r[0]) +
            "</dt>" +
            "<dd>" +
            val +
            "</dd>" +
            "</div>"
          );
        })
        .join("") +
      "</dl>";
  }

  var id = currentPostId();
  if (!id) return;

  fetch(dataUrl())
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var posts = Array.isArray(data.posts) ? data.posts : [];
      var post = posts.find(function (p) {
        return p.id === id;
      });
      render(post);
    })
    .catch(function () {
      var host = document.getElementById("post-meta-root");
      if (host) host.hidden = true;
    });
})();
