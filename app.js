
(function () {

  /* ========================================================
     🔒 BLOCK: Disable MovieBox App on Blogger Post Pages
     ======================================================== */
  const path = window.location.pathname;

  // Blogger post URLs look like: /2025/11/post-title.html
  const isPost = /^\/\d{4}\/\d{2}\//.test(path);

  if (isPost) {
    console.log("Post page detected — MovieBox app disabled.");
    return; // STOP entire app from loading on post pages
  }

  /* ========================================================
     MOVIEBOX APP (Optimized + Google-indexable routing)
     ======================================================== */

  const API = "https://moviebox.ph";
  const COMMON_HEADERS = {
    Accept: "application/json",
    Referer: "https://moviebox.ph/",
    "x-client-info": '{"timezone":"Asia/Dhaka"}',
    "x-source": "web",
  };
  const HISTORY_KEY = "bm_watch_history";
  const PER_PAGE = 24;

  const DETAIL_ENDPOINT = "/wefeed-h5-bff/web/subject/detail";
  const DETAIL_REC_ENDPOINT = "/wefeed-h5-bff/web/subject/detail-rec";

  const GENRE_OPTIONS = [
    "All","Action","Adventure","Animation","Biography","Comedy","Crime",
    "Documentary","Drama","Family","Fantasy","Film-Noir","Game-Show","History",
    "Horror","Music","Musical","Mystery","News","Reality-TV","Romance",
    "Sci-Fi","Short","Sport","Talk-Show","Thriller","War","Western","Other"
  ];
  const COUNTRY_OPTIONS = [
    "All","United States","United Kingdom","Korea","Japan","Bangladesh","China",
    "Egypt","France","Germany","India","Indonesia","Iraq","Italy","Ivory Coast",
    "Kenya","Lebanon","Mexico","Morocco","Nigeria","Pakistan","Philippines",
    "Russia","South Africa","Spain","Thailand","Turkey","Other"
  ];
  const YEAR_OPTIONS = [
    "All","2025","2024","2023","2022","2021","2020","2010s","2000s","1990s","1980s","Other"
  ];
  const LANGUAGE_OPTIONS = [
    "All","French dub","Hindi dub","Bengali dub","Urdu dub","Punjabi dub",
    "Tamil dub","Telugu dub","Malayalam dub","Kannada dub","Arabic dub",
    "Tagalog dub","Indonesian dub","Russian dub","Kurdish sub"
  ];
  const SORT_OPTIONS = ["ForYou","Hottest","Latest","Rating"];

  let currentTrending = [];
  let currentHeroIndex = 0;

  let categoryState = {
    type: "Movie",
    genre: "All",
    country: "All",
    year: "All",
    language: "All",
    sort: "ForYou",
  };

  let homeCache = null;
  const searchCache = {};
  let mbPage = null;

  /* ===================== SEO ===================== */
  function updateSEO(config) {
    config = config || {};
    const title = config.title || "BlackMeMovie – Watch Movies & TV Shows Online Free";
    const description = config.description || "Watch movies & TV shows free on BlackMeMovie.";
    const image = config.image || "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg";
    const url = config.url || location.href;

    document.title = title;

    function ensureMeta(selector, createFn) {
      let el = document.querySelector(selector);
      if (!el) {
        el = createFn();
        document.head.appendChild(el);
      }
      return el;
    }

    ensureMeta('meta[name="description"]', () => {
      const m = document.createElement("meta");
      m.name = "description";
      return m;
    }).content = description;

    ensureMeta('meta[property="og:title"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:title");
      return m;
    }).content = title;

    ensureMeta('meta[property="og:description"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:description");
      return m;
    }).content = description;

    ensureMeta('meta[property="og:image"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image");
      return m;
    }).content = image;

    ensureMeta('meta[property="og:url"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:url");
      return m;
    }).content = url;

    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.rel = "canonical";
      document.head.appendChild(canon);
    }
    canon.href = url;
  }

  function setJSONLD(obj) {
    try {
      let el = document.getElementById("bm-schema");
      if (!el) {
        el = document.createElement("script");
        el.id = "bm-schema";
        el.type = "application/ld+json";
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(obj);
    } catch (e) {}
  }

  /* ===================== UTIL ===================== */
  function esc(s) {
    return (s || "")
      .toString()
      .replace(/[&<>"']/g, (m) => ({
        "&": "&amp;","<": "&lt;",">": "&gt;",'"': "&quot;","'": "&#39;"
      })[m]);
  }

  function cleanTitle(raw) {
    const t = (raw || "").toString().trim();
    if (!t) return "Unknown Title";
    if (t.length > 60) return t.slice(0, 57) + "...";
    return t;
  }

  function getTitle(m) {
    return cleanTitle(
      m.title || m.subTitle || m.name || m.seriesName || m.showName || m.videoTitle
    );
  }

  function pickItems(resp) {
    if (!resp || !resp.data) return [];
    const d = resp.data;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.subjectList)) return d.subjectList;
    if (Array.isArray(d.list)) return d.list;
    return [];
  }

  function apiGET(path, params, cb) {
    const sp = new URLSearchParams(params || {});
    const url = API + path + (sp.toString() ? "?" + sp.toString() : "");
    fetch(url, { headers: COMMON_HEADERS })
      .then((r) => r.json())
      .then(cb)
      .catch(() => cb({}));
  }

  function apiPOST(path, body, cb) {
    fetch(API + path, {
      method: "POST",
      headers: Object.assign({}, COMMON_HEADERS, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body || {}),
    })
      .then((r) => r.json())
      .then(cb)
      .catch(() => cb({}));
  }

  /* ===================== HISTORY ===================== */
  function pushHistory(item) {
    try {
      let list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      list = list.filter((x) => x.id !== item.id);
      list.unshift(item);
      if (list.length > 80) list = list.slice(0, 80);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function readHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function setLoading() {
    mbPage = document.getElementById("mb-page");
    if (mbPage) {
      mbPage.innerHTML =
        '<div class="loader" style="margin:40px auto;"></div>';
    }
  }

  function highlightNav(route) {
    const root = document.getElementById("moviebox-app");
    if (!root) return;
    root.querySelectorAll(".mb-nav-item").forEach((el) => {
      if (el.getAttribute("data-route") === route)
        el.classList.add("active");
      else el.classList.remove("active");
    });
  }

  /* ===================== LAYOUT ===================== */
  function layout() {
    const root = document.getElementById("moviebox-app");
    if (!root) return;

    root.innerHTML = `
      <div class="mb-shell">

        <div class="mb-sidebar">
          <div class="mb-nav-list">
            <div class="mb-nav-item" data-route="?home=1"><span class="icon">🏠</span><span class="text">Home</span></div>
            <div class="mb-nav-item" data-route="?category=TV"><span class="icon">📺</span><span class="text">TV Show</span></div>
            <div class="mb-nav-item" data-route="?category=Movie"><span class="icon">🎬</span><span class="text">Movie</span></div>
            <div class="mb-nav-item" data-route="?category=Animation"><span class="icon">🐻</span><span class="text">Animation</span></div>
            <div class="mb-nav-item" data-route="?category=Sport"><span class="icon">🎮</span><span class="text">Sport Live</span></div>
            <div class="mb-nav-item" data-route="?category=Novel"><span class="icon">📖</span><span class="text">Novel 🔥</span></div>
            <div class="mb-nav-item" data-route="?category=MostWatched"><span class="icon">📊</span><span class="text">Most Watched</span></div>
          </div>
        </div>

        <div class="mb-main-wrap">
          <div class="header">
            <div class="header-logo">
              <div class="logo-burger">☰</div>
              <div class="logo-icon">BM</div>
              <div class="logo-text">BlackMeMovie</div>
            </div>

            <div class="header-search">
              <div class="search-box">
                <input id="mb-search-input" class="search-input" placeholder="Search movies / TV shows">
                <span id="mb-search-icon" class="search-icon">🔍</span>
              </div>
            </div>

            <div class="header-actions">
              <button class="btn-header btn-download">⬇ Download App</button>
              <button id="mb-btn-history" class="btn-header btn-history">⏱ History</button>
            </div>
          </div>

          <div class="container">
            <div id="mb-page" class="mb-page"></div>
          </div>

          <div class="footer">
            BlackMeMovie © 2025
          </div>
        </div>
      </div>
    `;

    // sidebar routing
    root.querySelectorAll(".mb-nav-item").forEach((el) => {
      el.addEventListener("click", () => {
        const r = el.getAttribute("data-route");
        if (r) location.search = r;
      });
    });

    const burger = root.querySelector(".logo-burger");
    const sidebar = root.querySelector(".mb-sidebar");
    const logoText = root.querySelector(".logo-text");

    if (burger) {
      burger.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          document.body.classList.toggle("mb-sidebar-open");
          return;
        }

        const collapsed = document.body.classList.toggle("mb-sidebar-collapsed");
        if (collapsed) {
          sidebar.style.width = "64px";
          if (logoText) logoText.style.display = "none";
          root.querySelectorAll(".mb-sidebar .text").forEach((t) => (t.style.display = "none"));
        } else {
          sidebar.style.width = "235px";
          if (logoText) logoText.style.display = "";
          root.querySelectorAll(".mb-sidebar .text").forEach((t) => (t.style.display = ""));
        }
      });
    }

    // search
    const sInput = document.getElementById("mb-search-input");
    const sIcon = document.getElementById("mb-search-icon");
    const triggerSearch = () => {
      const v = (sInput.value || "").trim();
      if (v) location.search = "?search=" + encodeURIComponent(v);
    };
    if (sInput) sInput.addEventListener("keydown", (e) => { if (e.key === "Enter") triggerSearch(); });
    if (sIcon) sIcon.addEventListener("click", triggerSearch);

    const hBtn = document.getElementById("mb-btn-history");
    if (hBtn) hBtn.onclick = () => { location.search = "?history=1"; };
  }

  /* ===================== HOME ===================== */
  function buildHomeSchema(trending, movies, shows) {
    const urlBase = location.origin + location.pathname;
    const sample =
      (trending && trending[0]) ||
      (movies && movies[0]) ||
      (shows && shows[0]);

    const schema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "BlackMeMovie",
      url: urlBase,
      potentialAction: {
        "@type": "SearchAction",
        target: urlBase + "?search={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    };

    if (sample) {
      schema.about = {
        "@type": "Movie",
        name: getTitle(sample),
      };
    }

    setJSONLD(schema);
  }

  function pageHome() {
    highlightNav("?home=1");

    updateSEO({
      title: "BlackMeMovie – Watch Movies & TV Shows Online Free",
      description: "Watch trending movies, TV shows, drama, anime & more on BlackMeMovie. Free HD streaming.",
      image: "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
      url: location.href,
    });

    if (homeCache) {
      currentTrending = homeCache.trending || [];
      currentHeroIndex = 0;
      buildHomeSchema(homeCache.trending, homeCache.movies, homeCache.shows);
      renderHome(homeCache.movies, homeCache.shows);
      return;
    }

    setLoading();

    apiGET("/wefeed-h5-bff/web/subject/trending", { page: 0, perPage: 18 }, (trendRes) => {
      currentTrending = pickItems(trendRes);
      currentHeroIndex = 0;

      apiPOST("/wefeed-h5-bff/web/filter", {
        tabId: 2, classify: "Movie", genre: "All", year: "All",
        sort: "ForYou", page: 1, perPage: 18
      }, (movieRes) => {
        const movies = pickItems(movieRes);

        apiPOST("/wefeed-h5-bff/web/filter", {
          tabId: 2, classify: "TV", genre: "All", year: "All",
          sort: "ForYou", page: 1, perPage: 18
        }, (showRes) => {
          const shows = pickItems(showRes);

          homeCache = {
            trending: currentTrending.slice(),
            movies: movies.slice(),
            shows: shows.slice(),
          };

          buildHomeSchema(homeCache.trending, homeCache.movies, homeCache.shows);
          renderHome(movies, shows);
        });
      });
    });
  }

  function renderHome(movies, shows) {
    mbPage = document.getElementById("mb-page");
    if (!mbPage) return;

    const trending = currentTrending || [];
    const hero = trending[currentHeroIndex] || null;

    let heroHTML = "";

    if (hero) {
      const cover = (hero.cover && hero.cover.url) || hero.coverUrl || "";
      const dots = [];
      const maxDots = Math.min(trending.length, 6);
      for (let i = 0; i < maxDots; i++) {
        dots.push(`<div class="hero-dot${i === currentHeroIndex ? " active" : ""}" data-hero-index="${i}"></div>`);
      }

      heroHTML = `
        <div class="hero">
          <div class="hero-bg" style="background-image:url('${cover}')"></div>
          <div class="hero-overlay"></div>
          <div class="hero-inner">
            <div class="hero-poster">
              <img src="${cover}" loading="lazy">
            </div>
            <div>
              <div class="hero-title">${getTitle(hero)}</div>
              <div class="hero-meta">
                ${esc(hero.countryName || "")} | ${esc(hero.releaseDate || "")} | ${esc(hero.genre || "")}
              </div>
              <div style="margin-top:10px;">
                <a class="btn" href="?watch=${hero.subjectId}">▶ Watch</a>
                <span class="btn-secondary" style="margin-left:8px;cursor:default;">More Info</span>
              </div>
            </div>
          </div>
          <div class="hero-controls">
            <div class="hero-arrow" id="mb-hero-prev">‹</div>
            <div class="hero-arrow" id="mb-hero-next">›</div>
            <div class="hero-dots">${dots.join("")}</div>
          </div>
        </div>
      `;
    }

    mbPage.innerHTML = `
      ${heroHTML}

      <div>
        <div class="section-title">🔥 Trending</div>
        <div class="grid">
          ${
            trending
              .map((m) => {
                const c = (m.cover && m.cover.url) || m.coverUrl || "";
                return `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${c}" loading="lazy">
                    <div class="card-title">${getTitle(m)}</div>
                  </div>
                </a>
              `;
              })
              .join("") || ""
          }
        </div>
      </div>

      <div style="margin-top:18px;">
        <div class="section-title">🎞 Movies</div>
        <div class="grid">
          ${
            movies
              .map((m) => {
                const c = (m.cover && m.cover.url) || m.coverUrl || "";
                return `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${c}" loading="lazy">
                    <div class="card-title">${getTitle(m)}</div>
                  </div>
                </a>
              `;
              })
              .join("") || ""
          }
        </div>
      </div>

      <div style="margin-top:18px;">
        <div class="section-title">📺 TV Shows</div>
        <div class="grid">
          ${
            shows
              .map((m) => {
                const c = (m.cover && m.cover.url) || m.coverUrl || "";
                return `
                <a href="?detail=${m.subjectId}">
                  <div class="card">
                    <img src="${c}" loading="lazy">
                    <div class="card-title">${getTitle(m)}</div>
                  </div>
                </a>
              `;
              })
              .join("") || ""
          }
        </div>
      </div>
    `;

    const prev = document.getElementById("mb-hero-prev");
    const next = document.getElementById("mb-hero-next");

    if (prev) prev.onclick = () => {
      if (!currentTrending.length) return;
      currentHeroIndex = (currentHeroIndex - 1 + currentTrending.length) % currentTrending.length;
      renderHome(movies, shows);
    };

    if (next) next.onclick = () => {
      if (!currentTrending.length) return;
      currentHeroIndex = (currentHeroIndex + 1) % currentTrending.length;
      renderHome(movies, shows);
    };

    document.querySelectorAll(".hero-dot").forEach((dot) => {
      dot.onclick = () => {
        currentHeroIndex = parseInt(dot.getAttribute("data-hero-index"), 10) || 0;
        renderHome(movies, shows);
      };
    });
  }

  /* ===================== CATEGORY ===================== */
  function mapTypeToClassify(t) {
    switch (t) {
      case "TV": return "TV";
      case "Movie": return "Movie";
      case "Animation": return "Animation";
      case "Sport": return "Sport";
      case "Novel": return "Novel";
      case "MostWatched": return "Movie";
      default: return "Movie";
    }
  }

  function pageCategory(typeParam) {
    highlightNav("?category=" + typeParam);

    updateSEO({
      title: esc(typeParam) + " – Browse | BlackMeMovie",
      description: "Browse " + typeParam + " content on BlackMeMovie in HD.",
      image: "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
      url: location.href,
    });

    setJSONLD({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: typeParam + " – BlackMeMovie",
      url: location.href,
    });

    const classify = mapTypeToClassify(typeParam);
    categoryState.type = classify;
    categoryState.genre = "All";
    categoryState.country = "All";
    categoryState.year = "All";
    categoryState.language = "All";
    categoryState.sort = typeParam === "MostWatched" ? "Hottest" : "ForYou";

    mbPage = document.getElementById("mb-page");
    if (!mbPage) return;

    mbPage.innerHTML = `
      <h1>${esc(typeParam)}</h1>

      <div class="mb-filter-panel">

        <div class="mb-filter-row">
          <div class="mb-filter-label">Genre</div>
          <div class="mb-filter-options" id="mb-filter-genre"></div>
        </div>

        <div class="mb-filter-row">
          <div class="mb-filter-label">Country</div>
          <div class="mb-filter-options" id="mb-filter-country"></div>
        </div>

        <div class="mb-filter-row">
          <div class="mb-filter-label">Year</div>
          <div class="mb-filter-options" id="mb-filter-year"></div>
        </div>

        <div class="mb-filter-row">
          <div class="mb-filter-label">Language</div>
          <div class="mb-filter-options" id="mb-filter-language"></div>
        </div>

        <div class="mb-filter-row">
          <div class="mb-filter-label">Sort by</div>
          <div class="mb-filter-options" id="mb-filter-sort"></div>
        </div>

      </div>

      <div class="grid" id="mb-filter-grid"></div>
    `;

    renderFilterPills();
    loadCategoryResults();
  }

  function renderFilterGroup(containerId, labelArr, activeVal, filterKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = labelArr.map((v) => {
      const cls = "mb-filter-pill" + (v === activeVal ? " active" : "");
      return `<span class="${cls}" data-filter="${filterKey}" data-value="${esc(v)}">${esc(v)}</span>`;
    }).join("");
  }

  function renderFilterPills() {
    renderFilterGroup("mb-filter-genre", GENRE_OPTIONS, categoryState.genre, "genre");
    renderFilterGroup("mb-filter-country", COUNTRY_OPTIONS, categoryState.country, "country");
    renderFilterGroup("mb-filter-year", YEAR_OPTIONS, categoryState.year, "year");
    renderFilterGroup("mb-filter-language", LANGUAGE_OPTIONS, categoryState.language, "language");
    renderFilterGroup("mb-filter-sort", SORT_OPTIONS, categoryState.sort, "sort");

    document.querySelectorAll("#moviebox-app .mb-filter-pill").forEach((el) => {
      el.onclick = () => {
        const key = el.getAttribute("data-filter");
        const val = el.getAttribute("data-value");
        categoryState[key] = val;
        renderFilterPills();
        loadCategoryResults();
      };
    });
  }

  function loadCategoryResults() {
    const grid = document.getElementById("mb-filter-grid");
    if (!grid) return;

    grid.innerHTML = '<div class="loader" style="margin:20px auto;"></div>';

    apiPOST("/wefeed-h5-bff/web/filter", {
      tabId: 2,
      classify: categoryState.type,
      genre: categoryState.genre,
      year: categoryState.year,
      sort: categoryState.sort,
      page: 1,
      perPage: 40,
      country: categoryState.country,
      language: categoryState.language,
    }, (res) => {
      const data = pickItems(res);
      grid.innerHTML =
        data
          .map((m) => {
            const c = (m.cover && m.cover.url) || m.coverUrl || "";
            return `
            <a href="?detail=${m.subjectId}">
              <div class="card">
                <img src="${c}" loading="lazy">
                <div class="card-title">${getTitle(m)}</div>
              </div>
            </a>
          `;
          })
          .join("") ||
        "<p style='color:#aaa;font-size:13px'>No results.</p>";
    });
  }

  /* ===================== SEARCH ===================== */
  function renderSearchPage(q, list) {
    mbPage = document.getElementById("mb-page");
    if (!mbPage) return;

    mbPage.innerHTML = `
      <h1>Search: ${esc(q)}</h1>
      <div class="grid">
        ${
          list
            .map((m) => {
              const c = (m.cover && m.cover.url) || m.coverUrl || "";
              return `
            <a href="?detail=${m.subjectId}">
              <div class="card">
                <img src="${c}" loading="lazy">
                <div class="card-title">${getTitle(m)}</div>
              </div>
            </a>
          `;
            })
            .join("") ||
          "<p style='color:#aaa;margin-top:10px'>No results found.</p>"
        }
      </div>
    `;
  }

  function pageSearch(q) {
    highlightNav("");

    updateSEO({
      title: "Search: " + q + " – BlackMeMovie",
      description: "Search results for '" + q + "' on BlackMeMovie.",
      image: "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
      url: location.href,
    });

    setJSONLD({
      "@context": "https://schema.org",
      "@type": "SearchResultsPage",
      name: "Search: " + q,
      url: location.href,
      query: q,
    });

    if (searchCache[q]) {
      renderSearchPage(q, searchCache[q]);
      return;
    }

    fetch(API + "/wefeed-h5-bff/web/subject/search", {
      method: "POST",
      headers: Object.assign({}, COMMON_HEADERS, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        keyword: q,
        page: 1,
        perPage: PER_PAGE,
      }),
    })
      .then((r) => r.json())
      .then((resp) => {
        const list = pickItems(resp);
        searchCache[q] = list.slice();
        renderSearchPage(q, list);
      })
      .catch(() => {
        mbPage = document.getElementById("mb-page");
        if (mbPage)
          mbPage.innerHTML =
            '<p style="color:#aaa;margin-top:10px">Search failed.</p>';
      });
  }

  /* ===================== DETAIL ===================== */
  function buildDetailSchema(info, cover) {
    info = info || {};
    const typeStr = (
      info.classify || info.typeName || info.subjectType || ""
    )
      .toString()
      .toLowerCase();

    const isSeries = typeStr.includes("tv") || typeStr.includes("series") || typeStr.includes("show");

    const schema = {
      "@context": "https://schema.org",
      "@type": isSeries ? "TVSeries" : "Movie",
      name: getTitle(info),
      image: cover || "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
      description: info.description || info.desc || "",
      datePublished: info.releaseDate || info.year || "",
      genre:
        info.genre ||
        (Array.isArray(info.genreList) ? info.genreList.join(", ") : ""),
    };

    const rawScore = info.score || info.imdbRatingValue || info.imdbScore;
    const ratingCount = info.scoreCount || info.imdbRatingCount || info.ratingCount || info.voteCount;

    if (rawScore) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: typeof rawScore === "number" ? rawScore.toFixed(1) : rawScore,
        ratingCount: ratingCount || "",
      };
    }

    setJSONLD(schema);
  }

  function pageDetail(id) {
    highlightNav("");

    setLoading();

    apiGET(DETAIL_ENDPOINT, { subjectId: id }, (res) => {
      const d = res && res.data && res.data.subject ? res.data.subject : {};

      const title = d.title || "Unknown Title";
      const cover = (d.cover && d.cover.url) || d.coverUrl || "";
      const desc = d.description || "";
      const release = d.releaseDate || "";
      const genre = d.genre || "";
      const country = d.countryName || "";

      buildDetailSchema(d, cover);

      updateSEO({
        title: title + " – Watch Online | BlackMeMovie",
        description: desc || "Watch " + title + " online in HD on BlackMeMovie.",
        image: cover || "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
        url: location.href,
      });

      apiGET(DETAIL_REC_ENDPOINT, { subjectId: id, page: 1, perPage: 12 }, (recRes) => {
        const rec =
          recRes &&
          recRes.data &&
          Array.isArray(recRes.data.items)
            ? recRes.data.items
            : [];

        mbPage = document.getElementById("mb-page");
        if (!mbPage) return;

        mbPage.innerHTML = `
          <div class="detail-layout">
            <div class="detail-main">
              <div class="detail-top">
                <img src="${cover}" class="detail-poster" loading="lazy">
                <div class="detail-info">
                  <div class="detail-title">${esc(title)}</div>

                  <div class="detail-meta-line">
                    <b>Genre:</b> ${esc(genre)} &nbsp; • &nbsp;
                    <b>Country:</b> ${esc(country)} &nbsp; • &nbsp;
                    <b>Release:</b> ${esc(release)}
                  </div>

                  <p class="detail-desc">${esc(desc)}</p>

                  <div class="detail-buttons">
                    <a class="btn btn-watch-main" href="?watch=${id}">▶ Watch</a>
                  </div>
                </div>
              </div>

              <h2 class="section-title">Similar</h2>
              <div class="grid">
                ${
                  rec
                    .map((m) => {
                      const c = (m.cover && m.cover.url) || m.coverUrl || "";
                      const t = m.title || "Unknown";
                      return `
                      <a href="?detail=${m.subjectId}">
                        <div class="card">
                          <img src="${c}" loading="lazy">
                          <div class="card-title">${esc(t)}</div>
                        </div>
                      </a>
                    `;
                    })
                    .join("") || ""
                }
              </div>
            </div>
          </div>
        `;
      });
    });
  }

  /* ===================== WATCH ===================== */
  function pageWatch(id) {
    highlightNav("");
    setLoading();

    apiGET(DETAIL_ENDPOINT, { subjectId: id }, (res) => {
      const subject =
        res && res.data && res.data.subject ? res.data.subject : {};

      const title = subject.title || "Unknown Title";
      const cover = (subject.cover && subject.cover.url) || subject.coverUrl || "";

      let slug = subject.detailPath || subject.detail_path || "";
      if (slug && slug.indexOf("/") !== -1) {
        const parts = slug.split("/");
        slug = parts[parts.length - 1];
      }
      if (!slug) slug = "movie-" + id;

      const loklokUrl =
        "https://lok-lok.cc/spa/videoPlayPage/movies/" +
        encodeURIComponent(slug) +
        "?id=" +
        encodeURIComponent(id) +
        "&type=/movie/detail&lang=en";

      pushHistory({
        id: id,
        title: title,
        cover: cover,
        ts: Date.now(),
      });

      updateSEO({
        title: "Watch " + title + " – BlackMeMovie",
        description: "Streaming " + title + " online in HD on BlackMeMovie.",
        image: cover || "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
        url: location.href,
      });

      setJSONLD({
        "@context": "https://schema.org",
        "@type": "WatchAction",
        name: "Watch " + title,
        target: location.href,
      });

      mbPage = document.getElementById("mb-page");
      if (!mbPage) return;

      mbPage.innerHTML = `
        <h1>Watching: ${esc(title)}</h1>

        <div class="player-wrapper">
          <iframe
            class="player-iframe"
            src="${loklokUrl}"
            allowfullscreen
            scrolling="no"
            referrerpolicy="no-referrer-when-downgrade">
          </iframe>
        </div>

        <a class="btn" href="?detail=${id}" style="margin-top:10px;display:inline-block;">⬅ Back</a>
      `;
    });
  }

  /* ===================== HISTORY PAGE ===================== */
  function pageHistory() {
    highlightNav("");

    const list = readHistory();

    updateSEO({
      title: "Watch history – BlackMeMovie",
      description: "Your watch history on BlackMeMovie.",
      image: "https://i.ibb.co/2hR2qcF/moviebox-cover.jpg",
      url: location.href,
    });

    setJSONLD({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Watch history – BlackMeMovie",
      url: location.href,
      numberOfItems: list.length,
    });

    mbPage = document.getElementById("mb-page");
    if (!mbPage) return;

    if (!list.length) {
      mbPage.innerHTML = `
        <h1>Watch history</h1>
        <p style="color:#aaa;font-size:13px;margin-top:6px;">
          No history yet. Start watching something on BlackMeMovie.
        </p>
      `;
      return;
    }

    mbPage.innerHTML = `
      <h1>Watch history</h1>
      <div class="grid">
        ${
          list
            .map((item) => {
              return `
            <a href="?detail=${item.id}">
              <div class="card">
                <img src="${esc(item.cover)}" loading="lazy">
                <div class="card-title">${esc(cleanTitle(item.title))}</div>
                <div class="history-meta">
                  Last watched: ${new Date(item.ts || 0).toLocaleString()}
                </div>
              </div>
            </a>
          `;
            })
            .join("") || ""
        }
      </div>
    `;
  }

  /* ===================== ROUTER ===================== */
  function router() {
    mbPage = document.getElementById("mb-page");
    if (!mbPage) return;

    const params = new URLSearchParams(location.search);

    if (params.has("detail")) {
      pageDetail(params.get("detail"));
      return;
    }

    if (params.has("watch")) {
      pageWatch(params.get("watch"));
      return;
    }

    if (params.has("category")) {
      pageCategory(params.get("category"));
      return;
    }

    if (params.has("search")) {
      pageSearch(params.get("search"));
      return;
    }

    if (params.has("history")) {
      pageHistory();
      return;
    }

    pageHome();
  }

  /* INIT */
  layout();
  mbPage = document.getElementById("mb-page");
  router();

  window.addEventListener("popstate", router);

})();
