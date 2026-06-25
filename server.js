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

// ─── API: LME Excel Parser and Generator ─────────────────────────────────────
const { exec } = require('child_process');
const fs = require('fs');

app.get('/api/lme/excel-weeks', async (req, res) => {
    const pythonScript = path.join(__dirname, 'parse_lme.py');
    exec(`python "${pythonScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running parse_lme.py: ${error.message}`);
        }
        
        const jsonPath = path.join(__dirname, 'assets', 'excel', 'lme_parsed.json');
        fs.readFile(jsonPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading lme_parsed.json: ${err.message}`);
                return res.status(500).json({ error: 'Erro ao carregar dados do Excel.' });
            }
            try {
                const parsed = JSON.parse(data);
                res.json(parsed);
            } catch (e) {
                res.status(500).json({ error: 'Erro ao parsear dados do Excel.' });
            }
        });
    });
});

app.get('/api/lme/download-excel/:header', (req, res) => {
    const header = req.params.header.replace(/\//g, '-');
    const rawHeader = req.params.header;
    const jsonPath = path.join(__dirname, 'assets', 'excel', 'lme_parsed.json');
    const generatorScript = path.join(__dirname, 'generate_lme_excel.py');
    const tempFile = path.join(__dirname, 'assets', 'excel', `temp_report_${header}.xlsx`);
    
    exec(`python "${generatorScript}" "${jsonPath}" "${tempFile}" "${rawHeader}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error running generate_lme_excel.py: ${error.message}`);
            return res.status(500).send('Erro ao gerar planilha Excel.');
        }
        
        res.download(tempFile, `LME-Relatorio-${header}.xlsx`, (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            fs.unlink(tempFile, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
            });
        });
    });
});

// ─── API: LME (Scraping e Proxy) ──────────────────────────────────────────────
app.get('/api/lme/tabela/:mes', async (req, res) => {
    try {
        const mes = req.params.mes; // ex: 6-2026
        // Para a tabela, precisamos fazer um GET na página principal da LME com o mês selecionado
        const targetUrl = `https://shockmetais.com.br/lme/${mes}`;
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);
        
        const cotacoes = [];
        $('#boxtabela table tbody tr').each((index, element) => {
            const colunas = $(element).find('td');
            if (colunas.length > 0) {
                const dia = $(colunas[0]).text().trim();
                const cobre = $(colunas[1]).text().trim();
                const zinco = $(colunas[2]).text().trim();
                const aluminio = $(colunas[3]).text().trim();
                const chumbo = $(colunas[4]).text().trim();
                const estanho = $(colunas[5]).text().trim();
                const niquel = $(colunas[6]).text().trim();
                const dolar = $(colunas[7]).text().trim();
                
                // Pega a classe da linha para identificar se é média ou normal
                const isMedia = $(colunas[0]).hasClass('lmemedia');
                const isMensal = $(colunas[0]).hasClass('lmemensal');
                
                cotacoes.push({
                    dia, cobre, zinco, aluminio, chumbo, estanho, niquel, dolar,
                    tipo: isMensal ? 'mensal' : (isMedia ? 'semanal' : 'diaria')
                });
            }
        });

        // Buscar as opções de meses disponíveis (para preencher o select)
        const mesesDisponiveis = [];
        $('#meslme option').each((i, el) => {
            mesesDisponiveis.push({
                valor: $(el).val(),
                texto: $(el).text()
            });
        });

        res.json({ cotacoes, mesesDisponiveis });
    } catch (err) {
        console.error('Erro GET /api/lme/tabela:', err.message);
        res.status(500).json({ error: 'Erro ao buscar tabela LME.' });
    }
});

app.post('/api/lme/graflme', async (req, res) => {
    try {
        // Proxy para o gráfico
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
        // Proxy para as variações
        const response = await axios.post('https://shockmetais.com.br/lme/varialme', new URLSearchParams(req.body), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        // Retornar o HTML bruto ou JSON parseado. Retornaremos JSON parseado para ser mais flexível no frontend
        const $ = cheerio.load(response.data);
        const variaveis = [];
        
        $('.card').each((i, el) => {
            const titulo = $(el).find('.card-header').text().trim();
            const cols = $(el).find('.card-body .col-6');
            let dataAnt = '', valAnt = '', dataAtual = '', valAtual = '';
            if(cols.length >= 2) {
                dataAtual = $(cols[0]).find('small').text().trim();
                valAtual = $(cols[0]).find('b').text().trim();
                dataAnt = $(cols[1]).find('small').text().trim();
                valAnt = $(cols[1]).find('b').text().trim();
            }
            
            const footerText = $(el).find('.card-footer h3').text().trim();
            const iconClass = $(el).find('.card-footer i').attr('class') || '';
            const isPositive = footerText.includes('+') || $(el).find('.card-footer h3').hasClass('text-success') || iconClass.includes('up');
            
            variaveis.push({
                titulo,
                dataAtual,
                valAtual,
                dataAnt,
                valAnt,
                footerText,
                isPositive
            });
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
