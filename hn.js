{\rtf1\ansi\ansicpg1254\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww16560\viewh25580\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 <div id="hn-domain-vote-checker"></div>\
\
<script>\
(function()\{\
  // 1) Inject Hacker News\'96style CSS\
  const hnStyle = document.createElement('style');\
  hnStyle.type = 'text/css';\
  hnStyle.textContent = `\
    body \{\
      background-color: #f6f6ef !important;\
      color: #333 !important;\
      font-family: Verdana, Arial, sans-serif !important;\
      font-size: 10pt !important;\
      line-height: 1.4 !important;\
      margin: 0 auto !important;\
      max-width: 850px !important;\
      padding: 10px !important;\
    \}\
    a \{ color: #0000ff !important; text-decoration: none !important; \}\
    a:visited \{ color: #828282 !important; \}\
    a:hover \{ text-decoration: underline !important; \}\
    input, button, select, textarea \{\
      font-family: Verdana, Arial, sans-serif !important;\
      font-size: 10pt !important;\
      border: 1px solid #ccc !important;\
      padding: 2px 4px !important;\
      margin: 2px 0 !important;\
    \}\
    button \{\
      background-color: #ff6600 !important;\
      color: #fff !important;\
      border: 1px solid #ff6600 !important;\
      cursor: pointer !important;\
    \}\
    button:hover \{\
      background-color: #ff5500 !important;\
      border-color: #ff5500 !important;\
    \}\
    table \{\
      width: 100% !important;\
      border-collapse: collapse !important;\
      margin-top: 8px !important;\
    \}\
    th, td \{\
      border: 1px solid #ccc !important;\
      padding: 4px 6px !important;\
      text-align: left !important;\
      font-size: 10pt !important;\
    \}\
    th \{\
      background-color: #eee !important;\
      font-weight: bold !important;\
    \}\
  `;\
  document.head.appendChild(hnStyle);\
\
  // 2) Helper: clean URL and extract host\
  function normalizeInput(raw) \{\
    const fixed = raw.includes('://') ? raw : 'http://' + raw;\
    const u = new URL(fixed);\
    // return both clean identifier and its host\
    const host = u.host.toLowerCase();\
    // reuse previous cleanUrl logic for query purposes\
    let cleaned = u.host + u.pathname +\
      (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');\
    cleaned = cleaned\
      .replace(/(#.+)$/, '')\
      .replace(/index\\.(php|html?)$/, '')\
      .replace(/\\/+$/, '');\
    return \{ cleaned, host \};\
  \}\
\
  // 3) Fetch all substring\uc0\u8208 matched stories\
  async function fetchAllHnStories(domainCleaned) \{\
    const base = `https://hn.algolia.com/api/v1/search?` +\
                 `query=$\{encodeURIComponent(domainCleaned)\}` +\
                 `&restrictSearchableAttributes=url&hitsPerPage=100`;\
    const first = await fetch(base + '&page=0').then(r => \{\
      if (!r.ok) throw new Error(r.status);\
      return r.json();\
    \});\
    let hits = [...first.hits];\
    const pages = first.nbPages;\
    const tasks = [];\
    for (let p = 1; p < pages; p++) \{\
      tasks.push(\
        fetch(base + `&page=$\{p\}`)\
          .then(r => r.json())\
          .then(d => d.hits)\
      );\
    \}\
    const rest = await Promise.all(tasks);\
    rest.forEach(arr => hits.push(...arr));\
    // dedupe by objectID\
    const unique = Array.from(new Map(hits.map(h => [h.objectID, h])).values());\
    return unique;\
  \}\
\
  // 4) Build UI (with history via datalist)\
  const container      = document.getElementById('hn-domain-vote-checker');\
  const input          = document.createElement('input');\
  const datalist       = document.createElement('datalist');\
  const btn            = document.createElement('button');\
  const resultDiv      = document.createElement('div');\
  const tableContainer = document.createElement('div');\
\
  datalist.id = 'domain-list';\
  input.setAttribute('list', 'domain-list');\
  input.type        = 'text';\
  input.placeholder = 'example.com';\
  input.style.marginRight = '8px';\
\
  btn.textContent = 'Check HN Submissions';\
\
  resultDiv.id = 'hn-vote-result';\
  resultDiv.style.fontWeight = '600';\
  resultDiv.style.marginTop = '8px';\
\
  tableContainer.id = 'hn-table-container';\
\
  container.append(input, datalist, btn, resultDiv, tableContainer);\
\
  // restore history\
  const STORAGE_KEY = 'hnDomainHistory';\
  let history = [];\
  try \{ history = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; \} catch \{\}\
  history.forEach(d => \{\
    const o = document.createElement('option');\
    o.value = d;\
    datalist.appendChild(o);\
  \});\
\
  // 5) Main lookup\
  async function doLookup() \{\
    const raw = input.value.trim();\
    tableContainer.innerHTML = '';\
    if (!raw) \{\
      resultDiv.textContent = '\uc0\u9888 \u65039  Please enter a domain.';\
      return;\
    \}\
\
    // get cleaned query + exact host\
    const \{ cleaned, host \} = normalizeInput(raw);\
    resultDiv.textContent = `Searching HN for exact host \'93$\{host\}\'94\'85`;\
\
    try \{\
      const all = await fetchAllHnStories(cleaned);\
\
      // filter for exact\uc0\u8208 host matches\
      const filtered = all.filter(hit => \{\
        try \{\
          const u = new URL(hit.url);\
          return u.host.toLowerCase() === host;\
        \} catch \{\
          return false;\
        \}\
      \});\
\
      // totals\
      const totalSub = filtered.length;\
      const totalUp  = filtered.reduce((s,h) => s + (h.points||0), 0);\
      resultDiv.textContent =\
        `Found $\{totalSub\} submissions for $\{host\}, totaling $\{totalUp\} upvotes`;\
\
      // sort by upvotes desc\
      const sorted = filtered.sort((a,b) => (b.points||0) - (a.points||0));\
\
      // render full table\
      const table = document.createElement('table');\
      table.innerHTML = `\
        <thead>\
          <tr>\
            <th>Story</th><th>Upvotes</th><th>Submitter</th>\
            <th>Comments</th><th>Date</th>\
          </tr>\
        </thead>\
        <tbody>\
          $\{sorted.map(h => \{\
            const dt = new Date(h.created_at_i * 1000);\
            const date = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();\
            const title = h.title\
              .replace(/&/g,'&amp;')\
              .replace(/</g,'&lt;')\
              .replace(/>/g,'&gt;');\
            return `\
              <tr>\
                <td>\
                  <a href="https://news.ycombinator.com/item?id=$\{h.objectID\}"\
                     target="_blank" rel="noopener">\
                    $\{title\}\
                  </a>\
                </td>\
                <td>$\{h.points\}</td>\
                <td>$\{h.author\}</td>\
                <td>$\{h.num_comments||0\}</td>\
                <td>$\{date\}</td>\
              </tr>`;\
          \}).join('')\}\
        </tbody>\
      `;\
      tableContainer.appendChild(table);\
\
      // update history\
      if (!history.includes(host)) \{\
        history.push(host);\
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));\
        const o = document.createElement('option');\
        o.value = host;\
        datalist.appendChild(o);\
      \}\
\
    \} catch (err) \{\
      resultDiv.textContent = `Error: $\{err.message\}`;\
    \}\
  \}\
\
  // 6) Wire up click + Enter\
  btn.addEventListener('click', doLookup);\
  input.addEventListener('keydown', e => \{\
    if (e.key === 'Enter') \{\
      e.preventDefault();\
      doLookup();\
    \}\
  \});\
\
\})();\
</script>\
}