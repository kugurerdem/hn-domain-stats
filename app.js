const githubLink = 'https://github.com/kugurerdem/hnstats'

const RESOLUTIONS = {
    YEARLY: 'yearly',
    MONTHLY: 'monthly',
    WEEKLY: 'weekly',
    DAILY: 'daily',
}

const state = {
    domain: '',
    submissions: null, // null if not analyzed, otherwise [...submissions]
    chartInstance: null,
    resolution: RESOLUTIONS.MONTHLY,
    loading: false,
}

// Components
const App = () => `
    <header>
        <h1> HN Domain Stats </h1>
        <a href="${githubLink}" class="github-link" target="_blank">
            <i class="fab fa-github"></i> View on GitHub
        </a>
    </header>
    <div class="section form">
        <input
            type="text" id="domain"
            placeholder="Enter domain (e.g., example.com)"
            value="${state.domain}" 
            oninput="onDomainInputChange(event)"
            onkeydown="if(event.key === 'Enter') onAnalyzeButtonClick()" />
        <button
            id="analyze-button" onclick="onAnalyzeButtonClick()"
            ${state.loading ? 'disabled' : ''}>
            ${state.loading
                ? '<i class="fas fa-spinner fa-spin"></i> Analyzing...'
                : 'Analyze Domain'}
        </button>
    </div>

    ${state.submissions?.length ? `
        <div class="section">
            <h2>Analytics Overview</h2>${AnalyticsCards()}
        </div>
        <div class="section">
            <h2>Submission Trends</h2>
            ${ResolutionSelector()}
            <canvas id="chart"></canvas>
        </div>
    ` : ''}

    ${state.submissions !== null
        ? `<div class="section">
            <h2>Submission History</h2>
            ${ResultList()}
        </div>`
        : ''}
`

const AnalyticsCards = () => {
    const { submissions } = state
    if (!submissions?.length) return ''

    const count = submissions.length
    const points = _.sumBy(submissions, 'points')
    const comments = _.sumBy(submissions, 'num_comments')
    const authors = _.uniq(submissions.map(x => x.author)).length
    const avg = (n) => Math.round(n / count)

    const avgMonthly = (() => {
        const dates = submissions.map(x => new Date(x.created_at))
        const months = Math.max(1, Math.round(
            (Date.now() - _.min(dates)) / (30 * 24 * 3600 * 1000)
        ))
        return { months, perMonth: (count / months).toFixed(1) }
    })()

    const { months, perMonth } = avgMonthly
    const y = Math.floor(months / 12), m = months % 12

    const time = formatTimePeriod(y, m)

    const card = (icon, label, val, sub) => `
        <div class="stat-card">
          <div class="label"><i class="${icon}"></i>${label}</div>
          <div class="value">${val}</div>
          ${sub ? `<div class="secondary">${sub}</div>` : ''}
        </div>
    `

    /* eslint-disable max-len */
    return `<div class="analytics-cards">
        ${card('fas fa-newspaper', 'Submissions', count, `From ${authors} unique submitters<br>Avg ${perMonth} posts/month`)}
        ${card('fas fa-arrow-up', 'Upvotes', points, `Average: ${avg(points)} per post`)}
        ${card('fas fa-comments', 'Comments', comments, `Average: ${avg(comments)} per post`)}
        ${card('fas fa-clock', 'Time Period', time, 'Since first submission')}
      </div>`
    /* eslint-enable */
}

const ResultList = () => {
    const { submissions } = state

    if (submissions.length === 0) return '<p> No results found </p>'

    /* eslint-disable max-len */
    return `
        <ul>
            ${submissions.map(item => `
                <li>
                    <a href="${item.url}" target="_blank">${item.title}</a><br/>
                    <small>
                        <i class="fas fa-calendar"></i> ${new Date(item.created_at).toLocaleDateString()}
                        | <i class="fas fa-user"></i> <a href="https://news.ycombinator.com/user?id=${item.author}" target="_blank">${item.author}</a>
                        | <i class="fas fa-arrow-up"></i> ${item.points}
                        | <i class="fas fa-comments"></i> ${item.num_comments}
                        | <a href="https://news.ycombinator.com/item?id=${item.objectID}" target="_blank"><i class="fab fa-hacker-news"></i> Discussion</a>
                    </small>
                </li>
            `).join('')}
        </ul>
    `
    /* eslint-enable */
}

const ResolutionSelector = () => `
    <div>
        <label for="resolution">Time Resolution:</label>
        <select id="resolution" onchange="onResolutionChange(event)">
            <option value="${RESOLUTIONS.DAILY}">Daily</option>
            <option value="${RESOLUTIONS.WEEKLY}">Weekly</option>
            <option value="${RESOLUTIONS.MONTHLY}" selected>Monthly</option>
            <option value="${RESOLUTIONS.YEARLY}">Yearly</option>
        </select>
    </div>
`

// Listeners

const onDomainInputChange = (event) => state.domain = event.target.value

const onResolutionChange = (event) => {
    state.resolution = event.target.value
    drawChart(state.submissions); // Re-render chart with new resolution
}

const onAnalyzeButtonClick = async () => {
    if (!state.domain) {
        alert('Please enter a domain.')
        return
    }

    state.loading = true
    render()

    /* eslint-disable max-len */
    const normalizedDomain = normalizeDomain(state.domain)
    const baseUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(state.domain)}&restrictSearchableAttributes=url&tags=story`
    /* eslint-enable */

    try {
        const firstPage =
            await fetch(`${baseUrl}&page=0`).then(res => res.json())

        const remainingPages = await Promise.all(
            _.range(1, firstPage.nbPages)
            .map(i => fetch(`${baseUrl}&page=${i}`).then(res => res.json()))
        )
        const pages = [firstPage, ...remainingPages]
        const allHits = _.flatMap(pages, 'hits')

        state.submissions =
            allHits.filter(h => normalizeDomain(h.url) === normalizedDomain)
    } catch (error) {
        console.error('Error fetching data:', error)
        alert('Error fetching data. Please try again later.')
        state.submissions = []
    }

    state.loading = false

    render()
    if (state.submissions)
        drawChart(state.submissions)
}

// Utilities

const formatDate = (date) => {
    const getISOWeek = (d) => {
        const target = new Date(d.valueOf())
        target.setDate(target.getDate() - ((d.getDay() + 6) % 7) + 3)
        const firstThursday = new Date(target.getFullYear(), 0, 4)
        // eslint-disable-next-line max-len
        return 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000))
    }

    switch (state.resolution) {
        case RESOLUTIONS.DAILY:
            return date.toISOString().split('T')[0]
        case RESOLUTIONS.WEEKLY: {
            const monday = new Date(date)
            monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
            // eslint-disable-next-line max-len
            return `${monday.getFullYear()}-W${String(getISOWeek(monday)).padStart(2, '0')}`
        }
        case RESOLUTIONS.MONTHLY:
            // eslint-disable-next-line max-len
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        default:
            return `${date.getFullYear()}`
    }
}

const drawChart = (submissions) => {
    if (!submissions.length) return

    const aggregated = _.groupBy(submissions, i => formatDate(new Date(i.created_at)))

    const data = _.mapValues(aggregated, items => ({
        upvotes: _.sumBy(items, 'points'),
        comments: _.sumBy(items, 'num_comments'),
        posts: items.length
    }))

    const labels = Object.keys(data).sort()
    const metrics = ['upvotes', 'comments', 'posts']
    const values = metrics.map(m => labels.map(l => data[l][m]))

    /* eslint-disable max-len */
    const datasets = [
        { label: 'Upvotes', data: values[0], backgroundColor: 'rgba(255,165,0,0.6)', yAxisID: 'y1', type: 'bar' },
        { label: 'Comments', data: values[1], backgroundColor: 'rgba(70,130,180,0.6)', yAxisID: 'y1', type: 'bar' },
        { label: 'Posts', data: values[2], borderColor: 'rgba(34,139,34,1)', backgroundColor: 'rgba(34,139,34,0.1)',
          yAxisID: 'y2', type: 'line', tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2 }
    ]

    const ctx = document.getElementById('chart').getContext('2d')
    if (state.chartInstance) state.chartInstance.destroy()

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `Aggregated (${state.resolution}) HN Submissions` }
            },
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y1: { beginAtZero: true, title: { display: true, text: 'Upvotes & Comments' }, position: 'left' },
                y2: { beginAtZero: true, title: { display: true, text: 'Posts' }, position: 'right',
                     grid: { drawOnChartArea: false } }
            }
        }
    })
    /* eslint-enable */
}

const formatTimePeriod = (years, months) => {
    if (years === 0)
        return `${months} month${months > 1 ? 's' : ''}`

    const yearText = `${years} year${years > 1 ? 's' : ''}`
    const monthText =
        months ? `, ${months} month${months > 1 ? 's' : ''}` : ''

    return yearText + monthText
}

const normalizeDomain = urlOrDomain => {
    if (typeof urlOrDomain !== 'string') return null

    try {
        const host = new URL(
            /^https?:\/\//.test(urlOrDomain)
                ? urlOrDomain
                : `http://${urlOrDomain}`
        ).hostname

        return host.replace(/^www\./, '').toLowerCase()
    } catch {
        return null
    }
}

// Render

const root = document.getElementById('app')

const render = () => root.innerHTML = App()

// Initial render
document.addEventListener('DOMContentLoaded', render)
