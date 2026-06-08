document.addEventListener('DOMContentLoaded', () => {
    // --- Login Logic ---
    const loginOverlay = document.getElementById('login-overlay');
    const dashboardContainer = document.getElementById('admin-dashboard-container');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');

    // Check if already logged in (simple session storage)
    if (sessionStorage.getItem('apex_admin_logged_in') === 'true') {
        loginOverlay.style.display = 'none';
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
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ user, pass })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        sessionStorage.setItem('apex_admin_logged_in', 'true');
                        loginOverlay.style.display = 'none';
                        dashboardContainer.style.display = 'flex';
                        loginError.style.display = 'none';
                    } else {
                        loginError.style.display = 'block';
                    }
                } else {
                    loginError.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro na requisição de login:', error);
                loginError.style.display = 'block';
            }
        });
    }

    // --- Navigation ---
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

    // --- Charts ---
    const ctxLine = document.getElementById('lmeChartLine');
    if (ctxLine) {
        new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: ['1', '5', '10', '15', '20', '25', '30'],
                datasets: [{
                    label: 'Cobre (US$/t)',
                    data: [8200, 8350, 8300, 8400, 8500, 8420, 8450],
                    borderColor: '#2AD07A',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#fff' } }
                },
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
                datasets: [{
                    label: 'Volume (Toneladas)',
                    data: [1200, 1900, 800, 500],
                    backgroundColor: 'rgba(42, 208, 122, 0.7)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#fff' } }
                },
                scales: {
                    x: { ticks: { color: '#ccc' }, grid: { display: false } },
                    y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
    }

    // --- Materiais LocalStorage ---
    const form = document.getElementById('form-material');
    const listContainer = document.getElementById('materiais-list');

    function getMateriais() {
        const mats = localStorage.getItem('apex_materiais');
        return mats ? JSON.parse(mats) : [];
    }

    function saveMateriais(mats) {
        localStorage.setItem('apex_materiais', JSON.stringify(mats));
    }

    function renderMateriais() {
        const mats = getMateriais();
        listContainer.innerHTML = '';
        
        if (mats.length === 0) {
            listContainer.innerHTML = '<p style="color: #888; grid-column: 1/-1;">Nenhum material cadastrado via painel ainda.</p>';
            return;
        }

        mats.forEach(mat => {
            const div = document.createElement('div');
            div.className = 'mat-item';
            
            let locsHtml = mat.locais && mat.locais.length > 0 ? `<div style="padding:15px; padding-bottom:0;"><p style="font-size:0.8rem; color:#888;">${mat.locais.length} locais de coleta.</p></div>` : '';
            let imgHtml = mat.imagem ? `<div style="margin-bottom:12px;"><img src="${mat.imagem}" alt="${mat.nome}" style="width:100%; max-height:140px; object-fit:cover; border-radius:6px; border:1px solid rgba(42,208,122,0.2);"></div>` : '';
            
            div.innerHTML = `
                <div class="mat-content">
                    ${imgHtml}
                    <h4>${mat.nome}</h4>
                    <p>${mat.desc}</p>
                    ${locsHtml}
                    <button class="btn-delete" data-id="${mat.id}" style="margin-top:15px;"><i class="fa-solid fa-trash"></i> Remover</button>
                </div>
            `;
            listContainer.appendChild(div);
        });

        // Delete events
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.btn-delete').dataset.id;
                const newMats = getMateriais().filter(m => m.id != id);
                saveMateriais(newMats);
                renderMateriais();
                alert('Removido! Para atualizar o site, atualize a página inicial.');
            });
        });
    }

    // Dynamic Locations Logic
    const btnAddLocation = document.getElementById('btn-add-location');
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
        // add one default field
        createLocationField();
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('mat-name').value;
            const imagem = document.getElementById('mat-image').value.trim();
            const desc = document.getElementById('mat-desc').value;

            // Coletar locais
            const locais = [];
            document.querySelectorAll('.location-item').forEach(item => {
                const title = item.querySelector('.loc-title').value;
                const locDesc = item.querySelector('.loc-desc').value;
                locais.push({ titulo: title, desc: locDesc });
            });

            const newMat = {
                id: Date.now(),
                nome,
                imagem,
                desc,
                locais
            };

            const mats = getMateriais();
            mats.push(newMat);
            saveMateriais(mats);
            
            form.reset();
            locationsWrapper.innerHTML = '';
            createLocationField(); // restart with 1 field
            
            renderMateriais();
            
            alert('Material e abas cadastradas! Atualize a página inicial do site para ver a nova aba.');
        });
    }

    renderMateriais();

    // ============================================================
    // NOTÍCIAS - LocalStorage
    // ============================================================
    const formNoticia = document.getElementById('form-noticia');
    const noticiasAdminList = document.getElementById('noticias-admin-list');

    function getNoticias() {
        const raw = localStorage.getItem('apex_noticias');
        return raw ? JSON.parse(raw) : [];
    }

    function saveNoticias(items) {
        localStorage.setItem('apex_noticias', JSON.stringify(items));
    }

    function renderNoticiasAdmin() {
        if (!noticiasAdminList) return;
        const items = getNoticias();
        noticiasAdminList.innerHTML = '';

        if (items.length === 0) {
            noticiasAdminList.innerHTML = '<p style="color:#888; padding:10px 0;">Nenhuma notícia publicada ainda.</p>';
            return;
        }

        // Ordenar do mais recente
        const sorted = [...items].sort((a, b) => new Date(b.data) - new Date(a.data));

        sorted.forEach(n => {
            const div = document.createElement('div');
            div.className = 'noticia-admin-item';

            const dataFormatada = n.data
                ? new Date(n.data + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—';

            div.innerHTML = `
                <div class="noticia-admin-info">
                    ${n.categoria ? `<span class="noticia-admin-cat">${n.categoria}</span>` : ''}
                    <strong>${n.titulo}</strong>
                    <small>${dataFormatada}</small>
                    ${n.url ? `<a href="${n.url}" target="_blank" class="noticia-admin-link"><i class="fa-solid fa-external-link-alt"></i> Ver fonte</a>` : ''}
                </div>
                <button class="btn-delete btn-delete-noticia" data-id="${n.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            noticiasAdminList.appendChild(div);
        });

        // Delete events
        document.querySelectorAll('.btn-delete-noticia').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.btn-delete-noticia').dataset.id;
                if (confirm('Remover esta notícia do site?')) {
                    const updated = getNoticias().filter(n => n.id != id);
                    saveNoticias(updated);
                    renderNoticiasAdmin();
                }
            });
        });
    }

    if (formNoticia) {
        // Define data padrão como hoje
        const inputData = document.getElementById('not-data');
        if (inputData && !inputData.value) {
            inputData.value = new Date().toISOString().split('T')[0];
        }

        formNoticia.addEventListener('submit', (e) => {
            e.preventDefault();

            const titulo = document.getElementById('not-titulo').value.trim();
            const url = document.getElementById('not-url').value.trim();
            const resumo = document.getElementById('not-resumo').value.trim();
            const data = document.getElementById('not-data').value;
            const categoria = document.getElementById('not-categoria').value;

            const novaNoticia = {
                id: Date.now(),
                titulo,
                url,
                resumo,
                data,
                categoria
            };

            const items = getNoticias();
            items.push(novaNoticia);
            saveNoticias(items);

            formNoticia.reset();
            // Redefine a data para hoje após o reset
            const inputDataAfter = document.getElementById('not-data');
            if (inputDataAfter) inputDataAfter.value = new Date().toISOString().split('T')[0];

            renderNoticiasAdmin();
            alert('✅ Notícia publicada! Atualize a página inicial para ver.');
        });
    }

    renderNoticiasAdmin();
});
