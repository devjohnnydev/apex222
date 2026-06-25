const express = require('express');
const dotenv  = require('dotenv');
const path    = require('path');
const axios   = require('axios');
const cheerio = require('cheerio');

// Carregar variáveis de ambiente
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Pool (opcional) ──────────────────────────────────────────────
let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
}

// ─── Armazenamento em memória (fallback sem banco) ──────────────────────────
let nextId = 100;
const memStore = {
    solucoes: [
        { id: 1, nome: 'Sucatas de Indústrias',    img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/residuos-de-empresas-e-industrias.svg',  descricao: 'Nossos principais serviços incluem a gestão e comercialização de resíduos gerados por indústrias, assegurando o descarte adequado e a reciclagem responsável de materiais. Atendemos a diversos setores industriais, oferecendo soluções inovadoras e eficientes para a gestão de resíduos, com foco constante na sustentabilidade e no reaproveitamento, promovendo um ciclo ambientalmente consciente.', ordem: 1, criado_em: new Date().toISOString() },
        { id: 2, nome: 'Resíduos de Conectores',   img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/icon-residuos-de-conectores.svg',          descricao: 'Tratamos e reciclamos resíduos de conectores elétricos e eletrônicos, assegurando que esses materiais sejam reaproveitados de forma eficiente e sustentável. Nosso processo garante a máxima recuperação de metais, reduzindo o impacto ambiental e promovendo fortemente a economia circular em todos os nossos processos logísticos.', ordem: 2, criado_em: new Date().toISOString() },
        { id: 3, nome: 'Sucatas de Fios e Cabos',  img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/sucata-de-fio.svg',                         descricao: 'Especializamo-nos na compra e reciclagem de sucata de fio e cabos de todos os tipos. Transformamos resíduos em recursos reutilizáveis através de processos de separação de alta tecnologia que isolam o plástico dos metais valiosos como cobre e alumínio de maneira rápida, limpa e altamente sustentável.', ordem: 3, criado_em: new Date().toISOString() },
        { id: 4, nome: 'Resíduos e Sucatas de Obras', img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/residuos-e-sucatas-de-obras.svg',       descricao: 'Oferecemos serviços de gestão de resíduos em obras, proporcionando soluções completas e personalizadas para o setor da construção civil. Trabalhamos com planejamento de coleta programada para manter sua obra limpa, organizada e perfeitamente adequada às normas ambientais mais rigorosas de descarte.', ordem: 4, criado_em: new Date().toISOString() }
    ],
    materiais: [],
    noticias: [],
    settings: {
        show_sobre: 'true',
        show_solucoes: 'true',
        show_catalogo: 'true',
        show_onde_encontramos: 'true',
        show_cotacoes: 'true',
        show_noticias: 'true',
        show_galeria: 'true'
    },
    galeria: [
        { id: 1, url: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=800&q=80', titulo: 'Triagem de Sucata Eletrônica', ordem: 1 },
        { id: 2, url: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?auto=format&fit=crop&w=800&q=80', titulo: 'Processamento de Placas de Circuito', ordem: 2 },
        { id: 3, url: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?auto=format&fit=crop&w=800&q=80', titulo: 'Metais Nobres Separados', ordem: 3 }
    ]
};

// Inicializa tabelas na primeira execução (apenas se DB disponível)
async function initDatabase() {
    if (!pool) {
        console.log('⚠️  DATABASE_URL não configurada. Usando armazenamento em memória.');
        return;
    }
    let client;
    try {
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS solucoes (
                id        SERIAL PRIMARY KEY,
                nome      TEXT    NOT NULL,
                img       TEXT    NOT NULL,
                descricao TEXT    NOT NULL,
                ordem     INTEGER DEFAULT 0,
                criado_em TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS materiais (
                id        SERIAL PRIMARY KEY,
                nome      TEXT    NOT NULL,
                imagem    TEXT,
                descricao TEXT    NOT NULL,
                locais    JSONB   DEFAULT '[]',
                criado_em TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS noticias (
                id         SERIAL PRIMARY KEY,
                titulo     TEXT    NOT NULL,
                url        TEXT,
                resumo     TEXT,
                data_pub   DATE,
                categoria  TEXT,
                criado_em  TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS galeria (
                id        SERIAL PRIMARY KEY,
                url       TEXT NOT NULL,
                titulo    TEXT NOT NULL,
                ordem     INTEGER DEFAULT 0,
                criado_em TIMESTAMP DEFAULT NOW()
            );
        `);

        // Inserir soluções padrão se a tabela estiver vazia
        const { rowCount } = await client.query('SELECT 1 FROM solucoes LIMIT 1');
        if (rowCount === 0) {
            const defaultSolucoes = [
                { nome: 'Sucatas de Indústrias',    img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/residuos-de-empresas-e-industrias.svg',  desc: 'Nossos principais serviços incluem a gestão e comercialização de resíduos gerados por indústrias, assegurando o descarte adequado e a reciclagem responsável de materiais. Atendemos a diversos setores industriais, oferecendo soluções inovadoras e eficientes para a gestão de resíduos, com foco constante na sustentabilidade e no reaproveitamento, promovendo um ciclo ambientalmente consciente.', ordem: 1 },
                { nome: 'Resíduos de Conectores',   img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/icon-residuos-de-conectores.svg',          desc: 'Tratamos e reciclamos resíduos de conectores elétricos e eletrônicos, assegurando que esses materiais sejam reaproveitados de forma eficiente e sustentável. Nosso processo garante a máxima recuperação de metais, reduzindo o impacto ambiental e promovendo fortemente a economia circular em todos os nossos processos logísticos.', ordem: 2 },
                { nome: 'Sucatas de Fios e Cabos',  img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/sucata-de-fio.svg',                         desc: 'Especializamo-nos na compra e reciclagem de sucata de fio e cabos de todos os tipos. Transformamos resíduos em recursos reutilizáveis através de processos de separação de alta tecnologia que isolam o plástico dos metais valiosos como cobre e alumínio de maneira rápida, limpa e altamente sustentável.', ordem: 3 },
                { nome: 'Resíduos e Sucatas de Obras', img: 'https://apextechmetais.com.br/wp-content/uploads/2024/07/residuos-e-sucatas-de-obras.svg',       desc: 'Oferecemos serviços de gestão de resíduos em obras, proporcionando soluções completas e personalizadas para o setor da construção civil. Trabalhamos com planejamento de coleta programada para manter sua obra limpa, organizada e perfeitamente adequada às normas ambientais mais rigorosas de descarte.', ordem: 4 }
            ];
            for (const s of defaultSolucoes) {
                await client.query(
                    'INSERT INTO solucoes (nome, img, descricao, ordem) VALUES ($1, $2, $3, $4)',
                    [s.nome, s.img, s.desc, s.ordem]
                );
            }
            console.log('✅ Soluções padrão inseridas no banco de dados.');
        }

        // Inserir configurações padrão da home se vazia
        const { rowCount: settingsCount } = await client.query('SELECT 1 FROM settings LIMIT 1');
        if (settingsCount === 0) {
            const defaultSettings = [
                { key: 'show_sobre', value: 'true' },
                { key: 'show_solucoes', value: 'true' },
                { key: 'show_catalogo', value: 'true' },
                { key: 'show_onde_encontramos', value: 'true' },
                { key: 'show_cotacoes', value: 'true' },
                { key: 'show_noticias', value: 'true' },
                { key: 'show_galeria', value: 'true' }
            ];
            for (const s of defaultSettings) {
                await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [s.key, s.value]);
            }
            console.log('✅ Configurações padrão da home inseridas no banco de dados.');
        }

        dbAvailable = true;
        console.log('✅ Banco de dados inicializado com sucesso.');
    } catch (err) {
        console.warn('⚠️  Banco de dados indisponível. Usando armazenamento em memória.', err.message);
        dbAvailable = false;
    } finally {
        if (client) client.release();
    }
}

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Segurança: bloqueia acesso a arquivos sensíveis
app.use((req, res, next) => {
    const blockedFiles = [
        '/.env', '/.env.example', '/package.json', '/package-lock.json',
        '/server.js', '/.gitignore', '/readme.md',
        '/implementation_plan.md', '/task.md', '/walkthrough.md'
    ];
    const requestedPath = req.path.toLowerCase();
    if (blockedFiles.includes(requestedPath) || requestedPath.startsWith('/.git')) {
        return res.status(403).send('Forbidden: Access is denied.');
    }
    next();
});

// ─── Arquivos Estáticos ───────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ─── API: Login ───────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    try {
        const { user, pass } = req.body;
        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD || 'apex2026';

        if (user === adminUser && pass === adminPass) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, error: 'Usuário ou senha inválidos.' });
        }
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ─── API: Groq Chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;
        if (!message) return res.status(400).json({ error: 'O parâmetro message é obrigatório.' });

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt || 'Você é o assistente virtual da Apex Tech Metais.' },
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 250
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Erro Groq:', errorData);
            return res.status(response.status).json({ error: 'Erro de comunicação com o serviço de IA.' });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erro no proxy /api/chat:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// ─── API: Soluções (CRUD) ─────────────────────────────────────────────────────
app.get('/api/solucoes', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM solucoes ORDER BY ordem ASC, criado_em ASC');
            return res.json(result.rows);
        }
        res.json([...memStore.solucoes].sort((a, b) => a.ordem - b.ordem));
    } catch (err) {
        console.error('Erro GET /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao buscar soluções.' });
    }
});

app.post('/api/solucoes', async (req, res) => {
    try {
        const { nome, img, descricao, ordem } = req.body;
        if (!nome || !img || !descricao) return res.status(400).json({ error: 'nome, img e descricao são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO solucoes (nome, img, descricao, ordem) VALUES ($1, $2, $3, $4) RETURNING *',
                [nome, img, descricao, ordem || 0]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, nome, img, descricao, ordem: ordem || 0, criado_em: new Date().toISOString() };
        memStore.solucoes.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao criar solução.' });
    }
});

app.put('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, img, descricao, ordem } = req.body;
        if (dbAvailable) {
            const result = await pool.query(
                'UPDATE solucoes SET nome=$1, img=$2, descricao=$3, ordem=$4 WHERE id=$5 RETURNING *',
                [nome, img, descricao, ordem || 0, id]
            );
            if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
            return res.json(result.rows[0]);
        }
        const idx = memStore.solucoes.findIndex(s => s.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Solução não encontrada.' });
        Object.assign(memStore.solucoes[idx], { nome, img, descricao, ordem: ordem || 0 });
        res.json(memStore.solucoes[idx]);
    } catch (err) {
        console.error('Erro PUT /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao atualizar solução.' });
    }
});

app.delete('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM solucoes WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.solucoes.findIndex(s => s.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Solução não encontrada.' });
        memStore.solucoes.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao remover solução.' });
    }
});

// ─── API: Materiais (CRUD) ────────────────────────────────────────────────────
app.get('/api/materiais', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM materiais ORDER BY criado_em DESC');
            return res.json(result.rows);
        }
        res.json([...memStore.materiais]);
    } catch (err) {
        console.error('Erro GET /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao buscar materiais.' });
    }
});

app.post('/api/materiais', async (req, res) => {
    try {
        const { nome, imagem, descricao, locais } = req.body;
        if (!nome || !descricao) return res.status(400).json({ error: 'nome e descricao são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO materiais (nome, imagem, descricao, locais) VALUES ($1, $2, $3, $4) RETURNING *',
                [nome, imagem || null, descricao, JSON.stringify(locais || [])]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, nome, imagem: imagem || null, descricao, locais: locais || [], criado_em: new Date().toISOString() };
        memStore.materiais.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao criar material.' });
    }
});

app.delete('/api/materiais/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM materiais WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Material não encontrado.' });
            return res.json({ success: true });
        }
        const idx = memStore.materiais.findIndex(m => m.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Material não encontrado.' });
        memStore.materiais.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao remover material.' });
    }
});

// ─── API: Notícias (CRUD) ─────────────────────────────────────────────────────
app.get('/api/noticias', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM noticias ORDER BY data_pub DESC, criado_em DESC');
            return res.json(result.rows);
        }
        res.json([...memStore.noticias]);
    } catch (err) {
        console.error('Erro GET /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao buscar notícias.' });
    }
});

app.post('/api/noticias', async (req, res) => {
    try {
        const { titulo, url, resumo, data, categoria } = req.body;
        if (!titulo) return res.status(400).json({ error: 'titulo é obrigatório.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO noticias (titulo, url, resumo, data_pub, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [titulo, url || null, resumo || null, data || null, categoria || null]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, titulo, url: url || null, resumo: resumo || null, data_pub: data || null, categoria: categoria || null, criado_em: new Date().toISOString() };
        memStore.noticias.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao criar notícia.' });
    }
});

app.delete('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM noticias WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Notícia não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.noticias.findIndex(n => n.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Notícia não encontrada.' });
        memStore.noticias.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao remover notícia.' });
    }
});

// ─── API: Configurações da Home ──────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM settings');
            const settingsObj = {};
            result.rows.forEach(row => {
                settingsObj[row.key] = row.value;
            });
            return res.json(settingsObj);
        }
        res.json(memStore.settings);
    } catch (err) {
        console.error('Erro GET /api/settings:', err);
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

app.put('/api/settings', async (req, res) => {
    try {
        const settings = req.body;
        if (dbAvailable) {
            for (const [key, value] of Object.entries(settings)) {
                await pool.query(
                    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                    [key, String(value)]
                );
            }
            return res.json({ success: true });
        }
        Object.assign(memStore.settings, settings);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro PUT /api/settings:', err);
        res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
});

// ─── API: Galeria de Fotos ───────────────────────────────────────────────────
app.get('/api/galeria', async (req, res) => {
    try {
        if (dbAvailable) {
            const result = await pool.query('SELECT * FROM galeria ORDER BY ordem ASC, criado_em DESC');
            return res.json(result.rows);
        }
        const list = [...memStore.galeria].sort((a, b) => a.ordem - b.ordem);
        res.json(list);
    } catch (err) {
        console.error('Erro GET /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao buscar galeria.' });
    }
});

app.post('/api/galeria', async (req, res) => {
    try {
        const { url, titulo, ordem } = req.body;
        if (!url || !titulo) return res.status(400).json({ error: 'url e titulo são obrigatórios.' });
        if (dbAvailable) {
            const result = await pool.query(
                'INSERT INTO galeria (url, titulo, ordem) VALUES ($1, $2, $3) RETURNING *',
                [url, titulo, ordem || 0]
            );
            return res.status(201).json(result.rows[0]);
        }
        const item = { id: nextId++, url, titulo, ordem: ordem || 0, criado_em: new Date().toISOString() };
        memStore.galeria.push(item);
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro POST /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao adicionar imagem à galeria.' });
    }
});

app.delete('/api/galeria/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (dbAvailable) {
            const result = await pool.query('DELETE FROM galeria WHERE id=$1', [id]);
            if (result.rowCount === 0) return res.status(404).json({ error: 'Imagem não encontrada.' });
            return res.json({ success: true });
        }
        const idx = memStore.galeria.findIndex(g => g.id == id);
        if (idx === -1) return res.status(404).json({ error: 'Imagem não encontrada.' });
        memStore.galeria.splice(idx, 1);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/galeria:', err);
        res.status(500).json({ error: 'Erro ao remover imagem da galeria.' });
    }
});

// ─── API: LME Relatório Semanal (sem planilha, cálculo automático) ─────────────
// Busca dados da LME via scraping, agrupa por semana e calcula todas as métricas

function parseNum(str) {
    if (!str || str.trim() === '' || str.trim() === '-') return null;
    // Remove R$, %, espaços; troca vírgula decimal
    let s = str.replace(/R\$\s*/g, '').replace(/%/g, '').trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
}

const mesMapLME = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
};

function parseDate(diaStr, currentYearStr) {
    if (!diaStr) return null;
    
    // Formato: "27/Abr"
    const parts = diaStr.split('/');
    if (parts.length === 2) {
        const d = parseInt(parts[0], 10);
        const mStr = parts[1].toLowerCase();
        let m = mesMapLME[mStr];
        if (m === undefined) return null;
        
        // Determina o ano. Se currentYearStr não for passado, usa o atual.
        let y = currentYearStr ? parseInt(currentYearStr, 10) : new Date().getFullYear();
        // Nota: O site pode ter 'Dez' no relatório de 'Jan/2026'.
        // Trataremos isso comparando se m=11 e o mês do relatório é 0.
        return new Date(y, m, d);
    }
    
    // Formato antigo: "dd/mm/yyyy"
    if (parts.length >= 3) {
        let [d, m, y] = parts.map(Number);
        if (y < 100) y += 2000;
        return new Date(y, m - 1, d);
    }
    return null;
}

function weekKey(dateObj) {
    // Semana começa na segunda-feira — retorna "YYYY-Www"
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
    const year = d.getFullYear();
    const start = new Date(year, 0, 1);
    const weekNum = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function avg(arr) {
    const valid = arr.filter(v => v !== null && v !== undefined);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

app.get('/api/lme/relatorio-semanal', async (req, res) => {
    try {
        const mes = req.query.mes; // ex: "6-2026"
        if (!mes) return res.status(400).json({ error: 'Parâmetro mes obrigatório. Ex: ?mes=6-2026' });

        // 1. Busca dados do mês atual
        const targetUrl = `https://shockmetais.com.br/lme/${mes}`;
        const { data: html } = await axios.get(targetUrl, { timeout: 15000 });
        const $ = cheerio.load(html);

        // 2. Extrai opções de meses disponíveis
        const mesesDisponiveis = [];
        $('#meslme option').each((i, el) => {
            mesesDisponiveis.push({ valor: $(el).val(), texto: $(el).text().trim() });
        });

        const reqYear = mes.split('-')[1];

        // 3. Extrai linhas diárias
        const dailyRows = [];
        $('#boxtabela table tbody tr').each((i, el) => {
            const tds = $(el).find('td');
            if (tds.length < 8) return;
            const isMedia   = $(tds[0]).hasClass('lmemedia');
            const isMensal  = $(tds[0]).hasClass('lmemensal');
            if (isMedia || isMensal) return; // pula médias do site externo

            const diaStr = $(tds[0]).text().trim();
            const dateObj = parseDate(diaStr, reqYear);
            if (!dateObj) return;

            dailyRows.push({
                data:     diaStr,
                dateObj,
                cobre:    parseNum($(tds[1]).text()),
                zinco:    parseNum($(tds[2]).text()),
                aluminio: parseNum($(tds[3]).text()),
                chumbo:   parseNum($(tds[4]).text()),
                estanho:  parseNum($(tds[5]).text()),
                niquel:   parseNum($(tds[6]).text()),
                dolar:    parseNum($(tds[7]).text()),
            });
        });

        const METALS = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel'];

        // 4. Agrupa por semana
        const weekMap = new Map();
        dailyRows.forEach(row => {
            const wk = weekKey(row.dateObj);
            if (!weekMap.has(wk)) weekMap.set(wk, []);
            weekMap.get(wk).push(row);
        });

        // 5. Calcula média mensal de 100% LME (para usar em cada semana)
        // Calcula todas as semanas primeiro para ter a média mensal
        const allWeekLME = {}; // wk -> {metal: valor100pct}
        weekMap.forEach((days, wk) => {
            const entry = {};
            METALS.forEach(m => {
                const mediaMetal = avg(days.map(d => d[m]));
                const mediaDolar = avg(days.map(d => d.dolar));
                entry[m] = (mediaMetal !== null && mediaDolar !== null)
                    ? (mediaMetal * mediaDolar) / 1000 : null;
            });
            entry.dolar = avg(days.map(d => d.dolar));
            allWeekLME[wk] = entry;
        });

        // Média mensal de 100% LME por metal
        const mediaMensalLME = {};
        METALS.forEach(m => {
            const vals = Object.values(allWeekLME).map(e => e[m]).filter(v => v !== null);
            mediaMensalLME[m] = vals.length ? avg(vals) : null;
        });
        mediaMensalLME.dolar = avg(dailyRows.map(d => d.dolar).filter(v => v !== null));

        // 6. Monta blocos semanais com todos os cálculos
        const sortedWeekKeys = [...weekMap.keys()].sort();
        const weekBlocks = sortedWeekKeys.map((wk, idx) => {
            const days = weekMap.get(wk);
            const prevWk = idx > 0 ? sortedWeekKeys[idx - 1] : null;
            const prevLME = prevWk ? allWeekLME[prevWk] : null;
            const prevPrevWk = idx > 1 ? sortedWeekKeys[idx - 2] : null;

            // Médias semanais
            const mediaSemanal = {};
            METALS.forEach(m => { mediaSemanal[m] = avg(days.map(d => d[m])); });
            mediaSemanal.dolar = avg(days.map(d => d.dolar));

            // 100% LME = (média_metal * média_dolar) / 1000
            const lme100 = {};
            METALS.forEach(m => {
                lme100[m] = (mediaSemanal[m] !== null && mediaSemanal.dolar !== null)
                    ? (mediaSemanal[m] * mediaSemanal.dolar) / 1000 : null;
            });
            lme100.dolar = mediaSemanal.dolar;

            // SEMANA ANTERIOR = 100% LME da semana anterior
            const semanaAnterior = {};
            METALS.forEach(m => { semanaAnterior[m] = prevLME ? prevLME[m] : null; });
            semanaAnterior.dolar = prevLME ? prevLME.dolar : null;

            // OSCILAÇÃO R$ = 100% LME - SEMANA ANTERIOR
            const oscRS = {};
            METALS.forEach(m => {
                oscRS[m] = (lme100[m] !== null && semanaAnterior[m] !== null)
                    ? lme100[m] - semanaAnterior[m] : null;
            });
            oscRS.dolar = (lme100.dolar !== null && semanaAnterior.dolar !== null)
                ? lme100.dolar - semanaAnterior.dolar : null;

            // OSCILAÇÃO % = oscRS / semanaAnterior
            const oscPct = {};
            METALS.forEach(m => {
                oscPct[m] = (oscRS[m] !== null && semanaAnterior[m] !== null && semanaAnterior[m] !== 0)
                    ? oscRS[m] / semanaAnterior[m] : null;
            });
            oscPct.dolar = (oscRS.dolar !== null && semanaAnterior.dolar !== null && semanaAnterior.dolar !== 0)
                ? oscRS.dolar / semanaAnterior.dolar : null;

            // FECHAMENTO % (SEMANA ANTERIOR) = OSCILAÇÃO % da semana anterior
            const fechamentoPct = {};
            if (prevPrevWk) {
                const prevPrevLME = allWeekLME[prevPrevWk];
                METALS.forEach(m => {
                    const osc = (prevLME && prevPrevLME && prevLME[m] !== null && prevPrevLME[m] !== null && prevPrevLME[m] !== 0)
                        ? (prevLME[m] - prevPrevLME[m]) / prevPrevLME[m] : null;
                    fechamentoPct[m] = osc;
                });
                fechamentoPct.dolar = (prevLME && prevPrevLME && prevLME.dolar !== null && prevPrevLME.dolar !== null && prevPrevLME.dolar !== 0)
                    ? (prevLME.dolar - prevPrevLME.dolar) / prevPrevLME.dolar : null;
            } else {
                [...METALS, 'dolar'].forEach(m => { fechamentoPct[m] = null; });
            }

            // Formata dias para exibição (pad até 5 dias)
            const daysDisplay = [];
            for (let i = 0; i < 5; i++) {
                daysDisplay.push(days[i] ? {
                    data:     days[i].data,
                    cobre:    days[i].cobre,
                    zinco:    days[i].zinco,
                    aluminio: days[i].aluminio,
                    chumbo:   days[i].chumbo,
                    estanho:  days[i].estanho,
                    niquel:   days[i].niquel,
                    dolar:    days[i].dolar,
                } : { data: '—', cobre: null, zinco: null, aluminio: null, chumbo: null, estanho: null, niquel: null, dolar: null });
            }

            const firstDate = days[0].data;
            const lastDate  = days[days.length - 1].data;

            return {
                weekKey: wk,
                header:  firstDate,
                lastDay: lastDate,
                label:   `${firstDate} → ${lastDate}`,
                days:    daysDisplay,
                computed: {
                    'MEDIA SEMANAL':                    mediaSemanal,
                    '100% LME':                         lme100,
                    'SEMANA ANTERIOR':                  semanaAnterior,
                    'FECHAMENTO % ( SEMANA ANTERIOR )': fechamentoPct,
                    'OSCILAÇÃO %':                      oscPct,
                    'OSCILAÇÃO R$':                     oscRS,
                    'MEDIA MENSAL':                     mediaMensalLME,
                }
            };
        });

        res.json({ semanas: weekBlocks.reverse(), mesesDisponiveis });
    } catch (err) {
        console.error('Erro GET /api/lme/relatorio-semanal:', err.message);
        res.status(500).json({ error: 'Erro ao gerar relatório semanal LME: ' + err.message });
    }
});

// ─── API: LME Meses Disponíveis ───────────────────────────────────────────────
app.get('/api/lme/meses', async (req, res) => {
    try {
        const { data: html } = await axios.get(`https://shockmetais.com.br/lme/`, { timeout: 10000 });
        const $ = cheerio.load(html);
        const meses = [];
        $('#meslme option').each((i, el) => {
            meses.push({ valor: $(el).val(), texto: $(el).text().trim() });
        });
        res.json(meses);
    } catch (err) {
        console.error('Erro GET /api/lme/meses:', err.message);
        res.status(500).json({ error: 'Erro ao buscar meses LME.' });
    }
});

// ─── API: LME Gerar Excel (Node.js / ExcelJS — sem Python) ───────────────────
app.post('/api/lme/gerar-excel', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const { semana, mesLabel } = req.body;
        if (!semana) return res.status(400).json({ error: 'Dados da semana obrigatórios.' });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'ApexTech Metais';
        const ws = wb.addWorksheet('TABELA LME', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

        // ── Estilos ──
        const METALS = ['cobre', 'zinco', 'aluminio', 'chumbo', 'estanho', 'niquel', 'dolar'];
        const METAL_LABELS = ['COBRE', 'ZINCO', 'ALUMÍNIO', 'CHUMBO', 'ESTANHO', 'NÍQUEL', 'DÓLAR'];
        const HDR_COLORS   = ['FF0000', 'E6B8B7', 'A6A6A6', 'D9D9D9', 'B5B059', 'FFFFFF', '70AD47'];

        const fontBase = { name: 'Calibri', size: 11 };
        const bold = { ...fontBase, bold: true };
        const boldWhite = { ...bold, color: { argb: 'FFFFFFFF' } };
        const centerAlign = { horizontal: 'center', vertical: 'middle' };
        const leftAlign   = { horizontal: 'left',   vertical: 'middle' };

        const thin = { style: 'thin', color: { argb: 'FF000000' } };
        const border = { top: thin, bottom: thin, left: thin, right: thin };

        function fill(hex)  { return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } }; }

        // ── Widths ──
        ws.getColumn(1).width = 3;
        ws.getColumn(2).width = 36;
        METALS.forEach((_, i) => { ws.getColumn(i + 3).width = 17; });

        // ── Título ──
        ws.mergeCells('B1:I1');
        const titleCell = ws.getCell('B1');
        const labelFull = `COTACAO VALIDA PARA A SEMANA: ${semana.label || semana.header}`.toUpperCase();
        titleCell.value = labelFull;
        titleCell.font  = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
        titleCell.fill  = fill('FFFF00');
        titleCell.alignment = centerAlign;
        titleCell.border = border;
        ws.getRow(1).height = 30;

        ws.getRow(2).height = 10; // Espaço
        
        // ── Cabeçalho da Tabela (linha 3) ──
        ws.getRow(3).height = 20;
        const hdrRow = ws.getRow(3);
        hdrRow.getCell(2).value = 'DATA';
        hdrRow.getCell(2).fill  = fill('000000');
        hdrRow.getCell(2).font  = boldWhite;
        hdrRow.getCell(2).alignment = centerAlign;
        hdrRow.getCell(2).border = border;

        METALS.forEach((_, i) => {
            const c = hdrRow.getCell(i + 3);
            c.value     = METAL_LABELS[i];
            c.fill      = fill(HDR_COLORS[i]);
            c.font      = bold;
            c.alignment = centerAlign;
            c.border    = border;
        });

        // ── Dias (linhas 4–8) ──
        const days = semana.days || [];
        for (let i = 0; i < 5; i++) {
            const rowNum = 4 + i;
            ws.getRow(rowNum).height = 18;
            const r = ws.getRow(rowNum);
            const day = days[i] || {};
            r.getCell(2).value     = day.data || '—';
            r.getCell(2).font      = bold;
            r.getCell(2).alignment = centerAlign;
            r.getCell(2).border    = border;

            METALS.forEach((m, mi) => {
                const c = r.getCell(mi + 3);
                const v = day[m];
                c.value     = (v !== null && v !== undefined) ? v : '—';
                c.font      = fontBase;
                c.alignment = centerAlign;
                c.border    = border;
                if (typeof v === 'number') {
                    c.numFmt = m === 'dolar' ? '0.0000' : 'R$ #,##0.00';
                }
            });
        }
        
        ws.getRow(9).height = 10; // Espaço

        // ── Linhas Computadas (10–19) ──
        const comp = semana.computed || {};
        const COMP_ROWS = [
            { lbl: 'MEDIA SEMANAL',                   key: 'MEDIA SEMANAL',                    bg: 'E7E6E6', lblFont: bold, fmt: 'R$ #,##0.00',   dolFmt: 'R$ 0.0000'    },
            { space: true },
            { lbl: '100% LME',                        key: '100% LME',                         bg: 'FFFF00', lblFont: bold, fmt: 'R$ #,##0.00', dolFmt: 'R$ 0.0000'   },
            { space: true },
            { lbl: 'SEMANA ANTERIOR',                 key: 'SEMANA ANTERIOR',                  bg: '000000', lblFont: boldWhite, fmt: 'R$ #,##0.00', dolFmt: 'R$ #,##0.0000' },
            { lbl: 'FECHAMENTO % ( SEMANA ANTERIOR )',  key: 'FECHAMENTO % ( SEMANA ANTERIOR )', bg: 'FFFFFF', lblFont: { ...bold, color: {argb:'FF00B050'} }, fmt: '0.00%', dolFmt: '0.00%'    },
            { space: true },
            { lbl: 'OSCILAÇÃO %',                     key: 'OSCILAÇÃO %',                      bg: '00B0F0', lblFont: bold, fmt: '0.00%',      dolFmt: '0.00%'    },
            { space: true },
            { lbl: 'OSCILAÇÃO R$',                    key: 'OSCILAÇÃO R$',                     bg: 'E2EFDA', lblFont: bold, fmt: 'R$ #,##0.0000', dolFmt: 'R$ #,##0.0000' },
            { space: true },
            { lbl: 'MEDIA MENSAL',                    key: 'MEDIA MENSAL',                     bg: 'A6A6A6', lblFont: bold, fmt: 'R$ #,##0.00',  dolFmt: 'R$ #,##0.00' },
        ];

        let curRow = 10;
        COMP_ROWS.forEach((row) => {
            if (row.space) {
                ws.getRow(curRow).height = 8;
                curRow++;
                return;
            }
            ws.getRow(curRow).height = 20;
            const r = ws.getRow(curRow);
            r.getCell(2).value     = row.lbl;
            r.getCell(2).font      = row.lblFont;
            r.getCell(2).fill      = fill(row.bg);
            r.getCell(2).alignment = centerAlign;
            r.getCell(2).border    = border;

            const vals = comp[row.key] || {};
            METALS.forEach((m, mi) => {
                const c  = r.getCell(mi + 3);
                const v  = vals[m];
                c.fill      = fill(row.bg);
                c.font      = bold;
                c.alignment = centerAlign;
                c.border    = border;
                
                if (row.key === 'FECHAMENTO % ( SEMANA ANTERIOR )' || row.key === 'OSCILAÇÃO %' || row.key === 'OSCILAÇÃO R$') {
                    if (v !== null && v !== undefined) {
                        c.font = { ...bold, color: { argb: v >= 0 ? 'FF00B050' : 'FFFF0000' } };
                    }
                }
                
                if (row.key === 'OSCILAÇÃO R$' && v !== null && v !== undefined) {
                    const arrow = v >= 0 ? '⬆ ' : '⬇ ';
                    const pre = 'R$ ';
                    c.value = `${arrow}${v < 0 ? '-' : ''}${pre}${Math.abs(v).toFixed(4).replace('.', ',')}`;
                    c.numFmt = '@'; 
                } else if (v !== null && v !== undefined) {
                    c.value  = v;
                    c.numFmt = m === 'dolar' ? row.dolFmt : row.fmt;
                } else {
                    c.value = '—';
                }
            });
            curRow++;
        });

        // ── Tabela Resumo ──
        curRow += 2;
        ws.getRow(curRow).height = 20;
        const sumHdr = ws.getRow(curRow);
        sumHdr.getCell(2).value = 'TIPO';
        sumHdr.getCell(2).fill  = fill('A6A6A6');
        sumHdr.getCell(2).font  = bold;
        sumHdr.getCell(2).alignment = centerAlign;
        sumHdr.getCell(2).border = border;
        METALS.forEach((_, i) => {
            const c = sumHdr.getCell(i + 3);
            c.value     = METAL_LABELS[i];
            c.fill      = fill('A6A6A6');
            c.font      = bold;
            c.alignment = centerAlign;
            c.border    = border;
        });

        const SUMMARY_ROWS = [
            { lbl: 'SEMANA ANTERIOR', key: 'SEMANA ANTERIOR', fmt: 'R$ #,##0.00', dolFmt: '0.00', bg: 'D9E1F2' },
            { lbl: 'LME ATUAL',       key: '100% LME',        fmt: 'R$ #,##0.00', dolFmt: '0.00', bg: 'FFF2CC' },
        ];
        curRow++;
        SUMMARY_ROWS.forEach((row) => {
            ws.getRow(curRow).height = 20;
            const r = ws.getRow(curRow);
            r.getCell(2).value     = row.lbl;
            r.getCell(2).font      = { ...fontBase, italic: true };
            r.getCell(2).fill      = fill(row.bg);
            r.getCell(2).alignment = leftAlign;
            r.getCell(2).border    = border;
            const vals = comp[row.key] || {};
            METALS.forEach((m, mi) => {
                const c = r.getCell(mi + 3);
                const v = vals[m];
                c.fill      = fill(row.bg);
                c.font      = fontBase;
                c.alignment = centerAlign;
                c.border    = border;
                if (v !== null && v !== undefined) {
                    c.value  = v;
                    c.numFmt = m === 'dolar' ? row.dolFmt : row.fmt;
                } else {
                    c.value = '—';
                }
            });
            curRow++;
        });

        // ── Linha Oscilação com setas (Bottom table) ──
        ws.getRow(curRow).height = 20;
        const oscRow = ws.getRow(curRow);
        oscRow.getCell(2).value     = 'Osilacao';
        oscRow.getCell(2).font      = { ...bold, italic: true };
        oscRow.getCell(2).alignment = leftAlign;
        oscRow.getCell(2).border    = border;

        const oscVals = comp['OSCILAÇÃO R$'] || {};
        METALS.forEach((m, mi) => {
            const c = oscRow.getCell(mi + 3);
            const v = oscVals[m];
            c.alignment = centerAlign;
            c.border    = border;
            if (v !== null && v !== undefined) {
                const arrow = v >= 0 ? '⬆' : '⬇';
                const colorHex = v >= 0 ? 'FF00B050' : 'FFFF0000';
                const prefix = 'R$ ';
                c.value = `${arrow} ${v < 0 ? '-' : ''}${prefix}${Math.abs(v).toFixed(2).replace('.', ',')}`;
                c.font  = { ...bold, color: { argb: colorHex } };
            } else {
                c.value = '—';
                c.font  = fontBase;
            }
        });

        // ── Gera buffer e envia ──
        const safeName = (semana.header || 'semana').replace(/\//g, '-');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="LME-ApexTech-${safeName}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Erro POST /api/lme/gerar-excel:', err.message);
        res.status(500).json({ error: 'Erro ao gerar Excel: ' + err.message });
    }
});

// ─── API: LME (Scraping e Proxy — mantido para dashboard existente) ────────────
app.get('/api/lme/tabela/:mes', async (req, res) => {
    try {
        const mes = req.params.mes;
        const targetUrl = `https://shockmetais.com.br/lme/${mes}`;
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);
        
        const cotacoes = [];
        $('#boxtabela table tbody tr').each((index, element) => {
            const colunas = $(element).find('td');
            if (colunas.length > 0) {
                const dia      = $(colunas[0]).text().trim();
                const cobre    = $(colunas[1]).text().trim();
                const zinco    = $(colunas[2]).text().trim();
                const aluminio = $(colunas[3]).text().trim();
                const chumbo   = $(colunas[4]).text().trim();
                const estanho  = $(colunas[5]).text().trim();
                const niquel   = $(colunas[6]).text().trim();
                const dolar    = $(colunas[7]).text().trim();
                const isMedia  = $(colunas[0]).hasClass('lmemedia');
                const isMensal = $(colunas[0]).hasClass('lmemensal');
                cotacoes.push({ dia, cobre, zinco, aluminio, chumbo, estanho, niquel, dolar,
                    tipo: isMensal ? 'mensal' : (isMedia ? 'semanal' : 'diaria') });
            }
        });

        const mesesDisponiveis = [];
        $('#meslme option').each((i, el) => {
            mesesDisponiveis.push({ valor: $(el).val(), texto: $(el).text() });
        });

        res.json({ cotacoes, mesesDisponiveis });
    } catch (err) {
        console.error('Erro GET /api/lme/tabela:', err.message);
        res.status(500).json({ error: 'Erro ao buscar tabela LME.' });
    }
});

app.post('/api/lme/graflme', async (req, res) => {
    try {
        const response = await axios.post('https://shockmetais.com.br/lme/graflme', new URLSearchParams(req.body), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        res.json(response.data);
    } catch (err) {
        console.error('Erro POST /api/lme/graflme:', err.message);
        res.status(500).json({ error: 'Erro ao buscar gráfico LME.' });
    }
});

app.post('/api/lme/varialme', async (req, res) => {
    try {
        const response = await axios.post('https://shockmetais.com.br/lme/varialme', new URLSearchParams(req.body), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const $ = cheerio.load(response.data);
        const variaveis = [];
        $('.card').each((i, el) => {
            const titulo = $(el).find('.card-header').text().trim();
            const cols = $(el).find('.card-body .col-6');
            let dataAnt = '', valAnt = '', dataAtual = '', valAtual = '';
            if (cols.length >= 2) {
                dataAtual = $(cols[0]).find('small').text().trim();
                valAtual  = $(cols[0]).find('b').text().trim();
                dataAnt   = $(cols[1]).find('small').text().trim();
                valAnt    = $(cols[1]).find('b').text().trim();
            }
            const footerText = $(el).find('.card-footer h3').text().trim();
            const iconClass  = $(el).find('.card-footer i').attr('class') || '';
            const isPositive = footerText.includes('+') || $(el).find('.card-footer h3').hasClass('text-success') || iconClass.includes('up');
            variaveis.push({ titulo, dataAtual, valAtual, dataAnt, valAnt, footerText, isPositive });
        });
        res.json({ html: response.data, parsed: variaveis });
    } catch (err) {
        console.error('Erro POST /api/lme/varialme:', err.message);
        res.status(500).json({ error: 'Erro ao buscar variações LME.' });
    }
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🌿 Servidor da Apex Tech Metais rodando em http://localhost:${PORT}`);
        console.log(`📦 Modo de dados: ${dbAvailable ? 'PostgreSQL' : 'Memória (local)'}`);
    });
});
