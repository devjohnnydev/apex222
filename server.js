const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON
app.use(express.json());

// Middleware de segurança para impedir download de arquivos sensíveis
app.use((req, res, next) => {
    const blockedFiles = [
        '/.env',
        '/.env.example',
        '/package.json',
        '/package-lock.json',
        '/server.js',
        '/.gitignore',
        '/readme.md',
        '/implementation_plan.md',
        '/task.md',
        '/walkthrough.md'
    ];
    
    const requestedPath = req.path.toLowerCase();
    
    if (blockedFiles.includes(requestedPath) || requestedPath.startsWith('/.git')) {
        return res.status(403).send('Forbidden: Access is denied.');
    }
    next();
});

// Servir arquivos estáticos da pasta raiz
app.use(express.static(__dirname));

// Rota de proxy para a API do Groq
app.post('/api/chat', async (req, res) => {
    try {
        const { message, systemPrompt } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'O parâmetro message é obrigatório.' });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error('Erro: GROQ_API_KEY não configurada no servidor.');
            return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
        }

        // Fazer a chamada para o Groq (utilizando o fetch nativo do Node.js)
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
            console.error('Erro retornado pela API do Groq:', errorData);
            return res.status(response.status).json({ error: 'Erro de comunicação com o serviço de IA.' });
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Erro no proxy /api/chat:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Rota para login administrativo seguro
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

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`🌿 Servidor da Apex Tech Metais rodando com sucesso em http://localhost:${PORT}`);
});
