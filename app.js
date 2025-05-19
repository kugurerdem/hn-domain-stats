import {
    init, h, classModule, propsModule, styleModule, eventListenersModule,
} from 'https://cdn.jsdelivr.net/npm/snabbdom@3.6.2/+esm';

import createTags from 'https://cdn.skypack.dev/hyperscript-helpers';

const {
    button, header, br, div, i, input, p, a,
    h1, h2, label, select, option, ul, li, small,
} = createTags(h);

const patch =
    init([classModule, propsModule, styleModule, eventListenersModule]);

const githubLink = 'https://github.com/kugurerdem/hn-domain-stats';
const RESOLUTIONS =
    {YEARLY: 'yearly', MONTHLY: 'monthly', WEEKLY: 'weekly', DAILY: 'daily'};

const state = {
    domain: '',
    submissions: null,
    chartInstance: null,
    resolution: RESOLUTIONS.MONTHLY,
    loading: false,
};

const App = () => div([
    header([
        h1('HN Domain Stats'),
        a('.github-link', {props: {href: githubLink, target: '_blank'}}, [
            i('.fab.fa-github'),
            ' View on GitHub',
        ]),
    ]),
    div('.section.form', [
        input({
            props: {
                type: 'text',
                placeholder: 'Enter domain (e.g., example.com)',
                value: state.domain,
            },
            on: {
                input: onInput,
                keydown: e => e.key === 'Enter' && onAnalyze(),
            },
        }),
        button({props: {disabled: state.loading}, on: {click: onAnalyze}},
            state.loading
                ? [i('.fas.fa-spinner'), ' Analyzing...'] : 'Analyze Domain',
        ),
    ]),
    ...(state.submissions?.length ? [
        div('.section', [
            h2('Analytics Overview'),
            AnalyticsCards(),
        ]),
        div('.section', [h2('Submission Trends'),
            ResolutionSelector(),
            h('canvas', {props: {id: 'chart'}}),
        ]),
    ] : []),
    ...(state.submissions !== null ? [
        div('.section', [
            h2('Submission History'),
            ResultList(),
        ]),
    ] : []),
]);

const AnalyticsCards = () => {
    const {submissions} = state;
    const count = submissions.length;
    const points = _.sumBy(submissions, 'points');
    const comments = _.sumBy(submissions, 'num_comments');
    const authors = _.uniq(submissions.map(x => x.author)).length;
    const avg = n => Math.round(n / count);

    const months = Math.max(1, Math.round(
        (Date.now() - Math.min(...submissions.map(x => new Date(x.created_at)))) / (30 * 24 * 3600 * 1000))); // eslint-disable-line max-len
    const perMonth = (count / months).toFixed(1);
    const time = formatTimePeriod(Math.floor(months / 12), months % 12);

    const card = (icon, labelText, val, sub) => div('.stat-card', [
        div('.label', [i('.fas.' + icon), labelText]),
        div('.value', val),
        sub && div('.secondary', {props: {innerHTML: sub}}),
    ]);

    return div('.analytics-cards', [
        /* eslint-disable max-len */
        card('fa-newspaper', 'Submissions', count, `From ${authors} unique submitters<br>Avg ${perMonth} posts/month`),
        card('fa-arrow-up', 'Upvotes', points, `Average: ${avg(points)} per post`),
        card('fa-comments', 'Comments', comments, `Average: ${avg(comments)} per post`),
        card('fa-clock', 'Time Period', time, 'Since first submission'),
        /* eslint-enable max-len */
    ]);
};

const ResolutionSelector = () => div([
    label({props: {for: 'resolution'}}, 'Time Resolution:'),
    select({
        props: {id: 'resolution', value: state.resolution},
        on: {change: onResolutionChange},
        // eslint-disable-next-line no-unused-vars
    }, Object.entries(RESOLUTIONS).map(([_, val]) =>
        option({
            props: {
                value: val,
                selected: val === state.resolution,
            },
        }, val[0].toUpperCase() + val.slice(1)),
    )),
]);

const ResultList = () => {
    const items = state.submissions;
    if (!items.length) return p('No results found');

    return ul(items.map(item =>
        li([
            a({props: {href: item.url, target: '_blank'}}, item.title),
            br(),
            small([
                i('.fas.fa-calendar'),
                ' ', new Date(item.created_at).toLocaleDateString(),
                ' | ', i('.fas.fa-user'), ' ',
                a(
                    {props: {href: `https://news.ycombinator.com/user?id=${item.author}`, target: '_blank'}}, // eslint-disable-line max-len
                    item.author,
                ),
                ' | ', i('.fas.fa-arrow-up'), ` ${item.points}`,
                ' | ', i('.fas.fa-comments'), ` ${item.num_comments}`,
                ' | ', a({
                    props: {
                        href: `https://news.ycombinator.com/item?id=${item.objectID}`, // eslint-disable-line max-len
                        target: '_blank',
                    },
                }, [i('.fab.fa-hacker-news'), ' Discussion']),
            ]),
        ]),
    ));
};

const onInput = e => state.domain = e.target.value;

const onResolutionChange = e => {
    state.resolution = e.target.value;
    drawChart(state.submissions);
};

const onAnalyze = async () => {
    if (!state.domain) return alert('Please enter a domain.');
    state.loading = true;
    rerender();

    const normalized = normalizeDomain(state.domain);
    const baseUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(state.domain)}&restrictSearchableAttributes=url&tags=story`; // eslint-disable-line max-len

    try {
        const firstPage = await fetch(`${baseUrl}&page=0`).then(r => r.json());
        const pages = await Promise.all(
            _.range(1, firstPage.nbPages).map(i =>
                fetch(`${baseUrl}&page=${i}`).then(r => r.json())),
        );
        const allHits = [firstPage, ...pages].flatMap(p => p.hits);
        state.submissions =
            allHits.filter(h => normalizeDomain(h.url) === normalized);
    } catch (err) {
        console.error(err);
        alert('Error fetching data.');
        state.submissions = [];
    }

    state.loading = false;
    rerender();
    if (state.submissions) drawChart(state.submissions);
};

const normalizeDomain = urlOrDomain => {
    try {
        const host = new URL(
            /^https?:\/\//.test(urlOrDomain)
                ? urlOrDomain
                : `http://${urlOrDomain}`,
        ).hostname;
        return host.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
};

const drawChart = (submissions) => {
    if (!submissions.length) return;
    const grouped =
        _.groupBy(submissions, s => formatDate(new Date(s.created_at)));
    const labels = Object.keys(grouped).sort();
    const metrics = ['points', 'num_comments', 'posts'];
    const data = _.mapValues(grouped, items => ({
        points: _.sumBy(items, 'points'),
        num_comments: _.sumBy(items, 'num_comments'),
        posts: items.length,
    }));
    const values = metrics.map(m => labels.map(l => data[l][m]));

    const ctx = document.getElementById('chart')?.getContext('2d');
    if (!ctx) return;
    if (state.chartInstance) state.chartInstance.destroy();

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                /* eslint-disable max-len */
                {label: 'Upvotes', data: values[0], backgroundColor: 'rgba(255,165,0,0.6)', yAxisID: 'y1', type: 'bar'},
                {label: 'Comments', data: values[1], backgroundColor: 'rgba(70,130,180,0.6)', yAxisID: 'y1', type: 'bar'},
                {label: 'Posts', data: values[2], borderColor: 'rgba(34,139,34,1)', backgroundColor: 'rgba(34,139,34,0.1)',
                    yAxisID: 'y2', type: 'line', tension: 0.3, fill: false, pointRadius: 3, borderWidth: 2},
                /* eslint-enable max-len */
            ],
        },
        options: {
            responsive: true,
            /* eslint-disable max-len */
            plugins: {
                title: {display: true, text: `Aggregated (${state.resolution}) HN Submissions`},
                legend: {position: 'top'},
            },
            scales: {
                x: {title: {display: true, text: 'Time'}},
                y1: {beginAtZero: true, title: {display: true, text: 'Upvotes & Comments'}, position: 'left'},
                y2: {beginAtZero: true, title: {display: true, text: 'Posts'}, position: 'right', grid: {drawOnChartArea: false}},
            /* eslint-enable max-len */
            },
        },
    });
};

const formatDate = (date) => {
    const getISOWeek = d => {
        const target = new Date(d.valueOf());
        target.setDate(target.getDate() - ((d.getDay() + 6) % 7) + 3);
        const firstThursday = new Date(target.getFullYear(), 0, 4);
        return 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000)); // eslint-disable-line max-len
    };

    switch (state.resolution) {
    case RESOLUTIONS.DAILY: return date.toISOString().split('T')[0];
    case RESOLUTIONS.WEEKLY: {
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
        // eslint-disable-next-line max-len
        return `${monday.getFullYear()}-W${String(getISOWeek(monday)).padStart(2, '0')}`;
    }
    case RESOLUTIONS.MONTHLY:
        // eslint-disable-next-line max-len
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case RESOLUTIONS.YEARLY:
        return `${date.getFullYear()}`;
    }
};

const formatTimePeriod = (y, m) =>
    (y ? `${y} year${y > 1 ? 's' : ''}` : '') +
        (m ? `${y ? ', ' : ''}${m} month${m > 1 ? 's' : ''}` : '');

let vnode = document.getElementById('app');
const rerender = () => vnode = patch(vnode, App());

document.addEventListener('DOMContentLoaded', rerender);
