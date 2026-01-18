(function () {

  /* ========================================================
     STOP APP ON SITEMAP
     ======================================================== */
  if (location.pathname.includes("/p/sitemap")) return;

  /* ========================================================
     CONFIG
     ======================================================== */
  const API = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
  const PER_PAGE = 24;
  const HISTORY_KEY = "bm_watch_history";

  const HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  /* ========================================================
     UTILS
     ======================================================== */
  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, m =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])
    );
  }

  function apiGET(path, params, cb) {
    const url = API + path + (params ? "?" + new URLSearchParams(params) : "");
    fetch(url, { headers: HEADERS })
      .then(r => r.json())
      .then(cb)
      .catch(() => cb({}));
  }

  function apiPOST(path, body, cb) {
    fetch(API + path, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body || {})
    })
      .then(r => r.json())
      .then(cb)
      .catch(() => cb({}));
  }

  function pickItems(res) {
    return res?.data?.items || res?.data?.subjectList || [];
  }

  function setLoading() {
    const el = document.getElementById("mb-page");
    if (el) el.innerHTML = `<div class="loader" style="margin:40px auto"></div>`;
  }

  /* ========================================================
     HISTORY
     ======================================================== */
  function pushHistory(item) {
    let list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    list = list.filter(x => x.id !== item.id);
    list.unshift(item);
    if (list.length > 80) list = list.slice(0, 80);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }

  function readHistory() {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  }

  /* ========================================================
     HOME (TRENDING)
     ======================================================== */
  function pageHome() {
    setLoading();

    apiGET("/subject/trending", { page: 0, perPage: 18 }, res => {
      const list = pickItems(res);
      const el = document.getElementById("mb-page");

      el.innerHTML = `
        <h2>🔥 Trending</h2>
        <div class="grid">
          ${list.map(m => `
            <a href="?detail=${m.subjectId}">
              <div class="card">
                <img src="${m.cover?.url || m.coverUrl || ""}" loading="lazy">
                <div class="card-title">${esc(m.title)}</div>
              </div>
            </a>
          `).join("")}
        </div>
      `;
    });
  }

  /* ========================================================
     SEARCH (FIXED)
     ======================================================== */
  function pageSearch(q) {
    setLoading();

    apiPOST("/search", {
      keyword: q,
      page: 1,
      perPage: PER_PAGE,
      searchType: "SUBJECT"
    }, res => {

      const list = pickItems(res);
      const el = document.getElementById("mb-page");

      el.innerHTML = `
        <h1>Search: ${esc(q)}</h1>
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
              : "<p style='color:#aaa'>No results found.</p>"
          }
        </div>
      `;
    });
  }

  /* ========================================================
     DETAIL
     ======================================================== */
  function pageDetail(id) {
    setLoading();

    apiGET("/subject/detail", { subjectId: id }, res => {
      const d = res?.data?.subject || {};
      const cover = d.cover?.url || d.coverUrl || "";

      apiGET("/subject/detail-rec", { subjectId: id, page: 1, perPage: 12 }, recRes => {
        const rec = pickItems(recRes);
        const el = document.getElementById("mb-page");

        el.innerHTML = `
          <h1>${esc(d.title)}</h1>
          <img src="${cover}" style="max-width:180px">
          <p>${esc(d.description || "")}</p>

          <a class="btn" href="?watch=${id}">▶ Watch</a>

          <h3>Similar</h3>
          <div class="grid">
            ${rec.map(m => `
              <a href="?detail=${m.subjectId}">
                <div class="card">
                  <img src="${m.cover?.url || m.coverUrl || ""}" loading="lazy">
                  <div class="card-title">${esc(m.title)}</div>
                </div>
              </a>
            `).join("")}
          </div>
        `;
      });
    });
  }

  /* ========================================================
     WATCH
     ======================================================== */
  function pageWatch(id) {
    setLoading();

    apiGET("/subject/detail", { subjectId: id }, res => {
      const d = res?.data?.subject || {};
      const slug = (d.detailPath || "").split("/").pop() || ("movie-" + id);

      pushHistory({
        id,
        title: d.title,
        cover: d.cover?.url || d.coverUrl || "",
        ts: Date.now()
      });

      const iframeUrl =
        "https://filmboom.top/spa/videoPlayPage/movies/" +
        encodeURIComponent(slug) +
        "?id=" + encodeURIComponent(id);

      document.getElementById("mb-page").innerHTML = `
        <h1>Watching: ${esc(d.title)}</h1>
        <iframe
          src="${iframeUrl}"
          allowfullscreen
          style="width:100%;height:520px;border:0">
        </iframe>
        <br><br>
        <a href="?detail=${id}">⬅ Back</a>
      `;
    });
  }

  /* ========================================================
     HISTORY PAGE
     ======================================================== */
  function pageHistory() {
    const list = readHistory();
    const el = document.getElementById("mb-page");

    el.innerHTML = `
      <h1>Watch History</h1>
      <div class="grid">
        ${list.map(m => `
          <a href="?detail=${m.id}">
            <div class="card">
              <img src="${m.cover}" loading="lazy">
              <div class="card-title">${esc(m.title)}</div>
            </div>
          </a>
        `).join("")}
      </div>
    `;
  }

  /* ========================================================
     ROUTER
     ======================================================== */
  function router() {
    const p = new URLSearchParams(location.search);

    if (p.has("detail")) return pageDetail(p.get("detail"));
    if (p.has("watch")) return pageWatch(p.get("watch"));
    if (p.has("search")) return pageSearch(p.get("search"));
    if (p.has("history")) return pageHistory();

    pageHome();
  }

  router();
  window.addEventListener("popstate", router);

})();
