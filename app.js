(function () {

  /* ========================================================
     🛑 STOP APP on SITEMAP PAGE
     ======================================================== */
  if (window.location.pathname.includes("/p/sitemap")) {
    console.log("Sitemap page — app disabled.");
    return;
  }

  /* ========================================================
     CONFIG
     ======================================================== */

  const API = "https://moviebox.ph";

  const COMMON_HEADERS = {
    Accept: "application/json",
    Referer: "https://moviebox.ph/",
    "x-client-info": '{"timezone":"Asia/Dhaka"}',
    "x-source": "web",
    "x-platform": "web"
  };

  const HISTORY_KEY = "bm_watch_history";
  const PER_PAGE = 24;

  /* ========================================================
     🔥 NEW BFF ENDPOINTS (AUTO FALLBACK)
     ======================================================== */

  const BFF_PATHS = [
    "/moviebox-h5-bff",   // NEW
    "/wefeed-h5-bff"      // OLD (fallback)
  ];

  function withBFF(path) {
    return BFF_PATHS.map(p => p + path);
  }

  const ENDPOINTS = {
    TRENDING: withBFF("/web/subject/trending"),
    FILTER: withBFF("/web/filter"),
    DETAIL: withBFF("/web/subject/detail"),
    DETAIL_REC: withBFF("/web/subject/detail-rec"),
    SEARCH: withBFF("/web/subject/search"),
  };

  /* ========================================================
     API HELPERS (AUTO RETRY)
     ======================================================== */

  function apiGET(paths, params, cb, i = 0) {
    if (!paths[i]) return cb({});
    const qs = new URLSearchParams(params || {}).toString();
    const url = API + paths[i] + (qs ? "?" + qs : "");

    fetch(url, { headers: COMMON_HEADERS })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(cb)
      .catch(() => apiGET(paths, params, cb, i + 1));
  }

  function apiPOST(paths, body, cb, i = 0) {
    if (!paths[i]) return cb({});

    fetch(API + paths[i], {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(cb)
      .catch(() => apiPOST(paths, body, cb, i + 1));
  }

  /* ========================================================
     UTILS
     ======================================================== */

  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, m =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])
    );
  }

  function pickItems(resp) {
    if (!resp || !resp.data) return [];
    return resp.data.items || resp.data.subjectList || resp.data.list || [];
  }

  function getTitle(m) {
    return m.title || m.name || m.seriesName || m.videoTitle || "Unknown";
  }

  /* ========================================================
     HISTORY
     ======================================================== */

  function pushHistory(item) {
    let list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    list = list.filter(x => x.id !== item.id);
    list.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 80)));
  }

  function readHistory() {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  }

  /* ========================================================
     PAGE HELPERS
     ======================================================== */

  function setLoading() {
    const el = document.getElementById("mb-page");
    if (el) el.innerHTML = '<div class="loader" style="margin:40px auto;"></div>';
  }

  /* ========================================================
     HOME PAGE
     ======================================================== */

  function pageHome() {
    setLoading();

    apiGET(ENDPOINTS.TRENDING, { page: 0, perPage: 18 }, trendRes => {
      const trending = pickItems(trendRes);

      apiPOST(ENDPOINTS.FILTER, {
        tabId: 2,
        classify: "Movie",
        genre: "All",
        year: "All",
        sort: "ForYou",
        page: 1,
        perPage: 18
      }, movieRes => {

        apiPOST(ENDPOINTS.FILTER, {
          tabId: 2,
          classify: "TV",
          genre: "All",
          year: "All",
          sort: "ForYou",
          page: 1,
          perPage: 18
        }, tvRes => {

          const movies = pickItems(movieRes);
          const shows = pickItems(tvRes);
          renderHome(trending, movies, shows);
        });
      });
    });
  }

  function renderHome(trending, movies, shows) {
    const el = document.getElementById("mb-page");
    if (!el) return;

    el.innerHTML = `
      <h2>🔥 Trending</h2>
      <div class="grid">
        ${trending.map(m => `
          <a href="?detail=${m.subjectId}">
            <div class="card">
              <img src="${m.cover?.url || m.coverUrl || ""}">
              <div class="card-title">${esc(getTitle(m))}</div>
            </div>
          </a>
        `).join("")}
      </div>

      <h2>🎞 Movies</h2>
      <div class="grid">
        ${movies.map(m => `
          <a href="?detail=${m.subjectId}">
            <div class="card">
              <img src="${m.cover?.url || m.coverUrl || ""}">
              <div class="card-title">${esc(getTitle(m))}</div>
            </div>
          </a>
        `).join("")}
      </div>

      <h2>📺 TV Shows</h2>
      <div class="grid">
        ${shows.map(m => `
          <a href="?detail=${m.subjectId}">
            <div class="card">
              <img src="${m.cover?.url || m.coverUrl || ""}">
              <div class="card-title">${esc(getTitle(m))}</div>
            </div>
          </a>
        `).join("")}
      </div>
    `;
  }

  /* ========================================================
     DETAIL PAGE
     ======================================================== */

  function pageDetail(id) {
    setLoading();

    apiGET(ENDPOINTS.DETAIL, { subjectId: id }, res => {
      const d = res?.data?.subject || {};
      const cover = d.cover?.url || d.coverUrl || "";

      apiGET(ENDPOINTS.DETAIL_REC, { subjectId: id, page: 1, perPage: 12 }, recRes => {
        const rec = pickItems(recRes);
        const el = document.getElementById("mb-page");

        el.innerHTML = `
          <h1>${esc(d.title)}</h1>
          <img src="${cover}" style="max-width:200px">
          <p>${esc(d.description || "")}</p>
          <a class="btn" href="?watch=${id}">▶ Watch</a>

          <h3>Similar</h3>
          <div class="grid">
            ${rec.map(m => `
              <a href="?detail=${m.subjectId}">
                <div class="card">
                  <img src="${m.cover?.url || m.coverUrl || ""}">
                  <div class="card-title">${esc(getTitle(m))}</div>
                </div>
              </a>
            `).join("")}
          </div>
        `;
      });
    });
  }

  /* ========================================================
     WATCH PAGE
     ======================================================== */

  function pageWatch(id) {
    setLoading();

    apiGET(ENDPOINTS.DETAIL, { subjectId: id }, res => {
      const d = res?.data?.subject || {};
      const title = d.title || "Unknown";

      pushHistory({
        id,
        title,
        cover: d.cover?.url || d.coverUrl || "",
        ts: Date.now()
      });

      const slug = (d.detailPath || "").split("/").pop() || ("movie-" + id);
      const iframeUrl =
        "https://filmboom.top/spa/videoPlayPage/movies/" +
        encodeURIComponent(slug) +
        "?id=" + id;

      document.getElementById("mb-page").innerHTML = `
        <h1>Watching: ${esc(title)}</h1>
        <iframe src="${iframeUrl}" allowfullscreen style="width:100%;height:520px;border:0"></iframe>
      `;
    });
  }

  /* ========================================================
     SEARCH
     ======================================================== */

  function pageSearch(q) {
    setLoading();

    apiPOST(ENDPOINTS.SEARCH, {
      keyword: q,
      page: 1,
      perPage: PER_PAGE
    }, res => {
      const list = pickItems(res);
      const el = document.getElementById("mb-page");

      el.innerHTML = `
        <h1>Search: ${esc(q)}</h1>
        <div class="grid">
          ${list.map(m => `
            <a href="?detail=${m.subjectId}">
              <div class="card">
                <img src="${m.cover?.url || m.coverUrl || ""}">
                <div class="card-title">${esc(getTitle(m))}</div>
              </div>
            </a>
          `).join("")}
        </div>
      `;
    });
  }

  /* ========================================================
     HISTORY
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
              <img src="${m.cover}">
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
