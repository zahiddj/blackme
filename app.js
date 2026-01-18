(function () {

  /* =====================================================
     BASIC SAFETY
     ===================================================== */
  if (location.pathname.includes("/p/sitemap")) return;

  const API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
  const HOST = "moviebox.ph";
  const PER_PAGE = 24;

  const HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "x-source": "web",
    "x-platform": "web"
  };

  const page = document.getElementById("mb-page");
  if (!page) {
    console.error("Missing #mb-page element");
    return;
  }

  /* =====================================================
     HELPERS
     ===================================================== */
  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, m =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])
    );
  }

  function loading() {
    page.innerHTML = `<div style="padding:40px;text-align:center">Loading…</div>`;
  }

  function apiGET(path, params = {}) {
    params.host = HOST;
    const url = API + path + "?" + new URLSearchParams(params).toString();
    return fetch(url, { headers: HEADERS }).then(r => r.json());
  }

  function apiPOST(path, body = {}) {
    body.host = HOST;
    return fetch(API + path, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  function getItems(res) {
    return res?.data?.items || res?.data?.subjectList || [];
  }

  /* =====================================================
     HOME / TRENDING
     ===================================================== */
  function home() {
    loading();

    apiGET("/subject/trending", {
      page: 0,
      perPage: 18
    }).then(res => {
      const list = getItems(res);

      page.innerHTML = `
        <h2>🔥 Trending</h2>
        <div class="grid">
          ${
            list.length
              ? list.map(m => `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${m.cover?.url || m.coverUrl || ""}" loading="lazy">
                    <div class="card-title">${esc(m.title)}</div>
                  </div>
                </a>
              `).join("")
              : "<p>No data</p>"
          }
        </div>
      `;
    }).catch(() => {
      page.innerHTML = "<p>Failed to load trending</p>";
    });
  }

  /* =====================================================
     SEARCH (REAL RESULTS)
     ===================================================== */
  function search(q) {
    loading();

    apiPOST("/search", {
      keyword: q,
      page: 1,
      perPage: PER_PAGE,
      searchType: "SUBJECT"
    }).then(res => {
      const list = getItems(res);

      page.innerHTML = `
        <h2>Search: ${esc(q)}</h2>
        <div class="grid">
          ${
            list.length
              ? list.map(m => `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${m.cover?.url || m.coverUrl || ""}" loading="lazy">
                    <div class="card-title">${esc(m.title)}</div>
                  </div>
                </a>
              `).join("")
              : "<p>No results found</p>"
          }
        </div>
      `;
    }).catch(() => {
      page.innerHTML = "<p>Search failed</p>";
    });
  }

  /* =====================================================
     DETAIL
     ===================================================== */
  function detail(id) {
    loading();

    apiGET("/subject/detail", { subjectId: id }).then(res => {
      const d = res?.data?.subject;
      if (!d) {
        page.innerHTML = "<p>Not found</p>";
        return;
      }

      const cover = d.cover?.url || d.coverUrl || "";

      apiGET("/subject/detail-rec", {
        subjectId: id,
        page: 1,
        perPage: 12
      }).then(recRes => {
        const rec = getItems(recRes);

        page.innerHTML = `
          <h1>${esc(d.title)}</h1>
          <img src="${cover}" style="max-width:200px" loading="lazy">
          <p>${esc(d.description || "")}</p>

          <p>
            <b>Genre:</b> ${esc(d.genre || "—")} <br>
            <b>Release:</b> ${esc(d.releaseDate || "—")}
          </p>

          <a href="?watch=${id}" class="btn">▶ Watch</a>

          <h3>Similar</h3>
          <div class="grid">
            ${
              rec.map(m => `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${m.cover?.url || m.coverUrl || ""}" loading="lazy">
                    <div class="card-title">${esc(m.title)}</div>
                  </div>
                </a>
              `).join("")
            }
          </div>
        `;
      });
    }).catch(() => {
      page.innerHTML = "<p>Failed to load detail</p>";
    });
  }

  /* =====================================================
     WATCH
     ===================================================== */
  function watch(id) {
    loading();

    apiGET("/subject/detail", { subjectId: id }).then(res => {
      const d = res?.data?.subject;
      if (!d) {
        page.innerHTML = "<p>Not found</p>";
        return;
      }

      const slug =
        (d.detailPath || "").split("/").pop() || ("movie-" + id);

      const iframeUrl =
        "https://filmboom.top/spa/videoPlayPage/movies/" +
        encodeURIComponent(slug) +
        "?id=" + encodeURIComponent(id);

      page.innerHTML = `
        <h2>${esc(d.title)}</h2>
        <iframe
          src="${iframeUrl}"
          style="width:100%;height:520px;border:0"
          allowfullscreen>
        </iframe>
        <br><br>
        <a href="?detail=${id}">⬅ Back</a>
      `;
    }).catch(() => {
      page.innerHTML = "<p>Failed to load player</p>";
    });
  }

  /* =====================================================
     ROUTER
     ===================================================== */
  function router() {
    const p = new URLSearchParams(location.search);

    if (p.has("search")) return search(p.get("search"));
    if (p.has("detail")) return detail(p.get("detail"));
    if (p.has("watch")) return watch(p.get("watch"));

    home();
  }

  router();
  window.addEventListener("popstate", router);

})();
