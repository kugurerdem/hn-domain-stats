const
    // Model & State
    YEARLY_RESOLUTION = 'yearly',
    MONTHLY_RESOLUTION = 'monthly',
    WEEKLY_RESOLUTION = 'weekly',
    DAILY_RESOLUTION = 'daily',

    state = {
        domain: '',
        submissions: null, // null if not analyzed, otherwise [...submissions]
        chartInstance: null,
        resolution: MONTHLY_RESOLUTION,
    },

    // Components
    App = () => `
        ${Header()}
        <div class="section form">
            ${DomainInput()}
            ${AnalyzeButton()}
        </div>

        ${state.submissions?.length > 0 ? `
            <div class="section">
                <h2>Analytics Overview</h2>
                ${AnalyticsCards()}
            </div>
            <div class="section">
                <h2>Submission Trends</h2>
                ${ResolutionSelector()}
                <canvas id="chart" width="400" height="200">
                </canvas>
            </div>
        ` : ''}

        ${state.submissions !== null ? `
            <div class="section">
                <h2>Submission History</h2>
                ${ResultList()}
            </div>
        ` : ''}
    `,

    Header = () => `
        <header>
            <h1>HN Domain Analyzer</h1>
        </header>
    `,

    DomainInput = () => {
        return `
            <input
                type="text" id="domain"
                placeholder="Enter domain (e.g., example.com)"
                value="${state.domain}"
                oninput="onDomainInputChange(event)"
            />
        `
    },

    AnalyzeButton = () => `
        <button id="analyze-button" onclick="onAnalyzeButtonClick()">
            Analyze Domain
        </button>
    `,

    AnalyticsCards = () => {
        const { submissions } = state;

        if (!submissions || submissions.length === 0) return '';

        const totalPoints = submissions.reduce((sum, item) => sum + (item.points || 0), 0);
        const totalComments = submissions.reduce((sum, item) => sum + (item.num_comments || 0), 0);
        const uniqueAuthors = new Set(submissions.map(item => item.author)).size;
        const avgPoints = Math.round(totalPoints / submissions.length);
        const avgComments = Math.round(totalComments / submissions.length);

        // Calculate time-based stats
        const dates = submissions.map(item => new Date(item.created_at));
        const firstPost = new Date(Math.min(...dates));
        const now = new Date();
        const monthsSinceFirst = Math.round((now - firstPost) / (30 * 24 * 60 * 60 * 1000));
        const avgMonthlyPosts = (submissions.length / monthsSinceFirst).toFixed(1);

        // Format time period
        const years = Math.floor(monthsSinceFirst / 12);
        const months = monthsSinceFirst % 12;
        const timePeriod = years > 0
            ? `${years} year${years > 1 ? 's' : ''}${months > 0 ? `, ${months} month${months > 1 ? 's' : ''}` : ''}`
            : `${months} month${months > 1 ? 's' : ''}`;

        return `
            <div class="analytics-cards">
                <div class="stat-card">
                    <div class="label">Submissions</div>
                    <div class="value">${submissions.length}</div>
                    <div class="secondary">From ${uniqueAuthors} unique submitters</div>
                    <div class="secondary">Average ${avgMonthlyPosts} posts/month</div>
                </div>
                <div class="stat-card">
                    <div class="label">Upvotes</div>
                    <div class="value">${totalPoints}</div>
                    <div class="secondary">Average: ${avgPoints} per post</div>
                </div>
                <div class="stat-card">
                    <div class="label">Comments</div>
                    <div class="value">${totalComments}</div>
                    <div class="secondary">Average: ${avgComments} per post</div>
                </div>
                <div class="stat-card">
                    <div class="label">Time Period</div>
                    <div class="value">${timePeriod}</div>
                    <div class="secondary">Since first submission</div>
                </div>
            </div>
        `;
    },


    ResultList = () => {
        const { submissions } = state;

        if (submissions.length === 0) return '<p> No results found </p>';

        return `
            <ul>
                ${submissions.map(item => `
                    <li>
                        <a href="${item.url}" target="_blank">${item.title}</a><br/>
                        <small>
                            Submitted by <a href="https://news.ycombinator.com/user?id=${item.author}" target="_blank">${item.author}</a>
                            | Points: ${item.points} | Comments: ${item.num_comments}
                        </small>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    },

    ResolutionSelector = () => `
        <div>
            <label for="resolution">Time Resolution:</label>
            <select id="resolution" onchange="onResolutionChange(event)">
                <option value="${DAILY_RESOLUTION}">Daily</option>
                <option value="${WEEKLY_RESOLUTION}">Weekly</option>
                <option value="${MONTHLY_RESOLUTION}" selected>Monthly</option>
                <option value="${YEARLY_RESOLUTION}">Yearly</option>
            </select>
        </div>
    `,

    // Listeners

    onDomainInputChange = (event) => {
        state.domain = event.target.value
        console.log('Domain:', state.domain)
    },

    onResolutionChange = (event) => {
        state.resolution = event.target.value;
        drawChart(state.submissions); // Re-render chart with new resolution
    },

    onAnalyzeButtonClick = async () => {
        if (!state.domain) {
            alert('Please enter a domain.');
            return;
        }

        const normalizedDomain = state.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
            const baseUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(state.domain)}&restrictSearchableAttributes=url&tags=story`;

            try {
                // Step 1: Fetch the first page
                const firstResponse = await fetch(`${baseUrl}&page=0`);
                const firstData = await firstResponse.json();

                const totalPages = firstData.nbPages;
                let allHits = firstData.hits;

                // Step 2: Fetch remaining pages concurrently
                const pagePromises = [];

                for (let i = 1; i < totalPages; i++) {
                    pagePromises.push(fetch(`${baseUrl}&page=${i}`).then(res => res.json()));
                }

                const remainingPages = await Promise.all(pagePromises);

                // Step 3: Combine all hits
                for (const pageData of remainingPages) {
                    allHits = allHits.concat(pageData.hits);
                }

                // Step 4: Filter by exact domain match
                state.submissions = allHits.filter(item => {
                    try {
                        const itemDomain = new URL(item.url).hostname.toLowerCase().replace(/^www\./, '');
                        return itemDomain === normalizedDomain;
                    } catch {
                        return false;
                    }
                });


                render();
                drawChart(state.submissions);
            } catch (error) {
                console.error('Error fetching data:', error);
                state.submissions = [];
                render();
            }
    },

    // Utilities

    drawChart = (submissions) => {
        if (!submissions.length) return;

        const aggregated = {};

        const fmt = (date) => {
            switch (state.resolution) {
                case DAILY_RESOLUTION:
                    return date.toISOString().split('T')[0];
                case WEEKLY_RESOLUTION: {
                    const firstDay = new Date(date);
                    const day = firstDay.getDay();
                    const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1); // ISO week start (Monday)
                    const monday = new Date(firstDay.setDate(diff));
                    return `${monday.getFullYear()}-W${String(getISOWeek(monday)).padStart(2, '0')}`;
                }
                case MONTHLY_RESOLUTION:
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                case YEARLY_RESOLUTION:
                    return `${date.getFullYear()}`;
                default:
                    return date.toISOString().split('T')[0];
            }
        };

        const getISOWeek = (date) => {
            const target = new Date(date.valueOf());
            const dayNr = (date.getDay() + 6) % 7;
            target.setDate(target.getDate() - dayNr + 3);
            const firstThursday = new Date(target.getFullYear(), 0, 4);
            const diff = target - firstThursday;
            return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
        };

        for (const item of submissions) {
            const date = new Date(item.created_at);
            const key = fmt(date);

            if (!aggregated[key]) {
                aggregated[key] = { upvotes: 0, comments: 0, posts: 0 };
            }

            aggregated[key].upvotes += item.points || 0;
            aggregated[key].comments += item.num_comments || 0;
            aggregated[key].posts += 1
        }

        const labels = Object.keys(aggregated).sort();
        const upvotes = labels.map(label => aggregated[label].upvotes);
        const comments = labels.map(label => aggregated[label].comments);
        const posts = labels.map(label => aggregated[label].posts);

        const ctx = document.getElementById('chart').getContext('2d');
        if (state.chartInstance) state.chartInstance.destroy();


        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Upvotes',
                        data: upvotes,
                        backgroundColor: 'rgba(255,165,0,0.6)',
                        yAxisID: 'y1',
                        type: 'bar'
                    },
                    {
                        label: 'Comments',
                        data: comments,
                        backgroundColor: 'rgba(70,130,180,0.6)',
                        yAxisID: 'y1',
                        type: 'bar'
                    },
                    {
                        label: 'Posts',
                        data: posts,
                        borderColor: 'rgba(34,139,34,1)',
                        backgroundColor: 'rgba(34,139,34,0.1)',
                        yAxisID: 'y2',
                        type: 'line',
                        tension: 0.3,           // Optional: smooth the line
                        fill: false,            // No area fill
                        pointRadius: 3,         // Small points
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    title: {
                        display: true,
                        text: `Aggregated (${state.resolution}) HN Submissions`
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Time' }
                    },
                    y1: {
                        beginAtZero: true,
                        title: { display: true, text: 'Upvotes & Comments' },
                        position: 'left'
                    },
                    y2: {
                        beginAtZero: true,
                        title: { display: true, text: 'Posts' },
                        position: 'right',
                        grid: { drawOnChartArea: false } // Optional: avoid clutter from y2 grid
                    }
                }
            }
        });
    },

    // Render

    root = document.getElementById('app'),

    render = () => root.innerHTML = App()

// Initial render
document.addEventListener('DOMContentLoaded', render)
