const express = require('express');
const dotenv  = require('dotenv');
const path    = require('path');
const { Pool } = require('pg');

// Carregar variáveis de ambiente
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Pool ─────────────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializa tabelas na primeira execução
async function initDatabase() {
    const client = await pool.connect();
    try {
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

        console.log('✅ Banco de dados inicializado com sucesso.');
    } catch (err) {
        console.error('❌ Erro ao inicializar o banco de dados:', err.message);
    } finally {
        client.release();
    }
}

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(express.json());

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
        const result = await pool.query('SELECT * FROM solucoes ORDER BY ordem ASC, criado_em ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro GET /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao buscar soluções.' });
    }
});

app.post('/api/solucoes', async (req, res) => {
    try {
        const { nome, img, descricao, ordem } = req.body;
        if (!nome || !img || !descricao) return res.status(400).json({ error: 'nome, img e descricao são obrigatórios.' });
        const result = await pool.query(
            'INSERT INTO solucoes (nome, img, descricao, ordem) VALUES ($1, $2, $3, $4) RETURNING *',
            [nome, img, descricao, ordem || 0]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erro POST /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao criar solução.' });
    }
});

app.put('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, img, descricao, ordem } = req.body;
        const result = await pool.query(
            'UPDATE solucoes SET nome=$1, img=$2, descricao=$3, ordem=$4 WHERE id=$5 RETURNING *',
            [nome, img, descricao, ordem || 0, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro PUT /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao atualizar solução.' });
    }
});

app.delete('/api/solucoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM solucoes WHERE id=$1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Solução não encontrada.' });
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/solucoes:', err);
        res.status(500).json({ error: 'Erro ao remover solução.' });
    }
});

// ─── API: Materiais (CRUD) ────────────────────────────────────────────────────
app.get('/api/materiais', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM materiais ORDER BY criado_em DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro GET /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao buscar materiais.' });
    }
});

app.post('/api/materiais', async (req, res) => {
    try {
        const { nome, imagem, descricao, locais } = req.body;
        if (!nome || !descricao) return res.status(400).json({ error: 'nome e descricao são obrigatórios.' });
        const result = await pool.query(
            'INSERT INTO materiais (nome, imagem, descricao, locais) VALUES ($1, $2, $3, $4) RETURNING *',
            [nome, imagem || null, descricao, JSON.stringify(locais || [])]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erro POST /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao criar material.' });
    }
});

app.delete('/api/materiais/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM materiais WHERE id=$1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Material não encontrado.' });
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/materiais:', err);
        res.status(500).json({ error: 'Erro ao remover material.' });
    }
});

// ─── API: Notícias (CRUD) ─────────────────────────────────────────────────────
app.get('/api/noticias', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM noticias ORDER BY data_pub DESC, criado_em DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro GET /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao buscar notícias.' });
    }
});

app.post('/api/noticias', async (req, res) => {
    try {
        const { titulo, url, resumo, data, categoria } = req.body;
        if (!titulo) return res.status(400).json({ error: 'titulo é obrigatório.' });
        const result = await pool.query(
            'INSERT INTO noticias (titulo, url, resumo, data_pub, categoria) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [titulo, url || null, resumo || null, data || null, categoria || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erro POST /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao criar notícia.' });
    }
});

app.delete('/api/noticias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM noticias WHERE id=$1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Notícia não encontrada.' });
        res.json({ success: true });
    } catch (err) {
        console.error('Erro DELETE /api/noticias:', err);
        res.status(500).json({ error: 'Erro ao remover notícia.' });
    }
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🌿 Servidor da Apex Tech Metais rodando em http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Falha crítica ao iniciar o servidor:', err);
    process.exit(1);
});
