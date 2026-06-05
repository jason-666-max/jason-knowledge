// Jason's Knowledge — Knowledge Graph Visualization (Obsidian-style)
(function(){
    var container = document.getElementById('graphContainer');
    if (!container) return;
    var svg = d3.select('#graphSvg');
    var width = container.clientWidth;
    var height = 620;
    svg.attr('width', width).attr('height', height);

    var data = GRAPH_DATA;
    var nodes = data.nodes.map(function(d) { return Object.assign({}, d); });
    var links = data.links.map(function(d) { return Object.assign({}, d); });

    // --- Theme-aware colors ---
    var colors = {
        dark: {
            linkStroke: '#52525B', linkOpacity: 0.12,
            labelFill: '#D4D4D8', hoverStroke: '#FAFAFA',
            linkHoverActive: '#EC4899', linkHoverDim: '#52525B',
            dimmedOpacity: 0.15
        },
        light: {
            linkStroke: '#A1A1AA', linkOpacity: 0.15,
            labelFill: '#3F3F46', hoverStroke: '#18181B',
            linkHoverActive: '#EC4899', linkHoverDim: '#A1A1AA',
            dimmedOpacity: 0.12
        }
    };
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }
    function c() { return colors[getTheme()]; }

    // --- Build neighbor map for hover highlighting ---
    var neighborMap = {};
    nodes.forEach(function(n) { neighborMap[n.id] = new Set(); });
    links.forEach(function(l) {
        var src = typeof l.source === 'string' ? l.source : l.source.id;
        var tgt = typeof l.target === 'string' ? l.target : l.target.id;
        neighborMap[src].add(tgt);
        neighborMap[tgt].add(src);
    });

    var g = svg.append('g');
    var zoom = d3.zoom().scaleExtent([0.3, 4]).on('zoom', function(e) {
        g.attr('transform', e.transform);
    });
    svg.call(zoom);
    var initialScale = width > 768 ? 0.95 : 0.75;
    svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(initialScale));

    // Force simulation
    var sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(function(d) { return d.id; })
            .distance(function(d) {
                return (d.source.type === 'wiki' || d.target.type === 'wiki') ? 60 : 30;
            }).strength(0.6))
        .force('charge', d3.forceManyBody().strength(function(d) {
            return d.type === 'wiki' ? -100 : (d.size <= 4 ? -3 : -40);
        }))
        .force('center', d3.forceCenter(0, 0).strength(0.5))
        .force('collision', d3.forceCollide(function(d) { return d.size + (d.size <= 4 ? 14 : 6); }));

    // Links
    var link = g.append('g').selectAll('line').data(links).join('line')
        .attr('class', 'graph-link')
        .attr('stroke', c().linkStroke)
        .attr('stroke-opacity', c().linkOpacity)
        .attr('stroke-width', 0.8);

    // Nodes
    var node = g.append('g').selectAll('g').data(nodes).join('g');

    node.append('circle')
        .attr('class', 'node-circle')
        .attr('r', function(d) { return d.size; })
        .attr('fill', function(d) { return d.color; })
        .attr('opacity', function(d) { return d.type === 'wiki' ? 1 : 0.85; })
        .on('click', function(e, d) { if (d.url) window.location.href = d.url; })
        .on('mouseenter', function(e, d) { highlightNode(d); })
        .on('mouseleave', function(e, d) { clearHighlight(); });

    var labels = node.append('text')
        .attr('class', 'node-label')
        .attr('x', function(d) { return d.size + 5; })
        .attr('y', 3)
        .attr('fill', c().labelFill)
        .text(function(d) { return d.name; });

    // --- Hover highlighting (theme-aware) ---
    function highlightNode(d) {
        var neighbors = neighborMap[d.id];
        var hoveredId = d.id;
        var theme = getTheme();
        var dimOp = colors[theme].dimmedOpacity;
        var hsColor = colors[theme].hoverStroke;
        var laColor = colors[theme].linkHoverActive;
        var ldColor = colors[theme].linkHoverDim;
        var labelColor = colors[theme].labelFill;

        node.select('circle').transition().duration(200)
            .attr('opacity', function(n) {
                if (n.id === hoveredId) return 1;
                if (neighbors.has(n.id)) return 1;
                return dimOp;
            })
            .attr('r', function(n) {
                if (n.id === hoveredId) return n.size + 2;
                if (neighbors.has(n.id)) return n.size + 1;
                return n.size * 0.7;
            })
            .attr('stroke', function(n) {
                if (n.id === hoveredId || neighbors.has(n.id)) return hsColor;
                return 'none';
            })
            .attr('stroke-width', function(n) {
                if (n.id === hoveredId) return 2;
                if (neighbors.has(n.id)) return 1.5;
                return 0;
            });

        node.select('.node-label')
            .classed('visible', function(n) {
                return n.id === hoveredId || neighbors.has(n.id);
            })
            .attr('fill', labelColor);

        link.transition().duration(200)
            .attr('stroke-opacity', function(l) {
                var src = typeof l.source === 'string' ? l.source : l.source.id;
                var tgt = typeof l.target === 'string' ? l.target : l.target.id;
                if (src === hoveredId || tgt === hoveredId) return 0.5;
                return dimOp / 2;
            })
            .attr('stroke-width', function(l) {
                var src = typeof l.source === 'string' ? l.source : l.source.id;
                var tgt = typeof l.target === 'string' ? l.target : l.target.id;
                if (src === hoveredId || tgt === hoveredId) return 1.5;
                return 0.5;
            })
            .attr('stroke', function(l) {
                var src = typeof l.source === 'string' ? l.source : l.source.id;
                var tgt = typeof l.target === 'string' ? l.target : l.target.id;
                if (src === hoveredId || tgt === hoveredId) return laColor;
                return ldColor;
            });
    }

    function clearHighlight() {
        var theme = getTheme();
        var linkColor = colors[theme].linkStroke;
        var linkOpacity = colors[theme].linkOpacity;
        var labelColor = colors[theme].labelFill;

        node.select('circle').transition().duration(200)
            .attr('opacity', function(d) { return d.type === 'wiki' ? 1 : 0.85; })
            .attr('r', function(d) { return d.size; })
            .attr('stroke', 'none')
            .attr('stroke-width', 0);
        node.select('.node-label')
            .classed('visible', false)
            .attr('fill', labelColor);
        link.transition().duration(200)
            .attr('stroke-opacity', linkOpacity)
            .attr('stroke-width', 0.8)
            .attr('stroke', linkColor);
    }

    // --- Node dragging ---
    var dragHandler = d3.drag()
        .on('start', function(e, d) {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on('drag', function(e, d) {
            d.fx = e.x;
            d.fy = e.y;
        })
        .on('end', function(e, d) {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });

    node.call(dragHandler);

    // --- Theme change handler: re-apply SVG colors ---
    function applyThemeColors() {
        var t = getTheme();
        var lc = colors[t].linkStroke;
        var lo = colors[t].linkOpacity;
        var lf = colors[t].labelFill;

        link.attr('stroke', lc).attr('stroke-opacity', lo);
        labels.attr('fill', lf);
    }

    // Listen for theme changes (triggered by the theme toggle button elsewhere)
    var themeObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            if (m.attributeName === 'data-theme') {
                applyThemeColors();
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Legend
    var legendColors = {
        '#FBBF24': '阶层与社会',
        '#34D399': '传承与家族',
        '#FB923C': '处世与人际',
        '#A78BFA': '接纳与安命',
        '#F472B6': '婚姻与亲情',
        '#52525B': '其他文章'
    };
    var legendHtml = '';
    for (var c in legendColors) {
        legendHtml += '<div class="graph-legend-item"><span class="graph-legend-dot" style="background:' + c + '"></span>' + legendColors[c] + '</div>';
    }
    document.getElementById('graphLegend').innerHTML = legendHtml;

    // Tick
    sim.on('tick', function() {
        link.attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });
        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });

    // Resize
    window.addEventListener('resize', function() {
        width = container.clientWidth;
        svg.attr('width', width);
    });
})();

// Theme toggle
(function(){
    var theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeBtn.onclick = function() {
            theme = theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        };
    }
})();

// Search
(function(){
    if (typeof SEARCH_INDEX === 'undefined') return;
    var searchBtn = document.getElementById('searchBtn');
    var searchOverlay = document.getElementById('searchOverlay');
    var searchInput = document.getElementById('searchInput');
    var searchResults = document.getElementById('searchResults');
    if (searchBtn && searchOverlay) {
        searchBtn.onclick = function() { searchOverlay.classList.add('open'); searchInput.focus(); };
        searchOverlay.addEventListener('click', function(e) { if (e.target === searchOverlay) searchOverlay.classList.remove('open'); });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') searchOverlay.classList.remove('open');
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchOverlay.classList.add('open'); searchInput.focus(); }
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var q = searchInput.value.trim().toLowerCase();
            searchResults.innerHTML = '';
            if (!q) return;
            var hits = [];
            for (var i = 0; i < SEARCH_INDEX.length; i++) {
                var item = SEARCH_INDEX[i];
                var score = 0;
                if (item.t.toLowerCase().indexOf(q) >= 0) score += 3;
                if (item.e.toLowerCase().indexOf(q) >= 0) score += 1;
                if (score > 0) hits.push({ item: item, score: score });
            }
            hits.sort(function(a, b) { return b.score - a.score; });
            if (hits.length === 0) {
                searchResults.innerHTML = '<div class="search-empty">没有找到匹配的文章</div>';
                return;
            }
            for (var j = 0; j < Math.min(hits.length, 12); j++) {
                var h = hits[j].item;
                var div = document.createElement('div');
                div.className = 'search-result';
                div.innerHTML = '<span class="search-result-title">' + h.t + '</span><span class="search-result-excerpt">' + h.e.substring(0, 120) + '</span>';
                div.onclick = (function(url) { return function() { window.location.href = url; }; })(h.u);
                searchResults.appendChild(div);
            }
        });
    }
})();
