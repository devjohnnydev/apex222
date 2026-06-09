document.addEventListener('DOMContentLoaded', () => {

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────────────────────────────────
    const loginOverlay        = document.getElementById('login-overlay');
    const dashboardContainer  = document.getElementById('admin-dashboard-container');
    const loginForm           = document.getElementById('admin-login-form');
    const loginError          = document.getElementById('login-error');

    if (sessionStorage.getItem('apex_admin_logged_in') === 'true') {
        loginOverlay.style.display      = 'none';
        dashboardContainer.style.display = 'flex';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('login-user').value;
            const pass = document.getElementById('login-pass').value;
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user, pass })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    sessionStorage.setItem('apex_admin_logged_in', 'true');
                    loginOverlay.style.display      = 'none';
                    dashboardContainer.style.display = 'flex';
                    loginError.style.display        = 'none';
                } else {
                    loginError.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro no login:', error);
                loginError.style.display = 'block';
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NAVEGAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const sections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(item.dataset.target).classList.add('active');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GRÁFICOS LME
    // ─────────────────────────────────────────────────────────────────────────
    const ctxLine = document.getElementById('lmeChartLine');
    if (ctxLine) {
        new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: ['1', '5', '10', '15', '20', '25', '30'],
                datasets: [{ label: 'Cobre (US$/t)', data: [8200, 8350, 8300, 8400, 8500, 8420, 8450], borderColor: '#2AD07A', tension: 0.4, fill: false }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#fff' } } },
                scales: {
                    x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
    }

    const ctxBar = document.getElementById('lmeChartBar');
    if (ctxBar) {
        new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Cobre', 'Alumínio', 'Zinco', 'Chumbo'],
                datasets: [{ label: 'Volume (Toneladas)', data: [1200, 1900, 800, 500], backgroundColor: 'rgba(42, 208, 122, 0.7)' }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#fff' } } },
                scales: {
                    x: { ticks: { color: '#ccc' }, grid: { display: false } },
                    y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
    }

    // =========================================================================
    // SOLUÇÕES — API PostgreSQL
    // =========================================================================
    const formSolucao      = document.getElementById('form-solucao');
    const solucoesAdminList = document.getElementById('solucoes-admin-list');
    const btnCancelSolucao  = document.getElementById('btn-cancel-solucao');
    const solIdInput        = document.getElementById('sol-id');
    const solTituloInput    = document.getElementById('sol-titulo');
    const solImgInput       = document.getElementById('sol-img');
    const solDescInput      = document.getElementById('sol-desc');

    async function renderSolucoesAdmin() {
        if (!solucoesAdminList) return;
        solucoesAdminList.innerHTML = '<p style="color:#888;">Carregando...</p>';
        try {
            const res   = await fetch('/api/solucoes');
            const items = await res.json();
            solucoesAdminList.innerHTML = '';

            if (!items.length) {
                solucoesAdminList.innerHTML = '<p style="color:#888; padding:10px 0;">Nenhuma solução cadastrada.</p>';
                return;
            }

            items.forEach(s => {
                const div = document.createElement('div');
                div.className = 'noticia-admin-item';
                div.style.alignItems = 'center';
                div.innerHTML = `
                    <div style="margin-right:15px;">
                        <img src="${s.img}" alt="${s.nome}" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 5px rgba(42,208,122,0.5));">
                    </div>
                    <div class="noticia-admin-info" style="flex:1;">
                        <strong>${s.nome}</strong>
                        <small style="display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${s.descricao}</small>
                    </div>
                    <div>
                        <button class="btn-primary btn-edit-solucao" data-id="${s.id}" style="padding:6px 10px;margin-right:5px;"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn-delete btn-delete-solucao" data-id="${s.id}" style="padding:6px 10px;margin-top:0;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                solucoesAdminList.appendChild(div);
            });

            document.querySelectorAll('.btn-edit-solucao').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id  = e.currentTarget.dataset.id;
                    const res = await fetch('/api/solucoes');
                    const all = await res.json();
                    const sol = all.find(s => s.id == id);
                    if (sol) {
                        solIdInput.value      = sol.id;
                        solTituloInput.value  = sol.nome;
                        solImgInput.value     = sol.img;
                        solDescInput.value    = sol.descricao;
                        btnCancelSolucao.style.display = 'inline-block';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });

            document.querySelectorAll('.btn-delete-solucao').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    if (!confirm('Remover esta solução do site?')) return;
                    await fetch(`/api/solucoes/${id}`, { method: 'DELETE' });
                    renderSolucoesAdmin();
                });
            });

        } catch (err) {
            solucoesAdminList.innerHTML = '<p style="color:#f55;">Erro ao carregar soluções.</p>';
        }
    }

    if (formSolucao) {
        formSolucao.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id       = solIdInput.value;
            const nome     = solTituloInput.value.trim();
            const img      = solImgInput.value.trim();
            const descricao = solDescInput.value.trim();

            const method = id ? 'PUT' : 'POST';
            const url    = id ? `/api/solucoes/${id}` : '/api/solucoes';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, img, descricao })
            });

            if (res.ok) {
                formSolucao.reset();
                solIdInput.value = '';
                if (btnCancelSolucao) btnCancelSolucao.style.display = 'none';
                renderSolucoesAdmin();
                alert('✅ Solução salva com sucesso!');
            } else {
                alert('❌ Erro ao salvar a solução. Tente novamente.');
            }
        });
    }

    if (btnCancelSolucao) {
        btnCancelSolucao.addEventListener('click', () => {
            formSolucao.reset();
            solIdInput.value = '';
            btnCancelSolucao.style.display = 'none';
        });
    }

    renderSolucoesAdmin();

    // =========================================================================
    // MATERIAIS — API PostgreSQL
    // =========================================================================
    const form          = document.getElementById('form-material');
    const listContainer = document.getElementById('materiais-list');

    async function renderMateriais() {
        if (!listContainer) return;
        listContainer.innerHTML = '<p style="color:#888;">Carregando...</p>';
        try {
            const res   = await fetch('/api/materiais');
            const mats  = await res.json();
            listContainer.innerHTML = '';

            if (!mats.length) {
                listContainer.innerHTML = '<p style="color:#888;grid-column:1/-1;">Nenhum material cadastrado ainda.</p>';
                return;
            }

            mats.forEach(mat => {
                const div = document.createElement('div');
                div.className = 'mat-item';
                const locsCount = mat.locais && mat.locais.length ? `<div style="padding:15px;padding-bottom:0;"><p style="font-size:0.8rem;color:#888;">${mat.locais.length} locais de coleta.</p></div>` : '';
                const imgHtml   = mat.imagem ? `<div style="margin-bottom:12px;"><img src="${mat.imagem}" alt="${mat.nome}" style="width:100%;max-height:140px;object-fit:cover;border-radius:6px;border:1px solid rgba(42,208,122,0.2);"></div>` : '';
                div.innerHTML = `
                    <div class="mat-content">
                        ${imgHtml}
                        <h4>${mat.nome}</h4>
                        <p>${mat.descricao}</p>
                        ${locsCount}
                        <button class="btn-delete" data-id="${mat.id}" style="margin-top:15px;"><i class="fa-solid fa-trash"></i> Remover</button>
                    </div>
                `;
                listContainer.appendChild(div);
            });

            document.querySelectorAll('#materiais-list .btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.closest('.btn-delete').dataset.id;
                    if (!confirm('Remover este material?')) return;
                    await fetch(`/api/materiais/${id}`, { method: 'DELETE' });
                    renderMateriais();
                });
            });

        } catch (err) {
            listContainer.innerHTML = '<p style="color:#f55;">Erro ao carregar materiais.</p>';
        }
    }

    // Lógica dos campos de locais
    const btnAddLocation  = document.getElementById('btn-add-location');
    const locationsWrapper = document.getElementById('locations-wrapper');

    function createLocationField() {
        const div = document.createElement('div');
        div.className = 'location-item';
        div.innerHTML = `
            <button type="button" class="btn-remove-loc"><i class="fa-solid fa-xmark"></i></button>
            <div class="form-group">
                <label>Título do Local (ex: Indústria)</label>
                <input type="text" class="loc-title" required placeholder="Título do card">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>Descrição do Local</label>
                <textarea class="loc-desc" rows="2" required placeholder="Descrição detalhada..."></textarea>
            </div>
        `;
        div.querySelector('.btn-remove-loc').addEventListener('click', () => div.remove());
        locationsWrapper.appendChild(div);
    }

    if (btnAddLocation) {
        btnAddLocation.addEventListener('click', createLocationField);
        createLocationField();
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome    = document.getElementById('mat-name').value;
            const imagem  = document.getElementById('mat-image').value.trim();
            const descricao = document.getElementById('mat-desc').value;

            const locais = [];
            document.querySelectorAll('.location-item').forEach(item => {
                locais.push({
                    titulo: item.querySelector('.loc-title').value,
                    desc:   item.querySelector('.loc-desc').value
                });
            });

            const res = await fetch('/api/materiais', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, imagem, descricao, locais })
            });

            if (res.ok) {
                form.reset();
                locationsWrapper.innerHTML = '';
                createLocationField();
                renderMateriais();
                alert('✅ Material cadastrado! Atualize a página inicial do site.');
            } else {
                alert('❌ Erro ao salvar material.');
            }
        });
    }

    renderMateriais();

    // =========================================================================
    // NOTÍCIAS — API PostgreSQL
    // =========================================================================
    const formNoticia       = document.getElementById('form-noticia');
    const noticiasAdminList = document.getElementById('noticias-admin-list');

    async function renderNoticiasAdmin() {
        if (!noticiasAdminList) return;
        noticiasAdminList.innerHTML = '<p style="color:#888;">Carregando...</p>';
        try {
            const res   = await fetch('/api/noticias');
            const items = await res.json();
            noticiasAdminList.innerHTML = '';

            if (!items.length) {
                noticiasAdminList.innerHTML = '<p style="color:#888;padding:10px 0;">Nenhuma notícia publicada ainda.</p>';
                return;
            }

            items.forEach(n => {
                const div = document.createElement('div');
                div.className = 'noticia-admin-item';
                const dataFormatada = n.data_pub
                    ? new Date(n.data_pub + 'T12:00:00').toLocaleDateString('pt-BR')
                    : '—';
                div.innerHTML = `
                    <div class="noticia-admin-info">
                        ${n.categoria ? `<span class="noticia-admin-cat">${n.categoria}</span>` : ''}
                        <strong>${n.titulo}</strong>
                        <small>${dataFormatada}</small>
                        ${n.url ? `<a href="${n.url}" target="_blank" class="noticia-admin-link"><i class="fa-solid fa-external-link-alt"></i> Ver fonte</a>` : ''}
                    </div>
                    <button class="btn-delete btn-delete-noticia" data-id="${n.id}"><i class="fa-solid fa-trash"></i></button>
                `;
                noticiasAdminList.appendChild(div);
            });

            document.querySelectorAll('.btn-delete-noticia').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.closest('.btn-delete-noticia').dataset.id;
                    if (!confirm('Remover esta notícia do site?')) return;
                    await fetch(`/api/noticias/${id}`, { method: 'DELETE' });
                    renderNoticiasAdmin();
                });
            });

        } catch (err) {
            noticiasAdminList.innerHTML = '<p style="color:#f55;">Erro ao carregar notícias.</p>';
        }
    }

    if (formNoticia) {
        const inputData = document.getElementById('not-data');
        if (inputData && !inputData.value) inputData.value = new Date().toISOString().split('T')[0];

        formNoticia.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titulo    = document.getElementById('not-titulo').value.trim();
            const url       = document.getElementById('not-url').value.trim();
            const resumo    = document.getElementById('not-resumo').value.trim();
            const data      = document.getElementById('not-data').value;
            const categoria = document.getElementById('not-categoria').value;

            const res = await fetch('/api/noticias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titulo, url, resumo, data, categoria })
            });

            if (res.ok) {
                formNoticia.reset();
                const inputDataAfter = document.getElementById('not-data');
                if (inputDataAfter) inputDataAfter.value = new Date().toISOString().split('T')[0];
                renderNoticiasAdmin();
                alert('✅ Notícia publicada! Atualize a página inicial para ver.');
            } else {
                alert('❌ Erro ao publicar notícia.');
            }
        });
    }

    renderNoticiasAdmin();
});
